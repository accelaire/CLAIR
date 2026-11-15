// Crée la page docs/03-changelog/vX-Y-Z.mdx des versions déjà taguées qui n'en ont
// pas, à partir du message de leur tag annoté (texte du mainteneur conservé).
//
//   node scripts/changelog/from-tags.mjs [--remplacer]
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { comparerVersions, fichierDeVersion, pageDepuisTag } from "./lib.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const git = (...args) => execFileSync("git", args, { cwd: RACINE, encoding: "utf8" });

function main() {
  const remplacer = process.argv.includes("--remplacer");
  const tags = git("tag", "--list", "v[0-9]*.[0-9]*.[0-9]*")
    .split("\n")
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort(comparerVersions);

  for (const tag of tags) {
    const cible = path.join(RACINE, "docs/03-changelog", fichierDeVersion(tag));
    if (existsSync(cible) && !remplacer) continue;
    const [date, message] = [
      git("for-each-ref", `refs/tags/${tag}`, "--format=%(taggerdate:short)").trim(),
      git("tag", "--list", "--format=%(contents)", tag),
    ];
    if (!date) {
      console.warn(`⚠ ${tag} n'est pas un tag annoté : ignoré`);
      continue;
    }
    writeFileSync(cible, pageDepuisTag({ version: tag.slice(1), date, message }));
    console.log(`✓ ${path.relative(RACINE, cible)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
