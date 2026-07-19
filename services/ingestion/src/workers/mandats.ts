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

/** Borne basse plausible d'un mandat AN : début de la Ve République. */
const AN_MANDAT_DATE_MIN = new Date('1958-01-01');

/** Écarte une date de mandat source aberrante (avant 1958 ou plus d'un an dans le futur) :
 *  on préfère alors le fallback (bornes de législature) à une date corrompue. */
function clampMandatDateAN(date: Date | null, at: Date): Date | null {
  if (!date) return null;
  const maxPlausible = new Date(at);
  maxPlausible.setFullYear(maxPlausible.getFullYear() + 1);
  if (date < AN_MANDAT_DATE_MIN || date > maxPlausible) return null;
  return date;
}

/**
 * Surcharge un contexte de mandat AN (bornes de législature) par les VRAIES dates du
 * mandat source quand elles sont présentes et plausibles. Sans dateFin source, on
 * retombe sur `ctx.dateFin` (fin de législature en historique, null en courant) : un
 * député parti en cours de législature ne doit pas être daté sur toute la période.
 */
export function mandatContextANDepuisSource(
  ctx: MandatContext,
  mandatDateDebut: Date | null,
  mandatDateFin: Date | null,
  at: Date = new Date(),
): MandatContext {
  return {
    ...ctx,
    dateDebut: clampMandatDateAN(mandatDateDebut, at) ?? ctx.dateDebut,
    dateFin: clampMandatDateAN(mandatDateFin, at) ?? ctx.dateFin,
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
 * Upsert idempotent d'un `MandatParlementaire`.
 *
 * N'écrit QUE les champs d'identité/contexte (groupe/circo/dates). Les
 * statistiques sont volontairement laissées intactes : elles sont calculées
 * séparément (stats-calculator) et ne doivent jamais être remises à null par
 * un simple run d'ingestion.
 *
 * La contrainte DB [personne, chambre, legislature, mandature] tolère plusieurs
 * lignes par mandature au Sénat (`legislature` NULL ⇒ NULLS DISTINCT). C'est
 * VOULU : une même cohorte peut porter plusieurs périodes de service (retour de
 * ministre). Le vrai dédoublonnage est donc applicatif, ci-dessous, et repose sur
 * la SÉPARATION DES RESPONSABILITÉS entre les deux sources Sénat :
 *   - le sync `senateurs.json` possède le mandat COURANT (ouvert, `dateFin` null) ;
 *   - le worker ODSEN possède les mandats CLOS historiques (`dateFin` non null).
 * Aucun des deux ne touche jamais une ligne qui appartient à l'autre.
 */
export async function upsertMandatParlementaire(
  prisma: PrismaLike,
  input: UpsertMandatInput,
): Promise<{ created: boolean }> {
  if (input.chambre === 'assemblee') {
    return upsertMandatAN(prisma, input);
  }
  // Le contexte discrimine le propriétaire : `dateFin` null ⇒ mandat courant (sync),
  // sinon ⇒ mandat clos historique (ODSEN).
  return input.ctx.dateFin === null
    ? upsertMandatSenatCourant(prisma, input)
    : upsertMandatSenatClos(prisma, input);
}

/** AN : une seule période de service par (personne, législature) — la mandature est
 *  toujours null. On matche donc sur la seule législature et on réécrit les dates,
 *  désormais fournies par la source (idempotent). */
async function upsertMandatAN(
  prisma: PrismaLike,
  input: UpsertMandatInput,
): Promise<{ created: boolean }> {
  const { personneId, chambre, ctx } = input;

  const existing = await prisma.mandatParlementaire.findFirst({
    where: { personneId, chambre, legislature: ctx.legislature },
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
    data: mandatCreateData(input, ctx.dateDebut),
  });
  return { created: true };
}

/**
 * Sénat, chemin SYNC (`senateurs.json`) : le mandat reçu est COURANT (`dateFin` null).
 * On ne raisonne PAS sur la mandature dérivée pour matcher (le retour de ministre
 * partage la cohorte de sa ligne close), mais sur le mandat OUVERT de la personne.
 */
async function upsertMandatSenatCourant(
  prisma: PrismaLike,
  input: UpsertMandatInput,
): Promise<{ created: boolean }> {
  const { personneId, ctx } = input;

  const ouvert = await prisma.mandatParlementaire.findFirst({
    where: { personneId, chambre: 'senat', dateFin: null },
    select: { id: true, mandature: true },
  });

  let created: boolean;

  if (ouvert) {
    const memeMandatureOuPosterieure =
      ouvert.mandature === null || ctx.mandature === null || ouvert.mandature >= ctx.mandature;

    if (memeMandatureOuPosterieure) {
      // Même période de service : on rafraîchit le contexte d'époque SANS toucher aux
      // dates. `dateDebut` a pu être raffinée par ODSEN avec la vraie date d'entrée
      // (remplaçant, retour de ministre) ; l'écraser au début de cohorte la perdrait.
      await prisma.mandatParlementaire.update({
        where: { id: ouvert.id },
        data: {
          serie: ctx.serie,
          mandature: ctx.mandature,
          groupeId: input.groupeId,
          circonscriptionId: input.circonscriptionId,
          commissionPermanente: input.commissionPermanente,
        },
      });
      created = false;
    } else {
      // Renouvellement (sénateur réélu sur une NOUVELLE mandature, ex. sept. 2026) :
      // on clôt l'ancienne période à sa fin de droit et on en ouvre une nouvelle,
      // pour conserver l'historique de groupe/circo d'époque au lieu de l'écraser.
      await prisma.mandatParlementaire.update({
        where: { id: ouvert.id },
        data: { dateFin: senatMandatFinTheorique(ouvert.mandature!) },
      });
      await prisma.mandatParlementaire.create({
        data: mandatCreateData(input, ctx.dateDebut),
      });
      created = true;
    }
  } else {
    // Aucune période ouverte : création. La date de début fallback évite de chevaucher
    // une période close récente (retour de ministre qui reprend son siège après une
    // parenthèse : sa ligne close finit après le début de cohorte).
    const dateDebut = await dateDebutCreationSenat(prisma, personneId, ctx.dateDebut);
    await prisma.mandatParlementaire.create({
      data: mandatCreateData(input, dateDebut),
    });
    created = true;
  }

  // Filet : des périodes ouvertes de mandature strictement antérieure resteraient
  // ouvertes si un run précédent avait raté le renouvellement → on les clôt.
  if (ctx.mandature !== null) {
    await cloturerMandatsSenatAnterieurs(prisma, personneId, ctx.mandature);
  }

  return { created };
}

/**
 * Sénat, chemin ODSEN : le mandat reçu est CLOS (`dateFin` non null). On matche une
 * période close par sa date de début réelle ; on ne touche JAMAIS une ligne ouverte
 * (le roster courant appartient au sync).
 */
async function upsertMandatSenatClos(
  prisma: PrismaLike,
  input: UpsertMandatInput,
): Promise<{ created: boolean }> {
  const { personneId, ctx } = input;

  const existing = await prisma.mandatParlementaire.findFirst({
    where: { personneId, chambre: 'senat', dateDebut: ctx.dateDebut, dateFin: { not: null } },
    select: { id: true },
  });

  if (existing) {
    await prisma.mandatParlementaire.update({
      where: { id: existing.id },
      data: {
        mandature: ctx.mandature,
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
    data: mandatCreateData(input, ctx.dateDebut),
  });
  return { created: true };
}

/** Payload de création d'un mandat : le contexte, avec la `dateDebut` déjà résolue
 *  (fallback anti-chevauchement pour le chemin sync). */
function mandatCreateData(
  input: UpsertMandatInput,
  dateDebut: Date,
): Prisma.MandatParlementaireUncheckedCreateInput {
  const { personneId, chambre, ctx } = input;
  return {
    personneId,
    chambre,
    legislature: ctx.legislature,
    mandature: ctx.mandature,
    serie: ctx.serie,
    dateDebut,
    dateFin: ctx.dateFin,
    groupeId: input.groupeId,
    circonscriptionId: input.circonscriptionId,
    commissionPermanente: input.commissionPermanente,
  };
}

/** Date de début d'un mandat courant créé de zéro. Si la personne a une période close
 *  récente qui déborde le début de cohorte (retour de ministre), on démarre le
 *  lendemain de cette fin pour ne pas chevaucher ; sinon on prend le début de cohorte. */
async function dateDebutCreationSenat(
  prisma: PrismaLike,
  personneId: string,
  fallback: Date,
): Promise<Date> {
  const clos = await prisma.mandatParlementaire.findMany({
    where: { personneId, chambre: 'senat', dateFin: { not: null } },
    select: { dateFin: true },
  });

  let plusRecente: Date | null = null;
  for (const m of clos) {
    if (m.dateFin && (plusRecente === null || m.dateFin > plusRecente)) plusRecente = m.dateFin;
  }

  if (plusRecente && plusRecente >= fallback) {
    return new Date(plusRecente.getTime() + 24 * 60 * 60 * 1000);
  }
  return fallback;
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
