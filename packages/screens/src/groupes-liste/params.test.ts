import { buildHref } from "@clair/ui";
import { describe, expect, it } from "vitest";
import {
  estVueParDefaut,
  groupesEndpointOf,
  groupesListeParamsOf,
  parseGroupesListeParams,
} from "./params.ts";

describe("paramètres de la liste des groupes", () => {
  it("lit l'URL et ignore les valeurs inconnues", () => {
    expect(
      parseGroupesListeParams({
        search: " eco ",
        chambre: "senat",
        session: "2020",
        legislature: "x",
      }),
    ).toEqual({ search: "eco", chambre: "senat", legislature: "", session: "2020" });
    expect(parseGroupesListeParams({ chambre: "lune" }).chambre).toBe("");
  });

  it("choisit la route d'API selon la chambre", () => {
    expect(groupesEndpointOf(parseGroupesListeParams({}))).toBe("/parlementaires/groupes");
    expect(groupesEndpointOf(parseGroupesListeParams({ chambre: "assemblee" }))).toBe(
      "/deputes/groupes",
    );
    expect(groupesEndpointOf(parseGroupesListeParams({ chambre: "senat" }))).toBe(
      "/senateurs/groupes",
    );
  });

  it("réécrit l'URL sans les valeurs vides", () => {
    const params = parseGroupesListeParams({ chambre: "assemblee", legislature: "16" });
    expect(buildHref("/groupes", groupesListeParamsOf(params))).toBe(
      "/groupes?chambre=assemblee&legislature=16",
    );
    expect(estVueParDefaut(params)).toBe(false);
    expect(estVueParDefaut(parseGroupesListeParams({ search: "eco" }))).toBe(true);
  });
});
