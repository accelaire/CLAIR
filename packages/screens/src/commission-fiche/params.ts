import { asString, type QueryParams } from "@clair/ui";

export const ONGLETS_COMMISSION = ["membres", "agenda", "historique", "dossiers"] as const;
export type OngletCommission = (typeof ONGLETS_COMMISSION)[number];

/** États proposés en filtre des textes : ceux qu'accepte `/commissions/:slug/dossiers`. */
export const ETATS_DOSSIER = [
  "en_cours",
  "adopte",
  "promulgue",
  "rejete",
  "retire",
  "caduc",
  "fusionne",
] as const;
export type EtatDossierFiltre = (typeof ETATS_DOSSIER)[number];

/**
 * État de la fiche d'une commission dans l'URL. apps/web gardait tout en mémoire ; les clés
 * reprennent celles du site (`tab` comme sur un dossier, `role`, `etat`, `dateFrom`, `dateTo`).
 * `page` vaut pour la liste de l'onglet ouvert (historique ou textes).
 */
export type CommissionFicheParams = {
  /** Onglet demandé ; `null` : l'onglet par défaut selon le type de l'organe. */
  tab: OngletCommission | null;
  role: "fond" | "avis" | "";
  etat: EtatDossierFiltre | "";
  /** Jour `YYYY-MM-DD` (date de dépôt du texte). */
  dateFrom: string;
  dateTo: string;
  page: number;
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export const parseCommissionFicheParams = (params: QueryParams = {}): CommissionFicheParams => {
  const tab = asString(params.tab);
  const role = asString(params.role);
  const etat = asString(params.etat);
  const dateFrom = asString(params.dateFrom);
  const dateTo = asString(params.dateTo);
  const page = Number.parseInt(asString(params.page), 10);
  return {
    tab: ONGLETS_COMMISSION.find((valeur) => valeur === tab) ?? null,
    role: role === "fond" || role === "avis" ? role : "",
    etat: ETATS_DOSSIER.find((valeur) => valeur === etat) ?? "",
    dateFrom: JOUR.test(dateFrom) ? dateFrom : "",
    dateTo: JOUR.test(dateTo) ? dateTo : "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const commissionFicheParamsOf = (params: CommissionFicheParams) => ({
  tab: params.tab,
  role: params.role,
  etat: params.etat,
  dateFrom: params.dateFrom,
  dateTo: params.dateTo,
  page: params.page > 1 ? params.page : null,
});

/** Onglets que l'organe peut montrer : l'hémicycle n'a ni membres ni textes saisis. */
export const ongletsDisponibles = (commission: {
  type: string;
  nbDossiers: number;
}): OngletCommission[] => {
  const hemicycle = commission.type === "hemicycle";
  return ONGLETS_COMMISSION.filter((onglet) => {
    if (onglet === "membres") return !hemicycle;
    if (onglet === "dossiers") return !hemicycle && commission.nbDossiers > 0;
    return true;
  });
};

/**
 * Onglet affiché : celui de l'URL s'il est disponible, sinon les membres, ou les séances passées
 * pour l'hémicycle (comme apps/web).
 */
export const ongletEffectif = (
  demande: OngletCommission | null,
  disponibles: OngletCommission[],
): OngletCommission => {
  if (demande && disponibles.includes(demande)) return demande;
  return disponibles.includes("membres") ? "membres" : "historique";
};
