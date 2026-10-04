import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG = {
  docsDir: ROOT_DIR,
  outputFile: path.join(ROOT_DIR, "zudoku.navigation.tsx"),
};

// Ignore directories and files that should not be in the docs navigation
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "public",
  "scripts",
  "src",
  ".git",
  ".turbo",
]);

/**
 * Formats directory and file names into a clean, human-readable title.
 */
function formatLabel(name) {
  const clean = name.replace(/^(\d+-)+/, "");

  const exactMatches = {
    guide: "Plateforme & Guide",
    donnees: "Données & Base de Données",
    "donnees-et-sources": "Données & Sources",
    "base-de-donnees": "Base de Données",
    "api-reference": "Référence API",
    "guide-developpeur": "Guide Développeur",
    "vision-et-valeurs": "Vision & Valeurs",
    "stack-technique": "Stack Technique",
    "sources-de-donnees": "Sources Open Data",
    "orchestrateur-ingestion": "Orchestrateur d'Ingestion",
    "commandes-cli": "Commandes CLI",
    "qualite-des-donnees": "Qualité des Données",
    "enrichissement-ia": "Enrichissement IA",
    "modele-prisma": "Modèle Prisma",
    "schemas-erd": "Schémas ERD",
    "authentification-et-limites": "Authentification & Limites",
    parlementaires: "Parlementaires",
    "scrutins-et-votes": "Scrutins & Votes",
    "dossiers-et-amendements": "Dossiers & Amendements",
    "lobbying-hatvp": "Lobbying HATVP",
    "exemples-integration": "Exemples d'Intégration",
    "demarrage-local": "Démarrage Local",
    "deploiement-production": "Déploiement en Production",
    contribution: "Contribution & Normes",
  };

  if (exactMatches[clean]) {
    return exactMatches[clean];
  }

  const acronyms = {
    an: "Assemblée Nationale",
    senat: "Sénat",
    hatvp: "HATVP",
    dila: "DILA",
    api: "API REST",
    sdk: "SDK",
    erd: "Schémas ERD",
    prisma: "Prisma BDD",
    cli: "CLI",
    ia: "IA (Mistral)",
    jo: "Journal Officiel",
    uid: "UIDs",
  };

  return clean
    .split(/[-_]+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (acronyms[lower]) return acronyms[lower];
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Returns default Lucide icon name for categories and sections.
 */
function getDefaultIcon(name, depth) {
  const lower = name.toLowerCase();

  if (depth === 0) {
    if (lower.includes("accueil") || lower.includes("home")) return "home";
    if (lower.includes("intro") || lower.includes("vision")) return "sparkles";
    if (lower.includes("donnee") || lower.includes("source")) return "database";
    if (lower.includes("base") || lower.includes("bdd") || lower.includes("prisma"))
      return "server";
    if (lower.includes("api")) return "code";
    if (lower.includes("guide") || lower.includes("dev") || lower.includes("developpeur"))
      return "rocket";
  }

  // Sub-categories or specific folders
  if (lower.includes("source")) return "cloud-download";
  if (lower.includes("ingestion") || lower.includes("orchestrateur")) return "cpu";
  if (lower.includes("cli") || lower.includes("commande")) return "terminal";
  if (lower.includes("qualite") || lower.includes("audit")) return "check-circle";
  if (lower.includes("ia") || lower.includes("mistral")) return "bot";
  if (lower.includes("erd") || lower.includes("schema")) return "git-fork";
  if (lower.includes("auth") || lower.includes("limite")) return "shield";
  if (lower.includes("vote") || lower.includes("scrutin")) return "check-square";
  if (lower.includes("dossier") || lower.includes("loi")) return "file-text";
  if (lower.includes("lobbying") || lower.includes("hatvp")) return "building-2";
  if (lower.includes("deploiment") || lower.includes("deploiement")) return "cloud";

  return "folder";
}

function extractFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    const yaml = match[1];
    const data = {};
    for (const line of yaml.split("\n")) {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (key && val) data[key] = val;
      }
    }
    return data;
  } catch {
    return {};
  }
}

/**
 * Recursively scans a directory and builds Zudoku navigation items.
 */
function scanDir(dir, baseDir, depth = 0) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const validEntries = entries.filter((e) => {
    if (e.name.startsWith("_") || e.name.startsWith(".")) return false;
    if (
      e.name === "README.md" ||
      e.name === "CONTEXTE.md" ||
      e.name === "PLAN_ACTIONS.md" ||
      e.name === "PROMPT_PLAN.md" ||
      e.name === "ITERATION.md"
    )
      return false;
    if (depth === 0 && IGNORE_DIRS.has(e.name)) return false;
    if (e.isFile() && !e.name.endsWith(".md") && !e.name.endsWith(".mdx")) return false;
    return true;
  });

  // Sort: index first, then files before folders, then natural ordering
  validEntries.sort((a, b) => {
    const aIsIndex = a.name.startsWith("index.");
    const bIsIndex = b.name.startsWith("index.");
    if (aIsIndex && !bIsIndex) return -1;
    if (!aIsIndex && bIsIndex) return 1;

    if (a.isFile() && b.isDirectory()) return -1;
    if (a.isDirectory() && b.isFile()) return 1;

    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  const items = [];
  for (const entry of validEntries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      const subItems = scanDir(fullPath, baseDir, depth + 1);
      if (subItems.length > 0) {
        items.push({
          type: "category",
          label: formatLabel(entry.name),
          icon: getDefaultIcon(entry.name, depth),
          collapsed: false,
          items: subItems,
        });
      }
    } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
      const frontmatter = extractFrontmatter(fullPath);
      const cleanName = entry.name.replace(/\.mdx?$/, "");
      const label =
        frontmatter.sidebar_label ||
        frontmatter.title ||
        (entry.name.startsWith("index.")
          ? depth === 0
            ? "Accueil"
            : formatLabel(path.basename(dir))
          : formatLabel(cleanName));
      const icon = frontmatter.sidebar_icon || frontmatter.icon || getDefaultIcon(cleanName, depth);

      if (entry.name.startsWith("index.")) {
        if (depth === 0) {
          items.push({
            type: "doc",
            file: relPath,
            path: "/",
            label: label || "Accueil",
            icon: "home",
          });
        } else {
          items.push({
            type: "doc",
            file: relPath,
            path: `/${path.dirname(relPath)}`,
            label,
            icon,
          });
        }
      } else {
        items.push({
          type: "doc",
          file: relPath,
          path: "/" + relPath.replace(/\.mdx?$/, ""),
          label,
          icon,
        });
      }
    }
  }

  return items;
}

