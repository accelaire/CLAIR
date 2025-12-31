# Architecture Technique — CLAIR

## Vue d'ensemble

Ce document détaille l'architecture technique du projet CLAIR et sert de guide pour le développement.

---

## 1. Structure du Monorepo

```
clair/
├── apps/
│   ├── web/                    # Application Next.js
│   │   ├── app/               # App Router (Next.js 14+)
│   │   ├── components/        # Composants React
│   │   ├── lib/              # Utilitaires, hooks
│   │   └── public/           # Assets statiques
│   │
│   ├── mobile/                # Application React Native/Expo
│   │   ├── app/              # Expo Router
│   │   ├── components/       # Composants natifs
│   │   └── assets/          # Images, fonts
│   │
│   └── api/                   # Backend Fastify
│       ├── src/
│       │   ├── modules/      # Modules métier
│       │   ├── plugins/      # Plugins Fastify
│       │   ├── utils/        # Utilitaires
│       │   └── index.ts      # Entry point
│       └── prisma/           # Schema et migrations
│
├── packages/
│   ├── shared/               # Code partagé (types, utils)
│   ├── ui/                   # Composants UI partagés
│   └── config/               # Configs partagées (ESLint, TS)
│
├── services/
│   └── ingestion/            # Pipeline d'ingestion des données
│       ├── src/
│       │   ├── sources/      # Connecteurs par source
│       │   ├── transformers/ # Transformation des données
│       │   ├── loaders/      # Chargement en DB
│       │   └── scheduler.ts  # Orchestration cron
│       └── scripts/          # Scripts one-shot
│
├── docs/                      # Documentation
├── docker/                    # Dockerfiles
├── .github/                   # GitHub Actions
├── turbo.json                # Config Turborepo
├── package.json              # Workspace root
└── docker-compose.yml        # Dev environment
```

---

## 2. Backend API (Fastify)

### 2.1 Structure des modules

```
apps/api/src/
├── modules/
│   ├── deputes/
│   │   ├── deputes.controller.ts    # Routes
│   │   ├── deputes.service.ts       # Logique métier
│   │   ├── deputes.schema.ts        # Validation Zod
│   │   └── deputes.types.ts         # Types TypeScript
│   │
│   ├── scrutins/
│   │   ├── scrutins.controller.ts
│   │   ├── scrutins.service.ts
│   │   └── ...
│   │
│   ├── lobbying/
│   │   └── ...
│   │
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/              # JWT, OAuth
│   │   └── guards/                  # Middleware auth
│   │
│   └── content/
│       ├── content.controller.ts
│       ├── generators/              # Génération vidéo/images
│       └── ...
│
├── plugins/
│   ├── prisma.ts                    # Plugin Prisma
│   ├── redis.ts                     # Plugin Redis
│   ├── swagger.ts                   # Documentation API
│   └── auth.ts                      # Plugin authentification
│
├── utils/
│   ├── errors.ts                    # Gestion d'erreurs
│   ├── pagination.ts                # Helpers pagination
│   └── cache.ts                     # Helpers cache
│
└── index.ts                         # Bootstrap
```

### 2.2 Exemple de module (Députés)

```typescript
// apps/api/src/modules/deputes/deputes.schema.ts
import { z } from 'zod';

export const deputeParamsSchema = z.object({
  slug: z.string().min(1),
});

export const deputeQuerySchema = z.object({
  include: z.enum(['votes', 'interventions', 'amendements']).array().optional(),
});

export const deputesListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  groupe: z.string().optional(),
  departement: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['nom', 'presence', 'loyaute']).default('nom'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type DeputeParams = z.infer<typeof deputeParamsSchema>;
export type DeputeQuery = z.infer<typeof deputeQuerySchema>;
export type DeputesListQuery = z.infer<typeof deputesListQuerySchema>;
```

