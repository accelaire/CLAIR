# Captures : site actuel et bêta

Une capture par page, pour les deux fronts, à importer dans Figma.

- `NN-nom-de-la-page/actuel-desktop.png` : `apps/web` (le site de clair.vote), 1440 px de large, page entière.
- `NN-nom-de-la-page/actuel-mobile.png` : le même en 390 px (@2x).
- `NN-nom-de-la-page/beta-desktop.png` et `beta-mobile.png` : `apps/site` (le nouveau front), avec les corrections de l'audit (`AUDIT.md`).
- **Pages longues** : au-delà de 16 000 px (8 000 px de page en mobile), la capture est découpée en tuiles `beta-desktop-1.png`, `beta-desktop-2.png`… à recoller bout à bout dans Figma, dans l'ordre. Au-delà de 10 tuiles, la fin est coupée (le journal le dit).
- `index.html` : toutes les paires côte à côte, pour relire avant l'import.

Le préfixe numérique suit l'ordre du menu : 0x accueil, 1x-2x parlementaires et gouvernements, 3x-4x votes et textes, 5x travaux, 6x lobbying, 7x sénatoriales, 8x-9x pages éditoriales.

## Données

Les deux fronts tournent **en local, contre la même API et la même base** : le dump de production du 22/10/2026, complété par les migrations postérieures et par `sync-gouvernements`, `sync-bilan-gouvernement` et `calculate-stats`. Les chiffres sont donc ceux du 22/10, identiques des deux côtés, mais pas ceux d'aujourd'hui sur clair.vote.

Ce qui reste vide des deux côtés :

- les renvois Légifrance des amendements (index LEGI non téléchargé) ;
- les dates de naissance des candidats aux sénatoriales (absentes du dump) ;
- le direct de l'agenda, faute de séance en cours au moment de la capture.

## Refaire les captures

```bash
docker compose -f docker-compose.yml -f <surcharge locale> up -d   # Postgres 17 et Redis
(set -a; . ./.env; cd apps/api && npx tsx src/index.ts)             # API sur :3001
pnpm --filter @clair/web build && (cd apps/web && npx next start -p 3000)
pnpm --filter @clair/site build && (cd apps/site && npx next start -p 3010)
node screenshots/capture.mjs              # toutes les pages ; --only=depute pour un sous-ensemble
node screenshots/planche.mjs              # régénère index.html
```

La liste des pages et les exemples (député, scrutin, dossier…) sont dans `pages.mjs`. Les exemples sont pris par ordre alphabétique ou de date, sans critère politique.

## Excalidraw

- `clair-ecrans.excalidraw` (44 Mo) : toutes les pages. Chaque page est un cadre nommé (`01-accueil · Accueil`…) qui contient l'ancienne vue et la bêta, en ordinateur et en mobile, son statut, ce qui a changé et ce qu'on pourrait améliorer. Les notes viennent de `notes.json`, écrit d'après `AUDIT.md`.
- `clair-ecrans-0.excalidraw` à `-4` : le même tableau, une section par fichier, plus légers à ouvrir :
  - 0 : accueil et recherche ;
  - 1 : parlementaires, groupes, classements, gouvernements ;
  - 2 : votes, scrutins, dossiers, sujets ;
  - 3 : commissions, agenda, lobbying, sénatoriales ;
  - 4 : pages éditoriales, légales, erreurs.
- `clair-composants.excalidraw` : le design system de `packages/ui`. Une carte par composant (description de sa page de doc, story `Defaut` en clair et en sombre), rangées par famille, après les fondations.

**Commenter, comme dans Figma** : Excalidraw gratuit n'a pas de fils de commentaires. En tête du tableau, des pastilles jaunes numérotées se copient sur l'endroit visé d'une capture ; le fil s'écrit sous le même numéro dans l'encadré « Commentaires » de la page (`#1 · Prénom · jj/mm — remarque`, puis `↳` pour les réponses et « ✓ résolu », la pastille passant en vert).

**Figma** n'ouvre pas les `.excalidraw`, et aucun plugin fiable ne le fait. `figma/` contient donc un SVG par page (ancienne vue, bêta, notes, encadré « Commentaires ») et un par famille de composants : les glisser dans Figma, où textes, formes et captures arrivent en calques modifiables. Les pages de fondations (couleurs, typographie, espacements) n'y sont pas : prendre leurs PNG dans `composants/`.

Les captures sont réduites en JPEG, et les pages très longues sont recoupées en morceaux empilés. Pour le détail, prendre le PNG d'origine.

```bash
node screenshots/excalidraw.mjs                  # tout ; --section=2 pour une section
pnpm --filter @clair/storybook build && node screenshots/composants-excalidraw.mjs
# SVG pour Figma (bibliothèque Excalidraw installée hors du dépôt, voir l'en-tête du script) :
node screenshots/figma-svg.mjs --lib=<dossier>/node_modules
```
