// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (chemin: string) => new URL(chemin, import.meta.url);

/** Dossiers de composants exportés par index.ts (`./<catégorie>/<nom>/index.ts`). */
const composants = [
  ...readFileSync(source("./index.ts"), "utf8").matchAll(
    /from "\.\/((?:core|layout|filters|parliament|charts)\/[a-z0-9-]+)\/index\.ts"/g,
  ),
].map((m) => m[1] ?? "");

/** `badge` → `Badge`, `query-states` → `QueryStates`. */
const nomDe = (dossier: string) =>
  (dossier.split("/").pop() ?? "")
    .split("-")
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join("");

describe("catalogue des composants", () => {
  it("exporte au moins un composant", () => {
    expect(composants.length).toBeGreaterThan(0);
  });

  it.each(composants)("%s : composant, CSS module, story Defaut et test", (dossier) => {
    const nom = nomDe(dossier);
    for (const fichier of [
      `${nom}.tsx`,
      `${nom}.module.css`,
      `${nom}.stories.tsx`,
      `${nom}.test.tsx`,
    ]) {
      expect(existsSync(source(`./${dossier}/${fichier}`)), `${dossier}/${fichier}`).toBe(true);
    }
    const stories = readFileSync(source(`./${dossier}/${nom}.stories.tsx`), "utf8");
    expect(stories).toMatch(/export const Defaut\b/);
  });
});
