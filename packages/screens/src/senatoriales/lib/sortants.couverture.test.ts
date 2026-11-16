import type { Sortant } from "@clair/data";
import { describe, expect, it } from "vitest";
import { sortantsExemple } from "../fixtures.ts";
import { indexerPar, rechercherSortants, sectionsDeSortants } from "./sortants.ts";

// Sortants fictifs dérivés des fixtures.
const base = sortantsExemple[0] as Sortant;
const variante = (id: string, extra: Partial<Sortant> = {}): Sortant => ({
  ...base,
  mandatId: `mandat-${id}`,
  ...extra,
});
const sansRien = variante("vide", {
  groupe: null,
  circonscription: null,
  commissionPermanente: null,
  personne: { ...base.personne, profession: null },
});
const tous = [...sortantsExemple, sansRien];

describe("indexerPar", () => {
  it("regroupe les identifiants de mandat par libellé", () => {
    expect(indexerPar(sortantsExemple, (s) => s.circonscription?.nom ?? "?")).toEqual({
      Ain: ["mandat-1", "mandat-2"],
      Gironde: ["mandat-3"],
    });
  });
});

describe("sectionsDeSortants", () => {
  it("ne découpe pas les classements", () => {
    expect(sectionsDeSortants(tous, "presence")).toBeNull();
    expect(sectionsDeSortants(tous, "nom")).toBeNull();
  });

  it("range par code INSEE, circonscription absente en dernier", () => {
    const sections = sectionsDeSortants(tous, "departement");
    expect(sections?.map((s) => [s.libelle, s.ancre, s.sortants.length])).toEqual([
      ["Ain", "ain", 2],
      ["Gironde", "gironde", 1],
      ["Circonscription non renseignée", "circonscription-non-renseignee", 1],
    ]);
  });

  it("regroupe par groupe, sans groupe compris", () => {
    const sections = sectionsDeSortants(tous, "groupe");
    expect(sections?.map((s) => [s.libelle, s.sortants.length])).toEqual([
      ["Groupe Exemple A", 2],
      ["Sans groupe", 2],
    ]);
  });

  it("regroupe par commission, sans commission compris", () => {
    const sections = sectionsDeSortants(tous, "commission");
    expect(sections?.map((s) => [s.libelle, s.sortants.length])).toEqual([
      ["Commission fictive des exemples", 3],
      ["Sans commission permanente", 1],
    ]);
  });

  it("regroupe par famille professionnelle, départage par libellé", () => {
    const sections = sectionsDeSortants(tous, "profession");
    expect(sections?.map((s) => [s.libelle, s.sortants.length])).toEqual([
      ["Salariés", 2],
      ["Profession non renseignée", 1],
      ["Professions libérales", 1],
    ]);
  });
});

describe("rechercherSortants", () => {
  it("rend tout sans recherche", () => {
    expect(rechercherSortants(tous, "")).toBe(tous);
  });

  it("ignore accents et casse", () => {
    expect(rechercherSortants(tous, "HERVE").map((s) => s.mandatId)).toEqual([
      "mandat-1",
      "mandat-vide",
    ]);
    expect(rechercherSortants(tous, "modèle").map((s) => s.mandatId)).toEqual(["mandat-3"]);
    expect(rechercherSortants(tous, "personne")).toEqual([]);
  });
});
