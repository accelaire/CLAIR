// =============================================================================
// Textes du Sénat et dossier de leurs amendements
// =============================================================================
//
// `textes_senat` recopie la description des textes que publie AMELI (session de
// dépôt, numéro, signet du dossier DOSLEG). Elle sert à deux choses :
//
//  - rattacher chaque amendement du Sénat au dossier de son texte, en
//    RÉÉCRIVANT tout lien qui diffère, comme à l'Assemblée où « la source fait
//    foi » (linkAmendementsToDossiersByTexteRef) ;
//  - retrouver le bon texte d'un lien `/amendements/{session}/{texte}/…` lu sur
//    la page d'un scrutin (enrichScrutinsSenatAmendements).
//
// Voir utils/textes-senat-sql.ts pour l'incident qui l'a motivée.
// =============================================================================

import { Prisma, PrismaClient } from '@prisma/client';
import type { TexteSenatAmeli } from '../sources/senat/amendements-client';
import { logger } from '../utils/logger';
import { differencier, tranches } from '../utils/synchro-differentielle';
import { CTE_DOSSIER_DU_TEXTE_SENAT } from '../utils/textes-senat-db';
import {
  AMENDEMENTS_SENAT_AVANT_SESSION_DU_DOSSIER_SQL,
  AMENDEMENTS_SENAT_HORS_DOSSIER_DU_TEXTE_SQL,
  LIENS_SENAT_APRES_LE_VOTE_SQL,
  LIENS_SENAT_HORS_DOSSIER_DU_TEXTE_SQL,
} from '../utils/textes-senat-sql';

// Créé au premier usage : `sync.ts` importe ce module, et les tests qui
// importent `sync.ts` n'ont pas à démarrer un moteur Prisma de plus.
let client: PrismaClient | undefined;
const db = (): PrismaClient => (client ??= new PrismaClient());

/**
 * AMELI décrit ~9 000 textes depuis 2001. Un dump qui en donne beaucoup moins
 * est tronqué ou mal lu : on n'écrit rien plutôt qu'une table partielle.
 */
const TEXTES_SENAT_MINIMUM = 5000;

/** Amendements réécrits par instruction (rattacherAmendementsSenatAuDossierDuTexte). */
const TAILLE_LOT_RATTACHEMENT = 1000;

interface LigneTexteSenat {
  texteRef: string;
  sessionDepot: number;
  sessionInscription: number;
  numero: string;
  signet: string | null;
  type: string | null;
  intitule: string | null;
}

const CHAMPS: readonly (keyof LigneTexteSenat & string)[] = [
  'sessionDepot', 'sessionInscription', 'numero', 'signet', 'type', 'intitule',
];

/**
 * Écrit les textes AMELI par différence. Un texte absent du dump n'est pas
 * supprimé : AMELI ne retire pas de texte, et une ligne en trop ne rattache
 * qu'un amendement qui porte sa référence.
 */
export async function ecrireTextesSenat(
  textes: readonly TexteSenatAmeli[],
): Promise<{ crees: number; modifies: number; inchanges: number }> {
  if (textes.length < TEXTES_SENAT_MINIMUM) {
    logger.error({ textes: textes.length, minimum: TEXTES_SENAT_MINIMUM }, 'AMELI : trop peu de textes, textes_senat non mis à jour');
    return { crees: 0, modifies: 0, inchanges: 0 };
  }

  const voulus: LigneTexteSenat[] = textes.map((t) => ({
    texteRef: `SENAT-TXT-${t.id}`,
    sessionDepot: t.sessionDepot,
    sessionInscription: t.sessionInscription,
    numero: t.numero,
    signet: t.signet,
    type: t.type,
    intitule: t.intitule,
  }));
  const existants = await db().texteSenat.findMany({
    select: { texteRef: true, sessionDepot: true, sessionInscription: true, numero: true, signet: true, type: true, intitule: true },
  });
  const d = differencier(existants, voulus, { existant: (e) => e.texteRef, voulu: (v) => v.texteRef }, CHAMPS);

  for (const lot of tranches(d.aCreer, 1000)) {
    await db().texteSenat.createMany({ data: lot, skipDuplicates: true });
  }
  for (const { voulu } of d.aModifier) {
    const { texteRef, ...data } = voulu;
    await db().texteSenat.update({ where: { texteRef }, data });
  }

  const resultat = { crees: d.aCreer.length, modifies: d.aModifier.length, inchanges: d.inchanges };
  logger.info({ ...resultat, absentsDuDump: d.aSupprimer.length }, 'Textes du Sénat (AMELI) à jour');
  return resultat;
}

