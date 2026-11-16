import { describe, expect, it } from "vitest";
import {
  listeRestreinte,
  parseSenatorialesParams,
  sortantsCirconscriptionQuery,
} from "./params.ts";

describe("listeRestreinte", () => {
  it("un tri seul ne restreint pas la liste", () => {
    expect(listeRestreinte(parseSenatorialesParams({ tri: "nom" }))).toBe(false);
  });

  it("un département ou un groupe la restreignent", () => {
    expect(listeRestreinte(parseSenatorialesParams({ departement: "33" }))).toBe(true);
    expect(listeRestreinte(parseSenatorialesParams({ groupe: "groupe-exemple-a" }))).toBe(true);
  });
});

describe("parseSenatorialesParams", () => {
  it("sans paramètres : tout est vide", () => {
    expect(parseSenatorialesParams()).toEqual({ search: "", departement: "", groupe: "", tri: "" });
  });
});

describe("sortantsCirconscriptionQuery", () => {
  it("demande les sortants du département par ordre alphabétique", () => {
    expect(sortantsCirconscriptionQuery("2A")).toEqual({ departement: "2A", tri: "nom" });
  });
});
