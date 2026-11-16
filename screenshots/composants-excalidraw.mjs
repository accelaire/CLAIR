// Génère screenshots/clair-composants.excalidraw : le design system du nouveau front (packages/ui),
// une carte par composant (nom, famille, description de sa page de doc, story Defaut en clair et
// en sombre), rangées par famille, précédées des fondations (couleurs, typographie, espacements).
// Prérequis : `pnpm --filter @clair/storybook build` (storybook-static).
// Usage : node screenshots/composants-excalidraw.mjs
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..");
const STATIQUE = join(RACINE, "apps/storybook/storybook-static");
const CAPTURES = join(ICI, "composants");
const pnpmDir = join(RACINE, "node_modules/.pnpm");
const sharp = createRequire(import.meta.url)(
  join(pnpmDir, readdirSync(pnpmDir).find((d) => d.startsWith("sharp@")), "node_modules/sharp"),
);

if (!existsSync(join(STATIQUE, "index.json"))) {
  throw new Error("build absent : pnpm --filter @clair/storybook build");
}

// --- Serveur statique du build ---------------------------------------------------------------
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff" };
const serveur = createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = join(STATIQUE, chemin);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!f.startsWith(STATIQUE) || !existsSync(f)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
  createReadStream(f).pipe(res);
});
await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
const URL_SB = `http://127.0.0.1:${serveur.address().port}`;

// --- Liste des composants et des fondations ----------------------------------------------------
const index = JSON.parse(readFileSync(join(STATIQUE, "index.json"), "utf8"));
const entrees = Object.values(index.entries);
const VITRINES = ["Tons", "Variantes", "Tailles", "Provenances", "Positions", "Sorts", "Etats Dossier", "Chambres", "Au Focus"];
const FAMILLES = ["Fondations", "Mise en page", "Filtres", "Parlementaire", "Graphiques"];
const composants = entrees
  .filter((e) => e.type === "story" && e.title.startsWith("Composants/") && e.name === "Defaut")
  .map((e) => {
    const [, famille, nom] = e.title.split("/");
    const sombre = entrees.find((s) => s.title === e.title && s.name === "Sombre");
    // Une story qui montre toutes les variantes, quand elle existe, plutôt que la seule « Defaut ».
    const vitrine = VITRINES.map((v) => entrees.find((s) => s.title === e.title && s.name === v)).find(Boolean);
    return { famille, nom, id: (vitrine ?? e).id, histoire: (vitrine ?? e).name, sombreId: sombre?.id };
  })
  .sort((a, b) => FAMILLES.indexOf(a.famille) - FAMILLES.indexOf(b.famille) || a.nom.localeCompare(b.nom));
const fondations = entrees.filter((e) => e.type === "docs" && e.title.startsWith("Fondations/"));

// Description : premier paragraphe de la page de doc du composant (docs/04-front/03-composants).
const DOCS = join(RACINE, "docs/04-front/03-composants");
const pagesDoc = readdirSync(DOCS, { recursive: true }).filter((f) => String(f).endsWith(".mdx"));
const kebab = (nom) => nom.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const descriptionDe = (nom) => {
  const page = pagesDoc.find((f) => String(f).endsWith(`/${kebab(nom)}.mdx`));
  if (!page) return "";
  const corps = readFileSync(join(DOCS, String(page)), "utf8").replace(/^---[\s\S]*?---/, "");
  const paragraphe = corps.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[#<>|`!{]|^import /.test(p)) ?? "";
  return paragraphe
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s*Toutes les variantes dans l'atelier Storybook\.?/, "")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .trim();
};

// --- Captures ---------------------------------------------------------------------------------
await mkdir(CAPTURES, { recursive: true });
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });

const capturer = async (id, fichier, { docs = false, sombre = false } = {}) => {
  const url = `${URL_SB}/iframe.html?id=${id}&viewMode=${docs ? "docs" : "story"}${sombre ? "&globals=theme:dark" : ""}`;
  await page.goto("about:blank");
  await page.goto(url, { waitUntil: "networkidle" });
  const racine = docs ? "#storybook-docs" : "#storybook-root";
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el && el.getBoundingClientRect().height > 0;
  }, racine, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(600);
  const el = page.locator(docs ? `${racine} .sbdocs-content` : racine).first();
  // Le fond de la story (clair ou sombre) autour du composant : on capture le corps, recadré.
  let boite = await el.boundingBox();
  // Composant hors du flux (lien d'évitement au focus) : la racine ne mesure rien, on prend le
  // haut de la page, que le rognage resserre ensuite.
  if (!docs && (!boite || boite.height < 2)) boite = { x: 16, y: 16, width: 1168, height: 200 };
  if (!boite || boite.height < 2) return false;
  const marge = docs ? 0 : 16;
  await page.screenshot({
    path: fichier,
    fullPage: true,
    clip: {
      x: Math.max(0, boite.x - marge),
      y: Math.max(0, boite.y - marge),
      width: Math.min(1200, boite.width + 2 * marge),
      height: Math.min(6000, boite.height + 2 * marge),
    },
  });
  return true;
};

