// =============================================================================
// Module Dossiers Législatifs - Routes
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { dossiersListQuerySchema, paginationQuerySchema, amendementsQuerySchema, trendingQuerySchema } from './dossiers.schema';
import { ApiError } from '../../utils/errors';
import { buildMultiFieldSearchCondition } from '../../utils/search';
import { buildJournalOfficielUrl } from '../../utils/journal-officiel';

const CACHE_TTL_1H = 3600;

const dossierChambre = (legislature: number) => legislature === 0 ? 'senat' : 'assemblee';

export const dossiersRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/dossiers - Liste paginée avec filtres
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Liste des dossiers législatifs',
      description: 'Retourne la liste paginée des dossiers législatifs avec filtres',
    },
    handler: async (request, _reply) => {
      const query = dossiersListQuerySchema.parse(request.query);
      const { page, limit, etat, chambre, procedureCode, procedureLibelle, search, dateFrom, dateTo, sort, order } = query;

      const cacheKey = `dossiers:list:${JSON.stringify(query)}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const where: Prisma.DossierLegislatifWhereInput = {};

      if (etat) where.etat = etat;
      if (chambre === 'senat') where.legislature = 0;
      else if (chambre === 'assemblee') where.legislature = { gt: 0 };
      if (procedureCode) where.procedureCode = procedureCode;
      if (procedureLibelle) where.procedureLibelle = procedureLibelle;
      if (search) {
        Object.assign(where, buildMultiFieldSearchCondition(['titre', 'titreCourt'], search));
      }
      if (dateFrom || dateTo) {
        where.dateDepot = {};
        if (dateFrom) where.dateDepot.gte = dateFrom;
        if (dateTo) where.dateDepot.lte = dateTo;
      }

      // Only include dossiers that have at least one scrutin
      where.scrutins = { some: {} };

      const skip = (page - 1) * limit;

      const baseSelect = {
        id: true,
        uid: true,
        titre: true,
        titreCourt: true,
        legislature: true,
        procedureCode: true,
        procedureLibelle: true,
        etat: true,
        dateDepot: true,
        loiNumero: true,
        _count: {
          select: {
            scrutins: true,
            amendements: true,
          },
        },
      } as const;

      let result;

      if (sort === 'scrutins') {
        // Sort by scrutin count — Prisma handles natively
        const [dossiers, total] = await Promise.all([
          fastify.prisma.dossierLegislatif.findMany({
            where,
            orderBy: { scrutins: { _count: order } },
            skip,
            take: limit,
            select: {
              ...baseSelect,
              scrutins: { orderBy: { date: 'desc' as const }, take: 1, select: { date: true } },
            },
          }),
          fastify.prisma.dossierLegislatif.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);
        result = {
          data: dossiers.map(({ scrutins, ...d }) => ({
            ...d,
            chambre: dossierChambre(d.legislature),
            lastScrutinDate: scrutins[0]?.date || null,
          })),
          meta: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
        };
      } else {
        // Default: sort by most recent scrutin date (nulls last)
        const [allDossiers, total] = await Promise.all([
          fastify.prisma.dossierLegislatif.findMany({
            where,
            select: {
              ...baseSelect,
              scrutins: {
                orderBy: { date: 'desc' },
                take: 1,
                select: { date: true },
              },
            },
          }),
          fastify.prisma.dossierLegislatif.count({ where }),
        ]);

        // Sort by latest scrutin date
        allDossiers.sort((a, b) => {
          const dateA = a.scrutins[0]?.date;
          const dateB = b.scrutins[0]?.date;
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          const diff = dateB.getTime() - dateA.getTime();
          return order === 'asc' ? -diff : diff;
        });

        const paginated = allDossiers.slice(skip, skip + limit);
        const totalPages = Math.ceil(total / limit);
        result = {
          data: paginated.map(({ scrutins, ...d }) => ({
            ...d,
            chambre: dossierChambre(d.legislature),
            lastScrutinDate: scrutins[0]?.date || null,
          })),
          meta: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
        };
      }

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/filters - Valeurs distinctes pour les filtres
  // ===========================================================================
  fastify.get('/filters', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Valeurs de filtres disponibles',
      description: 'Retourne les procedureLibelle distinctes (dossiers avec scrutins uniquement)',
    },
    handler: async (_request, _reply) => {
      const cacheKey = 'dossiers:filters';
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const procedures = await fastify.prisma.dossierLegislatif.groupBy({
        by: ['procedureLibelle'],
        where: {
          scrutins: { some: {} },
          procedureLibelle: { not: null },
        },
        _count: true,
        orderBy: { _count: { procedureLibelle: 'desc' } },
      });

      const result = {
        procedures: procedures
          .filter((p) => p.procedureLibelle)
          .map((p) => ({
            label: p.procedureLibelle!,
            count: p._count,
          })),
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/trending - Dossiers avec activité récente
  // ===========================================================================
  fastify.get('/trending', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Dossiers législatifs en tendance',
      description: 'Retourne les dossiers avec le plus de scrutins récents (3 derniers mois)',
    },
    handler: async (request, _reply) => {
      const { limit } = trendingQuerySchema.parse(request.query);
      const cacheKey = `dossiers:trending:${limit}`;

      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Exclure les dossiers en état terminal pour le label "Dossiers en cours"
      const terminalStates = ['promulgue', 'caduc', 'retire', 'fusionne'];

      const trendingSelect = {
        id: true,
        uid: true,
        titre: true,
        titreCourt: true,
        legislature: true,
        etat: true,
        procedureLibelle: true,
        dateDepot: true,
        _count: { select: { scrutins: true } },
        scrutins: {
          orderBy: { date: 'desc' as const },
          take: 1,
          select: { date: true },
        },
      };

      // Pool large trié par date du dernier scrutin
      const pool = await fastify.prisma.dossierLegislatif.findMany({
        where: {
          etat: { notIn: terminalStates },
          scrutins: { some: { date: { gte: threeMonthsAgo } } },
        },
        select: trendingSelect,
        take: 30,
      });

      // Tri par date du dernier scrutin (fraîcheur prime)
      pool.sort((a, b) => {
        const da = a.scrutins[0]?.date;
        const db = b.scrutins[0]?.date;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db.getTime() - da.getTime();
      });

      const trending = pool.slice(0, limit);

      const result = {
        data: trending.map(d => ({
          id: d.id,
          uid: d.uid,
          titre: d.titre,
          titreCourt: d.titreCourt,
          chambre: dossierChambre(d.legislature),
          etat: d.etat,
          procedureLibelle: d.procedureLibelle,
          dateDepot: d.dateDepot,
          _count: d._count,
          lastScrutinDate: d.scrutins[0]?.date || null,
        })),
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/:uid - Détail d'un dossier
  // ===========================================================================
  fastify.get('/:uid', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Détail d\'un dossier législatif',
      description: 'Retourne le détail d\'un dossier avec ses scrutins et statistiques',
    },
    handler: async (request, _reply) => {
      const { uid } = z.object({ uid: z.string() }).parse(request.params);

      const cacheKey = `dossiers:detail:${uid}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const dossier = await fastify.prisma.dossierLegislatif.findUnique({
        where: { uid },
        select: {
          id: true,
          uid: true,
          titre: true,
          titreCourt: true,
          legislature: true,
          procedureCode: true,
          procedureLibelle: true,
          urlAN: true,
          urlSenat: true,
          etat: true,
          dateDepot: true,
          dateAdoption: true,
          sujetId: true,
          loiNumero: true,
          loiTitre: true,
          loiDateJO: true,
          urlLegifrance: true,
          sourceData: true,
          resumeIA: true,
          sujet: {
            select: {
              slug: true,
              label: true,
              status: true,
            },
          },
          scrutins: {
            orderBy: [{ date: 'desc' }, { numero: 'asc' }],
            take: 20,
            select: {
              id: true,
              numero: true,
              chambre: true,
              session: true,
              date: true,
              titre: true,
              sort: true,
              typeVote: true,
              nombrePour: true,
              nombreContre: true,
              nombreAbstention: true,
              nombreVotants: true,
              amendements: {
                select: {
                  id: true,
                  numero: true,
                  auteurLibelle: true,
                  sort: true,
                },
              },
            },
          },
          amendements: {
            orderBy: [{ dateDepot: { sort: 'desc', nulls: 'last' } }, { numeroOrdre: { sort: 'desc', nulls: 'last' } }],
            take: 20,
            select: {
              id: true,
              uid: true,
              numero: true,
              auteurLibelle: true,
              articleVise: true,
              dispositif: true,
              exposeSommaire: true,
              texteRef: true,
              sort: true,
              dateDepot: true,
              scrutins: {
                select: {
                  id: true,
                  numero: true,
                  chambre: true,
                  session: true,
                  sort: true,
                  date: true,
                },
              },
            },
          },
          _count: {
            select: {
              scrutins: true,
              amendements: true,
            },
          },
        },
      });

      if (!dossier) {
        throw new ApiError(404, 'Dossier législatif non trouvé');
      }

      // Stats aggregation + voted amendements count + groupes with amendements
      const [statsResult, votedAmendementsCount, amendementsGroupes] = await Promise.all([
        fastify.prisma.scrutin.groupBy({
          by: ['sort'],
          where: { dossierId: dossier.id },
          _count: true,
        }),
        fastify.prisma.amendement.count({
          where: {
            dossierId: dossier.id,
            scrutins: { some: {} },
          },
        }),
        fastify.prisma.$queryRaw<Array<{
          slug: string;
          nom: string;
          couleur: string;
          count: bigint;
        }>>`
          SELECT gp.slug, gp.nom, gp.couleur, COUNT(*) as count
          FROM amendements a
          JOIN parlementaires p ON a.parlementaire_id = p.id
          JOIN groupes_politiques gp ON p.groupe_id = gp.id
          WHERE a.dossier_id = ${dossier.id}
          GROUP BY gp.slug, gp.nom, gp.couleur
          ORDER BY count DESC
        `,
      ]);

      const stats = {
        totalAdopte: statsResult.find((s: { sort: string; _count: number }) => s.sort === 'adopte')?._count || 0,
        totalRejete: statsResult.find((s: { sort: string; _count: number }) => s.sort === 'rejete')?._count || 0,
      };

      // Agrège les infos loi à travers les dossiers du même sujet (le n° est
      // souvent porté côté Sénat, les URLs côté AN) pour une carte cohérente
      // avec la page sujet.
      let loiNumero = dossier.loiNumero;
      let loiTitre = dossier.loiTitre;
      let loiDateJO = dossier.loiDateJO;
      let urlLegifrance = dossier.urlLegifrance;
      let urlJournalOfficiel = buildJournalOfficielUrl(dossier.sourceData);

      if (dossier.sujetId) {
        const siblings = await fastify.prisma.dossierLegislatif.findMany({
          where: { sujetId: dossier.sujetId },
          select: { loiNumero: true, loiTitre: true, loiDateJO: true, urlLegifrance: true, sourceData: true },
        });
        for (const s of siblings) {
          loiNumero ??= s.loiNumero;
          loiTitre ??= s.loiTitre;
          loiDateJO ??= s.loiDateJO;
          urlLegifrance ??= s.urlLegifrance;
          urlJournalOfficiel ??= buildJournalOfficielUrl(s.sourceData);
        }
      }

      // Travaux d'application liés, dans les DEUX sens.
      //
      // La liste des dossiers exige au moins un scrutin, ce qui écarte 19 135
      // dossiers sur 21 055 — dont les rapports et missions d'application, qui
      // deviennent introuvables. Ces documents citent le numéro de la loi dans
      // leur titre (« Rapport d'information sur l'application de la loi
      // n° 2023-580 ») sans porter eux-mêmes de `loi_numero`.
      //
      // Sens 1 — on consulte la loi : lister ses travaux d'application.
      // Sens 2 — on consulte un rapport : remonter à la loi qu'il applique. Ces
      // pages sont très pauvres (aucun vote, aucun amendement), le lien retour
      // est souvent leur seul contenu exploitable.
      const loiRefDuTitre = dossier.titre.match(/n°\s*(\d{4}-\d+)/)?.[1] ?? null;

      const [travauxApplication, loiAppliquee] = await Promise.all([
        loiNumero
          ? fastify.prisma.$queryRaw<Array<{
              uid: string; titre: string; procedureLibelle: string | null;
              legislature: number; urlAN: string | null; urlSenat: string | null;
            }>>`
              SELECT doc.uid, doc.titre, doc.procedure_libelle AS "procedureLibelle",
                     doc.legislature, doc.url_an AS "urlAN", doc.url_senat AS "urlSenat"
              FROM dossiers_legislatifs doc
              WHERE substring(doc.titre from 'n°\\s*([0-9]{4}-[0-9]+)') = ${loiNumero}
                AND doc.id <> ${dossier.id}
                AND doc.loi_numero IS NULL
                AND NOT EXISTS (SELECT 1 FROM scrutins s WHERE s.dossier_id = doc.id)
              ORDER BY doc.legislature DESC, doc.uid
              LIMIT 20
            `
          : Promise.resolve([]),
        loiRefDuTitre && !dossier.loiNumero
          ? fastify.prisma.$queryRaw<Array<{
              uid: string; titre: string; loiNumero: string | null; sujetSlug: string | null;
            }>>`
              SELECT loi.uid, loi.titre, loi.loi_numero AS "loiNumero", s.slug AS "sujetSlug"
              FROM dossiers_legislatifs loi
              LEFT JOIN sujets s ON s.id = loi.sujet_id AND s.actif = true
              WHERE loi.loi_numero = ${loiRefDuTitre}
              ORDER BY (s.slug IS NULL), loi.uid
              LIMIT 5
            `
          : Promise.resolve([]),
      ]);

      const result = {
        ...dossier,
        sourceData: undefined,
        loiNumero,
        loiTitre,
        loiDateJO,
        urlLegifrance,
        urlJournalOfficiel,
        travauxApplication: travauxApplication.map(t => ({
          ...t,
          chambre: dossierChambre(t.legislature),
        })),
        loiAppliquee: loiAppliquee[0] ?? null,
        chambre: dossierChambre(dossier.legislature),
        scrutinsCount: dossier._count.scrutins,
        amendementsCount: dossier._count.amendements,
        votedAmendementsCount,
        amendementsGroupes: amendementsGroupes.map(g => ({
          slug: g.slug,
          nom: g.nom,
          couleur: g.couleur,
          count: Number(g.count),
        })),
        stats,
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/:uid/scrutins - Scrutins paginés du dossier
  // ===========================================================================
  fastify.get('/:uid/scrutins', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Scrutins d\'un dossier législatif',
      description: 'Retourne les scrutins paginés d\'un dossier',
    },
    handler: async (request, _reply) => {
      const { uid } = z.object({ uid: z.string() }).parse(request.params);
      const { page, limit, ...rest } = paginationQuerySchema.parse(request.query);
      const typeFilter = rest as { type?: string } | undefined;

      const cacheKey = `dossiers:${uid}:scrutins:${page}:${limit}:${typeFilter?.type ?? 'all'}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const dossier = await fastify.prisma.dossierLegislatif.findUnique({
        where: { uid },
        select: { id: true },
      });

      if (!dossier) {
        throw new ApiError(404, 'Dossier législatif non trouvé');
      }

      const skip = (page - 1) * limit;
      const whereClause: Record<string, unknown> = { dossierId: dossier.id };
      if (typeFilter?.type) {
        whereClause.typeVote = typeFilter.type as 'solennel' | 'ordinaire' | 'motion';
      }

      const [scrutins, total] = await Promise.all([
        fastify.prisma.scrutin.findMany({
          where: whereClause,
          orderBy: [{ date: 'desc' }, { numero: 'asc' }],
          skip,
          take: limit,
          select: {
            id: true,
            numero: true,
            chambre: true,
            session: true,
            date: true,
            titre: true,
            sort: true,
            typeVote: true,
            nombrePour: true,
            nombreContre: true,
            nombreAbstention: true,
            nombreVotants: true,
          },
        }),
        fastify.prisma.scrutin.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        data: scrutins,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/:uid/amendements - Amendements paginés du dossier
  // ===========================================================================
  fastify.get('/:uid/amendements', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Amendements d\'un dossier législatif',
      description: 'Retourne les amendements paginés d\'un dossier',
    },
    handler: async (request, _reply) => {
      const { uid } = z.object({ uid: z.string() }).parse(request.params);
      const { page, limit, voted, groupe, sort: sortValue } = amendementsQuerySchema.parse(request.query);

      const cacheKey = `dossiers:${uid}:amendements:${page}:${limit}:${voted ?? 'all'}:${groupe ?? 'all'}:${sortValue ?? 'all'}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const dossier = await fastify.prisma.dossierLegislatif.findUnique({
        where: { uid },
        select: { id: true },
      });

      if (!dossier) {
        throw new ApiError(404, 'Dossier législatif non trouvé');
      }

      const where: Prisma.AmendementWhereInput = { dossierId: dossier.id };
      if (voted) {
        where.scrutins = { some: {} };
      }
      if (groupe) {
        where.parlementaire = { groupe: { slug: groupe } };
      }
      if (sortValue) {
        where.sort = sortValue;
      }

      const skip = (page - 1) * limit;

      const [amendements, total] = await Promise.all([
        fastify.prisma.amendement.findMany({
          where,
          orderBy: [{ dateDepot: { sort: 'desc', nulls: 'last' } }, { numeroOrdre: { sort: 'desc', nulls: 'last' } }],
          skip,
          take: limit,
          select: {
            id: true,
            uid: true,
            numero: true,
            auteurLibelle: true,
            articleVise: true,
            dispositif: true,
            exposeSommaire: true,
            texteRef: true,
            sort: true,
            dateDepot: true,
            scrutins: {
              select: {
                id: true,
                numero: true,
                chambre: true,
                session: true,
                sort: true,
                date: true,
              },
            },
          },
        }),
        fastify.prisma.amendement.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        data: amendements,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });
};
