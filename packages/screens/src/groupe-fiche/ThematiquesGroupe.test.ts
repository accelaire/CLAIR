import { describe, expect, it } from "vitest";
import { debutAxeCohesion } from "./ThematiquesGroupe.tsx";

describe("debutAxeCohesion", () => {
  it("resserre l'axe quand les cohésions sont proches, pour que les barres se distinguent", () => {
    expect(debutAxeCohesion([97, 99, 100])).toBe(90);
    expect(debutAxeCohesion([84, 92])).toBe(70);
  });

  it("part de zéro quand l'écart est large ou qu'il n'y a pas de valeur", () => {
    expect(debutAxeCohesion([45, 98])).toBe(0);
    expect(debutAxeCohesion([])).toBe(0);
  });
});
