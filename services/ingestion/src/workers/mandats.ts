// =============================================================================
// Mandats parlementaires — dérivation + upsert idempotent (Phase 1)
// Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
//
// Source unique de vérité pour :
//   - les bornes temporelles d'une législature (AN) / mandature (Sénat) ;
//   - la dérivation du contexte de mandat (legislature/mandature/série/dates) ;
//   - l'upsert idempotent d'un `MandatParlementaire` sur la clé
//     [personne, chambre, legislature, mandature].
//
// Utilisé à la fois par le backfill Phase 0 (`backfill-mandats.ts`) et par
// l'ingestion Phase 1 (`sync.ts`) afin d'éviter toute dérive entre les deux.
// =============================================================================

import type { PrismaClient, Prisma } from '@prisma/client';

/** Législature AN « courante » : celle dont l'ingestion alimente la table
 *  `parlementaires` (groupe/circo/actif affichés). Les autres sont historiques. */
export const LEGISLATURE_AN_COURANTE = 17;

/** Début de législature (1re séance). Sert de `dateDebut` aux mandats AN. */
export const LEGISLATURE_DEBUT: Record<number, Date> = {
  15: new Date('2017-06-21'),
  16: new Date('2022-06-22'),
  17: new Date('2024-07-18'),
};

/** Fin de législature (dissolution / fin de mandat). `null` = en cours.
 *  16e dissoute le 9 juin 2024 ; 15e close le 21 juin 2022. */
export const LEGISLATURE_FIN: Record<number, Date | null> = {
  15: new Date('2022-06-21'),
  16: new Date('2024-06-09'),
  17: null,
};

// Sénat : série électorale → année de renouvellement (= cohorte « mandature »).
// Série 1 renouvelée en 2023 (mandat 2023-2029) ; série 2 en 2020 (mandat 2020-2026).
export const SENAT_SERIE_TO_MANDATURE: Record<string, number> = { '1': 2023, '2': 2020 };
export const SENAT_MANDATURE_DEBUT: Record<number, Date> = {
  2020: new Date('2020-10-01'),
  2023: new Date('2023-10-01'),
};
export const SENAT_DEBUT_FALLBACK = new Date('2020-10-01'); // plancher si série inconnue

/** Contexte temporel d'un mandat, dérivé de la chambre + législature/série. */
export interface MandatContext {
  legislature: number | null; // AN : 15/16/17 — null pour le Sénat
  mandature: number | null; // Sénat : année de renouvellement — null pour l'AN
  serie: string | null;
  dateDebut: Date;
  dateFin: Date | null;
}

/** Dérive le contexte de mandat pour une législature AN donnée. */
export function deriveMandatContextAN(legislature: number): MandatContext {
  return {
    legislature,
    mandature: null,
    serie: null,
    dateDebut: LEGISLATURE_DEBUT[legislature] ?? LEGISLATURE_DEBUT[LEGISLATURE_AN_COURANTE]!,
    dateFin: LEGISLATURE_FIN[legislature] ?? null,
  };
}

/** Dérive le contexte de mandat pour un sénateur, depuis sa série électorale. */
export function deriveMandatContextSenat(serie: string | null): MandatContext {
  const mandature = serie ? SENAT_SERIE_TO_MANDATURE[serie] ?? null : null;
  return {
    legislature: null,
    mandature,
    serie,
    dateDebut: (mandature && SENAT_MANDATURE_DEBUT[mandature]) || SENAT_DEBUT_FALLBACK,
    dateFin: null,
  };
}

/** Une législature AN est-elle la législature courante (affichée) ? */
export function isLegislatureCourante(legislature: number): boolean {
  return legislature === LEGISLATURE_AN_COURANTE;
}

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface UpsertMandatInput {
  personneId: string;
  chambre: string;
  ctx: MandatContext;
  groupeId: string | null;
  circonscriptionId: string | null;
  commissionPermanente: string | null;
}

/**
 * Upsert idempotent d'un `MandatParlementaire` sur la clé naturelle
 * [personne, chambre, legislature, mandature].
 *
 * N'écrit QUE les champs d'identité/contexte (groupe/circo/dates). Les
 * statistiques sont volontairement laissées intactes : elles sont calculées
 * séparément (stats-calculator) et ne doivent jamais être remises à null par
 * un simple run d'ingestion.
 */
export async function upsertMandatParlementaire(
  prisma: PrismaLike,
  input: UpsertMandatInput,
): Promise<{ created: boolean }> {
  const { personneId, chambre, ctx } = input;

  const existing = await prisma.mandatParlementaire.findFirst({
    where: { personneId, chambre, legislature: ctx.legislature, mandature: ctx.mandature },
    select: { id: true },
  });

  if (existing) {
    await prisma.mandatParlementaire.update({
      where: { id: existing.id },
      data: {
        serie: ctx.serie,
        dateDebut: ctx.dateDebut,
        dateFin: ctx.dateFin,
        groupeId: input.groupeId,
        circonscriptionId: input.circonscriptionId,
        commissionPermanente: input.commissionPermanente,
      },
    });
    return { created: false };
  }

  await prisma.mandatParlementaire.create({
    data: {
      personneId,
      chambre,
      legislature: ctx.legislature,
      mandature: ctx.mandature,
      serie: ctx.serie,
      dateDebut: ctx.dateDebut,
      dateFin: ctx.dateFin,
      groupeId: input.groupeId,
      circonscriptionId: input.circonscriptionId,
      commissionPermanente: input.commissionPermanente,
    },
  });
  return { created: true };
}