```typescript
// apps/api/src/modules/deputes/deputes.service.ts
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { DeputesListQuery } from './deputes.schema';

export class DeputesService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
  ) {}

  async getDeputes(query: DeputesListQuery) {
    const cacheKey = `deputes:list:${JSON.stringify(query)}`;
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { page, limit, groupe, departement, search, sort, order } = query;
    const skip = (page - 1) * limit;

    const where = {
      actif: true,
      ...(groupe && { groupe: { slug: groupe } }),
      ...(departement && { circonscription: { departement } }),
      ...(search && {
        OR: [
          { nom: { contains: search, mode: 'insensitive' } },
          { prenom: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [deputes, total] = await Promise.all([
      this.prisma.depute.findMany({
        where,
        include: {
          groupe: true,
          circonscription: true,
          _count: { select: { votes: true, interventions: true } },
        },
        orderBy: { [sort]: order },
        skip,
        take: limit,
      }),
      this.prisma.depute.count({ where }),
    ]);

    const result = {
      data: deputes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  async getDeputeBySlug(slug: string, include?: string[]) {
    const cacheKey = `depute:${slug}:${include?.join(',') || 'base'}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const depute = await this.prisma.depute.findUnique({
      where: { slug },
      include: {
        groupe: true,
        circonscription: true,
        ...(include?.includes('votes') && {
          votes: {
            include: { scrutin: true },
            orderBy: { scrutin: { date: 'desc' } },
            take: 50,
          },
        }),
        ...(include?.includes('interventions') && {
          interventions: {
            orderBy: { date: 'desc' },
            take: 20,
          },
        }),
      },
    });

    if (depute) {
      await this.redis.setex(cacheKey, 600, JSON.stringify(depute));
    }

    return depute;
  }

  async getDeputeStats(deputeId: string) {
    // Calcul des statistiques
    const [presence, loyaute, votes] = await Promise.all([
      this.calculatePresence(deputeId),
      this.calculateLoyaute(deputeId),
      this.getVotesSummary(deputeId),
    ]);

    return { presence, loyaute, votes };
  }

  private async calculatePresence(deputeId: string): Promise<number> {
    const total = await this.prisma.scrutin.count({
      where: { date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
    });
    
    const participated = await this.prisma.vote.count({
      where: {
        deputeId,
        position: { not: 'absent' },
        scrutin: { date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      },
    });

    return total > 0 ? Math.round((participated / total) * 100) : 0;
  }

  private async calculateLoyaute(deputeId: string): Promise<number> {
    // Logique de calcul de loyauté au groupe
    // Basé sur la formule de Datan.fr
    return 0; // TODO: Implémenter
  }

  private async getVotesSummary(deputeId: string) {
    const votes = await this.prisma.vote.groupBy({
      by: ['position'],
      where: { deputeId },
      _count: true,
    });

    return votes.reduce((acc, v) => {
      acc[v.position] = v._count;
      return acc;
    }, {} as Record<string, number>);
  }
}
```

```typescript
// apps/api/src/modules/deputes/deputes.controller.ts
import { FastifyPluginAsync } from 'fastify';
import { DeputesService } from './deputes.service';
import {
  deputeParamsSchema,
  deputeQuerySchema,
  deputesListQuerySchema,
} from './deputes.schema';

export const deputesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new DeputesService(fastify.prisma, fastify.redis);

  // GET /api/deputes
  fastify.get('/', {
    schema: {
      querystring: deputesListQuerySchema,
      tags: ['Députés'],
      summary: 'Liste des députés',
      description: 'Retourne la liste paginée des députés avec filtres',
    },
    handler: async (request, reply) => {
      const query = deputesListQuerySchema.parse(request.query);
      const result = await service.getDeputes(query);
      return result;
    },
  });

  // GET /api/deputes/:slug
  fastify.get('/:slug', {
    schema: {
      params: deputeParamsSchema,
      querystring: deputeQuerySchema,
      tags: ['Députés'],
      summary: 'Détails d\'un député',
    },
    handler: async (request, reply) => {
      const { slug } = deputeParamsSchema.parse(request.params);
      const { include } = deputeQuerySchema.parse(request.query);
      
      const depute = await service.getDeputeBySlug(slug, include);
      
      if (!depute) {
        return reply.status(404).send({ error: 'Député non trouvé' });
      }
      
      return depute;
    },
  });

  // GET /api/deputes/:slug/stats
  fastify.get('/:slug/stats', {
    schema: {
      params: deputeParamsSchema,
      tags: ['Députés'],
      summary: 'Statistiques d\'un député',
    },
    handler: async (request, reply) => {
      const { slug } = deputeParamsSchema.parse(request.params);
      
      const depute = await fastify.prisma.depute.findUnique({
        where: { slug },
        select: { id: true },
      });
      
      if (!depute) {
        return reply.status(404).send({ error: 'Député non trouvé' });
      }
      
      const stats = await service.getDeputeStats(depute.id);
      return stats;
    },
  });
};
```

---

## 3. Schema Prisma

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============== ÉLUS ==============

model Depute {
  id              String   @id @default(uuid())
  slug            String   @unique
  nom             String
  prenom          String
  sexe            String?
  dateNaissance   DateTime? @map("date_naissance")
  lieuNaissance   String?   @map("lieu_naissance")
  profession      String?
  photoUrl        String?   @map("photo_url")
  twitter         String?
  email           String?
  siteWeb         String?   @map("site_web")
  actif           Boolean   @default(true)
  
  // Relations
  groupeId        String?   @map("groupe_id")
  groupe          GroupePolitique? @relation(fields: [groupeId], references: [id])
  
  circonscriptionId String? @map("circonscription_id")
  circonscription   Circonscription? @relation(fields: [circonscriptionId], references: [id])
  
  votes           Vote[]
  interventions   Intervention[]
  amendements     Amendement[]
  actionsLobby    ActionLobby[]
  
  // Métadonnées
  sourceId        String?   @map("source_id") // ID AN (ex: PA793872)
  sourceData      Json?     @map("source_data")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("deputes")
  @@index([slug])
  @@index([groupeId])
  @@index([actif])
}

model GroupePolitique {
  id          String   @id @default(uuid())
  slug        String   @unique
  nom         String
  nomComplet  String?  @map("nom_complet")
  couleur     String?
  position    String?  // 'gauche', 'centre', 'droite'
  ordre       Int      @default(0)
  actif       Boolean  @default(true)
  
  deputes     Depute[]
  
  sourceId    String?  @map("source_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("groupes_politiques")
}

model Circonscription {
  id           String   @id @default(uuid())
  departement  String
  numero       Int
  nom          String
  population   Int?
  
  deputes      Depute[]
  
  createdAt    DateTime @default(now()) @map("created_at")

  @@unique([departement, numero])
  @@map("circonscriptions")
}

// ============== VOTES ==============

model Scrutin {
  id                String   @id @default(uuid())
  numero            Int      @unique
  date              DateTime
  titre             String
  typeVote          String   @map("type_vote") // 'solennel', 'ordinaire', 'motion'
  sort              String   // 'adopté', 'rejeté'
  
  nombreVotants     Int      @map("nombre_votants")
  nombrePour        Int      @map("nombre_pour")
  nombreContre      Int      @map("nombre_contre")
  nombreAbstention  Int      @map("nombre_abstention")
  
  // Classification
  tags              String[] @default([])
  importance        Int      @default(1) // 1-5
  
  // Texte associé
  texteId           String?  @map("texte_id")
  texteNumero       String?  @map("texte_numero")
  texteTitre        String?  @map("texte_titre")
  
  votes             Vote[]
  
  sourceUrl         String?  @map("source_url")
  sourceData        Json?    @map("source_data")
  createdAt         DateTime @default(now()) @map("created_at")

  @@map("scrutins")
  @@index([date])
  @@index([typeVote])
}

model Vote {
  id            String   @id @default(uuid())
  
  deputeId      String   @map("depute_id")
  depute        Depute   @relation(fields: [deputeId], references: [id])
  
  scrutinId     String   @map("scrutin_id")
  scrutin       Scrutin  @relation(fields: [scrutinId], references: [id])
  
  position      String   // 'pour', 'contre', 'abstention', 'absent'
  miseAuPoint   String?  @map("mise_au_point") // Correction de vote
  parDelegation Boolean  @default(false) @map("par_delegation")
  
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([deputeId, scrutinId])
  @@map("votes")
  @@index([scrutinId])
  @@index([position])
}

// ============== INTERVENTIONS ==============

model Intervention {
  id          String   @id @default(uuid())
  
  deputeId    String   @map("depute_id")
  depute      Depute   @relation(fields: [deputeId], references: [id])
  
  seanceId    String?  @map("seance_id")
  date        DateTime
  type        String   // 'question', 'intervention', 'explication_vote'
  
  contenu     String
  motsCles    String[] @default([]) @map("mots_cles")
  
  sourceUrl   String?  @map("source_url")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("interventions")
  @@index([deputeId])
  @@index([date])
}

model Amendement {
  id              String   @id @default(uuid())
  numero          String
  
  deputeId        String   @map("depute_id")
  depute          Depute   @relation(fields: [deputeId], references: [id])
  
  texteId         String?  @map("texte_id")
  articleVise     String?  @map("article_vise")
  
  objet           String?
  dispositif      String?
  sort            String   // 'adopté', 'rejeté', 'retiré', 'non_soutenu'
  
  dateDepot       DateTime @map("date_depot")
  dateSort        DateTime? @map("date_sort")
  
  sourceUrl       String?  @map("source_url")
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("amendements")
  @@index([deputeId])
  @@index([sort])
}

// ============== LOBBYING ==============

model Lobbyiste {
  id              String   @id @default(uuid())
  siren           String?  @unique
  nom             String
  type            String   // 'entreprise', 'association', 'cabinet', 'syndicat'
  secteur         String?
  
  adresse         String?
  codePostal      String?  @map("code_postal")
  ville           String?
  
  budgetAnnuel    Float?   @map("budget_annuel")
  nbLobbyistes    Int?     @map("nb_lobbyistes")
  
  siteWeb         String?  @map("site_web")
  
  actions         ActionLobby[]
  
  sourceId        String?  @map("source_id") // ID HATVP
  sourceData      Json?    @map("source_data")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("lobbyistes")
  @@index([secteur])
  @@index([type])
}

model ActionLobby {
  id              String   @id @default(uuid())
  
  lobbyisteId     String   @map("lobbyiste_id")
  lobbyiste       Lobbyiste @relation(fields: [lobbyisteId], references: [id])
  
  deputeId        String?  @map("depute_id")
  depute          Depute?  @relation(fields: [deputeId], references: [id])
  
  cible           String?  // 'depute', 'ministre', 'administration'
  cibleNom        String?  @map("cible_nom")
  
  description     String
  dateDebut       DateTime @map("date_debut")
  dateFin         DateTime? @map("date_fin")
  
  budget          Float?
  resultat        String?  // 'succes', 'echec', 'en_cours', 'inconnu'
  
  sourceUrl       String?  @map("source_url")
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("actions_lobby")
  @@index([lobbyisteId])
  @@index([deputeId])
}

// ============== UTILISATEURS ==============

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String?  @map("password_hash")
  
  nom           String?
  prenom        String?
  
  role          String   @default("user") // 'user', 'premium', 'admin'
  
  // OAuth
  googleId      String?  @unique @map("google_id")
  appleId       String?  @unique @map("apple_id")
  
  // Préférences
  preferences   Json     @default("{}")
  
  alertes       Alerte[]
  favoris       Favori[]
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("users")
}

model Alerte {
  id          String   @id @default(uuid())
  
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  type        String   // 'depute_vote', 'lobby_action', 'sujet'
  cibleType   String   @map("cible_type")
  cibleId     String   @map("cible_id")
  
  actif       Boolean  @default(true)
  
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("alertes")
  @@index([userId])
  @@index([actif])
}

model Favori {
  id          String   @id @default(uuid())
  
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  type        String   // 'depute', 'scrutin', 'lobbyiste'
  cibleId     String   @map("cible_id")
  
  createdAt   DateTime @default(now()) @map("created_at")

  @@unique([userId, type, cibleId])
  @@map("favoris")
}

// ============== CONTENU ==============

model Contenu {
  id          String   @id @default(uuid())
  
  type        String   // 'video_short', 'infographie', 'thread'
  titre       String
  description String?
  
  data        Json     // Données structurées pour génération
  fichierUrl  String?  @map("fichier_url")
  
  statut      String   @default("draft") // 'draft', 'generated', 'published'
  
  vues        Int      @default(0)
  partages    Int      @default(0)
  
  publishedAt DateTime? @map("published_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@map("contenus")
  @@index([type])
  @@index([statut])
}

// ============== SYNC ==============

model SyncLog {
  id          String   @id @default(uuid())
  source      String   // 'assemblee_nationale', 'dila', 'hatvp', 'legifrance'
  type        String   // 'full', 'incremental'
  statut      String   // 'started', 'completed', 'failed'
  
  itemsCount  Int      @default(0) @map("items_count")
  errorCount  Int      @default(0) @map("error_count")
  
  metadata    Json?
  error       String?
  
  startedAt   DateTime @map("started_at")
  completedAt DateTime? @map("completed_at")

  @@map("sync_logs")
  @@index([source])
  @@index([startedAt])
}
```

