import type {
  LobbyingActionListItem,
  LobbyingActionsPage,
  LobbyingSecteur,
  LobbyingStats,
  LobbyisteDetail,
  LobbyisteListItem,
  LobbyistesPage,
} from "@clair/data";

/**
 * Données FICTIVES pour les tests et les stories : organisations et actions inventées,
 * jamais présentées comme réelles.
 */
export const lobbyisteExemple: LobbyisteListItem = {
  id: "00000000-0000-4000-8000-000000000001",
  siren: "000000001",
  nom: "Fédération d'exemple des jardins partagés",
  type: "association",
  secteur: "Environnement, Agriculture",
  ville: "EXEMPLE-SUR-MER",
  siteWeb: "https://exemple.invalid",
  budgetAnnuel: 150000,
  nbLobbyistes: 3,
  actionsCount: 12,
  secteursList: [
    { slug: "environnement", label: "Environnement" },
    { slug: "agriculture", label: "Agriculture" },
  ],
};

export const lobbyisteExemple2: LobbyisteListItem = {
  ...lobbyisteExemple,
  id: "00000000-0000-4000-8000-000000000002",
  siren: null,
  nom: "Cabinet Conseil Exemple",
  type: "cabinet",
  secteur: null,
  budgetAnnuel: null,
  nbLobbyistes: null,
  actionsCount: 0,
  secteursList: [],
};

export const pageLobbyistes = (
  items: LobbyisteListItem[],
  { page = 1, totalPages = 1 }: { page?: number; totalPages?: number } = {},
): LobbyistesPage => ({
  data: items,
  meta: { total: items.length * totalPages, page, limit: 20, totalPages },
});

export const secteursExemple: { data: LobbyingSecteur[] } = {
  data: [
    { slug: "environnement", name: "Environnement", lobbyistesCount: 4, actionsCount: 9 },
    { slug: "agriculture", name: "Agriculture", lobbyistesCount: 2, actionsCount: 3 },
  ],
};

export const statsExemple: { data: LobbyingStats } = {
  data: { totalLobbyistes: 2, totalActions: 12, budgetTotal: 150000, totalSecteurs: 2 },
};

export const actionExemple: LobbyingActionListItem = {
  id: "action-exemple-1",
  description: "[Environnement] Présenter nos propositions sur les jardins partagés",
  cible: "parlementaire",
  cibleNom: "Député, sénateur ou collaborateur parlementaire",
  dateDebut: "2026-03-31T00:00:00.000Z",
  dateFin: null,
  texteVise: "Lois, y compris constitutionnelles",
  texteViseNom: "Lois, y compris constitutionnelles",
  secteursList: [],
  parlementaire: {
    id: "parlementaire-exemple",
    slug: "camille-exemple",
    nom: "Exemple",
    prenom: "Camille",
    photoUrl: null,
    groupe: { nom: "Groupe d'exemple", couleur: null },
  },
  lobbyiste: {
    id: lobbyisteExemple.id,
    nom: lobbyisteExemple.nom,
    type: "association",
    secteur: "Environnement",
    siteWeb: null,
  },
};

export const actionExemple2: LobbyingActionListItem = {
  ...actionExemple,
  id: "action-exemple-2",
  description: "Échanger sur un projet de décret d'exemple",
  cible: "ministre",
  cibleNom: null,
  dateDebut: "2025-06-15T00:00:00.000Z",
  texteViseNom: "Actes réglementaires",
  secteursList: [{ slug: "agriculture", label: "Agriculture" }],
  parlementaire: null,
};

export const pageActions = (
  items: LobbyingActionListItem[],
  { page = 1, totalPages = 1 }: { page?: number; totalPages?: number } = {},
): LobbyingActionsPage => ({
  data: items,
  meta: { total: items.length * totalPages, page, limit: 20, totalPages },
});

export const lobbyisteDetailExemple: LobbyisteDetail = {
  id: lobbyisteExemple.id,
  siren: lobbyisteExemple.siren,
  nom: lobbyisteExemple.nom,
  type: lobbyisteExemple.type,
  secteur: lobbyisteExemple.secteur,
  ville: lobbyisteExemple.ville,
  siteWeb: lobbyisteExemple.siteWeb,
  budgetAnnuel: lobbyisteExemple.budgetAnnuel,
  nbLobbyistes: lobbyisteExemple.nbLobbyistes,
  secteursList: lobbyisteExemple.secteursList,
  adresse: "1 rue de l'Exemple",
  codePostal: "99000",
  actions: [actionExemple, actionExemple2].map(({ lobbyiste: _auteur, ...action }) => action),
};
