---
name: clair-composant
description: Create or migrate a CLAIR UI component in packages/ui (folder, CSS module, story, test, docs page, export) porting it from apps/web when it exists there. Use when asked to create, migrate or port a component, or to take the next components of a wave.
---

# CLAIR — créer ou migrer un composant

Standards généraux : skill `clair-react`. Stories : skill `clair-story`. Vérification : skill `clair-verifier`.

## Étapes

1. **Cadrer.** Partir de la demande (ou de l'issue « Composant ou écran ») et du catalogue `docs/04-front/03-composants/index.mdx` (familles et composants déjà faits) : sources legacy dans `apps/web`, doublons, base Mantine, stories attendues.
2. **Lire l'existant** sans le modifier : chaque fichier legacy cité, puis `grep -rn` du nom et des classes CSS dans `apps/web` pour trouver les doublons. `apps/web` ne se modifie jamais.
3. **Vérifier qu'il n'existe pas déjà** dans `packages/ui/src/index.ts`.
4. **Créer le dossier** `packages/ui/src/<catégorie>/<nom-kebab>/` :

   | Fichier | Contenu |
   |---|---|
   | `Nom.tsx` | fonction fléchée, JSDoc en français, `type NomProps` exporté si public, base Mantine 9 si elle existe |
   | `Nom.module.css` | uniquement `var(--clair-…)`, variantes `[data-variant="…"]` |
   | `Nom.stories.tsx` | skill `clair-story` |
   | `Nom.test.tsx` | rendu + comportement visible + clavier si interactif (`renderWithProviders`) |
   | `index.ts` | `export { Nom, type NomProps } from "./Nom.tsx";` |

   Catégories (code, en anglais) ↔ familles (doc et Storybook, en français) : `core` → `01-fondations` / « Fondations », `layout` → `02-mise-en-page` / « Mise en page », `filters` → `03-filtres` / « Filtres », `parliament` → `04-parlementaire` / « Parlementaire », `charts` → `05-graphiques` / « Graphiques ».
5. **Exporter** dans `packages/ui/src/index.ts`, dans la section de sa catégorie (ordre alphabétique).
6. **Page de doc** `docs/04-front/03-composants/<famille>/<nom-kebab>.mdx` :
   ```mdx
   ---
   title: Nom
   sidebar_label: "Nom"
   ---

   import { Nom } from "@clair/ui";

   Une phrase : rôle et règle d'usage. [Toutes les variantes dans l'atelier Storybook](https://storybook.clair.vote/?path=/docs/composants-<famille>-<nom>--docs)

   ## Import

   ```tsx
   import { Nom } from "@clair/ui";
   ```

   ## Utilisation de base

   <Preview>
     <Nom>…</Nom>
   </Preview>

   ```tsx
   <Nom>…</Nom>
   ```

   ## Avec …   (une section par variante : un <Preview> + un bloc de code)
   ```
   Un bloc de code **par aperçu**, plus le bloc d'import : le test du catalogue le vérifie.
   Dans un aperçu MDX, un texte écrit sur plusieurs lignes devient un `<p>` : passe les textes en expression (`{"…"}`) ou sur une seule ligne, sinon un `<p>` imbriqué casse l'hydratation (erreur React #418, relevée par le test e2e).
7. **Vérifier** (skill `clair-verifier`) : `pnpm check`, type-check et tests de `@clair/ui`, captures clair / sombre / mobile **relues**, `pnpm docs:nav` puis `pnpm docs:validate`.
8. **Fragment** `.changelog/` si le composant devient visible pour les citoyens (sinon rien : un composant seul n'est pas notable).

## Définition de « terminé »

- Dossier complet, export, page de doc, story `Defaut`, test.
- Aucune valeur en dur, aucun `next/*`, aucune violation a11y dans Storybook.
- Captures relues ; le catalogue (`pnpm --filter @clair/ui test`) et le test du gabarit de la doc passent.
