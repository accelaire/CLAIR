// Génère screenshots/clair-ecrans.excalidraw : chaque page, ancienne vue (apps/web) et nouvelle
// vue (apps/site, bêta), en ordinateur et en mobile, avec les notes de notes.json (ce qui a changé,
// ce qu'on pourrait améliorer). Une page = un cadre (frame) nommé, pour naviguer dans Excalidraw.
// Usage : node screenshots/excalidraw.mjs [--section=0|1|…] (sans option : tout dans un fichier)
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./pages.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..");
const pnpmDir = join(RACINE, "node_modules/.pnpm");
const sharpDir = readdirSync(pnpmDir).find((d) => d.startsWith("sharp@"));
const sharp = createRequire(import.meta.url)(join(pnpmDir, sharpDir, "node_modules/sharp"));

const NOTES = JSON.parse(readFileSync(join(ICI, "notes.json"), "utf8"));

// Largeur affichée (px Excalidraw) et largeur réelle du JPEG (×2 pour rester net au zoom).
const COLONNES = [
  { cle: "actuel-desktop", libelle: "Ancienne vue · ordinateur", largeur: 440 },
  { cle: "beta-desktop", libelle: "Nouvelle vue (bêta) · ordinateur", largeur: 440 },
  { cle: "actuel-mobile", libelle: "Ancienne vue · mobile", largeur: 200 },
  { cle: "beta-mobile", libelle: "Nouvelle vue (bêta) · mobile", largeur: 200 },
];
const NETTETE = 1.5;
const QUALITE = 68;
const GOUTTIERE = 40;
const NOTES_LARGEUR = 460;

const STATUTS = {
  mieux: { libelle: "Mieux que l'ancienne", fond: "#b2f2bb", trait: "#2f9e44" },
  parite: { libelle: "À parité", fond: "#a5d8ff", trait: "#1971c2" },
  partielle: { libelle: "Parité partielle", fond: "#ffec99", trait: "#f08c00" },
  absent: { libelle: "Absente de la bêta", fond: "#ffc9c9", trait: "#e03131" },
};

const SECTIONS = [
  { titre: "Accueil et recherche", prefixes: ["0"] },
  { titre: "Parlementaires, groupes, classements, gouvernements", prefixes: ["1", "2"] },
  { titre: "Votes, scrutins, dossiers, sujets", prefixes: ["3", "4"] },
  { titre: "Commissions, agenda, lobbying, sénatoriales", prefixes: ["5", "6", "7"] },
  { titre: "Pages éditoriales, légales, erreurs", prefixes: ["8", "9"] },
];

// --- Éléments Excalidraw -------------------------------------------------------------------
let graine = 1;
const maintenant = Date.now();
const base = (type, x, y, largeur, hauteur, extra = {}) => ({
  id: `${type}-${graine}`,
  type,
  x,
  y,
  width: largeur,
  height: hauteur,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 0,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: graine,
  version: 1,
  versionNonce: graine++ * 7919,
  isDeleted: false,
  boundElements: null,
  updated: maintenant,
  link: null,
  locked: false,
  ...extra,
});

/** Coupe un texte en lignes de `max` caractères au plus, aux espaces. */
const couper = (texte, max) => {
  const lignes = [];
  let ligne = "";
  // Espaces insécables autour des guillemets et avant « : ; ! ? », pour qu'ils ne restent pas seuls
  // en bout de ligne ; seules les espaces ordinaires servent à couper.
  const insecable = texte.replace(/« /g, "«\u00a0").replace(/ ([»:;!?])/g, "\u00a0$1");
  for (const mot of insecable.split(/ +/)) {
    if (ligne && (ligne + " " + mot).length > max) {
      lignes.push(ligne);
      ligne = mot;
    } else ligne = ligne ? `${ligne} ${mot}` : mot;
  }
  if (ligne) lignes.push(ligne);
  return lignes;
};

const texte = (x, y, contenu, { taille = 16, couleur = "#1e1e1e", largeurMax, gras } = {}) => {
  const lignes = largeurMax
    ? contenu.split("\n").flatMap((l) => couper(l, Math.floor(largeurMax / (taille * 0.52))))
    : contenu.split("\n");
  const t = lignes.join("\n");
  const largeur = Math.max(...lignes.map((l) => l.length)) * taille * 0.52;
  const hauteur = lignes.length * taille * 1.25;
  return base("text", x, y, largeur, hauteur, {
    strokeColor: couleur,
    text: t,
    originalText: t,
    fontSize: taille,
    fontFamily: gras ? 2 : 2,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
  });
};

const rectangle = (x, y, largeur, hauteur, { fond = "transparent", trait = "#1e1e1e", pointilles } = {}) =>
  base("rectangle", x, y, largeur, hauteur, {
    backgroundColor: fond,
    strokeColor: trait,
    strokeStyle: pointilles ? "dashed" : "solid",
    roundness: { type: 3 },
  });

