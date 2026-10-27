import { expect, test } from "@playwright/test";
import { expectAccessible, trackErrors } from "./support.ts";

const PAGES = [
  ["/front", "Front : nouveau site, design system et composants"],
  ["/front/architecture", "Architecture du nouveau front"],
  ["/front/architecture/pages", "Pages et écrans"],
  ["/front/architecture/donnees", "Données du nouveau front"],
  ["/front/architecture/tests", "Tests du nouveau front"],
  ["/front/design-system", "Design system"],
  ["/front/design-system/couleurs", "Couleurs"],
  ["/front/design-system/typographie", "Typographie"],
  ["/front/design-system/espacements", "Espacements, rayons et ombres"],
  ["/front/composants", "Composants"],
] as const;

for (const [path, title] of PAGES) {
  test(`page ${path}`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expectAccessible(page, { include: "main" });
    expect(errors).toEqual([]);
  });
}

test("les schémas Mermaid de la section Front s'affichent", async ({ page }) => {
  for (const path of ["/front", "/front/architecture/pages", "/front/architecture/donnees"]) {
    await page.goto(path);
    await expect(page.locator("figure svg").first()).toBeVisible({ timeout: 15_000 });
  }
});

test("les nuanciers sont lus dans les tokens", async ({ page }) => {
  await page.goto("/front/design-system/couleurs");
  await expect(page.getByText("--clair-texte-action").first()).toBeVisible();
  await expect(page.getByText("#195BCC").first()).toBeVisible();
});

test("l'aperçu suit le mode sombre de la documentation", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/front/composants/fondations/badge");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(page.locator(".clair-preview").first()).toHaveAttribute(
    "data-mantine-color-scheme",
    "dark",
  );
});
