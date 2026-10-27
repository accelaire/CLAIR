import { describe, expect, it } from "vitest";
import { parseSujetFicheParams, sujetFicheParamsOf } from "./params.ts";

describe("paramètres de la fiche d'un sujet", () => {
  it("lit les valeurs connues et ignore les autres", () => {
    expect(
      parseSujetFicheParams({
        chambre: "senat",
        nature: "ensemble",
        page: "3",
        groupes: "assemblee",
        tri: "votes",
      }),
    ).toEqual({
      chambre: "senat",
      nature: "ensemble",
      page: 3,
      groupes: "assemblee",
      tri: "votes",
    });
    expect(
      parseSujetFicheParams({ chambre: "x", nature: "inconnue", page: "-2", tri: "z" }),
    ).toEqual({ chambre: "", nature: "", page: 1, groupes: "", tri: "amendements" });
  });

  it("omet les valeurs par défaut", () => {
    expect(
      sujetFicheParamsOf({ chambre: "", nature: "", page: 1, groupes: "", tri: "amendements" }),
    ).toEqual({
      chambre: undefined,
      nature: undefined,
      page: undefined,
      groupes: undefined,
      tri: undefined,
    });
    expect(
      sujetFicheParamsOf({
        chambre: "senat",
        nature: "article",
        page: 2,
        groupes: "",
        tri: "chambre",
      }),
    ).toEqual({ chambre: "senat", nature: "article", page: 2, groupes: undefined, tri: "chambre" });
  });
});