/** Pastille de commentaire, comme dans Figma : un rond jaune numéroté (forme et chiffre groupés). */
const pastille = (x, y, numero) => {
  const groupe = `pastille-${graine}`;
  const rond = base("ellipse", x, y, 44, 44, {
    backgroundColor: "#ffd43b",
    strokeColor: "#e67700",
    strokeWidth: 2,
    groupIds: [groupe],
  });
  const chiffre = texte(x + (numero > 9 ? 10 : 16), y + 10, String(numero), { taille: 20 });
  return [rond, { ...chiffre, groupIds: [groupe] }];
};

// --- Images ----------------------------------------------------------------------------------
/** Fichiers d'une capture : entière, ou ses tuiles dans l'ordre. */
const fichiersDe = (dossier, cle) => {
  const entiere = join(ICI, dossier, `${cle}.png`);
  if (existsSync(entiere)) return [entiere];
  const tuiles = [];
  for (let i = 1; existsSync(join(ICI, dossier, `${cle}-${i}.png`)); i++) {
    tuiles.push(join(ICI, dossier, `${cle}-${i}.png`));
  }
  return tuiles;
};

/** Hauteur réelle maximale d'un morceau d'image : au-delà, un canvas de navigateur peut refuser. */
const MORCEAU_MAX = 12_000;

/**
 * Recolle les tuiles et réduit à la largeur voulue, puis recoupe en morceaux de MORCEAU_MAX px :
 * une liste de JPEG en data URL, avec la hauteur affichée de chacun.
 */
const image = async (fichiers, largeur) => {
  const cible = Math.round(largeur * NETTETE);
  const morceaux = await Promise.all(
    fichiers.map((f) => sharp(f).resize({ width: cible }).png().toBuffer({ resolveWithObject: true })),
  );
  const hauteur = morceaux.reduce((h, m) => h + m.info.height, 0);
  let y = 0;
  const composites = morceaux.map((m) => {
    const c = { input: m.data, top: y, left: 0 };
    y += m.info.height;
    return c;
  });
  const entiere = await sharp({
    create: { width: cible, height: hauteur, channels: 3, background: "#ffffff" },
    limitInputPixels: false,
  })
    .composite(composites)
    .png()
    .toBuffer();
  const parts = [];
  for (let haut = 0; haut < hauteur; haut += MORCEAU_MAX) {
    const h = Math.min(MORCEAU_MAX, hauteur - haut);
    const jpeg = await sharp(entiere, { limitInputPixels: false })
      .extract({ left: 0, top: haut, width: cible, height: h })
      .jpeg({ quality: QUALITE, mozjpeg: true })
      .toBuffer();
    parts.push({ dataURL: `data:image/jpeg;base64,${jpeg.toString("base64")}`, hauteur: h / NETTETE, octets: jpeg.length });
  }
  return parts;
};

// --- Planche -----------------------------------------------------------------------------------
const arg = (nom) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1];
const choix = arg("section");
const sections = choix === undefined ? SECTIONS : [SECTIONS[Number(choix)]];

const elements = [];
const files = {};
let total = 0;
const LARGEUR_LIGNE =
  COLONNES.reduce((s, c) => s + c.largeur, 0) + GOUTTIERE * (COLONNES.length + 1) + NOTES_LARGEUR;

// En-tête du tableau et légende.
elements.push(texte(0, -360, "CLAIR : anciennes vues et nouvelles vues (bêta)", { taille: 44 }));
elements.push(
  texte(
    0,
    -290,
    "Les deux fronts tournent en local contre la même API et la même base (dump du 22/10/2026). Captures des 15 et 16/11/2026, page entière.\nNotes : ce qui a changé entre l'ancienne vue et la bêta, puis ce qu'on pourrait encore améliorer. Source : AUDIT.md.",
    { taille: 18, couleur: "#495057" },
  ),
);
Object.values(STATUTS).forEach((s, i) => {
  elements.push(rectangle(i * 260, -200, 240, 44, { fond: s.fond, trait: s.trait }));
  elements.push(texte(i * 260 + 14, -188, s.libelle, { taille: 18 }));
});
// Commenter comme dans Figma : pastilles à copier sur les captures, fil dans l'encadré de la page.
{
  const x0 = 1120;
  elements.push(rectangle(x0, -230, 1180, 150, { fond: "#fff9db", trait: "#e67700" }));
  elements.push(texte(x0 + 20, -218, "Commenter, comme dans Figma", { taille: 22 }));
  elements.push(
    texte(
      x0 + 20,
      -182,
      "1. Copier une pastille (Ctrl+C, Ctrl+V) et la poser sur l'endroit visé de la capture, avec le numéro suivant.\n2. Écrire le fil sous le même numéro dans l'encadré « Commentaires » de la page : #1 · Prénom · date — remarque, puis ↳ les réponses.\n3. Quand c'est réglé : « ✓ résolu » au bout du fil, et la pastille passe en vert.",
      { taille: 15, couleur: "#495057" },
    ),
  );
  for (let i = 1; i <= 5; i++) elements.push(...pastille(x0 + 880 + (i - 1) * 56, -216, i));
}