---

## 4. Pipeline d'Ingestion

### 4.1 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    SCHEDULER (Cron)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Assemblée  │  │    DILA     │  │    HATVP    │          │
│  │   Daily     │  │   Daily     │  │   Weekly    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    WORKERS (Bull Queue)                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │ Extract Worker  │ │Transform Worker │ │ Load Worker   │  │
│  │  (Fetch data)   │ │ (Clean, map)    │ │ (Upsert DB)   │  │
│  └────────┬────────┘ └────────┬────────┘ └───────┬───────┘  │
└───────────┼──────────────────┼───────────────────┼──────────┘
            │                  │                   │
            ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA STORES                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Raw Files  │  │  PostgreSQL │  │    Redis    │          │
│  │   (S3)      │  │  (Cleaned)  │  │   (Cache)   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Sources de données

Le projet utilise trois sources principales :

1. **Assemblée Nationale Open Data** (`data.assemblee-nationale.fr`)
   - Députés, groupes politiques, scrutins, amendements
   - Format : ZIP contenant des fichiers JSON
   - Pas de clé API nécessaire

2. **DILA** (`echanges.dila.gouv.fr`)
   - Comptes rendus intégraux des débats (interventions)
   - Format : Archives TAR contenant des fichiers XML
   - Pas de clé API nécessaire