for (const c of composants) {
  c.clair = join(CAPTURES, `${c.id}.png`);
  c.okClair = await capturer(c.id, c.clair);
  if (c.sombreId) {
    c.sombre = join(CAPTURES, `${c.sombreId}.png`);
    c.okSombre = await capturer(c.sombreId, c.sombre);
  }
  process.stdout.write(".");
}
for (const f of fondations) {
  f.fichier = join(CAPTURES, `${f.id}.png`);
  f.ok = await capturer(f.id, f.fichier, { docs: true });
}
await navigateur.close();
serveur.close();

// --- Excalidraw -------------------------------------------------------------------------------
let graine = 1;
const maintenant = Date.now();
const elements = [];
const files = {};
const base = (type, x, y, w, h, extra = {}) => ({
  id: `${type}-${graine}`, type, x, y, width: w, height: h, angle: 0, strokeColor: "#1e1e1e",
  backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 0,
  opacity: 100, groupIds: [], frameId: null, roundness: null, seed: graine, version: 1,
  versionNonce: graine++ * 7919, isDeleted: false, boundElements: null, updated: maintenant, link: null,
  locked: false, ...extra,
});
const couper = (texte, max) => {
  const lignes = [];
  let ligne = "";
  // Espaces insécables autour des guillemets et avant « : ; ! ? », pour qu'ils ne restent pas seuls
  // en bout de ligne ; seules les espaces ordinaires servent à couper.
  const insecable = texte.replace(/« /g, "«\u00a0").replace(/ ([»:;!?])/g, "\u00a0$1");
  for (const mot of insecable.split(/ +/)) {
    if (ligne && `${ligne} ${mot}`.length > max) {
      lignes.push(ligne);
      ligne = mot;
    } else ligne = ligne ? `${ligne} ${mot}` : mot;
  }
  if (ligne) lignes.push(ligne);
  return lignes;
};
const texte = (x, y, contenu, { taille = 16, couleur = "#1e1e1e", largeurMax } = {}) => {
  const lignes = largeurMax ? couper(contenu, Math.floor(largeurMax / (taille * 0.52))) : contenu.split("\n");
  const t = lignes.join("\n");
  return base("text", x, y, Math.max(...lignes.map((l) => l.length)) * taille * 0.52, lignes.length * taille * 1.25, {
    strokeColor: couleur, text: t, originalText: t, fontSize: taille, fontFamily: 2, textAlign: "left",
    verticalAlign: "top", containerId: null, autoResize: true, lineHeight: 1.25,
  });
};
const rectangle = (x, y, w, h, { fond = "transparent", trait = "#1e1e1e" } = {}) =>
  base("rectangle", x, y, w, h, { backgroundColor: fond, strokeColor: trait, roundness: { type: 3 } });
const image = async (brut, largeurMax) => {
  // Rogne le fond uniforme autour du composant, puis remet une marge de 24 px (48 en @2x).
  const fond = (await sharp(brut).raw().toBuffer({ resolveWithObject: true })).data.subarray(0, 3);
  const rogne = await sharp(brut).trim({ threshold: 8 }).toBuffer().catch(() => readFileSync(brut));
  const fichier = await sharp(rogne)
    .extend({ top: 48, bottom: 48, left: 48, right: 48, background: { r: fond[0], g: fond[1], b: fond[2] } })
    .png()
    .toBuffer();
  const meta = await sharp(fichier).metadata();
  const largeur = Math.min(largeurMax, meta.width / 2);
  const jpeg = await sharp(fichier).resize({ width: Math.round(largeur * 2) }).png({ compressionLevel: 9, palette: true }).toBuffer();
  const fileId = createHash("sha1").update(brut).digest("hex");
  files[fileId] = { mimeType: "image/png", id: fileId, dataURL: `data:image/png;base64,${jpeg.toString("base64")}`, created: maintenant };
  const hauteur = (meta.height / meta.width) * largeur;
  return { el: base("image", 0, 0, largeur, hauteur, { strokeColor: "transparent", status: "saved", fileId, scale: [1, 1], crop: null }), largeur, hauteur };
};

