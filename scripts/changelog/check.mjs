// Vérifie les fragments de `.changelog/` et, dans une PR, qu'il y en a un.
//
//   node scripts/changelog/check.mjs                       # format des fragments
//   node scripts/changelog/check.mjs --base origin/master  # + fragment ajouté par la branche
//        [--labels '["changelog:aucun"]'] [--avertir]
//
// --avertir : l'absence de fragment n'est qu'un avertissement (période d'adoption).
// Le format d'un fragment présent est toujours bloquant.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LABEL_SANS_FRAGMENT, verifierFragment } from "./lib.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DOSSIER = path.join(RACINE, ".changelog");

/** Fichiers fragments (`.md` sauf README.md). */
export function fichiersFragments() {
  if (!existsSync(DOSSIER)) return [];
  return readdirSync(DOSSIER).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
}

const option = (args, nom) => {
  const i = args.indexOf(nom);
  return i === -1 ? undefined : (args[i + 1] ?? "");
};

function main() {
  const args = process.argv.slice(2);
  const base = option(args, "--base");
  const labels = JSON.parse(option(args, "--labels") || "[]");
  const avertir = args.includes("--avertir");

  const fichiers = fichiersFragments();
  const erreurs = fichiers.flatMap((f) => verifierFragment(f, readFileSync(path.join(DOSSIER, f), "utf8")));

  let manque = null;
  if (base !== undefined && !labels.includes(LABEL_SANS_FRAGMENT)) {
    const ajoutes = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=A", `${base}...HEAD`, "--", ".changelog/"],
      { cwd: RACINE, encoding: "utf8" },
    )
      .split("\n")
      .filter((f) => f.endsWith(".md") && !f.endsWith("README.md"));
    if (ajoutes.length === 0) {
      manque =
        `aucun fragment ajouté dans .changelog/ : si la PR change le site, l'API, les données, ` +
        `la méthodologie ou l'outillage, en ajouter un (docs/03-changelog/index.mdx) ; ` +
        `sinon, poser le label « ${LABEL_SANS_FRAGMENT} »`;
    }
  }

  for (const e of erreurs) console.error(`✗ ${e}`);
  if (manque && avertir) console.log(`::warning::${manque}`);
  else if (manque) console.error(`✗ ${manque}`);

  if (erreurs.length > 0 || (manque && !avertir)) {
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${fichiers.length} fragment(s) valide(s)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
