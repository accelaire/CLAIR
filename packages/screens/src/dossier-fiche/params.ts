import { asString, type QueryParams } from "@clair/ui";

export const ONGLETS_DOSSIER = ["parcours", "amendements", "scrutins"] as const;
export type OngletDossier = (typeof ONGLETS_DOSSIER)[number];

/**
 * État de la fiche d'un dossier dans l'URL. Mêmes clés que apps/web (`tab`, `groupe`, `sort`,
 * `amendement`) ; `nature`, `voted` et `page` y ajoutent l'objet du vote, le filtre « votes
 * publics » et la page de la liste ouverte (apps/web les gardait en mémoire).
 */
export type DossierFicheParams = {
  /** Onglet demandé ; `null` : l'onglet par défaut, selon ce que le dossier a à montrer. */
  tab: OngletDossier | null;
  /** Slug du groupe de l'auteur des amendements. */
  groupe: string;
  /** Sort exact des amendements (« Adopté », « Rejeté »…). */
  sort: string;
  /** Uid de l'amendement visé par un lien : épinglé en tête de l'onglet. */
  amendement: string;
  /** Objet des scrutins (`ensemble`, `article`, `amendement`…). */
  nature: string;
  /** Seulement les amendements soumis à un scrutin public. */
  voted: boolean;
  /** Page de la liste de l'onglet ouvert. */
  page: number;
};

const isOnglet = (value: string): value is OngletDossier =>
  (ONGLETS_DOSSIER as readonly string[]).includes(value);

export const parseDossierFicheParams = (params: QueryParams = {}): DossierFicheParams => {
  const tab = asString(params.tab);
  const page = Number.parseInt(asString(params.page), 10);
  return {
    tab: isOnglet(tab) ? tab : null,
    groupe: asString(params.groupe),
    sort: asString(params.sort),
    amendement: asString(params.amendement),
    nature: asString(params.nature),
    voted: asString(params.voted) === "true",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const dossierFicheParamsOf = (params: DossierFicheParams) => ({
  tab: params.tab,
  groupe: params.groupe,
  sort: params.sort,
  amendement: params.amendement,
  nature: params.nature,
  voted: params.voted ? "true" : null,
  page: params.page > 1 ? params.page : null,
});

/** Un filtre d'amendement actif : la liste vient alors de la requête filtrée. */
export const filtreAmendementActif = (params: DossierFicheParams) =>
  params.voted || params.groupe !== "" || params.sort !== "";
