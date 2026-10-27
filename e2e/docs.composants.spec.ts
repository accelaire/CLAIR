import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
// Même calcul d'URL que la navigation générée (préfixes d'ordre retirés).
import { routeFromRelPath } from "../docs/scripts/routes.mjs";
import { expectAccessible, trackErrors } from "./support.ts";

const CATALOGUE = "04-front/03-composants/";
const docs = new URL("../docs/", import.meta.url);
const pages = readdirSync(new URL(CATALOGUE, docs), { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".mdx") && !file.endsWith("index.mdx"))
  .map((file) => routeFromRelPath(`${CATALOGUE}${file}`));

/** Composants exportés par @clair/ui (dossiers ./<catégorie>/<nom>/index.ts). */
const exportes = [
  ...readFileSync(new URL("../packages/ui/src/index.ts", import.meta.url), "utf8").matchAll(
    /from "\.\/(?:core|layout|filters|parliament|charts)\/([a-z0-9-]+)\/index\.ts"/g,
  ),
].map((m) => m[1]);

test("chaque composant exporté par @clair/ui a sa page dans le catalogue", () => {
  const slugs = pages.map((path) => path.split("/").pop());
  expect(exportes.filter((nom) => !slugs.includes(nom))).toEqual([]);
});

for (const path of pages) {
  test(`composant ${path} : gabarit, aperçus rendus, un bloc de code par aperçu`, async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2, name: /^Import/ })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Utilisation de base/ }),
    ).toBeVisible();

    const previews = page.locator(".clair-preview");
    const count = await previews.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      const box = await previews.nth(index).boundingBox();
      expect(box?.height ?? 0, `aperçu ${index + 1} vide`).toBeGreaterThan(30);
    }
    // Import + un bloc de code par aperçu.
    await expect(page.locator("main pre")).toHaveCount(count + 1);
    await expectAccessible(page, { include: "main" });
    expect(errors).toEqual([]);
  });
}