3. **HATVP** (`hatvp.fr`)
   - Registre des lobbyistes et leurs actions
   - Format : Scraping ou CSV

4. **Légifrance/PISTE** (optionnel)
   - Textes de loi
   - Nécessite une clé API gratuite sur piste.gouv.fr

### 4.3 Clients d'ingestion

```typescript
// services/ingestion/src/sources/assemblee-nationale/deputes-client.ts
// Télécharge et parse les données des députés depuis l'AN Open Data

// services/ingestion/src/sources/assemblee-nationale/scrutins-client.ts
// Télécharge et parse les scrutins avec votes individuels

// services/ingestion/src/sources/dila/interventions-client.ts
// Télécharge et parse les comptes rendus des débats
```

### 4.4 Scheduler

```typescript
// services/ingestion/src/scheduler.ts

import cron from 'node-cron';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from './utils/logger';

const redis = new Redis(process.env.REDIS_URL!);

const queues = {
  assemblee: new Queue('ingestion:assemblee', { connection: redis }),
  dila: new Queue('ingestion:dila', { connection: redis }),
  hatvp: new Queue('ingestion:hatvp', { connection: redis }),
};

export function startScheduler() {
  // Assemblée Nationale - Tous les jours à 2h du matin
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting Assemblée Nationale daily sync');
    await queues.assemblee.add('sync-deputes', { type: 'incremental' });
    await queues.assemblee.add('sync-scrutins', { type: 'incremental' });
  });

  // DILA (Interventions) - Tous les jours à 4h
  cron.schedule('0 4 * * *', async () => {
    logger.info('Starting DILA interventions sync');
    await queues.dila.add('sync-interventions', { maxSeances: 10 });
  });

  // HATVP - Toutes les semaines le lundi à 3h
  cron.schedule('0 3 * * 1', async () => {
    logger.info('Starting HATVP weekly sync');
    await queues.hatvp.add('sync-lobbyistes', { type: 'full' });
    await queues.hatvp.add('sync-actions', { type: 'incremental' });
  });

  logger.info('Scheduler started');
}

// Pour les syncs manuels ou le backfill initial
export async function triggerFullSync(source: 'assemblee' | 'dila' | 'hatvp') {
  const queue = queues[source];

  switch (source) {
    case 'assemblee':
      await queue.add('sync-groupes', { type: 'full' }, { priority: 1 });
      await queue.add('sync-deputes', { type: 'full' }, { priority: 2 });
      await queue.add('sync-scrutins', { type: 'full' }, { priority: 3 });
      await queue.add('sync-amendements', { type: 'full' }, { priority: 4 });
      break;
    case 'dila':
      await queue.add('sync-interventions', { maxSeances: 100 });
      break;
    case 'hatvp':
      await queue.add('sync-lobbyistes', { type: 'full' });
      await queue.add('sync-actions', { type: 'full' });
      break;
  }
}
```

