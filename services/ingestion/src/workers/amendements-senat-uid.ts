// =============================================================================
// Un amendement du Sénat, une ligne
// =============================================================================
//
// Ramène chaque amendement du Sénat à son uid stable (session de dépôt, numéro
// du texte, numéro sans rectification : utils/uid-amendement-senat.ts) et
// fusionne les lignes qui le partagent. 17 669 lignes en trop sur 77 785 en
// production le 22/11/2026, dont 15 849 comptées sur la fiche d'un sénateur :
//
//  - 10 305 : l'ancien import complet d'AMELI (`SENAT-AMD-{id}`, jusqu'en
//    février 2026) et le CSV couvraient les mêmes textes ;
//  - 5 346 : le CSV mettait la rectification dans l'uid, « 1 », « 1 rect. bis »
//    et « 1 rect. quinquies » faisaient trois lignes, dont deux périmées ;
//  - 1 651 : le CSV donnait `SENAT-AMD-T{texte}-…` aux lignes sans adresse ;
//  - 367 : l'ancien import AMELI gardait une ligne par version (AMELI en
//    publie une par rectification, sous un autre id).
//
// La ligne gardée est celle du CSV, à défaut celle d'AMELI, et parmi elles la
// dernière version, reconnue à sa date de dépôt (toutes les lignes de l'import
// AMELI ont été créées le même jour). Elle reprend les liens des autres
// (scrutins, avis de commission, sous-amendements ; cosignataires si elle n'en
// a pas) et la date de dépôt la plus ancienne, celle de la première version.
// Les autres sont supprimées et elle prend l'uid stable. Les passes de la nuit refont le reste à partir d'elle :
// dossier (rattacher…), article visé, métadonnées AMELI et renvois LEGI
// (`updated_at` a bougé). La colonne `scrutins.amendement_id`, présente en
// production mais hors du schéma et lue par aucun code, est mise à NULL par sa
// clé étrangère.
//
// Idempotente : sans doublon ni uid à reprendre, elle ne fait qu'une lecture.
// Elle tourne dans la synchro CSV, AVANT l'écriture, pour que le CSV retrouve
// sous leur uid stable les lignes qu'il doit mettre à jour (celles d'AMELI
// comprises) au lieu d'en créer de nouvelles.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { tranches } from '../utils/synchro-differentielle';
import {
  AMENDEMENTS_COMMISSION_SENAT_RECENTS_SQL,
  AMENDEMENTS_SENAT_EN_DOUBLE_SQL,
  AMENDEMENTS_SENAT_UID_INSTABLE_SQL,
  uidAmendementSenatSql,
} from '../utils/uid-amendement-senat';

let client: PrismaClient | undefined;
const db = (): PrismaClient => (client ??= new PrismaClient());

/** Groupes traités par transaction : la production écrit lentement (trigger d'horodatage). */
const GROUPES_PAR_LOT = 500;

export interface FusionAmendementsSenat {
  /** uid stables portés par plusieurs lignes */
  groupes: number;
  /** lignes en trop, supprimées après report de leurs liens */
  supprimees: number;
  /** lignes gardées dont l'uid change */
  renommees: number;
  /** liens scrutin → amendement reportés sur la ligne gardée (hors doublons) */
  liensScrutinReportes: number;
  /** groupes laissés de côté : leur uid stable est déjà pris hors du Sénat connu */
  ignores: number;
}

interface LignePlan {
  id: string;
  uid: string;
  canon: string;
  survivant: string;
}

