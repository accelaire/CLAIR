import type { PositionVote } from "@clair/data";
import { asString, type QueryParams } from "@clair/ui";
import { parsePage } from "../scrutins-liste/params.ts";
import { scrutinQuery } from "../shared/scrutins.ts";

export const ONGLETS = ["amendements", "debats", "vote"] as const;
export type Onglet = (typeof ONGLETS)[number];

export const POSITIONS: PositionVote[] = ["pour", "contre", "abstention", "absent"];

/** Natures de prise de parole, dans l'ordre où elles se lisent (libellés repris de apps/web). */
export const NATURES_PAROLE = [
  { valeur: "explication_vote", libelle: "Explications de vote" },
  { valeur: "intervention", libelle: "Interventions" },
  { valeur: "question", libelle: "Questions" },
  { valeur: "reponse_gouvernement", libelle: "Réponses du Gouvernement" },
] as const;
export type NatureParole = (typeof NATURES_PAROLE)[number]["valeur"];

/** `toutes` : choix explicite de toutes les natures (sinon les explications de vote passent devant). */
export type NatureDebat = NatureParole | "toutes" | "";

/**
 * État de la fiche d'un scrutin dans l'URL. `chambre` et `session` identifient le scrutin (son
 * numéro seul est ambigu) ; les autres clés sont l'onglet et les filtres de ses panneaux.
 */
export type ScrutinFicheParams = {
  chambre: "assemblee" | "senat";
  session: string;
  onglet: Onglet | "";
  /** Vote : sigle du groupe affiché. */
  groupe: string;
  /** Vote : position affichée. */
  position: PositionVote | "";
  /** Débats : nature des prises de parole. */
  nature: NatureDebat;
  /** Débats : ordre chronologique. */
  ordre: "asc" | "desc";
  /** Débats : recherche dans le contenu ou le nom de l'orateur. */
  q: string;
  /** Débats : page. */
  page: number;
};

const parmi = <T extends string>(valeurs: readonly T[], valeur: string): T | "" =>
  valeurs.find((item) => item === valeur) ?? "";

/** Lit l'URL ; une valeur inconnue est ignorée, la chambre vaut l'Assemblée par défaut (comme l'API). */
export const parseScrutinFicheParams = (params: QueryParams = {}): ScrutinFicheParams => {
  const nature = asString(params.nature);
  return {
    chambre: asString(params.chambre) === "senat" ? "senat" : "assemblee",
    session: asString(params.session).trim(),
    onglet: parmi(ONGLETS, asString(params.onglet)),
    groupe: asString(params.groupe),
    position: parmi(POSITIONS, asString(params.position)),
    nature:
      nature === "toutes"
        ? "toutes"
        : parmi(
            NATURES_PAROLE.map((item) => item.valeur),
            nature,
          ),
    ordre: asString(params.ordre) === "desc" ? "desc" : "asc",
    q: asString(params.q).trim(),
    page: parsePage(params.page),
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const scrutinFicheParamsOf = (params: ScrutinFicheParams) => ({
  ...scrutinQuery(params),
  onglet: params.onglet,
  groupe: params.groupe,
  position: params.position,
  nature: params.nature,
  ordre: params.ordre === "desc" ? "desc" : null,
  q: params.q,
  page: params.page > 1 ? params.page : null,
});

/** Requête `/scrutins/:numero` : la chambre et la session seules. */
export const scrutinApiQuery = (params: Pick<ScrutinFicheParams, "chambre" | "session">) =>
  scrutinQuery(params);

/** Numéro de scrutin de l'adresse : entier positif, sinon `null` (404). */
export const parseNumero = (raw: string): number | null =>
  /^\d{1,6}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
