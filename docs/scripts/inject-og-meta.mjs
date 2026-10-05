/**
 * Ajoute les balises Open Graph / Twitter aux pages pré-rendues par `zudoku build`.
 *
 * Zudoku 0.86 n'en produit aucune, et les robots de partage (X, LinkedIn,
 * Discord, Slack…) lisent le HTML servi sans exécuter de JavaScript : il faut
 * donc les écrire dans les fichiers de `dist/`. Titre et description sont repris
 * de ceux que Zudoku a déjà rendus pour chaque page.
 *
 * L'image `public/og-image.png` reprend le gabarit des images OG de clair.vote
 * (OgLayout + OgPage, apps/web/lib/og.tsx), avec en bas à droite « CLAIR.vote »
 * suivi de « Docs » en gris, comme dans le header de la doc. Elle a été rendue
 * une fois avec `next/og` : la
 * régénérer de la même façon si le gabarit du site change.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Sur Vercel (variable VERCEL), Zudoku écrit le site dans `.vercel/output/static`
// (Build Output API) et c'est ce dossier qui est servi : `dist/` n'existe plus.
const DIST_DIR = process.env.VERCEL
  ? path.resolve(__dirname, "..", ".vercel", "output", "static")
  : path.resolve(__dirname, "..", "dist");
const SITE_URL = "https://docs.clair.vote";
const SITE_NAME = "CLAIR.vote Docs";
const IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: "CLAIR.vote Docs : API ouverte, sources des données et architecture de la plateforme",
};

// Le texte d'un <title> ou d'un content="" est déjà échappé par le rendu : seul
// le guillemet reste à protéger pour le placer dans un attribut.
const attr = (value) => value.replace(/"/g, "&quot;");

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

function pageUrl(file) {
  const route = path.relative(DIST_DIR, file).split(path.sep).join("/").replace(/\.html$/, "");
  if (route === "index") return `${SITE_URL}/`;
  return `${SITE_URL}/${route.replace(/\/index$/, "")}`;
}

if (!fs.existsSync(DIST_DIR)) {
  console.error(`❌ Dossier de sortie introuvable : ${DIST_DIR}`);
  process.exit(1);
}

let updated = 0;
for (const file of htmlFiles(DIST_DIR)) {
  let html = fs.readFileSync(file, "utf-8");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title || html.includes('property="og:title"')) continue;
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";

  const tags = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", SITE_NAME],
    ["property", "og:locale", "fr_FR"],
    ["property", "og:url", pageUrl(file)],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:image", IMAGE.url],
    ["property", "og:image:width", String(IMAGE.width)],
    ["property", "og:image:height", String(IMAGE.height)],
    ["property", "og:image:alt", IMAGE.alt],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", IMAGE.url],
  ]
    .filter(([, , content]) => content)
    .map(([key, name, content]) => `<meta ${key}="${name}" content="${attr(content)}">`)
    .join("");

  html = html.replace("</head>", `${tags}</head>`).replace('<html lang="en"', '<html lang="fr"');
  fs.writeFileSync(file, html, "utf-8");
  updated++;
}

// Aucune page modifiée = sortie de Zudoku déplacée ou format changé : on le dit
// plutôt que de publier une doc sans aperçus de partage.
if (updated === 0) {
  console.error(`❌ Aucune page HTML à compléter dans ${DIST_DIR}.`);
  process.exit(1);
}

console.log(`✓ Balises Open Graph ajoutées à ${updated} pages (${path.relative(process.cwd(), DIST_DIR)}).`);
