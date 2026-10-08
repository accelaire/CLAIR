// =============================================================================
// Députés sortants et mandats d'organe de l'Assemblée
// =============================================================================
//
// L'AMO10 ne liste que les députés EN EXERCICE et leurs mandats en cours : un
// départ (gouvernement, démission, décès, élection au Sénat) se lit à
// l'absence, jamais à une date de fin publiée. Deux trous laissaient des
// mandats ouverts pour toujours.
//
// 1. La passe des sortants ne regardait que les fiches de chambre `assemblee`.
//    Un député élu sénateur passe au Sénat le jour de son élection
//    (`changement-chambre.ts`) : il lui échappait. Le 8 octobre 2026, les 8
//    députés élus sénateurs le 1er gardaient leur mandat de député ouvert,
//    rouvert le 2 par l'Assemblée qui les listait encore (voir
//    `finBorneeParLeSenat`, workers/mandats.ts). Les sortants se cherchent donc
//    par leur MANDAT de député ouvert, et leur identifiant de l'Assemblée se lit
//    dans `parlementaires_identifiants` quand la fiche a changé de chambre.
//
// 2. Aucune passe ne fermait les mandats d'ORGANE (commissions, groupes
//    d'études et d'amitié, missions) d'un député parti : la fermeture des
//    mandats périmés ne voit que les députés présents dans l'AMO10. 9 885
//    mandats d'organe d'anciens députés de la 15e et de la 16e étaient ouverts :
//    la page de la commission des finances comptait 134 membres, dont une
//    cinquantaine d'anciens députés. Règle : un mandat d'organe de l'Assemblée ne
//    survit pas au mandat de député pendant lequel il a commencé.

