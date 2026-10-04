# Contexte du Projet : Portail de Documentation Zudoku pour CLAIR

## 1. Vision, Objectifs & URL Cible

L'objectif est d'intégrer un portail de documentation moderne, complet, performant et pérenne au sein du dépôt **CLAIR**, hébergé dans un répertoire `docs/`.

Ce portail sera déployé en production et accessible publiquement sur le sous-domaine dédié :
👉 **`https://docs.clair.vote`**

### Missions du Portail
1. **Reprendre et enrichir l'intégralité du Wiki officiel CLAIR** (`https://github.com/accelaire/CLAIR.wiki.git`) :
   - Modèle de données Prisma & Schémas ERD Mermaid complets.
   - Orchestrateur d'ingestion (batch nocturne, batch intraday, réconciliation d'entités).
   - Sources de données ouvertes (Assemblée nationale, Sénat, HATVP, DILA, data.gouv.fr).
   - Pipelines d'enrichissement par IA souveraine (Mistral AI).
   - Contrôles de qualité des données et audits d'intégrité.
   - Commandes CLI et scripts d'administration.
   - Démarrage local, stack technique et stratégie de déploiement (Vercel, Railway).
2. **Fournir un explorateur d'API interactif connecté à `api.clair.vote`** : interface OpenAPI 3.0 fluide, interactive et testable pour les développeurs civiques et partenaires.
3. **Harmonisation graphique fidèle à `clair.vote`** : respect strict de la charte graphique (thème sombre signature `#0c0e12`, surfaces `#12151b`, bleu primaire `#1d70f5`, typographie Inter/JetBrains Mono, badges de vote et groupes politiques).
4. **Automatisation de la maintenance & Outillage robuste** :
   - Navigation Zudoku générée dynamiquement via `scripts/generate-docs-navigation.mjs`.
   - Rendu de diagrammes Mermaid interactifs (`Mermaid.tsx` avec zoom, plein écran via Portal et bascule dynamique Light/Dark).
   - Validation de syntaxe MDX et d'intégrité des liens (`validate-mdx-syntax.mjs`, `check-links.mjs`).

---

## 2. Analyse et Synthèse du Wiki CLAIR (`CLAIR.wiki`)

Le wiki GitHub (`https://github.com/accelaire/CLAIR.wiki.git`) contient une base documentaire technique et métier très riche qui doit être intégralement structurée et intégrée dans `docs/` :

