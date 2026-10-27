import type { ChambreSwitchValue, QueryParams } from "@clair/ui";
import { asString } from "@clair/ui";
import { NATURES_VOTE } from "../shared/scrutins.ts";

/** Tri des groupes du panneau « Groupes politiques ». */
export type TriGroupes = "amendements" | "votes" | "chambre";

/**
 * État de la fiche d'un sujet dans l'URL. apps/web gardait ces choix en mémoire ; ils passent
 * dans l'adresse pour être partageables : scrutins (`chambre`, `nature`, `page`) et groupes
 * (`groupes` pour la chambre, `tri`).
 */
export type SujetFicheParams = {
  chambre: ChambreSwitchValue;
  nature: string;
  page: number;
  groupes: ChambreSwitchValue;
  tri: TriGroupes;
};

const TRIS: TriGroupes[] = ["amendements", "votes", "chambre"];

const chambreDe = (value: string): ChambreSwitchValue =>
  value === "assemblee" || value === "senat" ? value : "";

export const parseSujetFicheParams = (params: QueryParams = {}): SujetFicheParams => {
  const nature = asString(params.nature);
  const page = Number.parseInt(asString(params.page), 10);
  const tri = TRIS.find((valeur) => valeur === asString(params.tri)) ?? "amendements";
  return {
    chambre: chambreDe(asString(params.chambre)),
    nature: Object.hasOwn(NATURES_VOTE, nature) ? nature : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
    groupes: chambreDe(asString(params.groupes)),
    tri,
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const sujetFicheParamsOf = ({ chambre, nature, page, groupes, tri }: SujetFicheParams) => ({
  chambre: chambre || undefined,
  nature: nature || undefined,
  page: page > 1 ? page : undefined,
  groupes: groupes || undefined,
  tri: tri === "amendements" ? undefined : tri,
});

/**
 * Dossiers chargés avec la fiche, par la route et par l'écran (même clé de cache) : 50 suffisent,
 * un sujet en compte rarement plus de quatre.
 */
export const DOSSIERS_DU_SUJET = { limit: 50 } as const;
