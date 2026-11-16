import { asString, type QueryParams } from "@clair/ui";

/**
 * Onglets de la page d'un gouvernement. Les valeurs reprennent les ancres de apps/web
 * (`#composition`, `#textes`, `#censure`, `#postes`) : les anciens liens restent lisibles.
 */
export const ONGLETS_GOUVERNEMENT = ["composition", "textes", "censure", "postes"] as const;
export type OngletGouvernement = (typeof ONGLETS_GOUVERNEMENT)[number];

/**
 * État de la page d'un gouvernement dans l'URL : l'onglet ouvert (`onglet`) et l'étape de la
 * composition choisie (`etape`, date `YYYY-MM-DD` ; vide : la dernière, composition actuelle ou
 * finale). apps/web gardait l'étape en mémoire.
 */
export type GouvernementFicheParams = {
  onglet: OngletGouvernement | null;
  etape: string;
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export const parseGouvernementFicheParams = (params: QueryParams = {}): GouvernementFicheParams => {
  const onglet = asString(params.onglet);
  const etape = asString(params.etape);
  return {
    onglet: ONGLETS_GOUVERNEMENT.find((valeur) => valeur === onglet) ?? null,
    etape: JOUR.test(etape) ? etape : "",
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const gouvernementFicheParamsOf = (params: GouvernementFicheParams) => ({
  onglet: params.onglet === "composition" ? null : params.onglet,
  etape: params.onglet === null || params.onglet === "composition" ? params.etape : "",
});

/**
 * Onglet affiché : celui de l'URL s'il existe pour ce gouvernement (pas de bilan avant juin
 * 2017, donc ni textes ni censure), la composition sinon.
 */
export const ongletEffectif = (
  demande: OngletGouvernement | null,
  disponibles: readonly OngletGouvernement[],
): OngletGouvernement => (demande && disponibles.includes(demande) ? demande : "composition");
