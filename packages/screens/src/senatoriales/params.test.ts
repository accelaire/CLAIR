import { describe, expect, it } from "vitest";
import { resultatsGirondeExemple, resultatsNationauxExemple, sortantsExemple } from "./fixtures.ts";
import { compteARebours } from "./lib/calendrier.ts";
import { estSlugGraphique } from "./lib/graphiques.ts";
import { directCirconscription, directNational, scrutinCommence } from "./lib/resultats.ts";
import { rechercherSortants, sectionsDeSortants } from "./lib/sortants.ts";
import { parseSenatorialesParams, senatorialesParamsOf, sortantsQueryOf } from "./params.ts";

describe("parseSenatorialesParams", () => {
  it("lit les filtres de l'URL", () => {
    expect(
      parseSenatorialesParams({ search: "herve", departement: "2A", groupe: "ump", tri: "age" }),
    ).toEqual({ search: "herve", departement: "2A", groupe: "ump", tri: "age" });
  });

  it("écarte les valeurs hors des ensembles connus (pas de 400 de l'API)", () => {
    expect(
      parseSenatorialesParams({ departement: "Gironde", groupe: "A B", tri: "hasard" }),
    ).toEqual({ search: "", departement: "", groupe: "", tri: "" });
  });

  it("omet les valeurs vides et garde la recherche hors de la requête API", () => {
    const params = parseSenatorialesParams({ search: "x", tri: "presence" });
    expect(senatorialesParamsOf(params)).toEqual({
      search: "x",
      departement: undefined,
      groupe: undefined,
      tri: "presence",
    });
    expect(sortantsQueryOf(params)).toEqual({
      departement: undefined,
      groupe: undefined,
      tri: "presence",
    });
  });
});

describe("lecture des sortants", () => {
  it("recherche sans tenir compte des accents", () => {
    expect(rechercherSortants(sortantsExemple, "herve").map((s) => s.personne.prenom)).toEqual([
      "Hervé",
    ]);
  });

  it("regroupe par département dans l'ordre des codes, et ne regroupe pas un classement", () => {
    const sections = sectionsDeSortants(sortantsExemple, "departement");
    expect(sections?.map((s) => [s.libelle, s.ancre, s.sortants.length])).toEqual([
      ["Ain", "ain", 2],
      ["Gironde", "gironde", 1],
    ]);
    expect(sectionsDeSortants(sortantsExemple, "presence")).toBeNull();
  });

  it("refuse les slugs de graphique hérités du prototype", () => {
    expect(estSlugGraphique("carte")).toBe(true);
    expect(estSlugGraphique("toString")).toBe(false);
  });
});

describe("état du scrutin", () => {
  it("compte à rebours à l'heure de Paris", () => {
    expect(compteARebours(new Date("2026-09-20T12:00:00+02:00"))).toBe("J-7 avant le scrutin");
    expect(compteARebours(new Date("2026-09-27T00:30:00+02:00"))).toBe("Jour du scrutin");
    expect(compteARebours(new Date("2026-09-29T12:00:00+02:00"))).toBe("Scrutin passé");
    expect(compteARebours(new Date("2026-10-27T12:00:00+01:00"))).toBe(
      "Les nouveaux sénateurs sont entrés en fonction",
    );
  });

  it("direct national tant que des sièges restent, dans la fenêtre du direct", () => {
    expect(scrutinCommence(resultatsNationauxExemple)).toBe(true);
    expect(directNational(resultatsNationauxExemple)).toBe(true);
    expect(
      directNational({ ...resultatsNationauxExemple, maintenant: "2026-09-28T09:00:00+02:00" }),
    ).toBe(false);
    expect(scrutinCommence(null)).toBe(false);
  });

  it("plus de direct pour une circonscription pourvue", () => {
    expect(directCirconscription(resultatsGirondeExemple)).toBe(false);
    expect(
      directCirconscription({
        ...resultatsGirondeExemple,
        circonscription: { ...resultatsGirondeExemple.circonscription, statut: "vote_en_cours" },
      }),
    ).toBe(true);
    expect(directCirconscription(null)).toBe(false);
  });
});
