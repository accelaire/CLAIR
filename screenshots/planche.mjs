// Génère screenshots/index.html : chaque page, actuel et bêta côte à côte (desktop puis mobile).
// Usage : node screenshots/planche.mjs
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./pages.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const echapper = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const balise = (dossier, nom) =>
  `<a href="${dossier}/${nom}"><img loading="lazy" src="${dossier}/${nom}" alt="${echapper(`${dossier} ${nom}`)}"></a>`;

/** Une capture entière, ou ses tuiles (`-1.png`, `-2.png`…) empilées dans l'ordre. */
const image = (dossier, nom) => {
  if (existsSync(join(ICI, dossier, nom))) return balise(dossier, nom);
  const tuiles = [];
  for (let i = 1; existsSync(join(ICI, dossier, nom.replace(/\.png$/, `-${i}.png`))); i++) {
    tuiles.push(balise(dossier, nom.replace(/\.png$/, `-${i}.png`)));
  }
  return tuiles.length > 0
    ? `<div class="tuiles">${tuiles.join("")}</div>`
    : `<p class="manque">Capture absente</p>`;
};

const sections = PAGES.map(
  (p) => `<section id="${p.dossier}">
  <h2>${p.dossier} <code>${echapper(p.chemin)}</code>${p.beta ? ` · bêta <code>${echapper(p.beta)}</code>` : ""}</h2>
  ${["desktop", "mobile"]
    .map(
      (vp) => `<div class="paire ${vp}">
    <figure><figcaption>Actuel · ${vp}</figcaption>${image(p.dossier, `actuel-${vp}.png`)}</figure>
    <figure><figcaption>Bêta · ${vp}</figcaption>${image(p.dossier, `beta-${vp}.png`)}</figure>
  </div>`,
    )
    .join("\n  ")}
</section>`,
).join("\n");

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Captures CLAIR : actuel et bêta</title>
<style>
body{font-family:system-ui,sans-serif;margin:0 16px 64px;background:#f6f6f4;color:#1b1b1b}
nav{columns:4 220px;font-size:13px;margin:16px 0 32px}nav a{display:block;color:#1b1b1b}
h2{font-size:16px;margin:48px 0 12px;position:sticky;top:0;background:#f6f6f4;padding:8px 0;z-index:1}
.paire{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin-bottom:16px}
.mobile{grid-template-columns:repeat(2,minmax(0,390px))}
figure{margin:0}figcaption{font-size:12px;font-weight:600;margin-bottom:4px}
img{width:100%;border:1px solid #ccc;background:#fff;display:block}.tuiles img+a img,.tuiles a+a img{border-top:0}.manque{color:#a00;font-size:13px}
</style></head><body>
<h1>Captures CLAIR : site actuel (apps/web) et bêta (apps/site)</h1>
<p>Les deux fronts tournent en local contre la même API et la même base (dump du 22/10/2026). Desktop 1440 px, mobile 390 px (@2x), pages entières.</p>
<nav>${PAGES.map((p) => `<a href="#${p.dossier}">${p.dossier}</a>`).join("")}</nav>
${sections}
</body></html>
`;
await writeFile(join(ICI, "index.html"), html);
console.log("screenshots/index.html écrit");
