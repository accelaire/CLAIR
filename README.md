# CLAIR — Citoyen Libre, Analyse, Information, République

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)

**Plateforme de transparence politique pour la jeune génération française.**

CLAIR agrège, croise et présente de manière accessible les données publiques sur l'activité des parlementaires (députés et sénateurs), le lobbying et les votes au Parlement.

---

## Objectifs

- **Simplicité** : Comprendre ton député ou sénateur en 30 secondes
- **Factuel** : Données brutes + sources vérifiables, zéro opinion
- **Accessible** : Interface claire et adaptée au mobile

---

## Architecture

```
clair/
├── apps/
│   ├── web/          # Frontend Next.js
│   └── api/          # Backend Fastify
├── packages/
│   ├── shared/       # Types et utilitaires partagés
│   ├── ui/           # Composants UI partagés
│   └── config/       # Configs ESLint, TypeScript
├── services/
│   └── ingestion/    # Pipeline d'ingestion des données
└── docs/             # Documentation
```

---

## Démarrage rapide

### Prérequis

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose

### Installation

```bash
# Cloner le repo
git clone https://github.com/votre-org/clair.git
cd clair

# Installer les dépendances
pnpm install

# Copier les variables d'environnement
cp .env.example .env

# Démarrer les services (PostgreSQL, Redis, Meilisearch)
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

### URLs de développement

| Service | URL |
|---------|-----|
| Frontend Web | http://localhost:3000 |
| API | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |
| Meilisearch | http://localhost:7700 |

---

## Sources de données

| Source | Type | Données |
|--------|------|---------|
| [Assemblée Nationale Open Data](https://data.assemblee-nationale.fr) | Députés | 577 députés, scrutins, votes, amendements |
| [Sénat Open Data](https://data.senat.fr) | Sénateurs | 348 sénateurs, scrutins, votes |
| [HATVP](https://www.hatvp.fr) | Lobbying | Registre des représentants d'intérêts |

---

## Scripts disponibles

```bash
# Développement
pnpm dev              # Lancer tous les services en dev
pnpm dev:web          # Frontend uniquement
pnpm dev:api          # Backend uniquement

# Build
pnpm build            # Build tous les packages
pnpm build:web        # Build frontend
pnpm build:api        # Build backend

# Base de données
pnpm db:generate      # Générer le client Prisma
pnpm db:migrate       # Appliquer les migrations
pnpm db:push          # Push le schema (dev rapide)
pnpm db:seed          # Seed la base
pnpm db:studio        # Interface Prisma Studio

# Docker
pnpm docker:up        # Démarrer les services
pnpm docker:down      # Arrêter les services
pnpm docker:logs      # Voir les logs

# Ingestion des données
pnpm ingestion:sync             # Sync incrémental (tout)
pnpm ingestion:sync -- -d       # Députés uniquement
pnpm ingestion:sync -- -S       # Sénateurs uniquement
pnpm ingestion:sync -- -s       # Scrutins AN uniquement
pnpm ingestion:sync -- --scrutins-senat  # Scrutins Sénat
pnpm ingestion:backfill         # Backfill complet

# Qualité
pnpm lint             # Linter
pnpm lint:fix         # Fix auto
pnpm type-check       # Vérification TypeScript
pnpm test             # Tests
```

---

## Structure de l'API

### Endpoints principaux

```
GET  /health                    # Health check
GET  /health/ready              # Readiness (DB + Redis)

# Députés (Assemblée Nationale)
GET  /api/v1/deputes            # Liste des 577 députés
GET  /api/v1/deputes/:slug      # Détail d'un député
GET  /api/v1/deputes/:slug/stats      # Statistiques de participation
GET  /api/v1/deputes/:slug/votes      # Historique des votes
GET  /api/v1/deputes/groupes          # Groupes politiques AN

# Sénateurs (Sénat)
GET  /api/v1/senateurs          # Liste des 348 sénateurs
GET  /api/v1/senateurs/:slug    # Détail d'un sénateur
GET  /api/v1/senateurs/:slug/stats    # Statistiques
GET  /api/v1/senateurs/:slug/votes    # Historique des votes
GET  /api/v1/senateurs/groupes        # Groupes politiques Sénat

# Scrutins (votes au Parlement)
GET  /api/v1/scrutins           # Liste des scrutins (AN + Sénat)
GET  /api/v1/scrutins/:numero   # Détail d'un scrutin
GET  /api/v1/scrutins/importants      # Scrutins importants

# Lobbying (HATVP)
GET  /api/v1/lobbying/lobbyistes      # Liste des représentants d'intérêts
GET  /api/v1/lobbying/actions         # Actions de lobbying
GET  /api/v1/lobbying/secteurs        # Par secteur d'activité

# Recherche globale (Meilisearch)
GET  /api/v1/search             # Recherche députés, sénateurs, scrutins, lobbyistes
GET  /api/v1/search/suggest     # Auto-complétion
```

Documentation Swagger : http://localhost:3001/docs

---

## Configuration

### Variables d'environnement

Voir `.env.example` pour la liste complète.

Variables principales :
- `DATABASE_URL` : URL PostgreSQL
- `REDIS_URL` : URL Redis
- `MEILISEARCH_URL` : URL Meilisearch
- `MEILISEARCH_KEY` : Clé API Meilisearch

---

## Stack technique

### Backend
- **Runtime** : Node.js 20+
- **Framework** : Fastify
- **ORM** : Prisma
- **Validation** : Zod
- **Queue** : BullMQ + Redis

### Frontend
- **Framework** : Next.js 14 (App Router)
- **UI** : Tailwind CSS + shadcn/ui
- **State** : Zustand
- **Data** : TanStack Query

### Infrastructure
- **Base de données** : PostgreSQL 16
- **Cache** : Redis 7
- **Recherche** : Meilisearch

---

## Tests

```bash
# Tests unitaires
pnpm test

# Tests E2E
pnpm test:e2e

# Avec couverture
pnpm test -- --coverage
```

---

## Contribution

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

---

## License

AGPL-3.0 - voir [LICENSE](LICENSE)

---

## Crédits

- [Assemblée Nationale](https://data.assemblee-nationale.fr/) pour les données Open Data des députés
- [Sénat](https://data.senat.fr/) pour les données Open Data des sénateurs
- [HATVP](https://www.hatvp.fr/) pour les données de lobbying

---

## Contact

- **Axel Robaldo** : axel.roba@gmail.com
- Issues : [GitHub Issues](https://github.com/votre-org/clair/issues)
