// Génère les diagrammes entité-relation de `02-donnees/schemas-erd.mdx` depuis
// le schéma Prisma, pour qu'ils ne puissent pas diverger de lui.
//
// Lit le DMMF du client Prisma généré : à lancer depuis `apps/api`, après
// `pnpm db:generate`. Depuis la racine : `pnpm docs:erd`.
//
// Seule la partie entre les marqueurs `ERD:DEBUT` et `ERD:FIN` de la page est
// réécrite ; le texte autour reste écrit à la main.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.resolve(__dirname, "../02-donnees/schemas-erd.mdx");
const DEBUT = "{/* ERD:DEBUT, généré par docs/scripts/generate-erd.mjs : ne pas modifier à la main */}";
const FIN = "{/* ERD:FIN */}";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { Prisma } = require("@prisma/client");
const models = Prisma.dmmf.datamodel.models;

// Chaque table apparaît avec ses colonnes dans une seule section.
const SECTIONS = [
  {
    titre: "Parlementaires, mandats et groupes",
    tables: [
      "parlementaires",
      "parlementaires_identifiants",
      "mandats_parlementaires",
      "groupes_politiques",
      "circonscriptions",
      "mandats",
      "groupes_alliances",
      "groupes_thematiques",
      "declarations_hatvp",
    ],
  },
  {
    titre: "Travail législatif : dossiers, scrutins, amendements, débats, sujets",
    tables: [
      "dossiers_legislatifs",
      "scrutins",
      "votes",
      "amendements",
      "_AmendementToScrutin",
      "_AmendementCosignataires",
      "interventions",
      "intervention_scrutin",
      "textes_articles",
      "sujets",
      "sujet_liens",
    ],
  },
  {
    titre: "Commissions, réunions et agenda",
    tables: [
      "commissions",
      "reunions",
      "reunion_participants",
      "avis_commission",
      "dossier_commissions",
      "evenements_institutionnels",
    ],
  },
  {
    titre: "Lobbying (HATVP)",
    tables: [
      "lobbyistes",
      "actions_lobby",
      "secteurs",
      "lobbyistes_secteurs",
      "actions_secteurs",
      "cible_types",
      "action_descriptions",
    ],
  },
  {
    titre: "Élections sénatoriales : candidatures et résultats",
    tables: [
      "candidatures_listes",
      "candidatures",
      "resultats_tours",
      "resultats_listes",
      "candidats_mandats_locaux",
    ],
  },
  {
    titre: "Tables techniques",
    intro: "Sans relation avec les autres tables.",
    tables: ["source_states", "sync_logs", "feedbacks"],
  },
];

const TYPES = {
  String: "text",
  Int: "int",
  BigInt: "bigint",
  Float: "float",
  Decimal: "decimal",
  Boolean: "bool",
  DateTime: "timestamp",
  Json: "jsonb",
  Bytes: "bytea",
};

const tableOf = (model) => model.dbName ?? model.name;
const columnOf = (field) => field.dbName ?? field.name;
const modelByName = new Map(models.map((m) => [m.name, m]));

// --- Tables -----------------------------------------------------------------

/** Colonnes d'un modèle : { type, nom, cles, nullable }. */
function colonnes(model) {
  const fk = new Set(
    model.fields.filter((f) => f.kind === "object").flatMap((f) => f.relationFromFields ?? []),
  );
  const pk = new Set(model.primaryKey?.fields ?? []);
  return model.fields
    .filter((f) => f.kind === "scalar" || f.kind === "enum")
    .map((f) => {
      const cles = [];
      if (f.isId || pk.has(f.name)) cles.push("PK");
      if (fk.has(f.name)) cles.push("FK");
      if (f.isUnique) cles.push("UK");
      const type = (TYPES[f.type] ?? "text") + (f.isList ? "[]" : "");
      return { type, nom: columnOf(f), cles, nullable: !f.isRequired };
    });
}

// Tables de jointure implicites des relations many-to-many sans modèle.
const jointures = [];
for (const model of models) {
  for (const f of model.fields) {
    if (f.kind !== "object" || !f.isList) continue;
    const autre = modelByName.get(f.type);
    const inverse = autre.fields.find((g) => g.relationName === f.relationName && g !== f);
    if (!inverse?.isList || jointures.some((j) => j.relation === f.relationName)) continue;
    // Prisma nomme les colonnes A et B dans l'ordre alphabétique des modèles.
    const [a, b] = [model, autre].sort((x, y) => (x.name < y.name ? -1 : 1));
    jointures.push({ relation: f.relationName, table: `_${f.relationName}`, a, b });
  }
}

