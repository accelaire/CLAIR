import { describe, expect, it } from "vitest";
import {
  parseRechercheParams,
  rechercheHref,
  rechercheParamsOf,
  rechercheValide,
  searchQueryOf,
} from "./params.ts";

describe("paramètres de la recherche", () => {
  it("lit le terme, la catégorie et les anciens dans l'URL", () => {
    expect(parseRechercheParams({ q: " Paris ", type: "deputes", anciens: "1" })).toEqual({
      q: "Paris",
      type: "deputes",
      anciens: true,
    });
    expect(parseRechercheParams()).toEqual({ q: "", type: "all", anciens: false });
    expect(parseRechercheParams({ type: "inconnu", anciens: "oui" })).toEqual({
      q: "",
      type: "all",
      anciens: false,
    });
  });

  it("omet les valeurs par défaut", () => {
    expect(rechercheParamsOf({ q: "", type: "all", anciens: false })).toEqual({
      q: undefined,
      type: undefined,
      anciens: undefined,
    });
    expect(rechercheParamsOf({ q: "eau", type: "sujets", anciens: true })).toEqual({
      q: "eau",
      type: "sujets",
      anciens: "1",
    });
  });

  it("construit l'adresse de recherche de l'accueil", () => {
    expect(rechercheHref("  logement social ")).toBe("/recherche?q=logement+social");
    expect(rechercheHref("")).toBe("/recherche");
  });

  it("exige deux caractères", () => {
    expect(rechercheValide({ q: "a" })).toBe(false);
    expect(rechercheValide({ q: "ab" })).toBe(true);
  });

  it("interroge toutes les catégories, ou une seule paginée", () => {
    expect(searchQueryOf({ q: "eau", type: "all", anciens: false })).toEqual({
      q: "eau",
      type: "all",
      inclureAnciens: "false",
    });
    expect(searchQueryOf({ q: "eau", type: "dossiers", anciens: true }, 2)).toEqual({
      q: "eau",
      type: "dossiers",
      limit: 30,
      page: 2,
      inclureAnciens: "true",
    });
  });
});
