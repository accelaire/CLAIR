import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

console.log("🔗 Vérification des liens internes du portail de documentation...\n");

function getMdxFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "scripts" ||
      entry.name === "public" ||
      entry.name === ".git" ||
      entry.name === ".turbo"
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getMdxFiles(fullPath));
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

const allPages = getMdxFiles(ROOT_DIR);
const validRoutes = new Set();
validRoutes.add("/");
validRoutes.add("/api"); // Route for OpenAPI Swagger explorer
validRoutes.add("/api-reference"); // Alias route for OpenAPI explorer

for (const p of allPages) {
  const rel = path.relative(ROOT_DIR, p).replace(/\\/g, "/");
  const route = "/" + rel.replace(/\.(mdx|md)$/, "").replace(/\/index$/, "");
  validRoutes.add(route === "" ? "/" : route);
}

const mdLinkRegex = /\[([^\]]*)\]\(([^)#\s?]+)(?:#[^\s)]*)?\)/g;
const htmlLinkRegex = /(?:href|to)=["']([^"'#\s?]+)(?:#[^"']*)?["']/g;

let totalLinksChecked = 0;
let brokenLinksCount = 0;

function checkTarget(rawTarget, relSource) {
  if (!rawTarget || !rawTarget.startsWith("/") || rawTarget.startsWith("//")) return;

  // Assets in public
  if (rawTarget.endsWith(".svg") || rawTarget.endsWith(".png") || rawTarget.endsWith(".json") || rawTarget.endsWith(".ico")) {
    const assetPath = path.join(PUBLIC_DIR, rawTarget.replace(/^\//, ""));
    totalLinksChecked++;
    if (!fs.existsSync(assetPath)) {
      console.log(`  ❌ [ASSET INTROUVABLE] ${rawTarget} dans ${relSource}`);
      brokenLinksCount++;
    }
    return;
  }

  totalLinksChecked++;
  const targetRoute =
    rawTarget.endsWith("/") && rawTarget.length > 1 ? rawTarget.slice(0, -1) : rawTarget;

  if (!validRoutes.has(targetRoute)) {
    console.log(`  ❌ [LIEN ROUTE CASSÉ] ${rawTarget} dans ${relSource}`);
    brokenLinksCount++;
  }
}

for (const p of allPages) {
  const content = fs.readFileSync(p, "utf-8");
  const relSource = path.relative(ROOT_DIR, p);
  let match;

  while ((match = mdLinkRegex.exec(content)) !== null) {
    checkTarget(match[2], relSource);
  }

  while ((match = htmlLinkRegex.exec(content)) !== null) {
    checkTarget(match[1], relSource);
  }
}

console.log(`📄 Pages analysées : ${allPages.length}`);
console.log(`🔗 Liens vérifiés : ${totalLinksChecked}`);
console.log(
  `📊 Résultat : ${totalLinksChecked - brokenLinksCount} valides, ${brokenLinksCount} cassés.\n`
);

if (process.argv.includes("--strict") && brokenLinksCount > 0) {
  console.error("❌ Échec : des liens internes sont cassés.");
  process.exit(1);
} else {
  console.log("✅ Contrôle d'intégrité des liens terminé avec succès.");
}
