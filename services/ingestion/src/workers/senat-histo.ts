// =============================================================================
// Sénateurs historiques (« anciens sénateurs ») — ingestion open data ODSEN
//
// Complète `senateurs.json` (qui n'expose que les sénateurs EN COURS, sans dates)
// avec la couche HISTORIQUE nécessaire aux sessions Sénat passées : identités des
// anciens, intervalles de mandat réels, groupe d'époque.
//
// Division du travail (voir mémoire « source anciens sénateurs ») :
//   - `senateurs.json` (sync.ts) reste propriétaire des mandats COURANTS/ouverts ;
//   - ce worker n'ingère QUE les mandats CLOS (dateFin non nulle) chevauchant le
//     périmètre. Un mandat ouvert de l'export ELUSEN — figé avant sept. 2023 — est
//     soit déjà en base via le sync (série 2, 2020), soit en réalité clos et corrigé
//     par `deriveMandatContextSenatOdsen`. On ne réécrit donc jamais un mandat courant.
//
// Périmètre par défaut : sessions 2020-2021 → présent (mandats chevauchant 2020-10-01).
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import {
  SenatHistoClient,
  type OdsenAppartenanceGroupe,
  type OdsenMandatRow,
} from '../sources/senat/senat-histo-client';
import {
  deriveMandatContextSenatOdsen,
  inferSerieSenatDepuisDate,
  upsertMandatParlementaire,
  type MandatContext,
} from './mandats';

const prisma = new PrismaClient();

/** 1er octobre 2020 : ouverture de la session 2020-2021 (plancher du périmètre). */
const PERIMETRE_DEBUT_DEFAUT = new Date(Date.UTC(2020, 9, 1));

const MAX_DATE = new Date(8640000000000000);

