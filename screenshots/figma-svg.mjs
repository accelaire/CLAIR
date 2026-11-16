// Exporte les tableaux Excalidraw en SVG pour Figma (qui n'ouvre pas les .excalidraw) : un SVG par
// page (un cadre du tableau des écrans) et un par famille de composants, dans screenshots/figma/.
// Glisser les SVG dans Figma : textes, formes et captures arrivent en calques modifiables.
// Prérequis : la bibliothèque Excalidraw, installée hors du dépôt :
//   npm install --prefix <dossier> @excalidraw/excalidraw@0.17.6 react@18.3.1 react-dom@18.3.1
// Usage : node screenshots/figma-svg.mjs --lib=<dossier>/node_modules
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ICI = dirname(fileURLToPath(import.meta.url));
const LIB = process.argv.find((a) => a.startsWith("--lib="))?.slice(6);
if (!LIB) throw new Error("--lib=<dossier>/node_modules manquant (voir l'en-tête du script)");
const SORTIE = join(ICI, "figma");
rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
// La bibliothèque est servie en local ; aucune requête ne sort de la machine.
await page.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.host !== "local") return route.abort();
  const fichiers = {
    "/react.js": "react/umd/react.production.min.js",
    "/react-dom.js": "react-dom/umd/react-dom.production.min.js",
    "/excalidraw.js": "@excalidraw/excalidraw/dist/excalidraw.production.min.js",
  };
  const f = fichiers[url.pathname];
  if (f) return route.fulfill({ body: readFileSync(join(LIB, f)), contentType: "text/javascript; charset=utf-8" });
  if (url.pathname === "/") return route.fulfill({ body: "<!doctype html><html><body></body></html>", contentType: "text/html" });
  return route.fulfill({ status: 404, body: "" });
});
await page.goto("http://local/");
for (const s of ["/react.js", "/react-dom.js", "/excalidraw.js"]) await page.addScriptTag({ url: `http://local${s}` });

/** Exporte chaque cadre d'un tableau dans son SVG. */
const exporter = async (fichier, prefixe) => {
  const scene = JSON.parse(readFileSync(join(ICI, fichier), "utf8"));
  const cadres = scene.elements.filter((e) => e.type === "frame");
  for (const cadre of cadres) {
    const elements = [cadre, ...scene.elements.filter((e) => e.frameId === cadre.id)];
    const ids = new Set(elements.filter((e) => e.type === "image").map((e) => e.fileId));
    const files = Object.fromEntries(Object.entries(scene.files).filter(([id]) => ids.has(id)));
    const svg = await page.evaluate(
      async ({ elements, files }) => {
        const el = await ExcalidrawLib.exportToSvg({
          elements,
          files,
          appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
          exportPadding: 32,
        });
        return new XMLSerializer().serializeToString(el);
      },
      { elements, files },
    );
    const nom = `${prefixe}${cadre.name.replace(/\s*·\s*/g, " - ").replace(/[\\/:*?"<>|]/g, "-")}.svg`;
    writeFileSync(join(SORTIE, nom), svg);
    process.stdout.write(".");
  }
  return cadres.length;
};

const pages = await exporter("clair-ecrans.excalidraw", "");
const familles = await exporter("clair-composants.excalidraw", "");
await navigateur.close();
console.log(`\n${pages} pages et ${familles} familles de composants exportées dans ${SORTIE}`);