export interface RattachementSenat {
  /** Amendements sans dossier qui reçoivent celui de leur texte */
  poses: number;
  /** Amendements rattachés à un autre dossier que celui de leur texte */
  corriges: number;
  /** Amendements dont le dossier source n'est pas encore en base : lien retiré */
  retires: number;
}

/**
 * Rattache chaque amendement du Sénat au dossier que la source donne à son
 * texte, et RÉÉCRIT tout lien qui diffère. Les propagations (scrutin →
 * amendement, voisins de texte) ne touchent plus ces amendements.
 *
 * Quand le dossier n'est pas encore en base (le PLF 2027 n'est arrivé que le
 * 20/11, ses amendements dès le 12/11), l'amendement reste sans dossier : c'est
 * précisément dans ce creux qu'une propagation lui avait donné « Budget 2014 ».
 */
export async function rattacherAmendementsSenatAuDossierDuTexte(
  options: { dryRun?: boolean } = {},
): Promise<RattachementSenat> {
  const ecarts = await db().$queryRaw<Array<{ id: string; actuel: string | null; voulu: string | null }>>`
    WITH ${CTE_DOSSIER_DU_TEXTE_SENAT}
    SELECT a.id, a.dossier_id AS actuel, x.dossier_id AS voulu
    FROM amendements a
    JOIN dossier_du_texte_senat x ON x.texte_ref = a.texte_ref
    WHERE a.chambre = 'senat'
      AND a.dossier_id IS DISTINCT FROM x.dossier_id
    ORDER BY a.id
  `;
  const resultat: RattachementSenat = {
    poses: ecarts.filter((e) => e.actuel === null).length,
    corriges: ecarts.filter((e) => e.actuel !== null && e.voulu !== null).length,
    retires: ecarts.filter((e) => e.actuel !== null && e.voulu === null).length,
  };

  // PAR LOTS. Le premier passage en production réécrivait 55 860 lignes en une
  // instruction : chacune passe par le trigger d'horodatage, qui compare la
  // ligne entière (dispositif et objet compris). Annulée au bout de 14 minutes
  // le 21/11/2026, sans rien écrire. Des lots courts avancent et se reprennent.
  if (!options.dryRun) {
    for (const lot of tranches(ecarts, TAILLE_LOT_RATTACHEMENT)) {
      await db().$executeRaw`
        UPDATE amendements a
        SET dossier_id = v.voulu
        FROM unnest(${lot.map((e) => e.id)}::text[], ${lot.map((e) => e.voulu)}::text[]) AS v(id, voulu)
        WHERE a.id = v.id
          AND a.dossier_id IS DISTINCT FROM v.voulu
      `;
    }
  }

  if (resultat.corriges + resultat.retires > 0) {
    logger.warn({ ...resultat, dryRun: !!options.dryRun }, 'Amendements Sénat rattachés à un autre dossier que celui de leur texte : corrigés');
  } else {
    logger.info({ ...resultat, dryRun: !!options.dryRun }, 'Amendements Sénat rattachés au dossier de leur texte');
  }
  return resultat;
}

/**
 * Efface les liens scrutin du Sénat → amendement d'un autre dossier que celui
 * du scrutin, selon la source de l'un et de l'autre.
 *
 * La date ne suffit pas : un texte homonyme d'une session antérieure passe le
 * contrôle « déposé avant le vote ». Le scrutin du 10/07/2025 sur
 * `ppl22-545` était relié à des amendements de janvier 2024 de `ppl23-202`.
 * On n'efface que si le dossier source de l'amendement n'est ni celui du
 * scrutin ni celui que nomme sa source (`dossierRef`) : le dossier d'un
 * scrutin est parfois faux lui-même, et le lien juste resterait alors.
 */
