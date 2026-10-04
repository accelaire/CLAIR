# Plan d'Actions : Création et Intégration du Dossier `docs/` Zudoku pour CLAIR

Ce plan détaille l'ensemble des étapes opérationnelles pour concevoir, structurer et déployer le portail de documentation Zudoku au sein du projet **CLAIR**, hébergé dans le répertoire `docs/` et destiné à être accessible publiquement sur **`https://docs.clair.vote`**.

Le portail intègre et sublime l'ensemble du contenu du **Wiki officiel CLAIR** (`https://github.com/accelaire/CLAIR.wiki.git`), en y associant l'explorateur interactif d'API (`api.clair.vote`), le design system signature de CLAIR et l'outillage moderne inspiré de `dinum-setup/documentation` et `scratch`.

---

## 📋 Tableau Synthétique des Jalons

| Jalon | Titre | Objectif Principal |
| :--- | :--- | :--- |
| **Jalon 1** | **Scaffolding & Workspace Monorepo** | Déclarer l'espace `docs/`, configurer `pnpm-workspace.yaml`, `package.json`, `tsconfig.json`, `vite.config.ts`, `turbo.json` et préparer le déploiement sur `docs.clair.vote`. |
| **Jalon 2** | **Identité Visuelle & Thème CLAIR** | Implémenter `zudoku.theme.css` reprenant la charte de `clair.vote` (mode sombre `#0c0e12`, surfaces `#12151b`, bleu `#1d70f5`, badges politiques et votes, logos SVG). |
| **Jalon 3** | **Composants MDX Enrichis & Mermaid** | Créer le composant `Mermaid.tsx` (zoom interactif, plein écran via Portal, adaptation dynamique dark/light) et les composants MDX (`Cards`, `CodeTabs`, `DocHeaderSummary`, `VoteBadge`, `PoliticalBadge`, `ApiSimulator`). |
| **Jalon 4** | **Automatisation de la Navigation & Redirections** | Développer `scripts/generate-docs-navigation.mjs` pour scanner les fichiers MDX à la racine de `docs/` et générer automatiquement `zudoku.navigation.tsx`. |
| **Jalon 5** | **Connexion OpenAPI `api.clair.vote`** | Configurer l'explorateur d'API dans `zudoku.config.tsx` branché sur `https://api.clair.vote/docs/json` avec miroir local de secours `public/openapi.json`. |
| **Jalon 6** | **Migration & Structuration Intégrale du Wiki MDX** | Transposer, enrichir et structurer l'intégralité du Wiki CLAIR en pages MDX (`01-introduction/`, `02-donnees-et-sources/`, `03-base-de-donnees/`, `04-api-reference/`, `05-guide-developpeur/`). |
| **Jalon 7** | **Scripts de Contrôle Qualité & Validation** | Adapter `validate-mdx-syntax.mjs` et `check-links.mjs` pour interdire toute régression syntaxique et tout lien brisé. |
| **Jalon 8** | **Recette, Indexation Pagefind & Validation Finale** | Valider la compilation Zudoku, tester la recherche Pagefind locale, vérifier l'intégration Turbo et valider la configuration DNS / Vercel pour `docs.clair.vote`. |

---

## 🛠️ Jalon 1 : Scaffolding & Workspace Monorepo

