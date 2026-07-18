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

// =============================================================================
// Sénat — calendrier des renouvellements (cohorte « mandature »)
//
// La source `senateurs.json` n'expose AUCUNE date de mandat : seulement la série
// électorale. La mandature (= année du renouvellement qui a ouvert le mandat) est
// donc DÉRIVÉE du calendrier, jamais lue de la source.
//
// Depuis 2011, renouvellement par moitiés tous les 3 ans, en alternance ; chaque
// mandat dure 6 ans. Le scrutin a lieu fin septembre, la prise de fonction le 1er
// octobre :
//   - série 1 : 2011, 2017, 2023, 2029…
//   - série 2 : 2014, 2020, 2026, 2032…  (renouvellement du 27 sept. 2026)
// La série "3" est un héritage des tiers pré-2011 : pas de calendrier → mandature null.
//
// ⚠️ Ne JAMAIS figer la mandature dans une map statique : au renouvellement de
// sept. 2026, un sénateur série 2 réélu doit obtenir une NOUVELLE mandature (2026)
// pour que son mandat 2020 soit clos et conservé, au lieu d'être écrasé.
// =============================================================================

export const SENAT_MANDAT_DUREE_ANS = 6;

/** Ancre du calendrier : dernier renouvellement connu de chaque série. */
const SENAT_ANCRE_RENOUVELLEMENT: Record<string, number> = { '1': 2023, '2': 2020 };

export const SENAT_DEBUT_FALLBACK = new Date('2020-10-01'); // plancher si série inconnue

/** Prise de fonction d'une mandature : 1er octobre de l'année du renouvellement. */
export function senatMandatureDebut(mandature: number): Date {
  return new Date(Date.UTC(mandature, 9, 1)); // mois 9 = octobre
}

/** Fin de droit d'un mandat : veille du renouvellement suivant de la même série
 *  (30 septembre, 6 ans plus tard). Sert à clore un mandat sans le supprimer. */