elements.push(texte(0, -260, "CLAIR : design system du nouveau front", { taille: 44 }));
elements.push(texte(0, -190, `Composants de packages/ui (Mantine 9, thème @clair/theme), story « Defaut » de l'atelier Storybook, en clair et en sombre. ${composants.length} composants, ${new Date().toLocaleDateString("fr-FR")}.\nDonnées fictives. Chaque composant a sa page de doc (docs.clair.vote/front) et ses variantes dans storybook.clair.vote.`, { taille: 18, couleur: "#495057" }));

let y = 0;
// Fondations : pages de doc capturées en entier.
if (fondations.some((f) => f.ok)) {
  elements.push(texte(0, y, "Fondations : tokens", { taille: 36 }));
  y += 80;
  let x = 0;
  let hMax = 0;
  for (const f of fondations.filter((f) => f.ok)) {
    elements.push(texte(x, y, f.title.split("/").pop(), { taille: 24 }));
    const img = await image(f.fichier, 900);
    elements.push({ ...img.el, x, y: y + 44 });
    elements.push(rectangle(x, y + 44, img.largeur, img.hauteur, { trait: "#dee2e6" }));
    x += img.largeur + 80;
    hMax = Math.max(hMax, img.hauteur + 44);
  }
  y += hMax + 200;
}

const CARTE = 760;
const PAR_LIGNE = 3;
for (const famille of FAMILLES) {
  const liste = composants.filter((c) => c.famille === famille && c.okClair);
  if (liste.length === 0) continue;
  const cadreId = `frame-${famille}`;
  const yCadre = y;
  const dans = [];
  dans.push(texte(40, y + 30, `${famille} (${liste.length})`, { taille: 36 }));
  y += 110;
  for (let i = 0; i < liste.length; i += PAR_LIGNE) {
    let hLigne = 0;
    const ligne = liste.slice(i, i + PAR_LIGNE);
    for (const [j, c] of ligne.entries()) {
      const x = 40 + j * (CARTE + 60);
      let yc = y + 24;
      const contenu = [];
      contenu.push(texte(x + 24, yc, c.nom, { taille: 26 }));
      yc += 44;
      const desc = descriptionDe(c.nom);
      if (desc) {
        const t = texte(x + 24, yc, desc, { taille: 15, couleur: "#495057", largeurMax: CARTE - 48 });
        contenu.push(t);
        yc += t.height + 20;
      }
      for (const [libelle, fichier, ok] of [[c.histoire === "Defaut" ? "Clair" : `Clair · ${c.histoire}`, c.clair, c.okClair], ["Sombre", c.sombre, c.okSombre]]) {
        if (!ok) continue;
        contenu.push(texte(x + 24, yc, libelle, { taille: 14, couleur: "#868e96" }));
        yc += 24;
        const img = await image(fichier, CARTE - 48);
        contenu.push({ ...img.el, x: x + 24, y: yc });
        yc += img.hauteur + 24;
      }
      const hCarte = yc - y;
      dans.push(rectangle(x, y, CARTE, hCarte, { fond: "#f8f9fa", trait: "#ced4da" }));
      dans.push(...contenu);
      hLigne = Math.max(hLigne, hCarte);
    }
    y += hLigne + 60;
  }
  const largeurCadre = 40 + PAR_LIGNE * (CARTE + 60);
  elements.push(base("frame", 0, yCadre, largeurCadre, y - yCadre, { id: cadreId, name: `Composants · ${famille}`, strokeColor: "#bbb" }));
  for (const e of dans) elements.push({ ...e, frameId: cadreId });
  y += 200;
}

const sortie = join(ICI, "clair-composants.excalidraw");
await writeFile(sortie, JSON.stringify({ type: "excalidraw", version: 2, source: "https://excalidraw.com", elements, appState: { viewBackgroundColor: "#ffffff", gridSize: null }, files }));
const manquants = composants.filter((c) => !c.okClair).map((c) => c.nom);
console.log(`\n${sortie} : ${composants.length} composants, ${elements.length} éléments${manquants.length ? `, sans capture : ${manquants.join(", ")}` : ""}`);