let y = 0;
for (const section of sections) {
  elements.push(texte(0, y, section.titre, { taille: 36 }));
  y += 90;
  const pages = PAGES.filter((p) => section.prefixes.includes(p.dossier[0]));
  for (const p of pages) {
    const note = NOTES[p.dossier] ?? { titre: p.dossier, statut: "parite", modifie: [], ameliorer: [] };
    const statut = STATUTS[note.statut] ?? STATUTS.parite;
    const cadreId = `frame-${p.dossier}`;
    const dans = [];

    // Titre, chemin, statut.
    dans.push(texte(GOUTTIERE, y + 24, `${p.dossier.slice(0, 2)} · ${note.titre}`, { taille: 28 }));
    dans.push(
      texte(GOUTTIERE, y + 64, `${p.chemin}${p.beta ? `   ·   bêta : ${p.beta}` : ""}`, {
        taille: 15,
        couleur: "#868e96",
      }),
    );
    const xStatut = LARGEUR_LIGNE - NOTES_LARGEUR - GOUTTIERE;
    dans.push(rectangle(xStatut, y + 24, NOTES_LARGEUR, 40, { fond: statut.fond, trait: statut.trait }));
    dans.push(texte(xStatut + 14, y + 34, statut.libelle, { taille: 18 }));

    // Captures.
    let x = GOUTTIERE;
    const yImages = y + 140;
    let hauteurMax = 0;
    for (const col of COLONNES) {
      dans.push(texte(x, yImages - 30, col.libelle, { taille: 15, couleur: "#495057" }));
      const fichiers = fichiersDe(p.dossier, col.cle);
      if (fichiers.length === 0) {
        dans.push(rectangle(x, yImages, col.largeur, 200, { trait: "#e03131", pointilles: true }));
        dans.push(texte(x + 12, yImages + 12, "Capture absente", { taille: 15, couleur: "#e03131" }));
        hauteurMax = Math.max(hauteurMax, 200);
      } else {
        const parts = await image(fichiers, col.largeur);
        let yPart = yImages;
        for (const [i, part] of parts.entries()) {
          total += part.octets;
          const fileId = createHash("sha1").update(`${p.dossier}/${col.cle}/${i}`).digest("hex");
          files[fileId] = { mimeType: "image/jpeg", id: fileId, dataURL: part.dataURL, created: maintenant };
          dans.push(
            base("image", x, yPart, col.largeur, part.hauteur, {
              strokeColor: "transparent",
              status: "saved",
              fileId,
              scale: [1, 1],
              crop: null,
            }),
          );
          yPart += part.hauteur;
        }
        dans.push(rectangle(x, yImages, col.largeur, yPart - yImages, { trait: "#dee2e6" }));
        hauteurMax = Math.max(hauteurMax, yPart - yImages);
      }
      x += col.largeur + GOUTTIERE;
    }

    // Notes : ce qui a changé, ce qu'on pourrait améliorer.
    let yNote = yImages;
    for (const [titre, puces, fond, trait] of [
      ["Ce qui a changé", note.modifie, "#f1f3f5", "#adb5bd"],
      ["À améliorer", note.ameliorer, "#fff3bf", "#f08c00"],
    ]) {
      if (!puces?.length) continue;
      const corps = texte(x + 16, yNote + 52, puces.map((t) => `• ${t}`).join("\n"), {
        taille: 16,
        largeurMax: NOTES_LARGEUR - 40,
      });
      const hauteur = corps.height + 72;
      dans.push(rectangle(x, yNote, NOTES_LARGEUR, hauteur, { fond, trait }));
      dans.push(texte(x + 16, yNote + 16, titre, { taille: 20 }));
      dans.push(corps);
      yNote += hauteur + 24;
    }
    // Commentaires : le fil de chaque pastille posée sur les captures de la page.
    {
      const hauteur = 260;
      dans.push(rectangle(x, yNote, NOTES_LARGEUR, hauteur, { fond: "#ffffff", trait: "#e67700", pointilles: true }));
      dans.push(texte(x + 16, yNote + 16, "Commentaires", { taille: 20 }));
      dans.push(
        texte(x + 16, yNote + 52, "#1 · Prénom · jj/mm — remarque\n    ↳ réponse\n    ✓ résolu", {
          taille: 15,
          couleur: "#adb5bd",
        }),
      );
      yNote += hauteur + 24;
    }
    hauteurMax = Math.max(hauteurMax, yNote - yImages);

    const hauteurCadre = hauteurMax + 140 + GOUTTIERE;
    elements.push(
      base("frame", 0, y, LARGEUR_LIGNE, hauteurCadre, {
        id: cadreId,
        name: `${p.dossier} · ${note.titre}`,
        strokeColor: "#bbb",
      }),
    );
    for (const e of dans) elements.push({ ...e, frameId: cadreId });
    y += hauteurCadre + 120;
    process.stdout.write(".");
  }
  y += 160;
}

const sortie = join(ICI, choix === undefined ? "clair-ecrans.excalidraw" : `clair-ecrans-${choix}.excalidraw`);
await writeFile(
  sortie,
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: { viewBackgroundColor: "#ffffff", gridSize: null },
    files,
  }),
);
console.log(`\n${sortie} : ${elements.length} éléments, images ${(total / 1e6).toFixed(1)} Mo`);