### 1.1 Mise à jour de la configuration Monorepo racine
* Modifier `pnpm-workspace.yaml` pour inclure le répertoire `docs` :
  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
    - 'services/*'
    - 'docs'
  ```
* Ajouter les scripts associés dans le fichier racine `package.json` :
  - `"dev:docs": "turbo run dev --filter=@clair/docs"`
  - `"build:docs": "turbo run build --filter=@clair/docs"`
  - `"docs:nav": "pnpm --filter @clair/docs docs:nav"`
  - `"docs:validate": "pnpm --filter @clair/docs validate"`
* Vérifier et ajuster `turbo.json` pour intégrer les tâches de build et de cache de `@clair/docs` (`outputs: ["dist/**"]`).

### 1.2 Création de l'arborescence et des fichiers de configuration `docs/`
* Créer `docs/package.json` :
  - Nom : `@clair/docs`
  - Version : `0.1.0`
  - Type : `module`
  - Dépendances :
    - `zudoku: "^0.86.0"`
    - `react: "^19.2.0"`
    - `react-dom: "^19.2.0"`
    - `mermaid: "^11.17.2"`
  - Dépendances de développement :
    - `typescript: "^5.3.0"`
    - `@types/react: "^19.0.0"`
    - `@types/react-dom: "^19.0.0"`
    - `@types/node: "^20.10.0"`
    - `pagefind: "1.5.2"`
    - `prettier: "^3.0.0"`
  - Scripts :
    - `"dev": "node scripts/generate-docs-navigation.mjs && ZUDOKU_DISABLE_UPDATE_CHECK=1 zudoku dev --host 0.0.0.0"`
    - `"build": "node scripts/generate-docs-navigation.mjs && ZUDOKU_DISABLE_UPDATE_CHECK=1 zudoku build"`
    - `"preview": "ZUDOKU_DISABLE_UPDATE_CHECK=1 zudoku preview --host 0.0.0.0"`
    - `"docs:nav": "node scripts/generate-docs-navigation.mjs"`
    - `"search": "pagefind --site dist --output-path dist/pagefind"`
    - `"validate": "node scripts/validate-mdx-syntax.mjs --strict && node scripts/check-links.mjs --strict"`
    - `"typecheck": "tsc --noEmit"`
* Créer `docs/tsconfig.json` avec support de `react-jsx`, `zudoku/client`, `node`.
* Créer `docs/vite.config.ts` adapté pour Zudoku, incluant la résolution d'alias et la gestion SSR pour Mermaid.
* Créer `docs/vercel.json` pour la configuration du déploiement sur le domaine `docs.clair.vote`.

---

## 🎨 Jalon 2 : Identité Visuelle & Thème CLAIR

### 2.1 Conception de `docs/zudoku.theme.css`
* Importer et aligner les tokens CSS avec ceux définis dans `apps/web/app/globals.css` et `apps/web/tailwind.config.ts` :
  - **Racine (`:root`) - Mode Clair** :
    ```css
    :root {
      --primary: 215 91% 51%; /* Bleu CLAIR #1d70f5 */
      --primary-accent: #2563eb;
      --primary-deep: #1e40af;
      --background: #ffffff;
      --foreground: #020817;
      --card: #ffffff;
      --card-foreground: #020817;
      --border: #e2e8f0;
      --muted: #f1f5f9;
      --muted-foreground: #64748b;
    }
    ```
  - **Mode Sombre (`.dark`) - Signature Figma CLAIR** :
    ```css
    .dark {
      --primary: 215 91% 51%;
      --background: #0c0e12;     /* Fond signature */
      --foreground: #ffffff;
      --card: #12151b;           /* Surface cartes */
      --card-foreground: #ffffff;
      --border: #22262f;         /* Séparateurs et bordures */
      --input: #373a41;          /* Bordures inputs */
      --muted: #22262f;
      --muted-foreground: #94969c;
    }
    ```
  - **Tokens Spécifiques CLAIR** :
    - Badges de vote (`.vote-pour`, `.vote-contre`, `.vote-abstention`, `.vote-absent`).
    - Badges politiques (`.pol-gauche`, `.pol-droite`, `.pol-centre`, etc.).
  - **Affinage de l'UI Zudoku** :
    - En-tête avec bordure subtile `#e2e8f0` / `#22262f` et fond semi-transparent flouté (`backdrop-blur`).
    - Sommaire de droite (TOC) sans fond avec survol bleu CLAIR.
    - Style des blocs de code, tableaux et alertes harmonisé.

