// node --test scripts/changelog/lib.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brouillonDeVersion,
  comparerVersions,
  fichierDeVersion,
  lireFrontmatter,
  messageDeTag,
  niveauLePlusHaut,
  pageDepuisTag,
  parserFragment,
  prDesCommits,
  verifierFragment,
  versionSuivante,
} from "./lib.mjs";

const fragment = (meta, texte = "Les sous-amendements sont reliés à leur amendement parent.") =>
  `---\n${meta}\n---\n\n${texte}\n`;
const valide = "niveau: mineur\ntype: fonctionnalite\npublic: [citoyens, reutilisateurs]\npr: [96]";

describe("verifierFragment", () => {
  it("accepte un fragment complet", () => {
    assert.deepEqual(verifierFragment("sous-amendements.md", fragment(valide)), []);
  });

  it("accepte pr: [] quand la PR n'existe pas encore, et les commentaires en fin de ligne", () => {
    const meta = "niveau: correctif # petit\ntype: correction\npublic: [citoyens]\npr: []";
    assert.deepEqual(verifierFragment("calcul.md", fragment(meta)), []);
  });

  it("refuse un nom qui n'est pas un sujet en kebab-case", () => {
    assert.match(verifierFragment("2026-10-25 Sous_amendements.md", fragment(valide))[0], /kebab-case/);
  });

  it("refuse un niveau, un type ou un public inconnus", () => {
    const meta = "niveau: enorme\ntype: divers\npublic: [tout-le-monde]\npr: [1]";
    const erreurs = verifierFragment("x.md", fragment(meta));
    assert.equal(erreurs.length, 3);
  });

  it("refuse un texte vide ou trop long", () => {
    assert.match(verifierFragment("x.md", fragment(valide, "")).join(), /vide/);
    assert.match(verifierFragment("x.md", fragment(valide, "a".repeat(601))).join(), /601 caractères/);
  });

  it("exige « À faire de votre côté » pour une rupture d'API", () => {
    const meta = "niveau: majeur\ntype: api\npublic: [reutilisateurs]\npr: [1]";
    assert.equal(verifierFragment("x.md", fragment(meta, "La route /x disparaît.")).length, 1);
    assert.deepEqual(
      verifierFragment("x.md", fragment(meta, "La route /x disparaît. À faire de votre côté : utiliser /y.")),
      [],
    );
  });

  it("refuse un fichier sans en-tête", () => {
    assert.match(verifierFragment("x.md", "texte")[0], /en-tête/);
  });
});

describe("lireFrontmatter", () => {
  it("garde un # dans une valeur entre guillemets", () => {
    assert.equal(lireFrontmatter('---\ntitle: "Sous-amendements (#96)"\n---\n').meta.title, "Sous-amendements (#96)");
  });
});

describe("versions", () => {
  it("compare numériquement", () => {
    assert.ok(comparerVersions("v0.10.0", "v0.9.0") > 0);
    assert.equal(comparerVersions("0.5.0", "v0.5.0"), 0);
  });

  it("nomme la page d'une version sans point", () => {
    assert.equal(fichierDeVersion("v0.5.0"), "v0-5-0.mdx");
    assert.equal(fichierDeVersion("0.10.2"), "v0-10-2.mdx");
  });

  it("prend le niveau le plus haut", () => {
    assert.equal(niveauLePlusHaut([{ niveau: "correctif" }, { niveau: "mineur" }]), "mineur");
    assert.equal(niveauLePlusHaut([]), null);
  });

  it("monte le bon chiffre", () => {
    assert.equal(versionSuivante("v0.5.0", "correctif"), "0.5.1");
    assert.equal(versionSuivante("v0.5.3", "mineur"), "0.6.0");
    assert.equal(versionSuivante("v1.2.3", "majeur"), "2.0.0");
  });

  it("en 0.x, une rupture monte le mineur : la 1.0 se décide explicitement", () => {
    assert.equal(versionSuivante("v0.5.0", "majeur"), "0.6.0");
  });

  it("retrouve les PR des commits de merge et des squash", () => {
    const log = "Merge pull request #106 from accelaire/fix\nfeat(web): sous-amendements (#96)\nfix: x (#96)";
    assert.deepEqual(prDesCommits(log), [96, 106]);
  });
});

