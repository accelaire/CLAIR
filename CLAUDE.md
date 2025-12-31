# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLAIR (Citoyen Libre, Analyse, Information, République) is a French political transparency platform. It aggregates public data on elected officials, lobbying activities, and political voting patterns from sources like the Assemblée Nationale Open Data API and HATVP.

## Commands

```bash
# Install dependencies
pnpm install

# Start development (all services)
pnpm dev

# Start individual services
pnpm dev:web          # Next.js frontend on port 3000
pnpm dev:api          # Fastify API on port 3001
pnpm dev:ingestion    # Ingestion pipeline

# Docker services (PostgreSQL, Redis, Meilisearch, MinIO)
pnpm docker:up
pnpm docker:down

# Database (Prisma)
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema without migration (dev)
pnpm db:seed          # Seed database
pnpm db:studio        # Open Prisma Studio

# Data ingestion
pnpm ingestion:sync      # Incremental sync
pnpm ingestion:backfill  # Full backfill

# Quality
pnpm lint
pnpm lint:fix
pnpm type-check
pnpm test
pnpm test:e2e
```

## Architecture

This is a pnpm monorepo managed by Turborepo with three main workspaces:

### apps/api (Fastify Backend)
- Entry point: `src/index.ts`
- Module pattern: `src/modules/{feature}/` with:
  - `{feature}.controller.ts` - Routes
  - `{feature}.service.ts` - Business logic
  - `{feature}.schema.ts` - Zod validation schemas
- Plugins: `src/plugins/` (prisma, redis, auth)
- Prisma schema: `prisma/schema.prisma`

### apps/web (Next.js 14 Frontend)
- Uses App Router (`app/` directory)
- UI: Tailwind CSS
- State: Zustand
- Data fetching: TanStack Query
- API client: `lib/api.ts`

### services/ingestion (Data Pipeline)
- Sources: `src/sources/` (connectors for Assemblée Nationale, HATVP)
- Workers: `src/workers/` (BullMQ job processors)
- CLI: `src/cli.ts` for manual sync/backfill
- Transformers convert raw API data to Prisma models

## Data Model

Core entities in the Prisma schema:
- **Depute**: Elected officials with group/constituency relations
- **GroupePolitique**: Political party groups
- **Scrutin/Vote**: Parliamentary votes and individual voting records
- **Intervention/Amendement**: Parliamentary speeches and amendments
- **Lobbyiste/ActionLobby**: Lobbying entities and their activities
- **User/Alerte/Favori**: User accounts with alerts and favorites

## API Structure

Base URL: `http://localhost:3001`

- `/health` - Health checks
- `/api/v1/deputes` - Deputies (list, detail, stats, votes)
- `/api/v1/scrutins` - Votes/ballots
- `/api/v1/lobbying` - Lobbying data
- `/api/v1/search` - Global search (Meilisearch)
- `/api/v1/auth` - Authentication (JWT)
- `/docs` - Swagger UI

## Data Sources

The ingestion pipeline fetches data from:

1. **Assemblée Nationale Open Data** (`data.assemblee-nationale.fr`)
   - Députés, groupes politiques, scrutins, votes individuels, amendements
   - Format: ZIP/JSON bulk downloads
   - No API key required

2. **DILA** (`echanges.dila.gouv.fr`)
   - Comptes rendus intégraux des débats (interventions)
   - Format: TAR/XML archives
   - No API key required

3. **HATVP** (`hatvp.fr`)
   - Lobbying data (representatives, actions)
   - Scraping required

4. **Légifrance/PISTE** (optional)
   - Legal texts
   - Requires free API key from piste.gouv.fr

## Environment

Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for cache/queues
- `MEILISEARCH_URL` / `MEILISEARCH_KEY` - Search engine
- `ASSEMBLEE_NATIONALE_LEGISLATURE` - Legislature number (default: 17)
- `LEGIFRANCE_CLIENT_ID` / `LEGIFRANCE_CLIENT_SECRET` - Optional Légifrance API