export async function fusionnerAmendementsSenat(
  options: { dryRun?: boolean } = {},
): Promise<FusionAmendementsSenat> {
  const plan = await db().$queryRawUnsafe<LignePlan[]>(`
    WITH c AS (
      SELECT a.id, a.uid, a.created_at, a.date_depot, ${uidAmendementSenatSql('a', 't')} AS canon,
        a.uid !~ '^SENAT-AMD-[0-9]+$' AS du_csv
      FROM amendements a
      JOIN textes_senat t ON t.texte_ref = a.texte_ref
      WHERE a.chambre = 'senat'
    ), r AS (
      SELECT c.*,
        count(*) OVER (PARTITION BY canon) AS n,
        first_value(id) OVER (
          PARTITION BY canon ORDER BY du_csv DESC, date_depot DESC NULLS LAST, created_at DESC, id
        ) AS survivant
      FROM c
    )
    SELECT id, uid, canon, survivant FROM r
    WHERE n > 1 OR uid <> canon
    ORDER BY canon, id
  `);

  // Un uid stable déjà porté par une ligne hors du plan (texte inconnu de
  // textes_senat) : renommer violerait l'unicité. On laisse le groupe.
  const idsDuPlan = new Set(plan.map((l) => l.id));
  const pris = new Set<string>();
  for (const lot of tranches([...new Set(plan.map((l) => l.canon))], 5000)) {
    const lignes = await db().$queryRaw<Array<{ id: string; uid_canonique: string }>>`
      SELECT id, uid_canonique FROM amendements WHERE uid_canonique = ANY(${lot}::text[])`;
    for (const l of lignes) if (!idsDuPlan.has(l.id)) pris.add(l.uid_canonique);
  }

  const groupes = new Map<string, LignePlan[]>();
  for (const l of plan) {
    if (pris.has(l.canon)) continue;
    groupes.set(l.canon, [...(groupes.get(l.canon) ?? []), l]);
  }

  const resultat: FusionAmendementsSenat = {
    groupes: [...groupes.values()].filter((g) => g.length > 1).length,
    supprimees: plan.filter((l) => !pris.has(l.canon) && l.id !== l.survivant).length,
    renommees: plan.filter((l) => !pris.has(l.canon) && l.id === l.survivant && l.uid !== l.canon).length,
    liensScrutinReportes: 0,
    ignores: new Set(plan.filter((l) => pris.has(l.canon)).map((l) => l.canon)).size,
  };

  if (!options.dryRun) {
    // Une ligne peut porter comme uid l'uid stable d'un AUTRE amendement :
    // avant le 21/11/2026, le CSV mettait dans l'uid la session d'inscription
    // du texte, pas celle de dépôt (`S2025-2026-501-3` pour le n° 501 déposé
    // en 2024-2025, qui est l'uid stable du n° 501 de 2025-2026). On la gare
    // d'abord sous un uid provisoire, sans quoi le renommage de l'autre
    // violerait l'unicité ; elle prend le sien plus bas.
    const canons = new Set(groupes.keys());
    const squatteurs = [...groupes.values()].flat().filter((l) => l.uid !== l.canon && canons.has(l.uid));
    for (const lot of tranches(squatteurs, 1000)) {
      await db().$executeRaw`
        UPDATE amendements SET uid = 'SENAT-AMD-PROVISOIRE-' || id, uid_canonique = 'SENAT-AMD-PROVISOIRE-' || id
        WHERE id = ANY(${lot.map((l) => l.id)}::text[])`;
    }
    for (const l of squatteurs) l.uid = `SENAT-AMD-PROVISOIRE-${l.id}`;

    for (const lot of tranches([...groupes.values()], GROUPES_PAR_LOT)) {
      const lignes = lot.flat();
      const perdants = lignes.filter((l) => l.id !== l.survivant);
      const gardees = lignes.filter((l) => l.id === l.survivant && l.uid !== l.canon);
      resultat.liensScrutinReportes += await reporterEtFusionner(
        perdants.map((l) => l.id),
        perdants.map((l) => l.survivant),
        gardees.map((l) => l.id),
        gardees.map((l) => l.canon),
      );
    }
  }

  if (resultat.supprimees + resultat.renommees + resultat.ignores > 0) {
    logger.warn({ ...resultat, dryRun: !!options.dryRun }, 'Amendements Sénat ramenés à leur uid stable (doublons fusionnés)');
  } else {
    logger.info({ ...resultat, dryRun: !!options.dryRun }, 'Amendements Sénat : un amendement, une ligne');
  }
  return resultat;
}

/**
 * Une transaction : reporte les liens des perdants sur leur survivant, les
 * supprime, puis donne leur uid stable aux survivants.
 * @returns le nombre de liens scrutin reportés
 */
