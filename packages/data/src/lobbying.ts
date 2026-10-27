import type { PageMeta } from "./common.ts";

/**
 * Lobbying (répertoire des représentants d'intérêts de la HATVP), tel que le renvoie l'API
 * (apps/api, module lobbying) : liste (`/lobbying`), secteurs (`/lobbying/secteurs`),
 * statistiques (`/lobbying/stats`), détail (`/lobbying/:id`), actions (`/lobbying/actions`,
 * `/lobbying/actions/recent`). Relevé sur l'API le 2026-10-26 ; seuls les champs utiles au
 * site sont typés.
 */

/** Types de représentants d'intérêts acceptés en filtre par l'API (`type` de `/lobbying`). */
export const LOBBYISTE_TYPES = [
  "entreprise",
  "association",
  "cabinet",
  "syndicat",
  "organisation_pro",
] as const;
export type LobbyisteType = (typeof LOBBYISTE_TYPES)[number];

/** Libellés des types de représentants d'intérêts. */
export const LOBBYISTE_TYPE_LIBELLES: Record<LobbyisteType, string> = {
  entreprise: "Entreprise",
  association: "Association",
  cabinet: "Cabinet de conseil",
  syndicat: "Syndicat",
  organisation_pro: "Organisation professionnelle",
};

/** Catégories de responsables publics visés par une action (`cible`). */
export const LOBBYING_CIBLES = [
  "parlementaire",
  "ministre",
  "presidence",
  "collectivite",
  "autorite",
  "administration",
] as const;
export type LobbyingCible = (typeof LOBBYING_CIBLES)[number];

/** Libellés courts des cibles. */
export const LOBBYING_CIBLE_LIBELLES: Record<LobbyingCible, string> = {
  parlementaire: "Parlement",
  ministre: "Gouvernement",
  presidence: "Présidence",
  collectivite: "Collectivités",
  autorite: "Autorités administratives indépendantes",
  administration: "Administration",
};

/** Secteur d'activité normalisé (`secteursList`). */
export type SecteurRef = { slug: string; label: string };

/** Représentant d'intérêts dans une liste (`/lobbying`). */
export type LobbyisteListItem = {
  id: string;
  siren: string | null;
  nom: string;
  /** Type déclaré ; une valeur inconnue des libellés reste affichée telle quelle. */
  type: string | null;
  /** Secteurs déclarés, en texte libre (repli quand `secteursList` est vide). */
  secteur: string | null;
  ville: string | null;
  siteWeb: string | null;
  /** Budget annuel déclaré, en euros (déclaratif, par tranches). */
  budgetAnnuel: number | null;
  nbLobbyistes: number | null;
  actionsCount: number;
  secteursList: SecteurRef[];
};

export type LobbyistesPage = PageMeta<LobbyisteListItem>;

/** Secteur proposé en filtre (`/lobbying/secteurs`, réponse `{ data }`). */
export type LobbyingSecteur = {
  slug: string;
  name: string;
  lobbyistesCount: number;
  actionsCount: number;
};

/** Chiffres globaux (`/lobbying/stats`, réponse `{ data }`). */
export type LobbyingStats = {
  totalLobbyistes: number;
  totalActions: number;
  budgetTotal: number;
  totalSecteurs: number;
};

/** Parlementaire rencontré lors d'une action, quand la déclaration le rattache. */
export type LobbyingParlementaire = {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  photoUrl?: string | null;
  groupe: { nom: string; couleur: string | null; slug?: string } | null;
};

/** Action de représentation d'intérêts (activité déclarée). */
export type LobbyingAction = {
  id: string;
  /** Objet de l'action ; peut commencer par ses secteurs entre crochets (« [Énergie] … »). */
  description: string;
  cible: string | null;
  /** Libellé officiel de la catégorie de responsables publics visés. */
  cibleNom: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  texteVise: string | null;
  texteViseNom: string | null;
  secteursList: SecteurRef[];
  parlementaire: LobbyingParlementaire | null;
};

/** Action dans la liste générale (`/lobbying/actions`), avec son auteur. */
export type LobbyingActionListItem = LobbyingAction & {
  lobbyiste: {
    id: string;
    nom: string;
    type: string | null;
    secteur: string | null;
    siteWeb: string | null;
  };
};

export type LobbyingActionsPage = PageMeta<LobbyingActionListItem>;

/** Fiche d'un représentant d'intérêts (`/lobbying/:id`, réponse `{ data }`). */
export type LobbyisteDetail = Omit<LobbyisteListItem, "actionsCount"> & {
  adresse: string | null;
  codePostal: string | null;
  /** Les 50 actions les plus récentes (limite de l'API). */
  actions: LobbyingAction[];
};
