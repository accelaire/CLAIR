// Fragments de changement et versions de CLAIR (docs/03-changelog/index.mdx).
//
// Deux niveaux :
// - un fragment par PR notable, dans `.changelog/<sujet>.md` ;
// - une version (`vX.Y.Z`) qui regroupe les fragments en attente dans
//   `docs/03-changelog/vX-Y-Z.mdx`, puis un tag annoté au format historique
//   des tags `v0.1.0` à `v0.5.0` (`=== Thème ===`).
//
// Fonctions pures, testées dans lib.test.mjs ; les accès au disque et à git
// sont dans check.mjs, prepare.mjs, from-tags.mjs et tag-message.mjs.

export const NIVEAUX = ["correctif", "mineur", "majeur"];
export const TYPES = ["fonctionnalite", "correction", "donnees", "methodologie", "api", "outillage"];
export const PUBLICS = ["citoyens", "reutilisateurs", "contributeurs"];

/** Titre de section d'une page de version, dans l'ordre d'affichage. */
export const SECTIONS = {
  fonctionnalite: "Nouveautés",
  donnees: "Données",
  methodologie: "Méthodologie",
  api: "Pour les réutilisateurs de l'API",
  correction: "Corrections",
  outillage: "Pour les contributeurs",
};

export const LABEL_SANS_FRAGMENT = "changelog:aucun";
export const LONGUEUR_MAX = 600;
const NOM_FRAGMENT = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/;

// --- Fragments ---------------------------------------------------------------

