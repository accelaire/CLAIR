import { describe, expect, it } from "vitest";
import {
  gouvernementFicheParamsOf,
  ongletEffectif,
  parseGouvernementFicheParams,
} from "./params.ts";

describe("params de la page d'un gouvernement", () => {
  it("lit l'onglet et l'étape, ignore les valeurs inconnues", () => {
    expect(parseGouvernementFicheParams({ onglet: "censure", etape: "2025-06-02" })).toEqual({
      onglet: "censure",
      etape: "2025-06-02",
    });
    expect(parseGouvernementFicheParams({ onglet: "x", etape: "hier" })).toEqual({
      onglet: null,
      etape: "",
    });
  });

  it("omet l'onglet par défaut, et l'étape hors de la composition", () => {
    expect(gouvernementFicheParamsOf({ onglet: "composition", etape: "2025-06-02" })).toEqual({
      onglet: null,
      etape: "2025-06-02",
    });
    expect(gouvernementFicheParamsOf({ onglet: "textes", etape: "2025-06-02" })).toEqual({
      onglet: "textes",
      etape: "",
    });
  });

  it("retombe sur la composition quand l'onglet n'existe pas pour ce gouvernement", () => {
    expect(ongletEffectif("textes", ["composition", "postes"])).toBe("composition");
    expect(ongletEffectif("postes", ["composition", "postes"])).toBe("postes");
  });
});
