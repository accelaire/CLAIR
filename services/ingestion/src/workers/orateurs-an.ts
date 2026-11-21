// =============================================================================
// Prises de parole de l'Assemblée rattachées à une fiche que le nom de
// l'orateur contredit
//
// L'ingestion des débats (syceron) ne retient plus une fiche que le nom de
// l'orateur contredit (`ficheDeLaPrise`). Les séances déjà en base ne sont pas
// réécrites pour autant : leur empreinte ne compte que le texte. Ce module les
// trouve, pour le contrôle qualité, et les corrige (`corriger-orateurs-an`).
// =============================================================================

import { writeFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { concordanceOrateur, ficheDansLaSeance, ficheRetenue, type Concordance } from '../utils/concordance-orateur';

/** Interventions de séance issues de syceron (les réunions de commission viennent des PDF). */
const PERIMETRE_SQL = `i.chambre = 'assemblee' AND i.seance_uid LIKE 'CRSANR5%' AND i.reunion_id IS NULL`;

export interface PaireContredite {
  parlementaireId: string;
  orateurNom: string | null;
  orateurPrenom: string | null;
  ficheNom: string;
  fichePrenom: string;
  concordance: Concordance;
  interventions: number;
}

interface LignePaire {
  parlementaire_id: string;
  orateur_nom: string | null;
  orateur_prenom: string | null;
  nom: string;
  prenom: string;
  n: number;
}

/** Couples (orateur écrit, fiche attribuée) que le nom de l'orateur contredit. */
export async function pairesContredites(prisma: PrismaClient): Promise<PaireContredite[]> {
  const lignes = await prisma.$queryRawUnsafe<LignePaire[]>(`
    SELECT i.parlementaire_id, i.orateur_nom, i.orateur_prenom, p.nom, p.prenom, count(*)::int AS n
    FROM interventions i
    JOIN parlementaires p ON p.id = i.parlementaire_id
    WHERE ${PERIMETRE_SQL}
    GROUP BY 1, 2, 3, 4, 5
  `);
  const contredites: PaireContredite[] = [];
  for (const l of lignes) {
    const concordance = concordanceOrateur(
      { prenom: l.orateur_prenom, nom: l.orateur_nom ?? '' },
      { prenom: l.prenom, nom: l.nom },
    );
    if (ficheRetenue(concordance)) continue;
    contredites.push({
      parlementaireId: l.parlementaire_id,
      orateurNom: l.orateur_nom,
      orateurPrenom: l.orateur_prenom,
      ficheNom: l.nom,
      fichePrenom: l.prenom,
      concordance,
      interventions: l.n,
    });
  }
  return contredites.sort((a, b) => b.interventions - a.interventions);
}

export interface InterventionContredite {
  id: string;
  /** La fiche que l'intervention désigne à tort (null : déjà détachée par une passe précédente) */
  parlementaireId: string | null;
  sourceUid: string | null;
  seanceUid: string | null;
  /** La fiche que le même orateur porte ailleurs dans la séance, à lui rendre ; null sinon */
  nouvelleFiche: string | null;
}

/**
 * Interventions des couples contredits, en une requête : la jointure sur la
 * liste des couples suit l'index de `parlementaire_id`.
 */
export async function interventionsContredites(
  prisma: PrismaClient,
  paires: readonly PaireContredite[],
): Promise<InterventionContredite[]> {
  if (paires.length === 0) return [];
  const lignes = await prisma.$queryRawUnsafe<
    Array<{ id: string; parlementaire_id: string; source_uid: string | null; seance_uid: string | null }>
  >(
    `SELECT i.id, i.parlementaire_id, i.source_uid, i.seance_uid
     FROM unnest($1::text[], $2::text[], $3::text[]) AS c(parlementaire_id, orateur_nom, orateur_prenom)
     JOIN interventions i
       ON i.parlementaire_id = c.parlementaire_id
      AND i.orateur_nom IS NOT DISTINCT FROM c.orateur_nom
      AND i.orateur_prenom IS NOT DISTINCT FROM c.orateur_prenom
     WHERE ${PERIMETRE_SQL}
     ORDER BY i.id`,
    paires.map((p) => p.parlementaireId),
    paires.map((p) => p.orateurNom),
    paires.map((p) => p.orateurPrenom),
  );
  return lignes.map((l) => ({
    id: l.id,
    parlementaireId: l.parlementaire_id,
    sourceUid: l.source_uid,
    seanceUid: l.seance_uid,
    nouvelleFiche: null,
  }));
}

/**
 * Interventions déjà détachées de leur fiche par une passe précédente (ids de
 * sa sauvegarde), encore sans fiche : on leur cherche l'orateur dans la séance.
 */
async function interventionsDejaDetachees(prisma: PrismaClient, ids: readonly string[]): Promise<InterventionContredite[]> {
  if (ids.length === 0) return [];
  const lignes = await prisma.$queryRawUnsafe<Array<{ id: string; source_uid: string | null; seance_uid: string | null }>>(
    `SELECT i.id, i.source_uid, i.seance_uid FROM interventions i
     WHERE i.id = ANY($1::text[]) AND i.parlementaire_id IS NULL AND ${PERIMETRE_SQL}
     ORDER BY i.id`,
    [...ids],
  );
  return lignes.map((l) => ({ id: l.id, parlementaireId: null, sourceUid: l.source_uid, seanceUid: l.seance_uid, nouvelleFiche: null }));
}

/**
 * Pour chaque intervention à corriger, la fiche que le même orateur porte
 * ailleurs dans sa séance (`ficheDansLaSeance`), en une requête. Les autres
 * interventions à corriger n'y servent pas de référence.
 */
async function fichesARendre(prisma: PrismaClient, cibles: readonly InterventionContredite[]): Promise<Map<string, string>> {
  if (cibles.length === 0) return new Map();
  const lignes = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      orateur_nom: string | null;
      orateur_prenom: string | null;
      parlementaire_id: string;
      nom: string;
      prenom: string;
    }>
  >(
    `SELECT DISTINCT c.id, i.orateur_nom, i.orateur_prenom, j.parlementaire_id, p.nom, p.prenom
     FROM unnest($1::text[]) AS c(id)
     JOIN interventions i ON i.id = c.id
     JOIN interventions j
       ON j.seance_uid = i.seance_uid
      AND j.id <> ALL($1::text[])
      AND j.orateur_nom = i.orateur_nom
      AND j.orateur_prenom IS NOT DISTINCT FROM i.orateur_prenom
      AND j.parlementaire_id IS NOT NULL
      AND j.est_presidence = false
     JOIN parlementaires p ON p.id = j.parlementaire_id`,
    cibles.map((c) => c.id),
  );
  const parCible = new Map<string, typeof lignes>();
  for (const l of lignes) parCible.set(l.id, [...(parCible.get(l.id) ?? []), l]);
  const rendues = new Map<string, string>();
  for (const [id, autres] of parCible) {
    const orateur = { nom: autres[0]!.orateur_nom ?? '', prenom: autres[0]!.orateur_prenom };
    const fiche = ficheDansLaSeance(
      orateur,
      autres.map((a) => ({ orateur, parlementaireId: a.parlementaire_id, fiche: { nom: a.nom, prenom: a.prenom } })),
    );
    if (fiche) rendues.set(id, fiche);
  }
  return rendues;
}

