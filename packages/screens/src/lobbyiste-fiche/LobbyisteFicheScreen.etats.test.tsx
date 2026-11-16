import type { LobbyingAction, LobbyisteDetail } from "@clair/data";
import { describe, expect, it } from "vitest";
import { lobbyisteDetailExemple } from "../lobbying-liste/fixtures.ts";
import { renderScreen } from "../test-utils.tsx";
import { LobbyisteFicheScreen, siteWebHref } from "./LobbyisteFicheScreen.tsx";

const ID = lobbyisteDetailExemple.id;
const CHEMIN = `/lobbying/${ID}`;

const rendre = (lobbyiste: LobbyisteDetail, params: Record<string, string> = {}) =>
  renderScreen(<LobbyisteFicheScreen id={ID} params={params} initialData={{ data: lobbyiste }} />, {
    routes: {},
    pathname: CHEMIN,
  });

/** Représentant FICTIF sans aucune information facultative. */
const minimal: LobbyisteDetail = {
  ...lobbyisteDetailExemple,
  type: null,
  secteur: null,
  secteursList: [],
  siren: null,
  siteWeb: null,
  adresse: null,
  codePostal: null,
  ville: null,
  budgetAnnuel: null,
  nbLobbyistes: null,
  actions: [],
};

describe("LobbyisteFicheScreen : cas limites", () => {
  it("sans aucune information facultative, n'affiche ni badge ni section Informations", () => {
    const { getByRole, queryByRole, getAllByText, getByText } = rendre(minimal);
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(minimal.nom);
    expect(queryByRole("heading", { name: "Informations" })).toBeNull();
    expect(getAllByText("Non déclaré")).toHaveLength(2);
    expect(queryByRole("term", { name: "Ville" })).toBeNull();
    expect(getByText("Aucune action déclarée")).toBeInTheDocument();
    expect(getByText("Ce représentant n'a déclaré aucune action de lobbying.")).toBeInTheDocument();
    expect(queryByRole("button", { name: "Retirer la période" })).toBeNull();
  });

  it("prend le secteur déclaré à défaut de liste normalisée", () => {
    const { getByText, queryByText } = rendre({
      ...minimal,
      secteur: "Secteur déclaré fictif",
    });
    expect(getByText("Secteur déclaré fictif")).toBeInTheDocument();
    expect(queryByText("Association")).toBeNull();
  });

  it("affiche la ville seule comme adresse, sans site ni SIREN", () => {
    const { getByRole, getByText, queryByText } = rendre({ ...minimal, ville: "VILLE-FICTIVE" });
    expect(getByRole("heading", { name: "Informations" })).toBeInTheDocument();
    expect(getByText("Adresse")).toBeInTheDocument();
    expect(queryByText("Site web")).toBeNull();
    expect(queryByText("SIREN")).toBeNull();
  });

  it("affiche le SIREN seul, sans adresse", () => {
    const { getByText, queryByText } = rendre({ ...minimal, siren: "000000009" });
    expect(getByText("000000009")).toBeInTheDocument();
    expect(queryByText("Adresse")).toBeNull();
  });

  it("signale les 50 actions les plus récentes quand la limite est atteinte", () => {
    const base: LobbyingAction | undefined = lobbyisteDetailExemple.actions[0];
    if (!base) throw new Error("fixture sans action");
    const actions = Array.from({ length: 50 }, (_, index) => ({ ...base, id: `action-${index}` }));
    const { getByText } = rendre({ ...minimal, actions });
    expect(getByText("Les 50 plus récentes")).toBeInTheDocument();
  });

  it("refuse une adresse de site illisible", () => {
    expect(siteWebHref("https://")).toBeNull();
    expect(siteWebHref("HTTP://exemple.invalid")).toBe("http://exemple.invalid/");
  });
});
