// =============================================================================
// Backfill Phase 0 — Multi-législatures / Multi-mandatures
// Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
//
// Bootstrap idempotent (rejouable sans créer de doublon) :
//   1. Scalaire : `legislature = 17` sur les groupes et scrutins de l'AN.
//   2. Mandats  : 1 `MandatParlementaire` par parlementaire existant, copiant
//      groupe / circo / série / stats. AN → legislature 17 ; Sénat → mandature
//      dérivée de la série électorale.
//
// Les dates de début sont des approximations de bootstrap ; l'ingestion Phase 1
// les remplacera par les dates exactes issues des sources (AMO mandats / Sénat).
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// --- Constantes de bootstrap (Phase 0) -------------------------------------
const LEGISLATURE_AN_COURANTE = 17;
const LEGISLATURE_17_DEBUT = new Date('2024-07-18'); // 1re séance de la 17e législature

// Sénat : série électorale → année de renouvellement (= cohorte « mandature »).
// Série 1 renouvelée en 2023 (mandat 2023-2029) ; série 2 en 2020 (mandat 2020-2026).
const SENAT_SERIE_TO_MANDATURE: Record<string, number> = { '1': 2023, '2': 2020 };
const SENAT_MANDATURE_DEBUT: Record<number, Date> = {
  2020: new Date('2020-10-01'),
  2023: new Date('2023-10-01'),
};
const SENAT_DEBUT_FALLBACK = new Date('2020-10-01'); // plancher si série inconnue

export interface BackfillMandatsResult {
  groupesUpdated: number;
  scrutinsUpdated: number;
  mandatsCreated: number;
  mandatsSkipped: number;
  senateursSerieInconnue: number;
}

export async function backfillMandatsParlementaires(): Promise<BackfillMandatsResult> {
  // --- 1. Backfill scalaire (AN → legislature 17) --------------------------
  const groupes = await prisma.groupePolitique.updateMany({
    where: { chambre: 'assemblee', legislature: null },
    data: { legislature: LEGISLATURE_AN_COURANTE },
  });
  const scrutins = await prisma.scrutin.updateMany({
    where: { chambre: 'assemblee', legislature: null },
    data: { legislature: LEGISLATURE_AN_COURANTE },
  });
  logger.info(
    { groupes: groupes.count, scrutins: scrutins.count },
    'Backfill scalaire legislature=17 (AN) terminé',
  );

  // --- 2. Bootstrap des mandats parlementaires -----------------------------
  const parlementaires = await prisma.parlementaire.findMany({
    select: {
      id: true,
      chambre: true,
      actif: true,
      groupeId: true,
      circonscriptionId: true,
      serie: true,
      commissionPermanente: true,
      statsPresence: true,
      statsPresenceSolennel: true,
      statsLoyaute: true,
      statsParticipation: true,
      statsInterventions: true,
      statsAmendements: true,
      statsAmendementsAdoptes: true,
      statsQuestions: true,
      statsCalculatedAt: true,
    },
  });

  let created = 0;
  let skipped = 0;
  let serieInconnue = 0;

  for (const p of parlementaires) {
    let legislature: number | null = null;
    let mandature: number | null = null;
    let dateDebut: Date;

    if (p.chambre === 'senat') {
      mandature = p.serie ? SENAT_SERIE_TO_MANDATURE[p.serie] ?? null : null;
      if (mandature === null) serieInconnue++;
      dateDebut = (mandature && SENAT_MANDATURE_DEBUT[mandature]) || SENAT_DEBUT_FALLBACK;
    } else {
      legislature = LEGISLATURE_AN_COURANTE;
      dateDebut = LEGISLATURE_17_DEBUT;
    }

    // Idempotence : ne pas recréer un mandat déjà bootstrappé pour cette personne/période.
    const existing = await prisma.mandatParlementaire.findFirst({
      where: { personneId: p.id, chambre: p.chambre, legislature, mandature },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.mandatParlementaire.create({
      data: {
        personneId: p.id,
        chambre: p.chambre,
        legislature,
        mandature,
        serie: p.serie,
        dateDebut,
        dateFin: null, // « en cours » au bootstrap ; raffiné par l'ingestion Phase 1
        groupeId: p.groupeId,
        circonscriptionId: p.circonscriptionId,
        commissionPermanente: p.commissionPermanente,
        statsPresence: p.statsPresence,
        statsPresenceSolennel: p.statsPresenceSolennel,
        statsLoyaute: p.statsLoyaute,
        statsParticipation: p.statsParticipation,
        statsInterventions: p.statsInterventions,
        statsAmendements: p.statsAmendements,
        statsAmendementsAdoptes: p.statsAmendementsAdoptes,
        statsQuestions: p.statsQuestions,
        statsCalculatedAt: p.statsCalculatedAt,
      },
    });
    created++;
  }

  logger.info(
    { created, skipped, serieInconnue },
    'Bootstrap des mandats parlementaires terminé',
  );

  return {
    groupesUpdated: groupes.count,
    scrutinsUpdated: scrutins.count,
    mandatsCreated: created,
    mandatsSkipped: skipped,
    senateursSerieInconnue: serieInconnue,
  };
}