const tagV05 = `v0.5.0 — Sénatoriales 2026, multi-législatures

272 commits, 13 PRs depuis v0.4.0.

=== Sénatoriales 2026 (nouveau module, full-stack) ===

- Une page par circonscription (64)
- Format abrégé pour stats > 1M {ex}
`;

describe("pageDepuisTag", () => {
  const page = pageDepuisTag({ version: "0.5.0", date: "2026-10-02", message: tagV05 });

  it("titre « Version vX.Y.Z », sans icône, thèmes en description", () => {
    assert.match(page, /^---\ntitle: "Version v0.5.0"\nsidebar_label: "Version v0.5.0"\n/);
    assert.doesNotMatch(page, /sidebar_icon/);
    assert.match(page, /description: "Sénatoriales 2026, multi-législatures"/);
  });

  it("met la date, le volume et les liens dans l'en-tête", () => {
    assert.match(page, /\*\*Publiée le 02\/10\/2026\*\* · 272 commits et 13 pull requests depuis \[v0.4.0\]\(\/changelog\/v0-4-0\)/);
    assert.match(page, /compare\/v0.4.0\.\.\.v0.5.0/);
    assert.match(page, /tree\/v0.5.0/);
  });

  it("garde un résumé à écrire, puis les notes du tag en ### échappées", () => {
    assert.ok(page.indexOf("## En bref") < page.indexOf("## Notes complètes"));
    assert.match(page, /^### Sénatoriales 2026 \(nouveau module, full-stack\)$/m);
    assert.match(page, /stats > 1M \\\{ex\\\}/);
    assert.doesNotMatch(page.split("## Notes complètes")[1] ?? "", /272 commits/);
  });

  it("v0.1.0 : titre normalisé, pas de volume, notes absentes signalées", () => {
    const v01 = pageDepuisTag({ version: "0.1.0", date: "2026-01-07", message: "Version 0.1.0 - Initial public release\n" });
    assert.match(v01, /description: "Initial public release"/);
    assert.doesNotMatch(v01, /commits:|pull requests/);
    assert.match(v01, /ne détaille pas son contenu/);
  });

  it("redonne exactement le message du tag", () => {
    const enrichie = page.replace(
      "## Notes complètes",
      "## Un fait marquant\n\nExplication, [lien](/x) et\n\n```bash\ncurl https://api.clair.vote/x\n```\n\n## Notes complètes",
    );
    assert.equal(messageDeTag(enrichie), tagV05);
  });
});

describe("brouillonDeVersion", () => {
  it("regroupe les fragments par type dans les notes complètes", () => {
    const fragments = [
      parserFragment("a.md", fragment(valide)),
      parserFragment("b.md", fragment("niveau: correctif\ntype: outillage\npublic: [contributeurs]\npr: []", "Node 24.")),
    ];
    const page = brouillonDeVersion({
      version: "0.6.0",
      date: "2026-12-10",
      precedente: "v0.5.0",
      commits: 95,
      prs: 12,
      fragments,
    });
    assert.match(page, /title: "Version v0.6.0"/);
    assert.match(page, /95 commits et 12 pull requests depuis \[v0.5.0\]/);
    assert.match(page, /### Nouveautés\n\n- Les sous-amendements sont reliés à leur amendement parent\. \(#96\)/);
    assert.match(page, /### Pour les contributeurs\n\n- Node 24\.$/m);
    assert.match(messageDeTag(page), /^v0.6.0 — À COMPLÉTER : thèmes du palier\n\n95 commits, 12 PRs depuis v0.5.0\.\n\n=== Nouveautés ===/);
  });
});
