// Prépare une version à partir des fragments en attente :
// - brouillon de docs/03-changelog/vX-Y-Z.mdx (à réécrire dans la PR de release) ;
// - version montée dans tous les package.json du dépôt ;
// - fragments consommés supprimés.
// Ne crée ni commit, ni tag, ni release : c'est au mainteneur (docs/03-changelog/index.mdx).
//
//   node scripts/changelog/prepare.mjs [--niveau correctif|mineur|majeur] [--version 1.0.0] [--essai]
//
// --essai : affiche ce qui serait fait, sans rien écrire.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOSSIER, fichiersFragments } from "./check.mjs";
import {
  brouillonDeVersion,
  comparerVersions,
  fichierDeVersion,
  formaterVersion,
  lireVersion,
  messageDeTag,
  NIVEAUX,
  niveauLePlusHaut,
  parserFragment,
  prDesCommits,
  verifierFragment,
  versionSemver,
  versionSuivante,
} from "./lib.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const git = (...args) => execFileSync("git", args, { cwd: RACINE, encoding: "utf8" }).trim();

/** package.json de la racine et des espaces de travail (apps, services, packages, docs). */
function manifestes() {
  const dossiers = ["apps", "services", "packages"].flatMap((d) =>
    readdirSync(path.join(RACINE, d), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(d, e.name)),
  );
  return ["", "docs", ...dossiers].map((d) => path.join(RACINE, d, "package.json"));
}

const option = (args, nom) => {
  const i = args.indexOf(nom);
  return i === -1 ? undefined : (args[i + 1] ?? "");
};

function main() {
  const args = process.argv.slice(2);
  const essai = args.includes("--essai");
  const niveauForce = option(args, "--niveau");
  if (niveauForce !== undefined && !NIVEAUX.includes(niveauForce)) {
    throw new Error(`--niveau : ${NIVEAUX.join(", ")}`);
  }
  // Vérifiée avant tout accès au disque : « 1.0 », « 1.0.0-beta » ou « v1.0.0.1 » écriraient une
  // page et des package.json invalides. Le « v » initial est toléré, puis retiré.
  const versionForcee = option(args, "--version");
  if (versionForcee !== undefined && !versionSemver(versionForcee)) {
    throw new Error(`--version : « ${versionForcee} » n'est pas une version X.Y.Z (ex. 1.0.0)`);
  }

  const fichiers = fichiersFragments();
  const contenus = fichiers.map((f) => [f, readFileSync(path.join(DOSSIER, f), "utf8")]);
  const erreurs = contenus.flatMap(([f, c]) => verifierFragment(f, c));
  if (erreurs.length > 0) throw new Error(`fragments invalides :\n${erreurs.join("\n")}`);
  const fragments = contenus.map(([f, c]) => parserFragment(f, c));
  if (fragments.length === 0)
    throw new Error("aucun fragment en attente dans .changelog/ : rien à publier");

  const precedente = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
  const niveauFragments = niveauLePlusHaut(fragments);
  const niveau =
    niveauForce && NIVEAUX.indexOf(niveauForce) > NIVEAUX.indexOf(niveauFragments)
      ? niveauForce
      : niveauFragments;
  const version = versionForcee
    ? formaterVersion(lireVersion(versionForcee))
    : versionSuivante(precedente, niveau);
  if (comparerVersions(version, precedente) <= 0)
    throw new Error(`${version} n'est pas après ${precedente}`);

  const commits = Number(git("rev-list", "--count", `${precedente}..HEAD`));
  const prs = prDesCommits(git("log", "--format=%s%n%b", `${precedente}..HEAD`));
  const date = new Date().toISOString().slice(0, 10);
  const page = brouillonDeVersion({
    version,
    date,
    precedente,
    commits,
    prs: prs.length,
    fragments,
  });
  const cible = path.join(RACINE, "docs/03-changelog", fichierDeVersion(version));

  console.log(
    `Version : ${precedente} → v${version} (niveau ${niveau}, ${fragments.length} fragment(s))`,
  );
  console.log(`${commits} commits, ${prs.length} PRs depuis ${precedente}`);
  const sansFragment = prs.filter((n) => !fragments.some((f) => f.pr.includes(n)));
  if (sansFragment.length > 0) {
    console.log(`PR sans fragment (à vérifier) : ${sansFragment.map((n) => `#${n}`).join(", ")}`);
  }

  if (essai) {
    console.log(`\n--- ${path.relative(RACINE, cible)} (essai, non écrit) ---\n${page}`);
    return;
  }

  writeFileSync(cible, page);
  for (const fichier of manifestes()) {
    const avant = readFileSync(fichier, "utf8");
    writeFileSync(fichier, avant.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
  }
  for (const f of fichiers) rmSync(path.join(DOSSIER, f));

  console.log(
    `\n✓ ${path.relative(RACINE, cible)} écrit, package.json en ${version}, fragments consommés.`,
  );
  console.log(
    `Ensuite : réécrire la page, pnpm docs:nav, puis la PR « chore(release): v${version} ».`,
  );
  console.log(`\nMessage du tag (après merge) :\n\n${messageDeTag(page)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
