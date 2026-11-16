import { describe, expect, it } from "vitest";
import { cibleLibelle, objetEtSecteurs, secteursLibelle, typeLibelle } from "./format.ts";

describe("formats du lobbying : cas limites", () => {
  it("laisse un type ou une cible absents à null", () => {
    expect(typeLibelle(null)).toBeNull();
    expect(cibleLibelle(null)).toBeNull();
    expect(typeLibelle("")).toBeNull();
  });

  it("garde un type ou une cible inconnus tels quels", () => {
    expect(typeLibelle("type-fictif")).toBe("type-fictif");
    expect(cibleLibelle("cible-fictive")).toBe("cible-fictive");
    expect(typeLibelle("syndicat")).toBe("Syndicat");
    expect(cibleLibelle("ministre")).toBe("Gouvernement");
  });

  it("n'invente pas de secteur sans crochets ni liste normalisée", () => {
    expect(objetEtSecteurs("  Objet fictif ", [])).toEqual({ objet: "Objet fictif", secteurs: [] });
  });

  it("prend le texte déclaré, ou rien, sans liste normalisée", () => {
    expect(secteursLibelle([], "Secteur déclaré fictif")).toBe("Secteur déclaré fictif");
    expect(secteursLibelle([], null)).toBe("");
  });
});
