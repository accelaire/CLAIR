import { describe, expect, it } from "vitest";
import { modeDeScrutin } from "./circonscription.ts";
import { locutionDepuisCode, slugDepuisCode } from "./departements.ts";
import { couleurFamille, libelleFamille } from "./familles.ts";
import {
  accorde,
  accorder,
  heureDeParis,
  lienPersonne,
  nombre,
  pluriel,
  pourcentage,
} from "./format.ts";

describe("format", () => {
  it("accorde noms, verbes et genre", () => {
    expect(pluriel(1, "siège")).toBe("siège");
    expect(pluriel(2, "siège")).toBe("sièges");
    expect(pluriel(2, "œil", "yeux")).toBe("yeux");
    expect(accorde(1, "est", "sont")).toBe("est");
    expect(accorde(3, "est", "sont")).toBe("sont");
    expect(accorder("F", "élu", "élue")).toBe("élue");
    expect(accorder(null, "élu", "élue")).toBe("élu");
  });

  it("formate nombres, pourcentages et heures de Paris", () => {
    expect(nombre(1234)).toMatch(/^1\s234$/);
    expect(pourcentage(null)).toBe("—");
    expect(pourcentage(12.345)).toBe("12,3 %");
    expect(pourcentage(12, 0)).toBe("12 %");
    expect(heureDeParis("2026-09-27T18:14:00Z")).toBe("20h14");
  });

  it("renvoie vers la fiche Sénat ou Assemblée", () => {
    expect(lienPersonne({ slug: "a", chambre: "senat" })).toBe("/senateurs/a");
    expect(lienPersonne({ slug: "a", chambre: "assemblee" })).toBe("/deputes/a");
  });
});

describe("familles", () => {
  it("se replie sur « Nuance non classée » et le gris pour une famille absente ou inconnue", () => {
    expect(libelleFamille("gauche")).toBe("Gauche");
    expect(libelleFamille(null)).toBe("Nuance non classée");
    expect(libelleFamille("inconnue")).toBe("Nuance non classée");
    expect(couleurFamille(undefined)).toBe("#9ca3af");
    expect(couleurFamille("inconnue")).toBe("#9ca3af");
    expect(couleurFamille("droite")).toBe("#3d6fb4");
  });
});

describe("circonscriptions", () => {
  it("déduit le mode de scrutin du nombre de sièges", () => {
    expect(modeDeScrutin(3).unite).toBe("liste");
    expect(modeDeScrutin(2).unite).toBe("candidature");
  });

  it("se replie sur « en <nom> » pour un code inconnu", () => {
    expect(slugDepuisCode("01")).toBe("ain");
    expect(locutionDepuisCode("01", "Ain")).toBe("dans l’Ain");
    expect(locutionDepuisCode("000", "Fictivie")).toBe("en Fictivie");
  });
});