export function senatMandatFinTheorique(mandature: number): Date {
  const suivant = senatMandatureDebut(mandature + SENAT_MANDAT_DUREE_ANS);
  return new Date(suivant.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Mandature d'un sénateur d'une série donnée, observée à la date `at`.
 * = dernier renouvellement de cette série antérieur ou égal à `at`.
 *
 * Ex. série 2 observée le 2026-09-01 → 2020 ; observée le 2026-10-02 → 2026.
 */
export function deriveMandatureSenat(serie: string | null, at: Date = new Date()): number | null {
  if (!serie) return null;
  const ancre = SENAT_ANCRE_RENOUVELLEMENT[serie];
  if (ancre === undefined) return null; // série "3" (pré-2011) ou valeur inconnue

  let mandature = ancre;
  // Avance vers les renouvellements déjà survenus à `at`…
  while (senatMandatureDebut(mandature + SENAT_MANDAT_DUREE_ANS) <= at) {
    mandature += SENAT_MANDAT_DUREE_ANS;
  }
  // …ou recule si `at` est antérieure à l'ancre.
  while (senatMandatureDebut(mandature) > at) {
    mandature -= SENAT_MANDAT_DUREE_ANS;
  }
  return mandature;
}

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

/**
 * Dérive le contexte de mandat d'un sénateur depuis sa série électorale, à la date
 * d'observation `at` (par défaut : maintenant). Le mandat en cours est ouvert
 * (`dateFin: null`) ; c'est l'upsert qui clôt le mandat précédent au renouvellement.
 */
export function deriveMandatContextSenat(serie: string | null, at: Date = new Date()): MandatContext {
  const mandature = deriveMandatureSenat(serie, at);
  return {
    legislature: null,
    mandature,
    serie,
    dateDebut: mandature !== null ? senatMandatureDebut(mandature) : SENAT_DEBUT_FALLBACK,
    dateFin: null,
  };
}

/**
 * Série électorale inférée d'une date de début de mandat qui tombe pile sur un
 * renouvellement (1er octobre d'une année de renouvellement). `null` si la date
 * n'est pas un renouvellement « propre » (remplacement en cours de mandat, etc.).
 *
 * Sert pour les anciens sénateurs (source ODSEN), dont la source n'expose pas la
 * série : un mandat plein 2017-10-01 ⇒ série 1, 2020-10-01 ⇒ série 2, etc.
 */
export function inferSerieSenatDepuisDate(dateDebut: Date): string | null {
  const y = dateDebut.getUTCFullYear();
  if ((y - 2011) % 3 !== 0) return null; // pas une année de renouvellement (cycle de 3 ans)
  // Prise de fonction : tout début du 1er au 3 octobre du renouvellement (la source
  // enregistre tantôt le 1er, tantôt le 2 octobre selon la 1re séance).
  if (dateDebut.getUTCMonth() !== 9 || dateDebut.getUTCDate() > 3) return null;
  return ((y - 2011) / 3) % 2 === 0 ? '1' : '2';
}

/** Année du dernier renouvellement sénatorial (cycle de 3 ans ancré sur 2011, prise
 *  de fonction 1er oct.) à une date donnée, SÉRIE-INDÉPENDANTE. Sert de mandature
 *  stable pour les mandats sans série connue (anciens purs) : ne dépend d'aucune
 *  inférence, donc la clé naturelle ne dérive pas d'un run à l'autre. */
export function renouvellementSenatAvant(date: Date): number {
  const y = date.getUTCFullYear();
  let m = y - ((((y - 2011) % 3) + 3) % 3); // année ≡ 2011 (mod 3), ≤ y
  if (senatMandatureDebut(m) > date) m -= 3; // avant le 1er oct. → cycle précédent
  return m;
}

/** Ramène une fin de mandat tombant pile sur un renouvellement (1er oct.) à la veille
 *  (30 sept.), pour lever le chevauchement d'un jour sortant/entrant. Sinon inchangée. */
export function normaliseFinRenouvellementSenat(dateFin: Date): Date {
  const y = dateFin.getUTCFullYear();
  const estRenouvellement = (y - 2011) % 3 === 0;
  if (estRenouvellement && dateFin.getTime() === senatMandatureDebut(y).getTime()) {
    return new Date(dateFin.getTime() - 24 * 60 * 60 * 1000);
  }
  return dateFin;
}

/** Entrée d'un mandat sénatorial issu de l'open data ODSEN (fichier ELUSEN). */
export interface OdsenMandatInput {
  dateDebut: Date; // eludatdeb (réelle)
  dateFin: Date | null; // eludatfin — `null` si vide dans l'export
  serie: string | null; // série connue (sénateur déjà en base) ou inférée
}

/**
 * Contexte d'un mandat sénatorial dérivé des VRAIES dates ODSEN, en corrigeant la
 * fraîcheur de l'export ELUSEN (voir mémoire « source anciens sénateurs ») : l'export
 * est figé avant le renouvellement de sept. 2023, si bien qu'un mandat de série 1
 * élu en 2017 y apparaît encore « ouvert » alors qu'il s'est terminé le 30 sept. 2023.
 *
 * Règle : un mandat sans date de fin dont la mandature est ANTÉRIEURE à la mandature
 * courante de sa série est en réalité clos → on le ferme à sa fin de droit. Seul le
 * mandat de la mandature courante reste ouvert (`dateFin: null`).
 *
 * Mandature = renouvellement SÉRIE-INDÉPENDANT à la date de début (`renouvellementSenatAvant`).
 * Ce worker n'importe que des mandats CLOS historiques ; le sync `senateurs.json` garde
 * les mandats courants ouverts, de mandature toujours différente ⇒ pas de collision.
 * La série ne pilote donc PAS la clé (elle dépendrait de l'inférence / de la présence en
 * base et dériverait entre deux runs) : elle ne sert qu'à décider la clôture ci-dessous.
 */
export function deriveMandatContextSenatOdsen(
  input: OdsenMandatInput,
  at: Date = new Date(),
): MandatContext {
  const mandature = renouvellementSenatAvant(input.dateDebut);

  // Convention Sénat : la fin d'un mandat = la prise de fonction du successeur (1er
  // octobre du renouvellement). Sans normalisation, sortant et entrant se chevauchent
  // d'un jour et toute la cohorte est comptée deux fois à la session du renouvellement.
  // On ramène donc une fin tombant pile sur un renouvellement à la veille (30 sept.),
  // ce qui aligne aussi sur `senatMandatFinTheorique`.
  let dateFin = input.dateFin ? normaliseFinRenouvellementSenat(input.dateFin) : null;
  if (dateFin === null) {
    const mandatureCourante = input.serie ? deriveMandatureSenat(input.serie, at) : null;
    // Série inconnue OU mandat d'une mandature révolue ⇒ clos à sa fin de droit.
    if (mandatureCourante === null || mandature < mandatureCourante) {
      dateFin = senatMandatFinTheorique(mandature);
    }
  }

  return {
    legislature: null,
    mandature,
    serie: input.serie,
    dateDebut: input.dateDebut,
    dateFin,
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

  let created: boolean;

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
    created = false;
  } else {
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
    created = true;
  }

  // Renouvellement Sénat : le mandat qui vient d'être ouvert sur une nouvelle
  // mandature rend caducs les mandats antérieurs restés ouverts → on les CLÔT
  // (jamais de suppression, jamais d'écrasement de leur groupe/circo d'époque).
  if (chambre === 'senat' && ctx.mandature !== null) {
    await cloturerMandatsSenatAnterieurs(prisma, personneId, ctx.mandature);
  }

  return { created };
}

/** Clôt les mandats sénatoriaux d'une personne antérieurs à `mandatureCourante`
 *  et restés ouverts, à leur fin de droit (veille du renouvellement suivant). */
async function cloturerMandatsSenatAnterieurs(
  prisma: PrismaLike,
  personneId: string,
  mandatureCourante: number,
): Promise<void> {
  const anterieurs = await prisma.mandatParlementaire.findMany({
    where: {
      personneId,
      chambre: 'senat',
      dateFin: null,
      mandature: { lt: mandatureCourante },
    },
    select: { id: true, mandature: true },
  });

  for (const m of anterieurs) {
    await prisma.mandatParlementaire.update({
      where: { id: m.id },
      data: { dateFin: senatMandatFinTheorique(m.mandature!) },
    });
  }
}
