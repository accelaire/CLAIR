import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

console.log("🔍 Contrôle approfondi de la syntaxe MDX et des balises...\n");

function getMdxFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "scripts" || entry.name === "public" || entry.name === ".git" || entry.name === ".turbo") {
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
let errorCount = 0;
let checkedCount = 0;

for (const p of allPages) {
  const content = fs.readFileSync(p, "utf-8");
  const relPath = path.relative(ROOT_DIR, p);
  checkedCount++;

  // 1. Vérifier les blocs de code mal fermés (4+ backticks)
  const backtickMatches = content.match(/(`{4,})/g);
  if (backtickMatches) {
    console.log(`  ❌ [BLOC DE CODE INVALID (4+ backticks)] ${relPath}`);
    errorCount++;
  }

  // 2. Vérifier la parité des délimiteurs de code ```
  const codeBlockCount = (content.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    console.log(`  ❌ [BLOC DE CODE NON FERMÉ (nombre impair de \`\`\`)] ${relPath}`);
    errorCount++;
  }

  // 3. Vérifier les balises orphelines de composants personnalisés
  const customTags = [
    "Mermaid",
    "FeatureCard",
    "FeatureGrid",
    "TrackCard",
    "CodeTabs",
  ];

  for (const tag of customTags) {
    // Retirer les blocs de code et commentaires avant l'analyse
    const cleaned = content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    // Nettoyer les chaînes de caractères littérales sans avaler le texte entre apostrophes françaises
    const sanitized = cleaned
      .replace(/\{`[\s\S]*?`\}/g, '=""')
      .replace(/`[^`]*`/g, "``")
      .replace(/"[^"\r\n]*"/g, '""')
      .replace(/=\s*'[^'\r\n]*'/g, '=""');

    // 1. Détecter les balises auto-fermantes <Tag ... /> ou <Tag/>
    const selfClosingTagRegex = new RegExp(`<${tag}(?:\\s[^>]*?)?\\s*\\/>`, "g");
    const selfClosingCount = (sanitized.match(selfClosingTagRegex) || []).length;

    // 2. Détecter toutes les balises d'ouverture (auto-fermantes ou non)
    const allOpenTagRegex = new RegExp(`<${tag}(?:\\s[^>]*?)?\\s*>`, "g");
    const totalOpenCount = (sanitized.match(allOpenTagRegex) || []).length;

    // Les balises d'ouverture réelles (non auto-fermantes)
    const actualOpenCount = totalOpenCount - selfClosingCount;

    // 3. Détecter les balises de fermeture </Tag>
    const closeTagRegex = new RegExp(`</${tag}>`, "g");
    const closeCount = (sanitized.match(closeTagRegex) || []).length;

    if (actualOpenCount !== closeCount) {
      console.log(
        `  ❌ [BALISE NON ÉQUILIBRÉE <${tag}>] ${relPath} (ouvertes: ${actualOpenCount}, fermées: ${closeCount})`
      );
      errorCount++;
    }
  }
}

console.log(`📄 Pages analysées : ${checkedCount}`);
console.log(`📊 Résultat : ${errorCount} anomalie(s) détectée(s).\n`);

if (process.argv.includes("--strict") && errorCount > 0) {
  console.error("❌ Échec de la validation MDX.");
  process.exit(1);
} else {
  console.log("✅ Validation syntaxique MDX réussie.");
}