### 2.2 Création des Logos et Assets Visuels
* Créer `docs/public/logo-clair-light.svg` et `docs/public/logo-clair-dark.svg` reprenant la typographie et le symbole de CLAIR.
* Créer `docs/public/favicon.svg` cohérent avec l'application web.

---

## 🧩 Jalon 3 : Composants MDX Enrichis & Mermaid

### 3.1 Implémentation du Composant `Mermaid.tsx` (`docs/src/components/Mermaid.tsx`)
* **Fonctionnalités Clés** :
  1. **Rendu Isomorphe / Client Dynamique** : Import asynchrone de `mermaid` pour éviter les erreurs d'hydratation et de SSR.
  2. **Réactivité Thème Sombre / Clair** : `MutationObserver` sur les classes HTML pour régénérer automatiquement le diagramme avec la palette exacte CLAIR :
     - Thème Sombre : Fond `#0c0e12`, nœuds `#12151b`, bordures `#3b82f6`, lignes `#94969c`, texte `#ffffff`.
     - Thème Clair : Fond `#ffffff`, nœuds `#f8fafc`, bordures `#1d70f5`, lignes `#64748b`, texte `#020817`.
  3. **Visualiseur Plein Écran & Zoom** :
     - Boutons interactifs : Zoom In (+), Zoom Out (-), Reset (100%), Plein Écran.
     - Modal avec `createPortal` pour isoler le diagramme dans le DOM.
     - Gestion du clavier (`Escape` pour fermer).
     - Rendu SVG responsive avec conteneur anti-débordement.

### 3.2 Composants MDX Métier & Documentation (`docs/src/components/`)
* **`Cards.tsx`** :
  - `FeatureCard` : Carte interactive avec icône, titre, description, badge et lien d'exploration.
  - `FeatureGrid` : Grille flexible (2, 3 ou 4 colonnes).
  - `TrackCard` : Carte d'étape numérotée avec badge de statut.
* **`CodeTabs.tsx`** :
  - Onglets de commande (`pnpm`, `npm`, `yarn`, `bun`, `docker`, `curl`, `python`, `typescript`).
* **`DocHeaderSummary.tsx`** :
  - Bannière d'en-tête de page MDX avec auteur, date de révision, statut et résumé.
* **`PoliticalBadge.tsx` & `VoteBadge.tsx`** :
  - Affichage visuel direct des groupes parlementaires (EPR, RN, LFI-NFP, SOC, DR, etc.) et des positions de vote (Pour, Contre, Abstention) avec les couleurs officielles de CLAIR.
* **`ApiSimulator.tsx`** :
  - Mini simulateur interactif pour tester des requêtes JSON vers `api.clair.vote` directement dans les guides.
* **`index.ts`** :
  - Point d'entrée exportant tous les composants pour Zudoku.

---

## 🧭 Jalon 4 : Automatisation de la Navigation & Redirections

### 4.1 Développement de `scripts/generate-docs-navigation.mjs`
* **Logique de Scan Récursif** :
  - Scanner le dossier racine `docs/` (en ignorant `node_modules`, `dist`, `src`, `scripts`, `public`).
  - Ordonnancement intelligent : `index.mdx` en premier, puis fichiers, puis sous-dossiers.
  - Extraction des titres depuis les frontmatters ou le premier `# Titre`.
* **Nettoyage & Formatage des Libellés (`formatLabel`)** :
  - Suppression automatique des préfixes de tri (`01-`, `02-`, etc.).
  - Dictionnaire sémantique parlementaire et technique :
    - `an` -> `Assemblée Nationale`
    - `senat` -> `Sénat`
    - `hatvp` -> `HATVP (Lobbying)`
    - `dila` -> `DILA (Légifrance)`
    - `api` -> `API REST`
    - `sdk` -> `SDK & Clients`
    - `prisma` -> `Prisma & BDD`
    - `erd` -> `Schémas ERD`
    - `ingestion` -> `Pipelines d'Ingestion`
    - `cli` -> `Commandes CLI`
    - `ia` -> `Enrichissement IA`
