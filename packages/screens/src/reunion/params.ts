import { asString, type QueryParams } from "@clair/ui";

/** Prises de parole par page du débat (le plafond de l'API). */
export const PRISES_PAR_PAGE = 200;

/**
 * État de la page d'une réunion dans l'URL. `vote` et `rang` sont ceux de apps/web (lien
 * « voir dans la séance » depuis un scrutin) ; `debat` y ajoute la page du débat, que apps/web
 * chargeait en défilement continu.
 */
export type ReunionParams = {
  /** Identifiant du scrutin d'où l'on arrive. */
  vote: string;
  /** Rang de la première prise de parole du débat de ce vote. */
  rang: number | null;
  /** Page du débat demandée ; `null` : celle du rang suivi, sinon la première. */
  debat: number | null;
};

export const parseReunionParams = (params: QueryParams = {}): ReunionParams => {
  const rang = Number.parseInt(asString(params.rang), 10);
  const debat = Number.parseInt(asString(params.debat), 10);
  return {
    vote: asString(params.vote),
    rang: Number.isFinite(rang) && rang >= 0 ? rang : null,
    debat: Number.isFinite(debat) && debat >= 1 ? debat : null,
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const reunionParamsOf = (params: ReunionParams) => ({
  vote: params.vote,
  rang: params.rang,
  debat: params.debat !== null && params.debat > 1 ? params.debat : null,
});

/**
 * Page du débat qui contient un rang. Les rangs d'une séance se suivent à partir de 1 : la
 * page se déduit donc du rang sans charger celles qui précèdent.
 */
export const pageDuRang = (rang: number) => Math.max(1, Math.ceil(rang / PRISES_PAR_PAGE));

/** Page du débat affichée : celle de l'URL, sinon celle du vote suivi, sinon la première. */
export const pageDuDebat = (params: ReunionParams) =>
  params.debat ?? (params.rang !== null ? pageDuRang(params.rang) : 1);

/** Ancre d'une prise de parole par son rang. */
export const ancreDuRang = (rang: number) => `prise-${rang}`;