export interface RapportCorrectionOrateurs {
  paires: PaireContredite[];
  /** Les interventions corrigées (prévues, en essai à blanc), avec la fiche rendue s'il y en a une */
  interventions: InterventionContredite[];
  /** Fiches dont les interventions ont changé : leurs statistiques sont à recalculer */
  fiches: string[];
}

/**
 * Corrige les interventions que le nom de l'orateur contredit : chacune est
 * rendue à la fiche que le même orateur porte ailleurs dans sa séance, ou
 * détachée de toute fiche à défaut. `reprendre` : ids d'interventions déjà
 * détachées par une passe précédente, à qui l'on cherche aussi leur orateur.
 *
 * La recherche (lente : une lecture par fiche) se fait hors transaction ;
 * l'écriture, par clé primaire, dans une transaction courte qui ne touche une
 * ligne que si elle désigne encore la fiche relevée. Si le compte diffère,
 * tout est annulé.
 */
export async function corrigerOrateursAN(
  prisma: PrismaClient,
  options: { dryRun?: boolean; sauvegarde?: string; reprendre?: readonly string[] } = {},
): Promise<RapportCorrectionOrateurs> {
  const paires = await pairesContredites(prisma);
  const attendues = paires.reduce((s, p) => s + p.interventions, 0);
  const contredites = await interventionsContredites(prisma, paires);
  if (contredites.length !== attendues) {
    throw new Error(`${contredites.length} interventions relues au lieu de ${attendues} : la base a changé, relancer`);
  }
  const cibles = [...contredites, ...(await interventionsDejaDetachees(prisma, options.reprendre ?? []))];
  const rendues = await fichesARendre(prisma, cibles);
  const interventions = cibles
    .map((c) => ({ ...c, nouvelleFiche: rendues.get(c.id) ?? null }))
    // Déjà détachée et sans orateur retrouvé : rien à écrire.
    .filter((c) => c.parlementaireId !== null || c.nouvelleFiche !== null);
  const fiches = [
    ...new Set(interventions.flatMap((x) => [x.parlementaireId, x.nouvelleFiche].filter((f): f is string => f !== null))),
  ];
  if (options.dryRun || interventions.length === 0) return { paires, interventions, fiches };

  // De quoi revenir en arrière : chaque intervention, la fiche qu'elle désignait et celle qu'elle reçoit.
  if (options.sauvegarde) writeFileSync(options.sauvegarde, csvSauvegarde(interventions));

  await prisma.$transaction(
    async (tx) => {
      const n = await tx.$executeRawUnsafe(
        `UPDATE interventions i SET parlementaire_id = c.nouvelle
         FROM unnest($1::text[], $2::text[], $3::text[]) AS c(id, ancienne, nouvelle)
         WHERE i.id = c.id AND i.parlementaire_id IS NOT DISTINCT FROM c.ancienne`,
        interventions.map((x) => x.id),
        interventions.map((x) => x.parlementaireId),
        interventions.map((x) => x.nouvelleFiche),
      );
      if (n !== interventions.length) {
        throw new Error(`${n} lignes modifiées au lieu de ${interventions.length} : annulation`);
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return { paires, interventions, fiches };
}

/** CSV des interventions et de la fiche qu'elles désignaient avant la correction. */
export function csvSauvegarde(interventions: readonly InterventionContredite[]): string {
  const champ = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const lignes = interventions.map((x) =>
    [x.id, x.parlementaireId, x.sourceUid, x.seanceUid, x.nouvelleFiche].map(champ).join(','),
  );
  return ['id,parlementaire_id,source_uid,seance_uid,nouvelle_fiche', ...lignes].join('\n') + '\n';
}