async function reporterEtFusionner(
  perdants: string[],
  survivants: string[],
  aRenommer: string[],
  uids: string[],
): Promise<number> {
  const [liens] = await db().$transaction([
    db().$executeRaw`
      INSERT INTO "_AmendementToScrutin" ("A", "B")
      SELECT DISTINCT m.survivant, x."B"
      FROM "_AmendementToScrutin" x
      JOIN unnest(${perdants}::text[], ${survivants}::text[]) AS m(perdant, survivant) ON x."A" = m.perdant
      ON CONFLICT DO NOTHING`,
    // Les cosignataires d'AMELI sont ceux du numéro de base, identiques pour
    // toutes les versions : on ne complète qu'un survivant qui n'en a aucun.
    db().$executeRaw`
      INSERT INTO "_AmendementCosignataires" ("A", "B")
      SELECT DISTINCT m.survivant, c."B"
      FROM "_AmendementCosignataires" c
      JOIN unnest(${perdants}::text[], ${survivants}::text[]) AS m(perdant, survivant) ON c."A" = m.perdant
      WHERE NOT EXISTS (SELECT 1 FROM "_AmendementCosignataires" s WHERE s."A" = m.survivant)
      ON CONFLICT DO NOTHING`,
    db().$executeRaw`
      UPDATE avis_commission v SET amendement_id = m.survivant
      FROM unnest(${perdants}::text[], ${survivants}::text[]) AS m(perdant, survivant)
      WHERE v.amendement_id = m.perdant`,
    db().$executeRaw`
      UPDATE amendements a SET amendement_parent_id = m.survivant
      FROM unnest(${perdants}::text[], ${survivants}::text[]) AS m(perdant, survivant)
      WHERE a.amendement_parent_id = m.perdant AND a.id <> m.survivant`,
    // La date de dépôt d'un amendement est celle de sa première version : le
    // CSV donne celle de la version courante (« 1 rect. quinquies », 27/10,
    // pour l'amendement 1 déposé le 22/10). Garder la plus tardive ferait
    // passer pour « déposé après le vote » l'amendement voté avant d'être
    // rectifié, et la nuit effacerait le lien.
    db().$executeRaw`
      UPDATE amendements a SET date_depot = p.premiere
      FROM (
        SELECT m.survivant, min(x.date_depot) AS premiere
        FROM unnest(${perdants}::text[], ${survivants}::text[]) AS m(perdant, survivant)
        JOIN amendements x ON x.id = m.perdant
        GROUP BY m.survivant
      ) p
      WHERE a.id = p.survivant AND p.premiere < COALESCE(a.date_depot, 'infinity')`,
    db().$executeRaw`DELETE FROM amendements WHERE id = ANY(${perdants}::text[])`,
    db().$executeRaw`
      UPDATE amendements a SET uid = r.uid, uid_canonique = r.uid
      FROM unnest(${aRenommer}::text[], ${uids}::text[]) AS r(id, uid)
      WHERE a.id = r.id AND (a.uid <> r.uid OR a.uid_canonique <> r.uid)`,
  ]);
  return liens;
}

export interface MesureAmendementsSenatUid {
  amendements: number;
  commission: number;
  enDouble: number;
  uidInstable: number;
  commissionRecents: number;
}

/** L'état des uid du Sénat, avec les requêtes des contrôles de check-quality. */
export async function mesurerAmendementsSenatUid(): Promise<MesureAmendementsSenatUid> {
  const valeur = async (sql: string): Promise<number> => {
    const [r] = await db().$queryRawUnsafe<[{ value: number }]>(sql);
    return Number(r.value);
  };
  const [compte] = await db().$queryRaw<[{ amendements: bigint; commission: bigint }]>`
    SELECT count(*) AS amendements, count(*) FILTER (WHERE numero LIKE 'COM-%') AS commission
    FROM amendements WHERE chambre = 'senat'`;
  return {
    amendements: Number(compte.amendements),
    commission: Number(compte.commission),
    enDouble: await valeur(AMENDEMENTS_SENAT_EN_DOUBLE_SQL),
    uidInstable: await valeur(AMENDEMENTS_SENAT_UID_INSTABLE_SQL),
    commissionRecents: await valeur(AMENDEMENTS_COMMISSION_SENAT_RECENTS_SQL),
  };
}
