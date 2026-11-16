// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const racine = new URL("./", import.meta.url);

/** Écrans : `<dossier>/<Nom>Screen.tsx`, hors `shared/` (blocs communs, testés à part). */
const ecrans = readdirSync(racine, { withFileTypes: true })
  .filter((entree) => entree.isDirectory() && entree.name !== "shared")
  .flatMap((dossier) =>
    readdirSync(new URL(`./${dossier.name}/`, racine))
      .filter((fichier) => /^[A-Z]\w*Screen\.tsx$/.test(fichier))
      .map((fichier) => `${dossier.name}/${fichier.replace(/\.tsx$/, "")}`),
  );

describe("catalogue des écrans", () => {
  it("trouve les écrans", () => {
    expect(ecrans.length).toBeGreaterThan(30);
  });

  it.each(ecrans)("%s : story Defaut, Mobile et Sombre, avec un play", (ecran) => {
    const chemin = new URL(`./${ecran}.stories.tsx`, racine);
    expect(existsSync(chemin), `${ecran}.stories.tsx`).toBe(true);
    const stories = readFileSync(chemin, "utf8");
    expect(stories).toMatch(/title: "Écrans\//);
    for (const story of ["Defaut", "Mobile", "Sombre"]) {
      expect(stories, story).toMatch(new RegExp(`export const ${story}\\b`));
    }
    expect(stories).toMatch(/play: async/);
  });
});