function blocTable(nom) {
  const model = models.find((m) => tableOf(m) === nom);
  const lignes = [];
  if (model) {
    for (const c of colonnes(model)) {
      const cles = c.cles.length ? ` ${c.cles.join(", ")}` : "";
      const note = c.nullable ? '  "nullable"' : "";
      lignes.push(`        ${c.type} ${c.nom}${cles}${note}`);
    }
  } else {
    const j = jointures.find((x) => x.table === nom);
    if (!j) throw new Error(`Table inconnue : ${nom}`);
    lignes.push(`        text A PK, FK "${tableOf(j.a)}.id"`);
    lignes.push(`        text B PK, FK "${tableOf(j.b)}.id"`);
  }
  return [`    ${citer(nom)} {`, ...lignes, "    }"];
}

// Mermaid exige des guillemets autour des noms qui commencent par `_`.
const citer = (nom) => (nom.startsWith("_") ? `"${nom}"` : nom);

// --- Relations --------------------------------------------------------------

/** Toutes les relations : { parent, enfant, cardinalite, etiquette }. */
const relations = [];
for (const model of models) {
  for (const f of model.fields) {
    if (f.kind !== "object" || !f.relationFromFields?.length) continue;
    const champs = f.relationFromFields.map((n) => model.fields.find((x) => x.name === n));
    const obligatoire = champs.every((c) => c.isRequired);
    const unique =
      (champs.length === 1 && champs[0].isUnique) ||
      model.uniqueFields.some(
        (u) => u.length === champs.length && champs.every((c) => u.includes(c.name)),
      );
    relations.push({
      parent: tableOf(modelByName.get(f.type)),
      enfant: tableOf(model),
      cardinalite: `${obligatoire ? "||" : "|o"}--${unique ? "o|" : "o{"}`,
      etiquette: champs.map(columnOf).join(", "),
    });
  }
}
for (const j of jointures) {
  relations.push({ parent: tableOf(j.a), enfant: j.table, cardinalite: "||--o{", etiquette: "A" });
  relations.push({ parent: tableOf(j.b), enfant: j.table, cardinalite: "||--o{", etiquette: "B" });
}

const ligneRelation = (r) =>
  `    ${citer(r.parent)} ${r.cardinalite} ${citer(r.enfant)} : "${r.etiquette}"`;

// --- Page -------------------------------------------------------------------

const toutes = new Set(SECTIONS.flatMap((s) => s.tables));
const attendues = [...models.map(tableOf), ...jointures.map((j) => j.table)];
const oubliees = attendues.filter((t) => !toutes.has(t));
if (oubliees.length) throw new Error(`Tables sans section : ${oubliees.join(", ")}`);

const diagramme = (titre, lignes) =>
  [`<Mermaid`, `  title="${titre}"`, "  chart={`erDiagram", ...lignes, "`}", "/>"].join("\n");

const sansRelation = attendues.filter(
  (t) => !relations.some((r) => r.parent === t || r.enfant === t),
);

const parties = [];
parties.push("## 🗺️ Vue d'ensemble des relations");
parties.push(
  `Les ${relations.length} relations entre tables, sans les colonnes. ` +
    `Les ${sansRelation.length} tables sans clé étrangère (${sansRelation.map((t) => `\`${t}\``).join(", ")}) ` +
    "n'y figurent pas ; elles sont détaillées plus bas.",
);
parties.push(diagramme("Toutes les relations", relations.map(ligneRelation)));

for (const section of SECTIONS) {
  const lignes = section.tables.flatMap(blocTable);
  // Une relation est montrée dans la section de sa table enfant.
  lignes.push(...relations.filter((r) => section.tables.includes(r.enfant)).map(ligneRelation));
  parties.push(`## ${section.titre}`);
  if (section.intro) parties.push(section.intro);
  parties.push(diagramme(section.titre, lignes));
}

const contenu = fs.readFileSync(PAGE, "utf-8");
const i = contenu.indexOf(DEBUT);
const j = contenu.indexOf(FIN);
if (i === -1 || j === -1 || j < i) throw new Error(`Marqueurs ERD introuvables dans ${PAGE}`);
const page = contenu.slice(0, i + DEBUT.length) + "\n\n" + parties.join("\n\n") + "\n\n" + contenu.slice(j);
fs.writeFileSync(PAGE, page, "utf-8");
console.log(`✓ ${PAGE} : ${attendues.length} tables, ${relations.length} relations`);