---

## 5. Configuration Docker

```yaml
# docker-compose.yml

version: '3.8'

services:
  # PostgreSQL
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: clair
      POSTGRES_PASSWORD: clair_dev
      POSTGRES_DB: clair
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clair"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Meilisearch
  meilisearch:
    image: getmeili/meilisearch:v1.6
    environment:
      MEILI_MASTER_KEY: clair_search_dev_key
      MEILI_ENV: development
    volumes:
      - meilisearch_data:/meili_data
    ports:
      - "7700:7700"

  # MinIO (S3-compatible)
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: clair_minio
      MINIO_ROOT_PASSWORD: clair_minio_secret
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  # API (dev mode)
  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://clair:clair_dev@postgres:5432/clair
      REDIS_URL: redis://redis:6379
      MEILISEARCH_URL: http://meilisearch:7700
      MEILISEARCH_KEY: clair_search_dev_key
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: clair_minio
      S3_SECRET_KEY: clair_minio_secret
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # Ingestion worker (dev mode)
  ingestion:
    build:
      context: .
      dockerfile: docker/ingestion.Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://clair:clair_dev@postgres:5432/clair
      REDIS_URL: redis://redis:6379
    volumes:
      - ./services/ingestion:/app/services/ingestion
      - ./packages:/app/packages
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
  meilisearch_data:
  minio_data:
```

