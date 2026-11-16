import { describe, expect, it } from "vitest";
import { libelleThematique } from "./thematiques.ts";

describe("libelleThematique", () => {
  it("rend les accents des codes de l'API", () => {
    expect(["securite", "sante", "education", "economie"].map(libelleThematique)).toEqual([
      "Sécurité",
      "Santé",
      "Éducation",
      "Économie",
    ]);
  });

  it("accepte un code déjà accentué", () => {
    expect(libelleThematique("fiscalité")).toBe("Fiscalité");
  });

  it("garde un code inconnu, avec une majuscule", () => {
    expect(libelleThematique("numerique")).toBe("Numerique");
  });
});
