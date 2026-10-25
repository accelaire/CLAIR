// Message du tag annoté d'une version, au format historique, depuis sa page.
//
//   node scripts/changelog/tag-message.mjs v0.6.0 > /tmp/tag.txt
//   git tag -a v0.6.0 -F /tmp/tag.txt
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fichierDeVersion, messageDeTag } from "./lib.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function main() {
  const tag = process.argv[2];
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) throw new Error("usage : tag-message.mjs vX.Y.Z");
  process.stdout.write(messageDeTag(readFileSync(path.join(RACINE, "docs/03-changelog", fichierDeVersion(tag)), "utf8")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