* **Attribution des Icônes Lucide (`getDefaultIcon`)** :
  - Catégorie Introduction -> `sparkles` / `book-open`
  - Catégorie Données & Sources -> `database` / `cloud-download`
  - Catégorie Base de Données -> `server` / `layers`
  - Catégorie API -> `code` / `terminal`
  - Catégorie Guide Développeur -> `rocket` / `git-pull-request`
* **Génération de `zudoku.navigation.tsx`** :
  - Exportation de `docsNavigation` et `docsRedirects`.
  - Formatage automatique via Prettier à la fin de la génération.

---

## ⚡ Jalon 5 : Configuration Zudoku & Connexion OpenAPI

### 5.1 Configuration de `docs/zudoku.config.tsx`
* **Métadonnées & Identité du Site** :
  - Titre : `CLAIR — Documentation & API`
  - Description : `Portail technique, architecture, modèles de données et référence de l'API de transparence politique CLAIR.`
  - Favicon : `/favicon.svg`
  - Logo : Light et Dark SVG pointant vers `/`.
  - Header Navigation : Liens vers `clair.vote`, GitHub et statut de l'API.
* **Moteur de Recherche** :
  - `search: { type: "pagefind" }`
* **Coloration Syntaxique** :
  - `syntaxHighlighting.languages` : `["mermaid", "typescript", "javascript", "json", "bash", "sql", "prisma", "yaml", "dockerfile", "http"]`.
* **Composants MDX Enregistrés** :
  - Intégration de `Mermaid`, `FeatureCard`, `FeatureGrid`, `TrackCard`, `CodeTabs`, `DocHeaderSummary`, `PoliticalBadge`, `VoteBadge`, `ApiSimulator`.
* **Intégration OpenAPI (`api.clair.vote`)** :
  ```tsx
  apis: [
    {
      type: "url",
      input: "https://api.clair.vote/docs/json",
      navigationId: "api-reference",
    }
  ],
  ```
  *(Avec script `export-openapi-spec.mjs` pour sauvegarder `public/openapi.json` en secours local).*
* **Configuration des fichiers de Documentation** :
  - `files: "./**/*.{md,mdx}"` (racine et sous-dossiers).

---

## 📚 Jalon 6 : Migration & Structuration Intégrale du Wiki MDX

### 6.1 Page d'Accueil (`docs/index.mdx`)
* Transposition de `Home.md` avec présentation de CLAIR, licence AGPL-3.0, cartographie du monorepo et tableau des routes du site web.
* Grille `FeatureGrid` orientant vers l'Architecture, l'Ingestion, l'Explorateur d'API, les Schémas ERD et le Guide développeur.
* Schéma Mermaid interactif de l'écosystème global CLAIR.

### 6.2 Section 01 : Introduction & Architecture (`docs/01-introduction/`)
* `index.mdx` : Vue d'ensemble de la démarche citoyenne et de transparence politique.
* `vision-et-valeurs.mdx` : Neutralité, traçabilité des données, absence de comptes utilisateurs (lecture seule).
* `stack-technique.mdx` : Transposition de `Stack.md` (Next.js 14, Fastify 4, Prisma 5, PostgreSQL 16, Redis 7, Tailwind, Turborepo, Vitest).

### 6.3 Section 02 : Données & Ingestion (`docs/02-donnees-et-sources/`)
* `index.mdx` : Vue d'ensemble du cycle de vie de la donnée parlementaire.
* `sources-de-donnees.mdx` : Transposition de `Source des données.md` (flux AN, Sénat, HATVP, DILA, formats, fréquences, URLs).
* `orchestrateur-ingestion.mdx` : Transposition de `L'orchestrateur d'ingestion.md` (batch nocturne, batch intraday, reprises sur panne, réconciliation cross-chambres).
* `commandes-cli.mdx` : Transposition de `Commandes CLI.md` (commandes `pnpm --filter @clair/ingestion` : sync, smart-sync, schedule, backfill, calculate-stats).
* `qualite-des-donnees.mdx` : Transposition de `Qualité des données.md` (audits automatisés, règles de cohérence, seuils).
* `enrichissement-ia.mdx` : Transposition de `Enrichissement IA.md` (modèles Mistral AI, prompts, résumés, vulgarisation des amendements et dossiers, garde-fous).

