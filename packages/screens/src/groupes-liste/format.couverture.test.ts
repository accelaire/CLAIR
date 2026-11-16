import { describe, expect, it } from "vitest";
import {
  cheminParlementaires,
  formatNombre,
  formatPourcent,
  libellePosition,
  libelleSession,
  nomDuGroupe,
  parPosition,
} from "./format.ts";

describe("libellePosition", () => {
  it("traduit une position connue, garde l'inconnue et renvoie null sans position", () => {
    expect(libellePosition("centre_gauche")).toBe("Centre-gauche");
    expect(libellePosition("ailleurs")).toBe("ailleurs");
    expect(libellePosition(null)).toBeNull();
  });
});

describe("parPosition", () => {
  it("range de gauche à droite, puis les non classés, à rang égal par ordre", () => {
    const groupes = [
      { nom: "D", position: "droite", ordre: 1 },
      { nom: "X", position: null, ordre: 0 },
      { nom: "G2", position: "gauche", ordre: 2 },
      { nom: "G1", position: "gauche", ordre: 1 },
    ];
    expect(parPosition(groupes).map((g) => g.nom)).toEqual(["G1", "G2", "D", "X"]);
  });
});

describe("formats", () => {
  it("donne le chemin de la chambre et le nom du groupe", () => {
    expect(cheminParlementaires("assemblee")).toBe("/deputes");
    expect(cheminParlementaires("senat")).toBe("/senateurs");
    expect(nomDuGroupe({ nom: "EXE", nomComplet: "Groupe Exemple" })).toBe("Groupe Exemple");
    expect(nomDuGroupe({ nom: "EXE", nomComplet: null })).toBe("EXE");
    expect(nomDuGroupe({ nom: "EXE", nomComplet: "" })).toBe("EXE");
  });

  it("formate nombres, pourcentages et sessions", () => {
    expect(formatNombre(1234)).toBe("1 234");
    expect(formatPourcent(98)).toMatch(/^98\s%$/u);
    expect(libelleSession("2025")).toBe("Session 2025-2026");
    expect(libelleSession("abc")).toBe("Session abc");
  });
});
