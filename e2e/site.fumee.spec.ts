import { expect, type Page, test } from "@playwright/test";
import { expectAccessible, trackErrors } from "./support.ts";

// Tests de fumée du nouveau site (apps/site), contre le faux serveur d'API (e2e/fake-api.mjs) :
// base vide, aucune donnée parlementaire. Pour chaque grande rubrique déjà portée : la page
// répond, porte un titre de niveau 1, ne lève aucune erreur et n'a pas de violation
// d'accessibilité grave.
const RUBRIQUES = [
  "/",
  "/recherche",
  "/deputes",
  "/senateurs",
  "/deputes/comparer",
  "/scrutins",
  "/votes",
  "/dossiers",
  "/sujets",
  "/commissions",
  "/agenda",
  "/lobbying",
  "/lobbying/actions",
  "/groupes",
  "/classements",
  "/comprendre",
  "/guide",
  "/methodologie",
  "/a-propos",
  "/api",
  "/soutenir",
  "/contact",
  "/mentions-legales",
  "/senatoriales-2026",
] as const;

/** Réponses en erreur (≥ 400). */
const trackFailedResponses = (page: Page) => {
  const echecs: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (response.status() < 400) return;
    echecs.push(`${response.status()} ${url.pathname}${url.search}`);
  });
  return echecs;
};

// Tests hermétiques : tout ce qui n'est pas servi en local (formulaire de don intégré, images des
// assemblées…) est coupé, pour ne dépendre d'aucun service extérieur.
test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort());
});

for (const chemin of RUBRIQUES) {
  test(`rubrique ${chemin}`, async ({ page }) => {
    const echecs = trackFailedResponses(page);
    // « Failed to load resource » est vérifié par trackFailedResponses, qui connaît l'adresse.
    const errors = trackErrors(page);
    const reponse = await page.goto(chemin);
    expect(reponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("load");
    await expectAccessible(page);
    expect(errors.filter((e) => !e.startsWith("Failed to load resource"))).toEqual([]);
    expect(echecs).toEqual([]);
  });
}

test("une fiche inconnue répond 404 avec la page d'erreur du site", async ({ page }) => {
  const reponse = await page.goto("/deputes/fiche-inexistante");
  expect(reponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("le proxy /api/v1 relaie vers le faux serveur, jamais ailleurs", async ({ request }) => {
  const liste = await request.get("/api/v1/scrutins?page=1&limit=1");
  expect(liste.status()).toBe(200);
  expect(await liste.json()).toMatchObject({ data: [], meta: { total: 0 } });
  expect((await request.get("/api/v1/x%2F..%2Fdocs")).status()).toBe(404);
});