---

## 6. Variables d'environnement

```bash
# .env.example

# =============================================================================
# DATABASE
# =============================================================================
DATABASE_URL="postgresql://clair:clair_dev@localhost:5432/clair"

# =============================================================================
# REDIS
# =============================================================================
REDIS_URL="redis://localhost:6379"

# =============================================================================
# SEARCH
# =============================================================================
MEILISEARCH_URL="http://localhost:7700"
MEILISEARCH_KEY="clair_search_dev_key"

# =============================================================================
# STORAGE
# =============================================================================
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="clair-assets"
S3_ACCESS_KEY="clair_minio"
S3_SECRET_KEY="clair_minio_secret"
S3_REGION="eu-west-1"

# =============================================================================
# AUTH
# =============================================================================
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"
REFRESH_TOKEN_EXPIRES_IN="30d"

# OAuth (optionnel)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
APPLE_CLIENT_ID=""
APPLE_CLIENT_SECRET=""

# =============================================================================
# EXTERNAL APIS
# =============================================================================
# Assemblée Nationale Open Data - pas de clé nécessaire
ASSEMBLEE_NATIONALE_BASE_URL="https://data.assemblee-nationale.fr"
ASSEMBLEE_NATIONALE_LEGISLATURE="17"

# DILA (Comptes rendus des débats) - pas de clé nécessaire
DILA_BASE_URL="https://echanges.dila.gouv.fr/OPENDATA/Debats/AN"

# HATVP - pas d'API officielle
HATVP_BASE_URL="https://www.hatvp.fr"

# Légifrance/PISTE (optionnel)
# Inscription gratuite sur https://piste.gouv.fr
LEGIFRANCE_CLIENT_ID=""
LEGIFRANCE_CLIENT_SECRET=""

# =============================================================================
# AI
# =============================================================================
ANTHROPIC_API_KEY=""

# =============================================================================
# MONITORING
# =============================================================================
SENTRY_DSN=""
LOG_LEVEL="debug"

# =============================================================================
# APP
# =============================================================================
NODE_ENV="development"
PORT="3001"
API_URL="http://localhost:3001"
WEB_URL="http://localhost:3000"
```

---

## 7. Scripts NPM

```json
{
  "name": "clair",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=web",
    "dev:api": "turbo run dev --filter=api",
    "dev:ingestion": "turbo run dev --filter=ingestion",
    
    "build": "turbo run build",
    "build:web": "turbo run build --filter=web",
    "build:api": "turbo run build --filter=api",
    
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "type-check": "turbo run type-check",
    
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    
    "db:generate": "prisma generate --schema=apps/api/prisma/schema.prisma",
    "db:migrate": "prisma migrate dev --schema=apps/api/prisma/schema.prisma",
    "db:push": "prisma db push --schema=apps/api/prisma/schema.prisma",
    "db:seed": "ts-node apps/api/prisma/seed.ts",
    "db:studio": "prisma studio --schema=apps/api/prisma/schema.prisma",
    
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    
    "ingestion:sync": "ts-node services/ingestion/src/cli.ts sync",
    "ingestion:backfill": "ts-node services/ingestion/src/cli.ts backfill",
    
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "turbo": "^2.0.0",
    "typescript": "^5.3.0",
    "prettier": "^3.1.0",
    "eslint": "^8.55.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```