function generateNavigation() {
  console.log("Scanning docs directory...");
  const navItems = scanDir(CONFIG.docsDir, CONFIG.docsDir);

  // Add Interactive Swagger API Explorer category in the sidebar
  navItems.push({
    type: "category",
    label: "Explorateur Swagger (API)",
    icon: "code",
    collapsed: false,
    items: [
      {
        type: "link",
        label: "API CLAIR (api.clair.vote)",
        to: "/api",
        icon: "terminal",
      },
    ],
  });

  const redirects = [
    { from: "/home", to: "/" },
    { from: "/accueil", to: "/" },
    { from: "/01-introduction", to: "/01-guide" },
    { from: "/01-introduction/vision-et-valeurs", to: "/01-guide/vision-et-valeurs" },
    { from: "/01-introduction/stack-technique", to: "/01-guide/stack-technique" },
    { from: "/stack", to: "/01-guide/stack-technique" },
    { from: "/sources", to: "/02-donnees/sources-de-donnees" },
    { from: "/02-donnees-et-sources", to: "/02-donnees" },
    { from: "/02-donnees-et-sources/sources-de-donnees", to: "/02-donnees/sources-de-donnees" },
    { from: "/02-donnees-et-sources/orchestrateur-ingestion", to: "/02-donnees/orchestrateur-ingestion" },
    { from: "/02-donnees-et-sources/commandes-cli", to: "/02-donnees/commandes-cli" },
    { from: "/02-donnees-et-sources/qualite-des-donnees", to: "/02-donnees/qualite-des-donnees" },
    { from: "/02-donnees-et-sources/enrichissement-ia", to: "/02-donnees/enrichissement-ia" },
    { from: "/ingestion", to: "/02-donnees/orchestrateur-ingestion" },
    { from: "/cli", to: "/02-donnees/commandes-cli" },
    { from: "/qualite", to: "/02-donnees/qualite-des-donnees" },
    { from: "/ia", to: "/02-donnees/enrichissement-ia" },
    { from: "/03-base-de-donnees", to: "/02-donnees" },
    { from: "/03-base-de-donnees/modele-prisma", to: "/02-donnees/modele-prisma" },
    { from: "/03-base-de-donnees/schemas-erd", to: "/02-donnees/schemas-erd" },
    { from: "/bdd", to: "/02-donnees/modele-prisma" },
    { from: "/erd", to: "/02-donnees/schemas-erd" },
    { from: "/04-api-reference", to: "/01-guide/api-reference" },
    { from: "/04-api-reference/authentification-et-limites", to: "/01-guide/api-reference/authentification-et-limites" },
    { from: "/04-api-reference/parlementaires", to: "/01-guide/api-reference/parlementaires" },
    { from: "/04-api-reference/scrutins-et-votes", to: "/01-guide/api-reference/scrutins-et-votes" },
    { from: "/04-api-reference/dossiers-et-amendements", to: "/01-guide/api-reference/dossiers-et-amendements" },
    { from: "/04-api-reference/lobbying-hatvp", to: "/01-guide/api-reference/lobbying-hatvp" },
    { from: "/04-api-reference/exemples-integration", to: "/01-guide/api-reference/exemples-integration" },
    { from: "/05-guide-developpeur", to: "/01-guide/guide-developpeur" },
    { from: "/05-guide-developpeur/demarrage-local", to: "/01-guide/guide-developpeur/demarrage-local" },
    { from: "/05-guide-developpeur/deploiement-production", to: "/01-guide/guide-developpeur/deploiement-production" },
    { from: "/05-guide-developpeur/contribution", to: "/01-guide/guide-developpeur/contribution" },
    { from: "/deploiement", to: "/01-guide/guide-developpeur/deploiement-production" },
    { from: "/demarrage", to: "/01-guide/guide-developpeur/demarrage-local" },
  ];

  const content = `import type { ZudokuConfig } from "zudoku";

export const docsNavigation: ZudokuConfig["navigation"] = ${JSON.stringify(navItems, null, 2)};

export const docsRedirects: ZudokuConfig["redirects"] = ${JSON.stringify(redirects, null, 2)};
`;

  fs.mkdirSync(path.dirname(CONFIG.outputFile), { recursive: true });
  fs.writeFileSync(CONFIG.outputFile, content, "utf-8");

  try {
    execSync(`npx prettier --write "${CONFIG.outputFile}"`, { stdio: "ignore" });
  } catch {
    // Fallback if prettier is not run
  }

  console.log(`✓ Navigation generated at ${CONFIG.outputFile}`);
}

generateNavigation();
