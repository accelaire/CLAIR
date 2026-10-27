import { defineConfig } from "@playwright/test";
import { E2E_PORTS } from "./e2e/ports.ts";

// Les applications doivent être construites avant :
//   docs : pnpm --filter @clair/docs build
//   site : pnpm --filter @clair/site build
// puis `pnpm test:e2e` (tout) ou `pnpm test:e2e --project=site` (une seule application).

/**
 * Projets demandés par `--project` (tous sans l'option). Les serveurs web de Playwright ne
 * dépendent pas du projet : sans ce filtre, `--project=site` exigerait aussi le build de la doc.
 */
const projetsDemandes = (() => {
  const noms: string[] = [];
  process.argv.forEach((arg, i) => {
    if (arg === "--project") noms.push(process.argv[i + 1] ?? "");
    else if (arg.startsWith("--project=")) noms.push(arg.slice("--project=".length));
  });
  return noms.length > 0 ? new Set(noms.flatMap((n) => n.split(","))) : null;
})();
const demande = (projet: string) => projetsDemandes === null || projetsDemandes.has(projet);

const API_LOCALE = `http://127.0.0.1:${E2E_PORTS.api}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { headless: true, viewport: { width: 1440, height: 900 }, locale: "fr-FR" },
  webServer: [
    ...(demande("docs")
      ? [
          {
            command: `pnpm --filter @clair/docs exec zudoku preview --port ${E2E_PORTS.docs}`,
            port: E2E_PORTS.docs,
            reuseExistingServer: !process.env.CI,
            env: { ZUDOKU_DISABLE_UPDATE_CHECK: "1" },
          },
        ]
      : []),
    ...(demande("site")
      ? [
          {
            // Faux serveur d'API : listes vides, fiches en 404. Le site n'appelle jamais la production.
            command: `node e2e/fake-api.mjs ${E2E_PORTS.api}`,
            url: `${API_LOCALE}/health`,
            reuseExistingServer: !process.env.CI,
          },
          {
            command: `pnpm --filter @clair/site exec next start -p ${E2E_PORTS.site}`,
            port: E2E_PORTS.site,
            reuseExistingServer: !process.env.CI,
            // API_URL lu à l'exécution par le rendu serveur et le proxy /api/v1. NEXT_PUBLIC_API_URL
            // l'emporterait : il ne doit pas être défini au build (il y serait figé).
            env: { API_URL: API_LOCALE, CLAIR_INTERNAL_SECRET: "e2e-pas-un-secret" },
          },
        ]
      : []),
  ],
  projects: [
    {
      name: "docs",
      testMatch: /docs\..*\.spec\.ts/,
      use: { browserName: "chromium", baseURL: `http://localhost:${E2E_PORTS.docs}` },
    },
    {
      name: "site",
      testMatch: /site\..*\.spec\.ts/,
      use: { browserName: "chromium", baseURL: `http://localhost:${E2E_PORTS.site}` },
    },
  ],
});