import type { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Effectif plancher attendu de l'Assemblée (577 sièges). En dessous, on considère le
 *  fetch source comme dégradé et on REFUSE de désactiver qui que ce soit. */
export const AN_EFFECTIF_MIN = 550;

export interface CandidatSortant {
  personneId: string;
  /** Identifiant de l'Assemblée (PA…), sur la fiche ou conservé au changement de chambre. */
  identifiantAN: string | null;
  /** Début du mandat de sénateur ouvert, si la personne est passée au Sénat. */
  debutSenat: Date | null;
}

export interface DecisionSortant {
  personneId: string;
  /** Fin à donner aux mandats de député encore ouverts. */
  dateFin: Date;
  /** Fiche à désactiver : vrai sauf si la personne siège désormais au Sénat. */
  desactiver: boolean;
}

/**
 * Les députés à clore : candidats dont l'identifiant de l'Assemblée n'est plus
 * dans la source. Un passage au Sénat clôt à la veille de l'entrée au Sénat et
 * laisse la fiche active ; un autre départ, à la date d'observation (bornée à
 * la fin de la législature).
 */
export function decisionsSortants(
  candidats: CandidatSortant[],
  identifiantsSource: Set<string>,
  maintenant: Date,
  finLegislature: Date | null,
): DecisionSortant[] {
  const observation = finLegislature && maintenant >= finLegislature ? finLegislature : maintenant;
  const decisions: DecisionSortant[] = [];
  for (const c of candidats) {
    // Sans identifiant, on ne peut pas constater l'absence : on ne touche à rien.
    if (!c.identifiantAN || identifiantsSource.has(c.identifiantAN.toUpperCase())) continue;
    decisions.push(
      c.debutSenat
        ? { personneId: c.personneId, dateFin: new Date(c.debutSenat.getTime() - JOUR_MS), desactiver: false }
        : { personneId: c.personneId, dateFin: observation, desactiver: true },
    );
  }
  return decisions;
}

/**
 * Sortants AN : personnes dont un mandat de député est ouvert (ou fiche de
 * l'Assemblée encore active) et qui ne sont plus dans la source. On ne supprime
 * JAMAIS : on clôt le mandat de député, et on désactive la fiche sauf passage
 * au Sénat. Les mandats d'organe suivent par `cloreOrganesANHorsMandat`.
 */
export async function cloturerDeputesSortants(
  prisma: PrismaClient,
  sourceUids: string[],
  options: { maintenant?: Date; finLegislature?: Date | null; dryRun?: boolean } = {},
): Promise<DecisionSortant[]> {
  // Garde-fou : un fetch partiel/dégradé ne doit pas désactiver l'Assemblée en masse.
  if (sourceUids.length < AN_EFFECTIF_MIN) {
    logger.warn(
      { recus: sourceUids.length, minimum: AN_EFFECTIF_MIN },
      'Effectif AN source anormalement bas — passe sortants ANNULÉE',
    );
    return [];
  }

  const candidats = await prisma.$queryRaw<CandidatSortant[]>`
    SELECT p.id AS "personneId",
      CASE WHEN p.chambre = 'assemblee' THEN p.source_id
        ELSE (SELECT i.source_id FROM parlementaires_identifiants i
              WHERE i.personne_id = p.id AND i.chambre = 'assemblee'
              ORDER BY i.created_at DESC, i.id LIMIT 1)
      END AS "identifiantAN",
      (SELECT min(s.date_debut) FROM mandats_parlementaires s
       WHERE s.personne_id = p.id AND s.chambre = 'senat' AND s.date_fin IS NULL) AS "debutSenat"
    FROM parlementaires p
    WHERE (p.chambre = 'assemblee' AND p.actif)
      OR EXISTS (SELECT 1 FROM mandats_parlementaires m
                 WHERE m.personne_id = p.id AND m.chambre = 'assemblee' AND m.date_fin IS NULL)
  `;
  const sansIdentifiant = candidats.filter((c) => !c.identifiantAN).length;
  if (sansIdentifiant > 0) {
    logger.warn({ sansIdentifiant }, 'Mandats de député ouverts sans identifiant AN : non examinés');
  }

  const decisions = decisionsSortants(
    candidats,
    new Set(sourceUids.map((u) => u.toUpperCase())),
    options.maintenant ?? new Date(),
    options.finLegislature ?? null,
  );
  if (decisions.length === 0 || options.dryRun) {
    logger.info(
      { sortants: decisions.length, passesAuSenat: decisions.filter((d) => !d.desactiver).length, dryRun: !!options.dryRun },
      'Députés sortants',
    );
    return decisions;
  }

  let mandatsClos = 0;
  for (const d of decisions) {
    if (d.desactiver) {
      await prisma.parlementaire.update({ where: { id: d.personneId }, data: { actif: false } });
    }
    // Un mandat commencé après la fin calculée n'est pas celui qu'on clôt.
    const { count } = await prisma.mandatParlementaire.updateMany({
      where: { personneId: d.personneId, chambre: 'assemblee', dateFin: null, dateDebut: { lte: d.dateFin } },
      data: { dateFin: d.dateFin },
    });
    mandatsClos += count;
  }

  logger.info(
    { sortants: decisions.length, passesAuSenat: decisions.filter((d) => !d.desactiver).length, mandatsClos },
    'Députés sortants : mandats clos',
  );
  return decisions;
}

/**
 * Mandats d'organe de l'Assemblée (`source_uid` PM…) encore ouverts alors que le
 * mandat de député pendant lequel ils ont commencé est clos. Ce mandat de départ
 * est le dernier mandat de député de la personne commencé au plus tard le jour
 * de l'organe. Fin donnée : celle de ce mandat, jamais avant le début de
 * l'organe (31 organes commencent après la fin connue de leur mandat de départ).
 *
 * La même requête sert l'invariant `organes_an_au_dela_du_mandat` de
 * checks/data-quality.ts.
 */
export const ORGANES_AN_HORS_MANDAT = `
  SELECT o.id, GREATEST(o.date_debut, depart.date_fin) AS fin
  FROM mandats o
  JOIN LATERAL (
    SELECT mp.date_fin FROM mandats_parlementaires mp
    WHERE mp.personne_id = o.parlementaire_id AND mp.chambre = 'assemblee'
      AND mp.date_debut <= o.date_debut
    ORDER BY mp.date_debut DESC, mp.id
    LIMIT 1
  ) depart ON TRUE
  WHERE o.date_fin IS NULL AND o.source_uid LIKE 'PM%' AND depart.date_fin IS NOT NULL`;

export async function cloreOrganesANHorsMandat(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<number> {
  if (options.dryRun) {
    const [{ n }] = await prisma.$queryRawUnsafe<[{ n: number }]>(
      `SELECT COUNT(*)::int AS n FROM (${ORGANES_AN_HORS_MANDAT}) x`,
    );
    logger.info({ organes: n, dryRun: true }, "Mandats d'organe AN au-delà du mandat de député");
    return n;
  }
  const clos = await prisma.$executeRawUnsafe(
    `UPDATE mandats o SET date_fin = c.fin FROM (${ORGANES_AN_HORS_MANDAT}) c WHERE o.id = c.id`,
  );
  logger.info({ organes: clos }, "Mandats d'organe AN au-delà du mandat de député : clos");
  return clos;
}