/** Valeur YAML simple : `mot`, `"texte"` ou liste `[a, b]`. */
function valeur(brute) {
  const v = brute.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    return v
      .slice(1, -1)
      .split(",")
      .map((x) => x.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  // Chaîne écrite par JSON.stringify (frontmatterVersion) : guillemets échappés compris
  if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      // chaîne YAML ordinaire
    }
  }
  return v.replace(/^["']|["']$/g, "");
}

/** `{ meta, corps }` d'un fichier à frontmatter, ou `null` sans frontmatter. */
export function lireFrontmatter(contenu) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(contenu);
  if (!m) return null;
  const meta = {};
  for (const ligne of m[1].split(/\r?\n/)) {
    const i = ligne.indexOf(":");
    if (i === -1) continue;
    const cle = ligne.slice(0, i).trim();
    const brute = ligne.slice(i + 1).trim();
    // `# commentaire` en fin de ligne, sauf dans une valeur entre guillemets
    const sansCommentaire = /^["']/.test(brute) ? brute : brute.replace(/\s+#.*$/, "");
    if (cle) meta[cle] = valeur(sansCommentaire);
  }
  return { meta, corps: m[2].trim() };
}

/** Erreurs d'un fragment (tableau vide s'il est valide). */
export function verifierFragment(fichier, contenu) {
  const erreurs = [];
  if (!NOM_FRAGMENT.test(fichier)) {
    erreurs.push(`${fichier} : le nom doit être un sujet en kebab-case, par exemple sous-amendements.md`);
  }
  const lu = lireFrontmatter(contenu);
  if (!lu) return [...erreurs, `${fichier} : en-tête (---) manquant`];
  const { meta, corps } = lu;

  if (!NIVEAUX.includes(meta.niveau)) {
    erreurs.push(`${fichier} : niveau « ${meta.niveau ?? ""} » invalide (${NIVEAUX.join(", ")})`);
  }
  if (!TYPES.includes(meta.type)) {
    erreurs.push(`${fichier} : type « ${meta.type ?? ""} » invalide (${TYPES.join(", ")})`);
  }
  const publics = Array.isArray(meta.public) ? meta.public : [];
  if (publics.length === 0 || publics.some((p) => !PUBLICS.includes(p))) {
    erreurs.push(`${fichier} : public doit être une liste parmi ${PUBLICS.join(", ")}`);
  }
  if (!Array.isArray(meta.pr) || meta.pr.some((n) => !/^\d+$/.test(n))) {
    erreurs.push(`${fichier} : pr doit être une liste de numéros, [] si la PR n'existe pas encore`);
  }
  if (!corps) erreurs.push(`${fichier} : le texte est vide`);
  if (corps.length > LONGUEUR_MAX) {
    erreurs.push(`${fichier} : ${corps.length} caractères, ${LONGUEUR_MAX} au plus (une à trois phrases)`);
  }
  if (meta.type === "api" && meta.niveau === "majeur" && !/à faire de votre côté/i.test(corps)) {
    erreurs.push(`${fichier} : une rupture d'API dit aux réutilisateurs quoi faire (« À faire de votre côté : … »)`);
  }
  return erreurs;
}

/** Fragment lu : `{ fichier, niveau, type, public, pr, texte }`. */
export function parserFragment(fichier, contenu) {
  const { meta, corps } = lireFrontmatter(contenu) ?? { meta: {}, corps: "" };
  return {
    fichier,
    niveau: meta.niveau,
    type: meta.type,
    public: meta.public ?? [],
    pr: (meta.pr ?? []).map(Number),
    texte: corps,
  };
}

// --- Versions ----------------------------------------------------------------

export function lireVersion(texte) {
  const m = VERSION.exec(texte.trim());
  if (!m) throw new Error(`version invalide : ${texte}`);
  return m.slice(1, 4).map(Number);
}

export const formaterVersion = ([majeur, mineur, correctif]) => `${majeur}.${mineur}.${correctif}`;

/**
 * Fichier de la page d'une version : `0.5.0` → `v0-5-0.mdx`, servie à
 * `/changelog/v0-5-0`. Pas de points dans l'URL, qu'un hébergeur statique
 * pourrait prendre pour une extension de fichier.
 */
export const fichierDeVersion = (version) => `v${formaterVersion(lireVersion(version)).replaceAll(".", "-")}.mdx`;

/** Ordre croissant de deux versions (`v0.10.0` après `v0.9.0`). */
export function comparerVersions(a, b) {
  const [x, y] = [lireVersion(a), lireVersion(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** Niveau le plus haut parmi les fragments, ou `null` sans fragment. */
export function niveauLePlusHaut(fragments) {
  return fragments.reduce(
    (haut, f) => (haut === null || NIVEAUX.indexOf(f.niveau) > NIVEAUX.indexOf(haut) ? f.niveau : haut),
    null,
  );
}

/**
 * Version suivante. En 0.x, une rupture (`majeur`) monte le mineur : la 1.0
 * est une décision du mainteneur (`--version 1.0.0`), pas un effet de bord.
 */
export function versionSuivante(actuelle, niveau) {
  const [majeur, mineur, correctif] = lireVersion(actuelle);
  if (niveau === "majeur" && majeur > 0) return formaterVersion([majeur + 1, 0, 0]);
  if (niveau === "majeur" || niveau === "mineur") return formaterVersion([majeur, mineur + 1, 0]);
  if (niveau === "correctif") return formaterVersion([majeur, mineur, correctif + 1]);
  throw new Error(`niveau invalide : ${niveau}`);
}

/** Numéros de PR cités dans des sujets ou corps de commit, sans doublon, triés. */
export function prDesCommits(messages) {
  const numeros = new Set();
  for (const m of messages.matchAll(/(?:Merge pull request #|\(#)(\d+)/g)) numeros.add(Number(m[1]));
  return [...numeros].sort((a, b) => a - b);
}

// --- Pages de version ----------------------------------------------------------

/** `2026-10-02` → `02/10/2026`. */
const dateFr = (iso) => iso.split("-").reverse().join("/");

/** Texte brut → MDX sûr (les accolades et `<` ouvriraient du JSX). */
const echapperMdx = (texte) => texte.replace(/[{}]/g, (c) => `\\${c}`).replace(/</g, "&lt;");

const DEPOT = "https://github.com/accelaire/CLAIR";
const NOTES = "## Notes complètes";
const STATS = /^(\d+) commits, (\d+) PRs depuis (v\d+\.\d+\.\d+)\.$/;

/** Adresse de la page d'une version dans la documentation. */
export const lienDeVersion = (version) => `/changelog/${fichierDeVersion(version).replace(/\.mdx$/, "")}`;

/** Ligne « 272 commits, 13 PRs depuis v0.4.0. » des messages de tag. */
const ligneStats = ({ commits, prs, depuis }) => `${commits} commits, ${prs} PRs depuis ${depuis}.`;

function frontmatterVersion({ version, date, description, stats }) {
  return [
    "---",
    `title: "Version v${version}"`,
    `sidebar_label: "Version v${version}"`,
    `date: ${date}`,
    `version: ${version}`,
    `description: ${JSON.stringify(description)}`,
    ...(stats ? [`commits: ${stats.commits}`, `prs: ${stats.prs}`, `depuis: ${stats.depuis}`] : []),
    "---",
  ].join("\n");
}

/** En-tête d'une page de version : date, volume, liens vers le code. */
function enTete({ version, date, stats }) {
  const parties = [`**Publiée le ${dateFr(date)}**`];
  if (stats) {
    parties.push(
      `${stats.commits} commits et ${stats.prs} pull requests depuis [${stats.depuis}](${lienDeVersion(stats.depuis)})`,
      `[Comparer avec ${stats.depuis}](${DEPOT}/compare/${stats.depuis}...v${version})`,
    );
  }
  parties.push(`[Code de la version](${DEPOT}/tree/v${version})`);
  return parties.join(" · ");
}

/**
 * Page d'une version déjà publiée, à partir du message de son tag annoté. Les
 * notes du mainteneur sont reprises telles quelles dans « Notes complètes »
 * (`=== Thème ===` devient `### Thème`) ; le résumé reste à écrire.
 */
export function pageDepuisTag({ version, date, message }) {
  const lignes = message.replace(/\r\n/g, "\n").trim().split("\n");
  const premiere = lignes.shift() ?? "";
  const sujet = premiere.replace(/^(?:version\s+)?v?\d+\.\d+\.\d+\s*[—–-]\s*/i, "").trim();
  let stats = null;
  const notes = lignes
    .filter((l) => {
      const m = STATS.exec(l.trim());
      if (m && !stats) stats = { commits: Number(m[1]), prs: Number(m[2]), depuis: m[3] };
      return !m;
    })
    .join("\n")
    .trim()
    .split("\n")
    .map((l) => {
      const theme = /^===\s*(.+?)\s*===$/.exec(l.trim());
      return theme ? `### ${echapperMdx(theme[1])}` : echapperMdx(l);
    })
    .join("\n")
    .trim();
  return [
    frontmatterVersion({ version, date, description: sujet, stats }),
    "",
    enTete({ version, date, stats }),
    "",
    "## En bref",
    "",
    "À COMPLÉTER : trois à cinq lignes sur ce qui change pour les citoyens et pour les réutilisateurs.",
    "",
    NOTES,
    "",
    `_Reprises telles quelles du tag annoté \`v${version}\`._`,
    "",
    notes || "Le tag de cette version ne détaille pas son contenu.",
    "",
  ].join("\n");
}

/**
 * Brouillon de page pour une nouvelle version : les fragments regroupés par
 * type dans « Notes complètes » ; le résumé et les faits marquants sont à
 * écrire par le mainteneur dans la PR de release.
 */
export function brouillonDeVersion({ version, date, precedente, commits, prs, fragments }) {
  const stats = { commits, prs, depuis: precedente };
  const sections = Object.entries(SECTIONS)
    .map(([type, titre]) => {
      const duType = fragments.filter((f) => f.type === type);
      if (duType.length === 0) return null;
      const puces = duType.map((f) => {
        const refs = f.pr.length ? ` (${f.pr.map((n) => `#${n}`).join(", ")})` : "";
        return `- ${f.texte.replace(/\s*\n\s*/g, " ")}${refs}`;
      });
      return [`### ${titre}`, "", ...puces].join("\n");
    })
    .filter(Boolean);
  return [
    frontmatterVersion({ version, date, description: "À COMPLÉTER : thèmes du palier", stats }),
    "",
    enTete({ version, date, stats }),
    "",
    "## En bref",
    "",
    "À COMPLÉTER : trois à cinq lignes sur ce qui change pour les citoyens et pour les réutilisateurs.",
    "",
    "{/* Faits marquants : une section ## par nouveauté importante (explication, lien vers le site,",
    "    exemple d'appel à l'API, schéma Mermaid). Modèle : docs/03-changelog/v0-5-0.mdx. */}",
    "",
    NOTES,
    "",
    sections.join("\n\n"),
    "",
  ].join("\n");
}

/**
 * Message du tag annoté, au format historique, à partir de la page de version :
 * « vX.Y.Z — thèmes », la ligne de volume, puis les « Notes complètes » où
 * `### Thème` redevient `=== Thème ===`.
 */
export function messageDeTag(page) {
  const { meta, corps } = lireFrontmatter(page) ?? { meta: {}, corps: page };
  const lignes = corps.split("\n");
  const debut = lignes.findIndex((l) => l.trim() === NOTES);
  const apres = debut === -1 ? [] : lignes.slice(debut + 1);
  const fin = apres.findIndex((l) => /^##\s/.test(l));
  const texte = (fin === -1 ? apres : apres.slice(0, fin))
    .filter((l) => !/^_Reprises telles quelles/.test(l))
    .map((l) => {
      const theme = /^###\s+(.+)$/.exec(l);
      if (theme) return `=== ${theme[1]} ===`;
      return l
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\\([{}])/g, "$1")
        .replace(/&lt;/g, "<");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const stats = meta.commits ? `${ligneStats(meta)}\n\n` : "";
  return `v${meta.version} — ${meta.description}\n\n${stats}${texte}\n`;
}
