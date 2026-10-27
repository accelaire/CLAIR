import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import {
  actionsQueryOf,
  aDesFiltres,
  lobbyingActionsParamsOf,
  parseLobbyingActionsParams,
} from "./params.ts";

describe("paramètres des actions de lobbying", () => {
  it("lit les filtres de l'URL et ignore les valeurs inconnues", () => {
    expect(
      parseLobbyingActionsParams({
        search: " eau ",
        cible: "ministre",
        texteVise: "Actes réglementaires",
        secteurs: "energie",
        sort: "lobbyiste",
        order: "asc",
        dateFrom: "2026-01-01",
        dateTo: "2026-13",
        page: "4",
      }),
    ).toEqual({
      search: "eau",
      cible: "ministre",
      texteVise: "Actes réglementaires",
      secteurs: ["energie"],
      sort: "lobbyiste",
      order: "asc",
      dateFrom: "2026-01-01",
      dateTo: "",
      page: 4,
    });
    expect(
      parseLobbyingActionsParams({ cible: "x", texteVise: "inventé", sort: "x" }),
    ).toMatchObject({ cible: "", texteVise: "", sort: "dateDebut", order: "desc" });
  });

  it("réécrit l'URL sans les valeurs par défaut et complète la requête", () => {
    const params = parseLobbyingActionsParams({ cible: "parlementaire", page: "2" });
    expect(buildHref("/lobbying/actions", lobbyingActionsParamsOf(params))).toBe(
      "/lobbying/actions?cible=parlementaire&page=2",
    );
    expect(actionsQueryOf(params)).toMatchObject({
      sort: "dateDebut",
      order: "desc",
      page: 2,
      limit: 20,
    });
    expect(aDesFiltres(params)).toBe(true);
    expect(aDesFiltres(parseLobbyingActionsParams({ order: "asc" }))).toBe(false);
  });
});