### 6.4 Section 03 : Base de Données & Modélisation (`docs/03-base-de-donnees/`)
* `index.mdx` : Présentation du schéma relationnel PostgreSQL.
* `modele-prisma.mdx` : Transposition de `BDD Prisma.md` (conventions de nommage, UIDs vs CUIDs, index de recherche, volumétrie en production).
* `schemas-erd.mdx` : Transposition de `Schéma ERD.md` avec diagrammes Mermaid interactifs (Parlementaires, Mandats, Scrutins, Votes, Dossiers, Amendements, HATVP Lobbying, Stats).

### 6.5 Section 04 : Référence API REST (`docs/04-api-reference/`)
* `index.mdx` : Transposition de `API.md` (architecture Fastify, principes REST).
* `authentification-et-limites.mdx` : Limites de débit (tier anonyme 10 req/min vs tier interne/partenaire), headers `X-Internal-Secret`, cache Redis.
* `parlementaires.mdx` : Endpoints `/api/v1/parlementaires`, `/api/v1/deputes`, `/api/v1/senateurs`.
* `scrutins-et-votes.mdx` : Endpoints `/api/v1/scrutins`, votes nominatifs et par groupe.
* `dossiers-et-amendements.mdx` : Endpoints `/api/v1/dossiers`, `/api/v1/sujets`.
* `lobbying-hatvp.mdx` : Endpoints `/api/v1/lobbying` (représentants d'intérêts et actions).
* `exemples-integration.mdx` : Snippets de code en TypeScript, Python et cURL.

### 6.6 Section 05 : Guide Développeur & Déploiement (`docs/05-guide-developpeur/`)
* `index.mdx` : Accueil contributeurs et développeurs.
* `demarrage-local.mdx` : Transposition de `Démarrage local.md` (Docker compose, variables `.env`, migrations Prisma, seed, lancement Turbo).
* `deploiement-production.mdx` : Transposition de `Deploiment.md` (Vercel, Railway, PostgreSQL & Redis managés, configuration pour `docs.clair.vote`).
* `contribution.mdx` : Conventions de code, workflow Git, tests unitaires et intégration.

---

## 🔍 Jalon 7 : Scripts de Contrôle Qualité & Liens

### 7.1 Implémentation de `validate-mdx-syntax.mjs`
* Analyse syntaxique de tous les fichiers `.mdx` et `.md` :
  - Détection des blocs de code mal fermés ou délimiteurs anormaux (`4+ backticks`).
  - Vérification de la parité des délimiteurs de code.
  - Analyse structurelle de balises JSX personnalisées (`<Mermaid>`, `<FeatureCard>`, `<DocHeaderSummary>`, etc.) pour interdire les balises orphelines.

### 7.2 Implémentation de `check-links.mjs`
* Extraction des liens Markdown `[texte](/route)` et HTML `href="/route"`.
* Vérification de l'existence de chaque route interne dans la navigation Zudoku générée.
* Détection et rapport précis des liens cassés avec numéro de ligne et fichier source.

---

## 🚀 Jalon 8 : Recette, Build & Validation Finale

### 8.1 Tests Locaux et Validation de Compilation
* Exécuter la génération de navigation : `pnpm --filter @clair/docs docs:nav`.
* Lancer le serveur de développement : `pnpm --filter @clair/docs dev`.
* Tester la compilation complète : `pnpm --filter @clair/docs build`.
* Lancer l'indexation de recherche : `pnpm --filter @clair/docs search`.
* Exécuter la suite de validation : `pnpm --filter @clair/docs validate`.

### 8.2 Vérification de la Checklist Finale
- [x] Dossier `docs/` créé à la racine du monorepo.
- [x] Tous les fichiers de documentation situés à la racine de `docs/`.
- [x] Setup Zudoku complet (config, navigation dynamique, composant Mermaid interactif).
- [x] Style 100% fidèle à `clair.vote` (palette bleu/dark mode Figma/badges politiques et votes).
- [x] Explorateur d'API branché sur `api.clair.vote`.
- [x] Intégralité des pages du Wiki CLAIR transposées et enrichies en MDX.
- [x] Domaine de destination configuré pour `docs.clair.vote`.
- [x] Scripts d'automatisation et de validation opérationnels.

  1. **Rendu Isomorphe / Client Dynamique** : Import asynchrone de `mermaid` pour éviter les erreurs d'hydratation et de SSR.
  2. **Réactivité Thème Sombre / Clair** : `MutationObserver` sur les classes HTML pour régénérer automatiquement le diagramme avec la palette exacte CLAIR :
     - Thème Sombre : Fond `#0c0e12`, nœuds `#12151b`, bordures `#3b82f6`, lignes `#94969c`, texte `#ffffff`.
     - Thème Clair : Fond `#ffffff`, nœuds `#f8fafc`, bordures `#1d70f5`, lignes `#64748b`, texte `#020817`.
  3. **Visualiseur Plein Écran & Zoom** :
     - Boutons interactifs : Zoom In (+), Zoom Out (-), Reset (100%), Plein Écran.
     - Modal avec `createPortal` pour isoler le diagramme dans le DOM.
     - Gestion du clavier (`Escape` pour fermer).
     - Rendu SVG responsive avec conteneur anti-débordement.

### 3.2 Composants MDX Métier & Documentation (`docs/src/components/`)
* **`Cards.tsx`** :
  - `FeatureCard` : Carte interactive avec icône, titre, description, badge et lien d'exploration.
  - `FeatureGrid` : Grille flexible (2, 3 ou 4 colonnes).
  - `TrackCard` : Carte d'étape numérotée avec badge de statut.
* **`CodeTabs.tsx`** :
  - Onglets de commande (`pnpm`, `npm`, `yarn`, `bun`, `docker`, `curl`, `python`, `typescript`).
* **`DocHeaderSummary.tsx`** :
  - Bannière d'en-tête de page MDX avec auteur, date de révision, statut et résumé.
* **`PoliticalBadge.tsx` & `VoteBadge.tsx`** :
  - Affichage visuel direct des groupes parlementaires (EPR, RN, LFI-NFP, SOC, DR, etc.) et des positions de vote (Pour, Contre, Abstention) avec les couleurs officielles de CLAIR.
* **`ApiSimulator.tsx`** :
  - Mini simulateur interactif pour tester des requêtes JSON vers `api.clair.vote` directement dans les guides.
* **`index.ts`** :
  - Point d'entrée exportant tous les composants pour Zudoku.

---

## 🧭 Jalon 4 : Automatisation de la Navigation & Redirections

### 4.1 Développement de `scripts/generate-docs-navigation.mjs`
* **Logique de Scan Récursif** :
  - Scanner le dossier racine `docs/` (en ignorant `node_modules`, `dist`, `src`, `scripts`, `public`).
  - Ordonnancement intelligent : `index.mdx` en premier, puis fichiers, puis sous-dossiers.
  - Extraction des titres depuis les frontmatters ou le premier `# Titre`.
* **Nettoyage & Formatage des Libellés (`formatLabel`)** :
  - Suppression automatique des préfixes de tri (`01-`, `02-`, etc.).
  - Dictionnaire sémantique parlementaire et technique :
    - `an` -> `Assemblée Nationale`
    - `senat` -> `Sénat`
    - `hatvp` -> `HATVP (Lobbying)`
    - `dila` -> `DILA (Légifrance)`
    - `api` -> `API REST`
    - `sdk` -> `SDK & Clients`
    - `prisma` -> `Prisma & Base de données`
    - `ingestion` -> `Pipelines d'Ingestion`
* **Attribution des Icônes Lucide (`getDefaultIcon`)** :
  - Catégorie Introduction -> `sparkles` / `book-open`
  - Catégorie Architecture -> `layers` / `boxes`
  - Catégorie API -> `code` / `terminal`
  - Catégorie Parlement -> `landmark` / `vote` / `users`
  - Catégorie Ingestion & Données -> `database` / `cloud-download`
  - Catégorie Guide Développeur -> `rocket` / `git-pull-request`
* **Génération de `zudoku.navigation.tsx`** :
  - Exportation de `docsNavigation` et `docsRedirects`.
  - Formatage automatique via Prettier à la fin de la génération.

---

## ⚡ Jalon 5 : Configuration Zudoku & Connexion OpenAPI

### 5.1 Configuration de `docs/zudoku.config.tsx`
* **Métadonnées & Identité du Site** :
  - Titre : `CLAIR — Documentation & API`
  - Description : `Portail technique, architecture, modèles de données et référence de l'API de transparence politique CLAIR.`
  - Favicon : `/favicon.svg`
  - Logo : Light et Dark SVG pointant vers `/`.
  - Header Navigation : Liens vers `clair.vote`, GitHub et statut de l'API.
* **Moteur de Recherche** :
  - `search: { type: "pagefind" }`
* **Coloration Syntaxique** :
  - `syntaxHighlighting.languages` : `["mermaid", "typescript", "javascript", "json", "bash", "sql", "prisma", "yaml", "dockerfile", "http"]`.
* **Composants MDX Enregistrés** :
  - Intégration de `Mermaid`, `FeatureCard`, `FeatureGrid`, `TrackCard`, `CodeTabs`, `DocHeaderSummary`, `PoliticalBadge`, `VoteBadge`, `ApiSimulator`.
* **Intégration OpenAPI (`api.clair.vote`)** :
  ```tsx
  apis: [
    {
      type: "url",
      input: "https://api.clair.vote/docs/json",
      navigationId: "api-reference",
    }
  ],
  ```
  *(Avec un script de secours téléchargeant ou synchronisant `public/openapi.json` pour la CI et le travail hors-ligne).*
* **Configuration des fichiers de Documentation** :
  - `files: "./**/*.{md,mdx}"` (racine et sous-dossiers).

---

## 📚 Jalon 6 : Rédaction du Contenu Initial MDX

### 6.1 Page d'Accueil (`docs/index.mdx`)
* Présentation de la mission de CLAIR.
* Grille `FeatureGrid` orientant vers l'Architecture, l'Explorateur d'API, les Sources de données et le Guide contributeur.
* Schéma Mermaid interactif de l'écosystème global CLAIR.

### 6.2 Section 01 : Introduction & Vision (`docs/01-introduction/`)
* `index.mdx` : Vue d'ensemble de la démarche d'ouverture et de transparence.
* `vision-et-valeurs.mdx` : Neutralité, traçabilité des données, indépendance citoyenne.
* `sources-de-donnees.mdx` : Détail des sources officielles (data.gouv.fr, Assemblée nationale, Sénat, HATVP, DILA).

### 6.3 Section 02 : Architecture Technique (`docs/02-architecture/`)
* `index.mdx` : Carte d'architecture globale (Frontend Next.js, Backend Fastify, PostgreSQL/Prisma, Redis, Ingestion Worker).
* `vue-d-ensemble.mdx` : Diagrammes de flux et interactions entre conteneurs.
* `modele-de-donnees.mdx` : Schéma relationnel Prisma (Parlementaires, Mandats, Scrutins, Votes, Amendements, Déclarations HATVP).
* `pipelines-ingestion.mdx` : Fonctionnement des tâches cron, smart-sync, et calcul des statistiques.

### 6.4 Section 03 : Guides & Référence API (`docs/03-api/`)
* `index.mdx` : Introduction à l'API REST `api.clair.vote`.
* `authentification-et-limites.mdx` : Rate limits (tier anonyme vs interne/partenaire), headers, gestion du cache HTTP.
* `parlementaires.mdx` : Requêtage des députés, sénateurs, filtres par groupe, circonscription et commission.
* `scrutins-et-votes.mdx` : Analyse des scrutins publics, positions individuelles et ventilations par groupe.
* `lobbying-et-representants.mdx` : Données de lobbying HATVP (activités déclarées, clients, domaines d'intervention).
* `exemples-integration.mdx` : Snippets de code en TypeScript, Python et cURL.

### 6.5 Section 04 : Données Parlementaires & Institutions (`docs/04-donnees-parlementaires/`)
* `index.mdx` : Comprendre le parcours législatif français.
* `assemblee-nationale.mdx` : Fonctionnement des législatures, des groupes et des scrutins solennels.
* `senat.mdx` : Spécificités sénatoriales, renouvellement par séries (ex: Sénatoriales 2026).
* `hatvp.mdx` : Répertoire des représentants d'intérêts et déclarations de lobbying.

### 6.6 Section 05 : Guide Développeur & Contribution (`docs/05-guide-developpeur/`)
* `index.mdx` : Participer au développement de CLAIR.
* `demarrage-rapide.mdx` : Prérequis (Node 20+, pnpm 8+, Docker), installation du monorepo, variables d'environnement, initialisation de la base PostgreSQL avec Prisma.
* `stack-technique.mdx` : Bonnes pratiques TypeScript, ESLint, tests unitaires (Vitest) et end-to-end.
* `bonnes-pratiques.mdx` : Conventions de commits, création de PR, respect des licences ouvertes (AGPL-3.0).

---

## 🔍 Jalon 7 : Scripts de Contrôle Qualité & Liens

### 7.1 Implémentation de `validate-mdx-syntax.mjs`
* Analyse syntaxique de tous les fichiers `.mdx` et `.md` :
  - Détection des blocs de code mal fermés ou délimiteurs anormaux (`4+ backticks`).
  - Vérification de la parité des délimiteurs de code.
  - Analyse structurelle de balises JSX personnalisées (`<Mermaid>`, `<FeatureCard>`, `<DocHeaderSummary>`, etc.) pour interdire les balises orphelines.

### 7.2 Implémentation de `check-links.mjs`
* Extraction des liens Markdown `[texte](/route)` et HTML `href="/route"`.
* Vérification de l'existence de chaque route interne dans la navigation Zudoku générée.
* Détection et rapport précis des liens cassés avec numéro de ligne et fichier source.

---

## 🚀 Jalon 8 : Recette, Build & Intégration Finale

### 8.1 Tests Locaux et Validation de Compilation
* Exécuter la génération de navigation : `pnpm --filter @clair/docs docs:nav`.
* Lancer le serveur de développement : `pnpm --filter @clair/docs dev`.
* Tester la compilation complète : `pnpm --filter @clair/docs build`.
* Lancer l'indexation de recherche : `pnpm --filter @clair/docs search`.
* Exécuter la suite de validation : `pnpm --filter @clair/docs validate`.

### 8.2 Vérification des Exigences Utilisateur
- [x] Dossier `docs/` créé à la racine du monorepo.
- [x] Fichiers de documentation situés à la racine de `docs/` avec arborescence claire.
- [x] Setup Zudoku complet (config, navigation dynamique, composant Mermaid interactif).
- [x] Style fidèle à `clair.vote` (palette bleu/dark mode Figma/badges politiques et votes).
- [x] Branchement de l'explorateur d'API sur `api.clair.vote`.
- [x] Scripts d'automatisation et de validation repris de `dinum-setup` et `scratch`.

---

## 📅 Prochaines Étapes Immédiates

1. **Revue et validation du plan d'actions** par l'utilisateur.
2. **Exécution du Jalon 1 à Jalon 8** dès confirmation.
