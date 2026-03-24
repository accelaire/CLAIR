# CLAIR — Citoyen Libre, Analyse, Information, République

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)
![pnpm](https://img.shields.io/badge/pnpm-8.15-orange)

**Plateforme de transparence politique pour la jeune génération française.**

CLAIR agrège, croise et présente de manière accessible les données publiques sur l'activité des parlementaires (députés et sénateurs), le lobbying et les votes au Parlement français.

Le projet est **open source**, **apartisan** et **factuel** : zéro opinion, uniquement des données brutes et des sources vérifiables.

---

## Sommaire

- [Objectifs](#objectifs)
- [Architecture](#architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Sources de données](#sources-de-données)
- [Scripts disponibles](#scripts-disponibles)
- [Structure de l'API](#structure-de-lapi)
- [Modèle de données](#modèle-de-données)
- [Configuration](#configuration)
- [Stack technique](#stack-technique)
- [Tests](#tests)
- [Qualité des données](#qualité-des-données)
- [Production](#production)
- [Documentation](#documentation)
- [Contribution](#contribution)
- [License](#license)
- [Crédits](#crédits)
- [Contact](#contact)

---

## Objectifs

- **Simplicité** : Comprendre ton député ou sénateur en 30 secondes
- **Factuel** : Données brutes + sources vérifiables, zéro opinion
- **Accessible** : Interface claire et adaptée au mobile
- **Exhaustif** : Assemblée Nationale ET Sénat, scrutins, amendements, interventions, lobbying

---

## Architecture

Monorepo pnpm géré par [Turborepo](https://turbo.build/repo) avec trois workspaces principaux :

```
CLAIR/
├── apps/
│   ├── web/              # Frontend Next.js 14 (App Router)
│   └── api/              # Backend Fastify + Prisma
├── packages/
│   ├── shared/           # Types et utilitaires partagés
│   └── config/           # Configs ESLint, TypeScript
├── services/
│   └── ingestion/        # Pipeline d'ingestion des données
├── docs/                 # Documentation technique
└── .github/workflows/    # CI/CD
```

### apps/web — Frontend

Next.js 14 avec App Router. Pages principales :

| Route | Description |
|-------|-------------|
| `/deputes` | Liste et fiches des 577 députés |
| `/senateurs` | Liste et fiches des 348 sénateurs |
| `/scrutins` | Votes parlementaires (AN + Sénat) |
| `/dossiers` | Dossiers législatifs |
| `/groupes` | Groupes politiques et alliances |
| `/lobbying` | Représentants d'intérêts (HATVP) |
| `/recherche` | Recherche globale |
| `/explorateur` | Explorateur de données |
| `/comprendre` | Contenus pédagogiques |
| `/guide` | Guides utilisateur |
| `/simulateur` | Simulateur électoral 2027 |

### apps/api — Backend

Fastify avec un module pattern : `src/modules/{feature}/` contenant controller, service et schema (Zod).

Plugins : Prisma, Redis, Meilisearch, Auth (JWT), Rate limiting.

### services/ingestion — Pipeline de données

CLI basée sur [Commander](https://github.com/tj/commander.js/) pour synchroniser les données depuis les sources publiques. Gère le téléchargement, la transformation, le linking entre entités et le calcul des statistiques.

---

## Démarrage rapide

### Prérequis

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0
- **Docker** & Docker Compose

### Installation

```bash
# Cloner le repo
git clone https://github.com/accelaire/CLAIR.git
cd CLAIR

# Installer les dépendances
pnpm install

# Copier les variables d'environnement
cp .env.example .env

# Démarrer les services Docker (PostgreSQL, Redis, Meilisearch, MinIO)
pnpm docker:up

# Générer le client Prisma
pnpm db:generate

# Appliquer les migrations
pnpm db:migrate

# (Optionnel) Seed la base avec des données de test
pnpm db:seed

# Lancer en mode développement
pnpm dev
```

> **Note** : Le `pnpm dev` lance simultanément le frontend (port 3000) et l'API (port 3001) via Turborepo.

### Alimenter la base en données réelles

Pour avoir des données en local, lancer une synchronisation après l'installation :

```bash
# Build du service ingestion (nécessaire avant toute sync locale)
pnpm --filter @clair/ingestion build

# Sync incrémental de toutes les sources
pnpm ingestion:smart-sync -- --all
```

### URLs de développement

| Service | URL |
|---------|-----|
| Frontend Web | http://localhost:3000 |
| API | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |
| Meilisearch | http://localhost:7700 |
| MinIO Console | http://localhost:9001 |
| Prisma Studio | `pnpm db:studio` |

---

## Sources de données

| Source | Données | Format | Auth |
|--------|---------|--------|------|
| [Assemblée Nationale Open Data](https://data.assemblee-nationale.fr) | Députés, groupes, scrutins, votes, amendements, dossiers | ZIP/JSON | Aucune |
| [Sénat Open Data](https://data.senat.fr) | Sénateurs, groupes, scrutins, votes, amendements, dossiers (DOSLEG) | JSON API + HTML | Aucune |
| [HATVP](https://www.hatvp.fr/open-data) | Représentants d'intérêts, actions de lobbying, secteurs | CSV | Aucune |
| [DILA](https://echanges.dila.gouv.fr) | Comptes rendus intégraux des débats (interventions) | TAR/XML | Aucune |

> **Documentation complète** : voir [docs/INGESTION.md](docs/INGESTION.md) pour le guide détaillé du pipeline d'ingestion.

---

## Scripts disponibles

### Développement

```bash
pnpm dev              # Lancer tous les services en dev (web + api)
pnpm dev:web          # Frontend uniquement (port 3000)
pnpm dev:api          # Backend uniquement (port 3001)
```

### Build

```bash
pnpm build            # Build tous les packages
pnpm build:web        # Build frontend
pnpm build:api        # Build backend
```

### Base de données (Prisma)

```bash
pnpm db:generate      # Générer le client Prisma
pnpm db:migrate       # Appliquer les migrations
pnpm db:push          # Push le schema sans migration (dev rapide)
pnpm db:seed          # Seed la base avec des données de test
pnpm db:studio        # Ouvrir Prisma Studio (interface visuelle)
```

### Docker

```bash
pnpm docker:up        # Démarrer PostgreSQL, Redis, Meilisearch, MinIO
pnpm docker:down      # Arrêter les services
pnpm docker:logs      # Suivre les logs
```

### Ingestion des données

```bash
# Smart sync (utilisé en production — détection intelligente des changements)
pnpm ingestion:smart-sync -- --all          # Toutes les sources
pnpm ingestion:smart-sync -- --force        # Forcer même si source inchangée

# Sync manuel granulaire
pnpm ingestion:sync -- -d                   # Députés uniquement
pnpm ingestion:sync -- -S                   # Sénateurs uniquement
pnpm ingestion:sync -- -s                   # Scrutins AN
pnpm ingestion:sync -- --scrutins-senat     # Scrutins Sénat
pnpm ingestion:sync -- -a                   # Amendements AN
pnpm ingestion:sync -- -i                   # Interventions AN (DILA)
pnpm ingestion:sync -- -D                   # Dossiers législatifs
pnpm ingestion:sync -- -L                   # Lobbyistes + actions (HATVP)
pnpm ingestion:sync -- -L --no-actions      # Lobbyistes sans actions
pnpm ingestion:sync -- -s -l 50            # Limiter à 50 scrutins

# Enrichissement et linking
pnpm ingestion:sync -- --enrich-amendements-an     # Enrichir amendements AN (HTML)
pnpm ingestion:sync -- --enrich-amendements-senat  # Enrichir amendements Sénat
pnpm ingestion:sync -- --link-amendements          # Lier amendements aux scrutins

# Backfill complet (historique)
pnpm ingestion:backfill

# Statistiques
pnpm ingestion:calculate-stats              # Recalculer toutes les stats

# Diagnostic
pnpm ingestion:status                       # Vérifier la fraîcheur des sources
```

### Qualité

```bash
pnpm lint             # Linter (ESLint)
pnpm lint:fix         # Fix automatique
pnpm type-check       # Vérification TypeScript
pnpm test             # Tests unitaires (Vitest)
pnpm test:e2e         # Tests E2E (Playwright)
pnpm format           # Formatage (Prettier)
```

### Qualité des données

```bash
# Validation de l'intégrité des données en base
pnpm --filter @clair/ingestion check-quality
```

---

## Structure de l'API

Base URL : `http://localhost:3001`

### Endpoints principaux

```
GET  /health                              # Health check
GET  /health/ready                        # Readiness (DB + Redis)

# Parlementaires (endpoint unifié)
GET  /api/v1/parlementaires               # Liste (filtrable par chambre, groupe, etc.)
GET  /api/v1/parlementaires/groupes       # Groupes politiques
GET  /api/v1/parlementaires/compare       # Comparer 2-4 parlementaires
GET  /api/v1/parlementaires/:slug         # Fiche détaillée

# Députés (Assemblée Nationale)
GET  /api/v1/deputes                      # Liste des 577 députés
GET  /api/v1/deputes/groupes              # Groupes politiques AN
GET  /api/v1/deputes/:slug                # Détail d'un député

# Sénateurs (Sénat)
GET  /api/v1/senateurs                    # Liste des 348 sénateurs
GET  /api/v1/senateurs/groupes            # Groupes politiques Sénat
GET  /api/v1/senateurs/:slug              # Détail d'un sénateur

# Groupes politiques
GET  /api/v1/groupes                      # Tous les groupes (filtre chambre)
GET  /api/v1/groupes/:chambre/:slug       # Détail d'un groupe avec membres
GET  /api/v1/groupes/:chambre/:slug/stats # Statistiques du groupe

# Scrutins (votes au Parlement)
GET  /api/v1/scrutins                     # Liste (AN + Sénat, filtres avancés)

# Dossiers législatifs
GET  /api/v1/dossiers                     # Liste avec filtres (état, chambre, procédure)
GET  /api/v1/dossiers/:uid                # Détail avec scrutins et amendements liés

# Lobbying (HATVP)
GET  /api/v1/lobbying                     # Liste des représentants d'intérêts
GET  /api/v1/lobbying/stats               # Statistiques lobbying
GET  /api/v1/lobbying/secteurs            # Secteurs d'activité

# Recherche globale (Meilisearch)
GET  /api/v1/search                       # Recherche multi-entités

# Analytics
GET  /api/v1/analytics/stats              # Statistiques globales
GET  /api/v1/analytics/timeline           # Timeline des votes
GET  /api/v1/analytics/heatmap            # Heatmap des votes

# Homepage
GET  /api/v1/homepage                     # Données agrégées pour la page d'accueil

# Authentification
POST /api/v1/auth/...                     # JWT (inscription, connexion, refresh)
```

Documentation Swagger : http://localhost:3001/docs

---

## Modèle de données

Le schéma Prisma utilise un modèle `Parlementaire` unifié pour les deux chambres, discriminé par le champ `chambre` (`assemblee` | `senat`).

### Entités principales

| Modèle | Description |
|--------|-------------|
| `Parlementaire` | Députés et sénateurs (unifié, avec stats pré-calculées) |
| `GroupePolitique` | Groupes parlementaires (AN et Sénat) |
| `GroupeAlliance` | Alliances de vote entre groupes |
| `Scrutin` | Votes parlementaires (scrutins publics) |
| `Vote` | Votes individuels par parlementaire |
| `DossierLegislatif` | Dossiers législatifs (projets/propositions de loi) |
| `Amendement` | Amendements (relation M:N avec Scrutin) |
| `Intervention` | Interventions en séance (débats) |
| `Lobbyiste` | Représentants d'intérêts (HATVP) |
| `ActionLobby` | Actions de lobbying déclarées |
| `User` / `Alerte` / `Favori` | Comptes utilisateurs, alertes et favoris |

### Stats pré-calculées

Le pipeline d'ingestion calcule automatiquement pour chaque parlementaire : taux de présence, loyauté au groupe, nombre d'interventions, d'amendements et de questions. Ces stats sont également agrégées au niveau des groupes politiques.

---

## Configuration

### Variables d'environnement

Copier `.env.example` en `.env` à la racine du projet. Les valeurs par défaut fonctionnent pour un environnement de développement local.

| Variable | Description | Défaut (dev) |
|----------|-------------|--------------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://clair:clair_dev@localhost:5432/clair` |
| `REDIS_URL` | URL Redis | `redis://localhost:6379` |
| `MEILISEARCH_URL` | URL Meilisearch | `http://localhost:7700` |
| `MEILISEARCH_KEY` | Clé API Meilisearch | `clair_search_dev_key` |
| `ASSEMBLEE_NATIONALE_LEGISLATURE` | Numéro de la législature | `17` |
| `SENAT_SESSION_START` / `SENAT_SESSION_END` | Plage de sessions Sénat | `2024` / `2026` |
| `JWT_SECRET` | Secret JWT (obligatoire en prod) | — |
| `ENABLE_SIMULATEUR` | Activer le simulateur 2027 | `false` |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Domaine Plausible Analytics | — |
| `LOG_LEVEL` | Niveau de log (Pino) | `debug` |

---

## Stack technique

### Backend
- **Runtime** : Node.js 20+
- **Framework** : Fastify 4
- **ORM** : Prisma 5
- **Validation** : Zod
- **Queue** : BullMQ + Redis
- **Auth** : JWT avec refresh tokens

### Frontend
- **Framework** : Next.js 14 (App Router)
- **UI** : Tailwind CSS + shadcn/ui
- **State** : Zustand
- **Data fetching** : TanStack Query 5
- **Analytics** : Plausible (respectueux RGPD)

### Infrastructure
- **Base de données** : PostgreSQL 16
- **Cache / Queues** : Redis 7
- **Recherche full-text** : Meilisearch 1.6
- **Stockage S3** : MinIO (dev) / compatible S3 (prod)
- **Monorepo** : pnpm workspaces + Turborepo
- **CI/CD** : GitHub Actions
- **Hébergement** : Railway

---

## Tests

Le projet utilise [Vitest](https://vitest.dev/) pour les tests unitaires et d'intégration, et [Playwright](https://playwright.dev/) pour les tests E2E.

### Lancer les tests

```bash
# Tous les tests
pnpm test

# Tests d'un workspace spécifique
pnpm --filter @clair/api test
pnpm --filter @clair/ingestion test

# Tests en mode watch
pnpm --filter @clair/api test:watch

# Tests avec couverture
pnpm --filter @clair/api test -- --coverage

# Tests E2E
pnpm test:e2e
```

### Écrire des tests

**Test unitaire** (service) :
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockPrismaClient } from '../../test/mocks';

describe('MonService', () => {
  let service: MonService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new MonService(mockPrisma as any);
  });

  it('devrait faire quelque chose', async () => {
    mockPrisma.maTable.findMany.mockResolvedValue([]);
    const result = await service.maMethode();
    expect(result).toBeDefined();
  });
});
```

**Test d'intégration** (controller) :
```typescript
import { buildTestApp, closeTestApp, TestApp } from '../../test/helpers/app.helper';

describe('MonController', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: async (fastify) => {
        await fastify.register(mesRoutes, { prefix: '/api/v1/mon-endpoint' });
      },
    });
  });

  afterAll(() => closeTestApp(app));

  it('GET / devrait retourner 200', async () => {
    app.mockPrisma.maTable.findMany.mockResolvedValue([]);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/mon-endpoint',
    });
    expect(response.statusCode).toBe(200);
  });
});
```

---

## Qualité des données

Le pipeline d'ingestion intègre un système de validation à 3 niveaux :

1. **Invariants** (tolérance zéro) : votes orphelins, scrutins sans votes, doublons, parlementaires sans groupe
2. **Seuils quantitatifs** : nombre minimum d'entités, taux de liaison attendus (AN 88%, Sénat 97%, dossiers 60%)
3. **Intégrité multi-amendements** : vérification croisée entre titres de scrutins et amendements liés

```bash
# Lancer les checks de qualité (après toute modification du pipeline)
pnpm --filter @clair/ingestion test
pnpm --filter @clair/ingestion check-quality
```

> **Règle** : après toute modification du code d'ingestion, d'enrichissement ou de linking, toujours valider avec ces deux commandes avant de merger.

---

## Production

### Hébergement

Le projet est déployé sur **Railway** avec les services suivants :
- **API** : Fastify (Node.js)
- **Web** : Next.js
- **PostgreSQL** : Base de données principale
- **Redis** : Cache et queues

### Synchronisation des données

La base de données de production est mise à jour **tous les jours à 5h du matin** via un CRON Railway qui exécute :

```
node --max-old-space-size=6144 services/ingestion/dist/cli.js smart-sync --all
```

Le smart-sync détecte automatiquement les sources modifiées (ETag/Last-Modified), synchronise dans l'ordre optimal, effectue le linking entre entités, recalcule les statistiques et invalide le cache.

### Cache

L'API utilise un cache Redis avec des TTL adaptés par endpoint :
- Homepage : 27h (survit au cycle sync quotidien + marge de rebuild)
- Scrutins / Dossiers : 1h
- Lobbying / Analytics : 12h

Un cache warming s'exécute après chaque sync pour pré-charger les pages les plus consultées.

---

## Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guide de contribution |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture technique détaillée |
| [docs/INGESTION.md](docs/INGESTION.md) | Guide du pipeline d'ingestion |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Guide de déploiement |
| [docs/SPECS.md](docs/SPECS.md) | Spécifications fonctionnelles |

---

## Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines complètes.

En résumé :

1. Fork le repo
2. Crée une branche (`feat/ma-fonctionnalite` ou `fix/mon-correctif`)
3. Code en respectant les conventions (TypeScript strict, ESLint, Prettier)
4. `pnpm lint && pnpm type-check && pnpm test`
5. Ouvre une Pull Request

---

## License

[AGPL-3.0](LICENSE) — Ce projet est open source. Toute version dérivée déployée publiquement doit également être open source.

---

## Crédits

- [Assemblée Nationale](https://data.assemblee-nationale.fr/) — Données Open Data des députés
- [Sénat](https://data.senat.fr/) — Données Open Data des sénateurs
- [HATVP](https://www.hatvp.fr/) — Données de lobbying
- [DILA](https://echanges.dila.gouv.fr/) — Comptes rendus des débats parlementaires

---

## Contact

- **Site** : [clair.vote](https://clair.vote)
- **Email** : contact@clair.vote
- **GitHub** : [github.com/accelaire/CLAIR](https://github.com/accelaire/CLAIR)
- **Issues** : [GitHub Issues](https://github.com/accelaire/CLAIR/issues)
