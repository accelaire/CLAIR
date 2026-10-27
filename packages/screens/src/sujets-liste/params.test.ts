import { describe, expect, it } from "vitest";
import { parseSujetsListeParams, sujetsListeParamsOf } from "./params.ts";

describe("paramètres de la liste des sujets", () => {
  it("lit la recherche dans l'URL", () => {
    expect(parseSujetsListeParams({ search: " retraites " })).toEqual({ search: "retraites" });
    expect(parseSujetsListeParams({ search: ["a", "b"] })).toEqual({ search: "a" });
    expect(parseSujetsListeParams()).toEqual({ search: "" });
  });

  it("omet une recherche vide", () => {
    expect(sujetsListeParamsOf({ search: "" })).toEqual({ search: undefined });
    expect(sujetsListeParamsOf({ search: "eau" })).toEqual({ search: "eau" });
  });
});
