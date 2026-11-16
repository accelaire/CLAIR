// Captures page par page de l'ancien front (apps/web) et du nouveau (apps/site), pour Figma.
// Usage : node screenshots/capture.mjs [--only=<motif>] [--sites=actuel,beta]
// Prérequis : API locale sur :3001, apps/web sur :3000, apps/site sur :3010 (voir README.md).
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PAGES } from "./pages.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const SITES = {
  actuel: process.env.ACTUEL_URL ?? "http://localhost:3000",
  beta: process.env.BETA_URL ?? "http://localhost:3010",
};
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const arg = (nom) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1];
const only = arg("only");
const sites = (arg("sites") ?? "actuel,beta").split(",");
// `--manquantes` : ne refait que les captures absentes (reprise après une coupure).
const manquantes = process.argv.includes("--manquantes");

const pages = PAGES.filter((p) => !only || p.dossier.includes(only) || p.chemin.includes(only));
const journal = [];

// Chromium ne capture pas une image de plus de 16 384 px de haut : une page plus longue est
// découpée en tuiles (`beta-desktop-1.png`, `-2.png`…) à recoller bout à bout dans Figma.
// Au-delà de TUILES_MAX tuiles (liste à chargement continu), la fin est coupée et le journal le dit.
const HAUTEUR_MAX_PX = 16_000;
const TUILES_MAX = 10;

let browser = await chromium.launch();
for (const site of sites) {
  for (const [vp, taille] of Object.entries(VIEWPORTS)) {
    const echelle = vp === "mobile" ? 2 : 1;
    const ouvrir = async () => {
      if (!browser.isConnected()) browser = await chromium.launch();
      const context = await browser.newContext({
        viewport: taille,
        deviceScaleFactor: echelle,
        reducedMotion: "reduce",
        colorScheme: "light",
        locale: "fr-FR",
        timezoneId: "Europe/Paris",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      return { context, page };
    };
    let { context, page } = await ouvrir();
    for (const p of pages) {
      const url = `${SITES[site]}${site === "beta" && p.beta ? p.beta : p.chemin}`;
      const fichier = join(ICI, p.dossier, `${site}-${vp}.png`);
      const tuile1 = fichier.replace(/\.png$/, "-1.png");
      if (manquantes && (existsSync(fichier) || existsSync(tuile1))) continue;
      await mkdir(dirname(fichier), { recursive: true });
      const debut = Date.now();
      try {
        if (page.isClosed()) ({ context, page } = await ouvrir());
        // Page blanche d'abord : une même adresse avec une autre ancre ne recharge pas la page.
        await page.goto("about:blank");
        const reponse = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
        // Laisse finir les graphiques et les images chargées tardivement.
        // Défilement jusqu'à la hauteur de la page au chargement, mesurée une fois : une liste à
        // chargement continu chargerait sinon la suite à chaque pas, ce que le visiteur ne voit pas.
        await page.evaluate(async (limite) => {
          const fin = Math.min(document.body.scrollHeight, limite);
          for (let y = 0; y < fin; y += 800) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        }, Math.floor((HAUTEUR_MAX_PX * TUILES_MAX) / echelle));
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(800);
        const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
        const max = Math.floor(HAUTEUR_MAX_PX / echelle);
        // Efface les fichiers d'une capture précédente (entière ou en tuiles) de cette page.
        for (let i = 0; i <= TUILES_MAX; i++) {
          await rm(i === 0 ? fichier : fichier.replace(/\.png$/, `-${i}.png`), { force: true });
        }
        const tuiles = Math.min(Math.ceil(hauteur / max), TUILES_MAX);
        const coupee = hauteur > max * TUILES_MAX;
        if (tuiles <= 1) {
          await page.screenshot({ path: fichier, fullPage: true, animations: "disabled" });
        } else {
          for (let i = 0; i < tuiles; i++) {
            const y = i * max;
            await page.screenshot({
              path: fichier.replace(/\.png$/, `-${i + 1}.png`),
              fullPage: true,
              animations: "disabled",
              clip: { x: 0, y, width: taille.width, height: Math.min(max, hauteur - y) },
            });
          }
        }
        const statut = reponse?.status() ?? 0;
        journal.push({ site, vp, dossier: p.dossier, url, statut, hauteur, tuiles, coupee, ms: Date.now() - debut });
        console.log(
          `${statut} ${site}/${vp} ${url}${tuiles > 1 ? ` (${tuiles} tuiles, ${hauteur} px)` : ""}${coupee ? " (fin coupée)" : ""}`,
        );
      } catch (erreur) {
        journal.push({ site, vp, dossier: p.dossier, url, erreur: String(erreur).slice(0, 200) });
        console.log(`ERR ${site}/${vp} ${url} ${String(erreur).slice(0, 120)}`);
        await context.close().catch(() => {});
        ({ context, page } = await ouvrir());
      }
    }
    await context.close().catch(() => {});
  }
}
await browser.close().catch(() => {});
await writeFile(
  join(ICI, `journal-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
  JSON.stringify(journal, null, 2),
);
