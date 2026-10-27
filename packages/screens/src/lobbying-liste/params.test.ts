import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import { aDesFiltres, lobbyingListeParamsOf, parseLobbyingListeParams } from "./params.ts";

describe("paramètres de la liste du lobbying", () => {
  it("lit les filtres de l'URL et ignore les valeurs inconnues", () => {
    expect(
      parseLobbyingListeParams({
        search: " exemple ",
        type: "cabinet",
        secteurs: "energie,,sante",
        sort: "budget",
        order: "desc",
        page: "2",
      }),
    ).toEqual({
      search: "exemple",
      type: "cabinet",
      secteurs: ["energie", "sante"],
      sort: "budget",
      order: "desc",
      page: 2,
    });
    expect(
      parseLobbyingListeParams({ type: "inconnu", sort: "x", order: "y", page: "-1" }),
    ).toEqual({
      search: "",
      type: "",
      secteurs: [],
      sort: "nom",
      order: "asc",
      page: 1,
    });
  });

  it("réécrit l'URL sans les valeurs par défaut", () => {
    const params = parseLobbyingListeParams({ secteurs: "energie,sante" });
    expect(buildHref("/lobbying", lobbyingListeParamsOf(params))).toBe(
      "/lobbying?secteurs=energie%2Csante",
    );
    expect(
      buildHref(
        "/lobbying",
        lobbyingListeParamsOf({ ...params, sort: "nom", order: "desc", page: 3 }),
      ),
    ).toBe("/lobbying?secteurs=energie%2Csante&sort=nom&order=desc&page=3");
    expect(aDesFiltres(params)).toBe(true);
    expect(aDesFiltres(parseLobbyingListeParams({ sort: "budget" }))).toBe(false);
  });
});
