import { asString, type QueryParams } from "@clair/ui";

export const TYPES_AGENDA = ["commission", "seance", "evenement"] as const;
export type TypeAgenda = (typeof TYPES_AGENDA)[number];

/**
 * État de l'agenda dans l'URL. Mêmes clés que apps/web (`date`, `chambre`, `type`) ; `mois`
 * (`YYYY-MM`) garde le mois affiché quand aucun jour n'est choisi, que apps/web perdait au
 * rechargement.
 */
export type AgendaParams = {
  /** Jour choisi, `YYYY-MM-DD`. */
  date: string;
  /** Mois affiché sans jour choisi, `YYYY-MM`. */
  mois: string;
  chambre: "assemblee" | "senat" | "";
  type: TypeAgenda | "";
};

const JOUR = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;

export const parseAgendaParams = (params: QueryParams = {}): AgendaParams => {
  const date = asString(params.date);
  const mois = asString(params.mois);
  const chambre = asString(params.chambre);
  const type = asString(params.type);
  return {
    date: JOUR.test(date) ? date : "",
    mois: MOIS.test(mois) ? mois : "",
    chambre: chambre === "assemblee" || chambre === "senat" ? chambre : "",
    type: TYPES_AGENDA.find((valeur) => valeur === type) ?? "",
  };
};

/** Paramètres d'URL : `mois` est inutile quand un jour le donne déjà. */
export const agendaParamsOf = (params: AgendaParams) => ({
  date: params.date,
  mois: params.date ? "" : params.mois,
  chambre: params.chambre,
  type: params.type,
});

/** Jour du calendrier `YYYY-MM-DD` en heure de Paris (le Parlement siège à Paris). */
export const jourParis = (instant: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);

/** Mois affiché (`YYYY-MM`) : celui du jour choisi, sinon `mois`, sinon celui d'aujourd'hui. */
export const moisAffiche = (params: AgendaParams, aujourdhui: string) =>
  (params.date || params.mois || aujourdhui).slice(0, 7);

/** Jour choisi : celui de l'URL ; sans jour ni mois, aujourd'hui (comme apps/web). */
export const jourChoisi = (params: AgendaParams, aujourdhui: string) =>
  params.date || (params.mois ? "" : aujourdhui);

/** Nombre de jours d'un mois `YYYY-MM`. */
export const joursDansLeMois = (mois: string) => {
  const [annee, numero] = mois.split("-").map(Number);
  return new Date(Date.UTC(annee ?? 1970, numero ?? 1, 0)).getUTCDate();
};

/** `2026-03` + 1 → `2026-04`. */
export const decalerMois = (mois: string, ecart: number) => {
  const [annee, numero] = mois.split("-").map(Number);
  const date = new Date(Date.UTC(annee ?? 1970, (numero ?? 1) - 1 + ecart, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Requête `/agenda` du mois affiché (`dateFrom` est obligatoire pour l'API). */
export const agendaQueryOf = (params: AgendaParams, aujourdhui: string) => {
  const mois = moisAffiche(params, aujourdhui);
  return {
    dateFrom: `${mois}-01`,
    dateTo: `${mois}-${String(joursDansLeMois(mois)).padStart(2, "0")}`,
    chambre: params.chambre,
    type: params.type,
    limit: 1000,
  };
};