function slugifySenateur(prenom: string, nom: string): string {
  return `${prenom} ${nom}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Code de groupe ODSEN → slug de groupe Sénat en base. Identité en minuscules,
 *  sauf « AUCUN » (aucun groupe) rattaché à la réunion administrative NI. */
function groupeSlugFromOdsen(code: string): string {
  const c = code.trim().toLowerCase();
  return c === 'aucun' ? 'ni' : c;
}

/** Chevauchement (ms) entre deux intervalles ; bornes nulles = ouvertes (±∞). */
function overlapMs(aDeb: Date, aFin: Date | null, bDeb: Date, bFin: Date): number {
  const start = Math.max(aDeb.getTime(), bDeb.getTime());
  const end = Math.min((aFin ?? MAX_DATE).getTime(), bFin.getTime());
  return Math.max(0, end - start);
}

/** Série d'un sénateur, inférée du 1er mandat plein rencontré (tous partagent le siège). */
function inferSerie(mandats: OdsenMandatRow[]): string | null {
  for (const m of mandats) {
    if (!m.dateDebut) continue;
    const s = inferSerieSenatDepuisDate(m.dateDebut);
    if (s) return s;
  }
  return null;
}

/** Groupe (id en base) dominant sur l'intervalle d'un mandat : appartenance au plus
 *  grand chevauchement, mappée code→slug. `null` si aucune ou groupe absent en base. */
function groupeDominant(
  appartenances: OdsenAppartenanceGroupe[],
  ctx: MandatContext,
  groupeIdBySlug: Map<string, string>,
): string | null {
  let meilleur: { id: string; ms: number } | null = null;
  for (const a of appartenances) {
    if (!a.dateDebut) continue;
    const ms = overlapMs(a.dateDebut, a.dateFin, ctx.dateDebut, ctx.dateFin ?? MAX_DATE);
    if (ms <= 0) continue;
    const id = groupeIdBySlug.get(groupeSlugFromOdsen(a.groupeCode));
    if (!id) continue;
    if (!meilleur || ms > meilleur.ms) meilleur = { id, ms };
  }
  return meilleur?.id ?? null;
}

export interface SyncSenateursHistoriquesResult {
  personnesCreees: number;
  personnesEnrichies: number;
  mandatsCrees: number;
  mandatsMisAJour: number;
  senateursIgnores: number;
}

export async function syncSenateursHistoriques(
  options: { perimetreDebut?: Date } = {},
): Promise<SyncSenateursHistoriquesResult> {
  const perimetreDebut = options.perimetreDebut ?? PERIMETRE_DEBUT_DEFAUT;
  const now = new Date();
  logger.info({ perimetreDebut }, 'Sync sénateurs historiques (ODSEN) — start');

  const data = await new SenatHistoClient().getData();

  // Référentiels en base ---------------------------------------------------
  const groupes = await prisma.groupePolitique.findMany({
    where: { chambre: 'senat' },
    select: { id: true, slug: true },
  });
  const groupeIdBySlug = new Map(groupes.map((g) => [g.slug, g.id]));

  const circos = await prisma.circonscription.findMany({
    where: { type: 'senatoriale' },
    select: { id: true, nom: true },
  });
  const circoIdByNom = new Map(circos.map((c) => [c.nom, c.id]));

  const existants = await prisma.parlementaire.findMany({
    where: { chambre: 'senat' },
    select: { id: true, sourceId: true, serie: true, dateNaissance: true },
  });
  const existantBySource = new Map(
    existants.filter((e) => e.sourceId).map((e) => [e.sourceId!, e]),
  );

  // Regroupements par matricule -------------------------------------------
  const appartByMat = new Map<string, OdsenAppartenanceGroupe[]>();
  for (const a of data.appartenances) {
    const arr = appartByMat.get(a.matricule) ?? [];
    arr.push(a);
    appartByMat.set(a.matricule, arr);
  }
  const mandatsByMat = new Map<string, OdsenMandatRow[]>();
  for (const m of data.mandats) {
    const arr = mandatsByMat.get(m.matricule) ?? [];
    arr.push(m);
    mandatsByMat.set(m.matricule, arr);
  }

  const result: SyncSenateursHistoriquesResult = {
    personnesCreees: 0,
    personnesEnrichies: 0,
    mandatsCrees: 0,
    mandatsMisAJour: 0,
    senateursIgnores: 0,
  };

  for (const [matricule, identite] of data.identites) {
    const mandatsRaw = mandatsByMat.get(matricule) ?? [];
    const existant = existantBySource.get(matricule);
    // La série ne pilote PAS la mandature (clé stable série-indépendante) : elle sert
    // seulement à décider la clôture des mandats périmés et à afficher la série.
    const serie = existant?.serie ?? inferSerie(mandatsRaw);

    // Mandats CLOS chevauchant le périmètre (les ouverts sont au sync courant).
    const mandatsAImporter = mandatsRaw
      .filter((m) => m.dateDebut !== null)
      .map((m) => deriveMandatContextSenatOdsen({ dateDebut: m.dateDebut!, dateFin: m.dateFin, serie }, now))
      .filter((ctx) => ctx.dateFin !== null && overlapMs(ctx.dateDebut, ctx.dateFin, perimetreDebut, now) > 0);

    if (mandatsAImporter.length === 0) {
      result.senateursIgnores++;
      continue;
    }

    const circoId = identite.circonscription ? circoIdByNom.get(identite.circonscription) ?? null : null;

    // 1) Résoudre la personne -------------------------------------------
    let personneId: string;
    if (existant) {
      personneId = existant.id;
      // Enrichissement bio non destructif (senateurs.json n'a pas la date de naissance).
      if (!existant.dateNaissance && identite.dateNaissance) {
        await prisma.parlementaire.update({
          where: { id: existant.id },
          data: { dateNaissance: identite.dateNaissance },
        });
        result.personnesEnrichies++;
      }
    } else {
      // Ancien pur : créer une personne inactive. Groupe = dernier mandat importé.
      const dernier = mandatsAImporter.reduce((a, b) => (a.dateDebut >= b.dateDebut ? a : b));
      const groupeId = groupeDominant(appartByMat.get(matricule) ?? [], dernier, groupeIdBySlug);
      const slug = await slugUnique(slugifySenateur(identite.prenom, identite.nom), matricule);
      const cree = await prisma.parlementaire.create({
        data: {
          slug,
          chambre: 'senat',
          nom: identite.nom,
          prenom: identite.prenom,
          sexe: identite.sexe,
          dateNaissance: identite.dateNaissance,
          profession: identite.profession,
          serie,
          actif: false,
          sourceId: matricule,
          groupeId,
          circonscriptionId: circoId,
        },
        select: { id: true },
      });
      personneId = cree.id;
      result.personnesCreees++;
    }

    // 2) Upsert des mandats historiques ---------------------------------
    for (const ctx of mandatsAImporter) {
      const groupeId = groupeDominant(appartByMat.get(matricule) ?? [], ctx, groupeIdBySlug);
      const { created } = await upsertMandatParlementaire(prisma, {
        personneId,
        chambre: 'senat',
        ctx,
        groupeId,
        circonscriptionId: circoId,
        commissionPermanente: null,
      });
      if (created) result.mandatsCrees++;
      else result.mandatsMisAJour++;
    }
  }

  logger.info(result, 'Sync sénateurs historiques (ODSEN) — done');
  return result;
}

/** Garantit l'unicité globale du slug : suffixe le matricule si un AUTRE parlementaire
 *  le détient déjà (homonymes ancien/actuel). */
async function slugUnique(base: string, matricule: string): Promise<string> {
  const taken = await prisma.parlementaire.findUnique({ where: { slug: base }, select: { sourceId: true } });
  if (!taken || taken.sourceId === matricule) return base;
  return `${base}-${matricule.toLowerCase()}`;
}