| Page Wiki d'Origine | Contenu & Concepts Clés à Transposer |
| :--- | :--- |
| **`Home.md`** | Présentation de CLAIR (Citoyen Libre, Analyse, Information, République), licence AGPL-3.0, architecture globale du monorepo, cartographie des routes du site web. |
| **`Stack.md`** | Next.js 14 (App Router), Fastify 4, Prisma 5, PostgreSQL 16, Redis 7, Tailwind CSS, Radix UI, Turborepo, Vitest. |
| **`Démarrage local.md`** | Prérequis, initialisation Docker Compose (`postgres` + `redis`), configuration `.env`, migrations Prisma, seed de base, lancement concurrent via Turbo. |
| **`Source des données.md`** | Inventaire exhaustif des flux Open Data : Assemblée nationale (Dossiers, Amendements, Scrutins, Députés, Organes), Sénat (Sénateurs, Dosleg, Amendements, Scrutins), HATVP (Répertoire des représentants d'intérêts, déclarations de lobbying), DILA / Légifrance (Textes de loi, JO). Fréquences, formats (JSON, XML, CSV) et URLs des sources. |
| **`L'orchestrateur d'ingestion.md`** | Architecture du worker d'ingestion, pipeline du batch nocturne (téléchargement, parsing, upsert, réconciliation, liaisons cross-chambres), pipeline intraday (scrutins et séances en temps réel), gestion des reprises sur panne et idempotence. |
| **`Commandes CLI.md`** | Répertoire exhaustif des commandes CLI `pnpm --filter @clair/ingestion` (`sync`, `smart-sync`, `schedule`, `backfill`, `calculate-stats`, synchronisations ciblées par module). |
| **`Qualité des données.md`** | Règles de cohérence et audits automatisés (`audit-data-quality.ts`, `audit-hatvp-data.ts`), détection des doublons, réconciliation des identifiants parlementaires, seuils de tolérance. |
| **`Enrichissement IA.md`** | Pipeline d'IA Mistral (modèles `mistral-small` et `mistral-large`), prompts structurés, résumés automatiques de scrutins et dossiers législatifs, vulgarisation des amendements, garde-fous anti-hallucination. |
| **`BDD Prisma.md`** | Modèle relationnel complet : conventions de nommage, stratégie des identifiants (UIDs officiels vs CUIDs), index de recherche et de jointure, gestion des volumétries en production. |
| **`Schéma ERD.md`** | Diagrammes relationnels Mermaid détaillés (Parlementaires & Mandats, Scrutins & Votes, Dossiers & Amendements, HATVP Lobbying, Statistiques & Historique). |
| **`API.md`** | Architecture Fastify, routes REST, gestion du rate limiting (tier anonyme à 10 req/min vs tier interne/partenaire avec `CLAIR_INTERNAL_SECRET`), politique de cache Redis, compression gzip. |
| **`Deploiment.md`** | Topologie de production : Frontend sur Vercel, API sur Railway, Worker d'ingestion sur Railway, PostgreSQL & Redis managés. Configuration DNS pour `clair.vote`, `api.clair.vote` et `docs.clair.vote`. |

---

## 3. Analyse des Projets de Référence

### A. Référence 1 : `dinum-setup/documentation`
* **Moteur & Framework** : [Zudoku](https://zudoku.dev) (par Zuplo), basé sur Vite, React 19 et MDX.
* **Génération de navigation** (`scripts/generate-docs-navigation.mjs`) :
  - Parcours récursif des dossiers Markdown/MDX.
  - Nettoyage des préfixes numériques d'ordonnancement (`01-`, `02-`).
  - Dictionnaire de formatage des acronymes et labels (`AN`, `HATVP`, `DILA`, `API`, `SDK`, `ERD`, etc.).
  - Attribution automatique d'icônes Lucide selon le nom et la profondeur de catégorie.
  - Émission de `zudoku.navigation.tsx` avec gestion fine des redirections.
* **Composants MDX avancés** (`src/components/`) :
  - **`Mermaid.tsx`** : Rendu client dynamique, `MutationObserver` pour la bascule de thème, mode plein écran (Portal React), zoom interactif (+, -, reset), accessibilité et isolation SVG.
  - **`Cards.tsx`** (`FeatureCard`, `FeatureGrid`, `TrackCard`) : Cartes et grilles responsives.
  - **`CodeTabs.tsx`** : Onglets de code multi-langages (pnpm, npm, cURL, python, typescript).
  - **`DocHeaderSummary.tsx`** : En-tête contextuel avec badges et temps de lecture.
* **Personnalisation graphique** (`zudoku.theme.css`) :
  - Surcharges CSS Zudoku pour reproduire la charte graphique souhaitée.

### B. Référence 2 : `scratch`
* **Contrôle Qualité & Fiabilité** (`scripts/`) :
  - **`validate-mdx-syntax.mjs`** : Détection des balises JSX orphelines, blocs de code markdown invalides (`4+ backticks`), parité des délimiteurs de code.
  - **`check-links.mjs`** : Contrôle exhaustif des liens internes pour proscrire tout lien brisé (404).

---

## 4. Design Tokens & Charte Graphique `clair.vote`

* **Couleur Principale** :
  - Bleu CLAIR : `hsl(215 91% 51%)` (`#1d70f5` / `#2563eb`).
  - Bleu Accent : `hsl(218 78% 45%)`.
  - Bleu Profond : `hsl(220 76% 38%)`.
* **Palette Thème Clair** :
  - Background : `#ffffff`
  - Foreground : `hsl(222.2 84% 4.9%)` (`#020817`)
  - Border : `hsl(214.3 31.8% 91.4%)` (`#e2e8f0`)
  - Muted : `hsl(210 40% 96.1%)` / Muted Text : `hsl(215.4 16.3% 46.9%)`
* **Palette Thème Sombre (Figma CLAIR)** :
  - Background : `hsl(220 20% 5.9%)` (`#0c0e12`)
  - Card / Surface : `hsl(221 20% 8.8%)` (`#12151b`)
  - Border / Divider : `hsl(221 16% 15.9%)` (`#22262f`)
  - Input / Subtle Border : `hsl(222 8% 23.5%)` (`#373a41`)
  - Muted Text : `hsl(225 4% 59.6%)` (`#94969c`)
* **Tokens Politiques et Votes** :
  - Vote : Pour (`#4CAF50`), Contre (`#F44336`), Abstention (`#FF9800`), Absent (`#9E9E9E`).
  - Groupes Politiques : Gauche (`#E53935`), Centre-gauche (`#F06292`), Centre (`#FFB300`), Centre-droit (`#42A5F5`), Droite (`#1565C0`), Extrême-droite (`#0D47A1`).

---

## 5. Architecture Cible du Répertoire `docs/`

```text
clair/
├── docs/
│   ├── package.json                   # Configuration du package @clair/docs
│   ├── tsconfig.json                  # TypeScript pour Zudoku & React 19
│   ├── vite.config.ts                 # Configuration Vite
│   ├── zudoku.config.tsx              # Configuration maîtresse Zudoku
│   ├── zudoku.navigation.tsx          # Navigation dynamique générée
│   ├── zudoku.theme.css               # Thème graphique CLAIR
│   ├── index.mdx                      # Accueil de la documentation (racine)
│   ├── 01-introduction/               # Vision, valeurs et architecture globale
│   │   ├── index.mdx
│   │   ├── vision-et-valeurs.mdx
│   │   └── stack-technique.mdx
│   ├── 02-donnees-et-sources/          # Sources Open Data & Ingestion
│   │   ├── index.mdx
│   │   ├── sources-de-donnees.mdx
│   │   ├── orchestrateur-ingestion.mdx
│   │   ├── commandes-cli.mdx
│   │   ├── qualite-des-donnees.mdx
│   │   └── enrichissement-ia.mdx
│   ├── 03-base-de-donnees/            # Modèle relationnel & Schémas ERD
│   │   ├── index.mdx
│   │   ├── modele-prisma.mdx
│   │   └── schemas-erd.mdx
│   ├── 04-api-reference/              # Documentation API REST & OpenAPI
│   │   ├── index.mdx
│   │   ├── authentification-et-limites.mdx
│   │   ├── parlementaires.mdx
│   │   ├── scrutins-et-votes.mdx
│   │   ├── dossiers-et-amendements.mdx
│   │   ├── lobbying-hatvp.mdx
│   │   └── exemples-integration.mdx
│   ├── 05-guide-developpeur/          # Guide d'installation & Déploiement
│   │   ├── index.mdx
│   │   ├── demarrage-local.mdx
│   │   ├── deploiement-production.mdx
│   │   └── contribution.mdx
│   ├── scripts/
│   │   ├── generate-docs-navigation.mjs # Générateur dynamique de zudoku.navigation.tsx
│   │   ├── validate-mdx-syntax.mjs     # Analyseur statique MDX
│   │   ├── check-links.mjs             # Vérificateur de liens internes
│   │   └── export-openapi-spec.mjs     # Synchronisation OpenAPI de secours
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── logo-clair-light.svg
│   │   ├── logo-clair-dark.svg
│   │   └── openapi.json
│   └── src/
│       ├── components/
│       │   ├── Mermaid.tsx            # Rendu Mermaid interactif (zoom/plein écran/dark)
│       │   ├── Cards.tsx              # FeatureCard, FeatureGrid, TrackCard
│       │   ├── CodeTabs.tsx           # Onglets multi-langages
│       │   ├── DocHeaderSummary.tsx   # En-tête de page avec métadonnées
│       │   ├── PoliticalBadge.tsx     # Badges des groupes parlementaires
│       │   ├── VoteBadge.tsx          # Badges visuels de vote
│       │   ├── ApiSimulator.tsx       # Simulateur interactif de requêtes REST
│       │   └── index.ts               # Export des composants MDX
│       └── styles/
│           └── theme.css              # Styles additionnels
├── package.json                       # Scripts globaux pnpm (dev:docs, build:docs, etc.)
├── pnpm-workspace.yaml                # Déclaration du workspace docs
└── turbo.json                         # Intégration du pipeline Turbo
```
  - `apps/api` : API REST Fastify, Fastify Swagger (`@fastify/swagger` + `@fastify/swagger-ui`), Prisma ORM, Redis.
  - `packages/config` & `packages/shared` : Partage de configurations et types TypeScript.
  - `services/ingestion` : Pipelines d'ingestion des données parlementaires et HATVP.

### B. Design Tokens & Charte Graphique `clair.vote`
* **Couleur Principale** :
  - Bleu CLAIR : `hsl(215 91% 51%)` (`#1d70f5` / `#2563eb`).
  - Bleu Accent : `hsl(218 78% 45%)`.
  - Bleu Profond : `hsl(220 76% 38%)`.
* **Palette Thème Clair** :
  - Background : `#ffffff`
  - Foreground : `hsl(222.2 84% 4.9%)` (`#020817`)
  - Border : `hsl(214.3 31.8% 91.4%)` (`#e2e8f0`)
  - Muted : `hsl(210 40% 96.1%)` / Muted Text : `hsl(215.4 16.3% 46.9%)`
* **Palette Thème Sombre (Figma CLAIR)** :
  - Background : `hsl(220 20% 5.9%)` (`#0c0e12`)
  - Card / Surface : `hsl(221 20% 8.8%)` (`#12151b`)
  - Border / Divider : `hsl(221 16% 15.9%)` (`#22262f`)
  - Input / Subtle Border : `hsl(222 8% 23.5%)` (`#373a41`)
  - Muted Text : `hsl(225 4% 59.6%)` (`#94969c`)
* **Tokens Politiques et Votes** :
  - Vote Pour (`#4CAF50`), Contre (`#F44336`), Abstention (`#FF9800`), Absent (`#9E9E9E`).
  - Groupes Politiques : Gauche (`#E53935`), Centre-gauche (`#F06292`), Centre (`#FFB300`), Centre-droit (`#42A5F5`), Droite (`#1565C0`), Extrême-droite (`#0D47A1`).

### C. Spécification API (`api.clair.vote`)
* **API Fastify** exposant Swagger / OpenAPI 3.0 :
  - Tags : `Parlementaires`, `Députés`, `Sénateurs`, `Groupes politiques`, `Scrutins`, `Lobbying`, `Dossiers`, `Sujets`, `Analytics`, `Search`, `Health`.
  - URL de production : `https://api.clair.vote/docs/json`.
  - Possibilité d'inclure une copie locale de secours (`docs/public/openapi.json`) générable via script de build pour le mode déconnecté / CI.

---

## 4. Architecture Cible du Répertoire `docs/`

```text
clair/
├── docs/
│   ├── package.json                   # Dépendances Zudoku, React 19, Mermaid, scripts
│   ├── tsconfig.json                  # Types Zudoku & React
│   ├── vite.config.ts                 # Configuration Vite pour Zudoku
│   ├── zudoku.config.tsx              # Configuration maîtresse du portail Zudoku
│   ├── zudoku.navigation.tsx          # Navigation générée dynamiquement
│   ├── zudoku.theme.css               # Thème graphique aux couleurs de clair.vote
│   ├── index.mdx                      # Page d'accueil de la documentation (à la racine de docs)
│   ├── 01-introduction/               # Vision, principes, méthodologie et sources
│   │   ├── index.mdx
│   │   ├── vision-et-valeurs.mdx
│   │   └── sources-de-donnees.mdx
│   ├── 02-architecture/               # Vue d'ensemble technique, base de données, flux
│   │   ├── index.mdx
│   │   ├── vue-d-ensemble.mdx
│   │   ├── modele-de-donnees.mdx
│   │   └── pipelines-ingestion.mdx
│   ├── 03-api/                        # Documentation textuelle & guides API
│   │   ├── index.mdx
│   │   ├── authentification-et-limites.mdx
│   │   ├── parlementaires.mdx
│   │   ├── scrutins-et-votes.mdx
│   │   ├── lobbying-et-representants.mdx
│   │   └── exemples-integration.mdx
│   ├── 04-donnees-parlementaires/     # Décryptage du fonctionnement institutionnel
│   │   ├── index.mdx
│   │   ├── assemblee-nationale.mdx
│   │   ├── senat.mdx
│   │   └── hatvp.mdx
│   ├── 05-guide-developpeur/          # Guide de contribution locale
│   │   ├── index.mdx
│   │   ├── demarrage-rapide.mdx
│   │   ├── stack-technique.mdx
│   │   └── bonnes-pratiques.mdx
│   ├── scripts/
│   │   ├── generate-docs-navigation.mjs # Générateur de zudoku.navigation.tsx
│   │   ├── validate-mdx-syntax.mjs     # Contrôle de conformité MDX
│   │   ├── check-links.mjs             # Contrôle des liens internes
│   │   └── export-openapi-spec.mjs     # Synchronisation du schéma OpenAPI de api.clair.vote
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── logo-clair-light.svg
│   │   ├── logo-clair-dark.svg
│   │   └── openapi.json
│   └── src/
│       ├── components/
│       │   ├── Mermaid.tsx            # Rendu Mermaid interactif (zoom/plein écran/dark)
│       │   ├── Cards.tsx              # FeatureCard, FeatureGrid, TrackCard
│       │   ├── CodeTabs.tsx           # Onglets de commande et de code multi-langages
│       │   ├── DocHeaderSummary.tsx   # En-tête de page avec badges et métadonnées
│       │   ├── PoliticalBadge.tsx     # Badges interactifs pour partis et groupes
│       │   ├── VoteBadge.tsx          # Badges visuels pour votes (Pour, Contre, etc.)
│       │   ├── ApiSimulator.tsx       # Simulateur interactif de requête API
│       │   └── index.ts               # Export global des composants MDX
│       └── styles/
│           └── theme.css              # Variables et styles CSS additionnels
├── package.json                       # Scripts globaux (dev:docs, build:docs, etc.)
├── pnpm-workspace.yaml                # Déclaration du workspace docs
└── turbo.json                         # Configuration des pipelines Turbo
```