export async function effacerLiensSenatHorsDossierDuTexte(
  options: { dryRun?: boolean } = {},
): Promise<{ effaces: number }> {
  let effaces: number;
  if (options.dryRun) {
    const [r] = await db().$queryRaw<[{ n: bigint }]>`
      WITH ${CTE_DOSSIER_DU_TEXTE_SENAT}
      SELECT count(*) AS n
      FROM "_AmendementToScrutin" ats
      JOIN scrutins s ON s.id = ats."B"
      JOIN amendements a ON a.id = ats."A"
      JOIN dossier_du_texte_senat x ON x.texte_ref = a.texte_ref
      WHERE s.chambre = 'senat'
        AND s.dossier_id IS NOT NULL
        AND x.dossier_id IS NOT NULL
        AND x.dossier_id <> s.dossier_id
        AND x.signet IS DISTINCT FROM lower(s.source_data->>'dossierRef')
    `;
    effaces = Number(r.n);
  } else {
    effaces = await db().$executeRaw`
      WITH ${CTE_DOSSIER_DU_TEXTE_SENAT}
      DELETE FROM "_AmendementToScrutin" ats
      USING scrutins s, amendements a, dossier_du_texte_senat x
      WHERE ats."B" = s.id
        AND ats."A" = a.id
        AND x.texte_ref = a.texte_ref
        AND s.chambre = 'senat'
        AND s.dossier_id IS NOT NULL
        AND x.dossier_id IS NOT NULL
        AND x.dossier_id <> s.dossier_id
        AND x.signet IS DISTINCT FROM lower(s.source_data->>'dossierRef')
    `;
  }
  if (effaces > 0) {
    logger.warn({ effaces, dryRun: !!options.dryRun }, "Liens scrutin Sénat → amendement d'un autre dossier : effacés");
  }
  return { effaces };
}

export interface MesureRattachementSenat {
  textes: number;
  amendements: number;
  amendementsRattaches: number;
  horsDossierDuTexte: number;
  avantSessionDuDossier: number;
  liens: number;
  liensApresLeVote: number;
  liensHorsDossierDuTexte: number;
}

/** L'état du rattachement au Sénat, avec les requêtes des invariants de check-quality. */
export async function mesurerRattachementSenat(): Promise<MesureRattachementSenat> {
  const valeur = async (sql: string): Promise<number> => {
    const [r] = await db().$queryRaw<[{ value: number }]>(Prisma.raw(sql));
    return Number(r.value);
  };
  const [compte] = await db().$queryRaw<[{ textes: bigint; amendements: bigint; rattaches: bigint; liens: bigint }]>`
    SELECT
      (SELECT count(*) FROM textes_senat) AS textes,
      (SELECT count(*) FROM amendements WHERE chambre = 'senat') AS amendements,
      (SELECT count(*) FROM amendements WHERE chambre = 'senat' AND dossier_id IS NOT NULL) AS rattaches,
      (SELECT count(*) FROM "_AmendementToScrutin" ats JOIN scrutins s ON s.id = ats."B" WHERE s.chambre = 'senat') AS liens
  `;
  return {
    textes: Number(compte.textes),
    amendements: Number(compte.amendements),
    amendementsRattaches: Number(compte.rattaches),
    horsDossierDuTexte: await valeur(AMENDEMENTS_SENAT_HORS_DOSSIER_DU_TEXTE_SQL),
    avantSessionDuDossier: await valeur(AMENDEMENTS_SENAT_AVANT_SESSION_DU_DOSSIER_SQL),
    liens: Number(compte.liens),
    liensApresLeVote: await valeur(LIENS_SENAT_APRES_LE_VOTE_SQL),
    liensHorsDossierDuTexte: await valeur(LIENS_SENAT_HORS_DOSSIER_DU_TEXTE_SQL),
  };
}
