// Capture d'une story de Storybook en PNG, pour vérifier un rendu (clair, sombre, mobile).
//
//   pnpm storybook:capture <storyId> [--theme dark] [--viewport xs] [--width 1280]
//
// Sert le build statique (storybook-static, `pnpm --filter @clair/storybook build`) sur un port
// libre, ou utilise un Storybook déjà lancé avec --url http://localhost:6006.
// Les PNG sont écrits dans apps/storybook/.captures/ (ignoré par git).
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATIQUE = path.join(RACINE, "storybook-static");
const SORTIE = path.join(RACINE, ".captures");
const LARGEURS = { xs: 375, sm: 640, md: 768, lg: 1024, xl: 1280 };
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const option = (args, nom) => {
  const i = args.indexOf(nom);
  return i === -1 ? undefined : args[i + 1];
};

/** Serveur statique minimal du build Storybook. */
const servir = () =>
  new Promise((resolve) => {
    const serveur = createServer((req, res) => {
      const chemin = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
      let fichier = path.join(STATIQUE, chemin);
      if (!fichier.startsWith(STATIQUE)) {
        res.writeHead(403).end();
        return;
      }
      if (existsSync(fichier) && statSync(fichier).isDirectory())
        fichier = path.join(fichier, "index.html");
      if (!existsSync(fichier)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(fichier)] ?? "application/octet-stream",
      });
      createReadStream(fichier).pipe(res);
    });
    serveur.listen(0, "127.0.0.1", () => resolve(serveur));
  });

const main = async () => {
  const args = process.argv.slice(2);
  const valeurs = new Set(
    ["--theme", "--viewport", "--width", "--url"].map((o) => option(args, o)),
  );
  const id = args.find((a) => !a.startsWith("--") && !valeurs.has(a));
  if (!id) throw new Error("usage : capture.mjs <storyId> [--theme dark] [--viewport xs]");
  const theme = option(args, "--theme") ?? "light";
  const viewport = option(args, "--viewport");
  const largeur = Number(option(args, "--width") ?? (viewport ? LARGEURS[viewport] : 1024));
  let base = option(args, "--url");
  let serveur;
  if (!base) {
    if (!existsSync(STATIQUE))
      throw new Error("build absent : pnpm --filter @clair/storybook build");
    serveur = await servir();
    base = `http://127.0.0.1:${serveur.address().port}`;
  }
  const url = `${base}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story&globals=theme:${theme}`;
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 800 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  await page.goto(url, { waitUntil: "networkidle" });
  // Story (#storybook-root) ou page de documentation (#storybook-docs) : attendre un contenu visible.
  await page.waitForFunction(
    () =>
      ["#storybook-root", "#storybook-docs"].some(
        (s) => (document.querySelector(s)?.textContent ?? "").trim().length > 0,
      ),
    undefined,
    { timeout: 15000 },
  );
  await page.waitForTimeout(300);
  mkdirSync(SORTIE, { recursive: true });
  const fichier = path.join(SORTIE, `${id}--${theme}${viewport ? `--${viewport}` : ""}.png`);
  await page.screenshot({ path: fichier, fullPage: true });
  await navigateur.close();
  serveur?.close();
  console.log(fichier);
  if (erreurs.length) {
    console.error(`erreurs de la page :\n${erreurs.join("\n")}`);
    process.exitCode = 1;
  }
};

await main();
