// =============================================================================
// Module Parlementaires - Controller (Routes)
// Routes: /api/v1/parlementaires, /api/v1/deputes, /api/v1/senateurs
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { ParlementairesService } from './parlementaires.service';
import {
  parlementaireParamsSchema,
  parlementaireQuerySchema,
  parlementairesListQuerySchema,
  parlementaireVotesQuerySchema,
  Chambre,
} from './parlementaires.schema';
import { ApiError } from '../../utils/errors';

// ===========================================================================
// FACTORY pour créer des routes avec chambre optionnelle
// ===========================================================================

function createParlementairesRoutes(forcedChambre?: Chambre): FastifyPluginAsync {
  return async (fastify) => {
    const service = new ParlementairesService(fastify.prisma, fastify.redis);

    const chambreLabel = forcedChambre === 'assemblee' ? 'Députés' :
                         forcedChambre === 'senat' ? 'Sénateurs' : 'Parlementaires';

    // ===========================================================================
    // GET / - Liste des parlementaires
    // ===========================================================================
    fastify.get('/', {
      schema: {
        tags: [chambreLabel],
        summary: `Liste des ${chambreLabel.toLowerCase()}`,
        description: `Retourne la liste paginée des ${chambreLabel.toLowerCase()} avec filtres et tri`,
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            chambre: { type: 'string', enum: ['assemblee', 'senat'], description: 'Filtrer par chambre' },
            groupe: { type: 'string', description: 'Slug du groupe politique' },
            departement: { type: 'string', description: 'Numéro du département' },
            search: { type: 'string', description: 'Recherche par nom/prénom' },
            actif: { type: 'boolean', default: true },
            sort: { type: 'string', enum: ['nom', 'prenom', 'presence', 'loyaute', 'activite'], default: 'nom' },
            order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
      handler: async (request, _reply) => {
        const query = parlementairesListQuerySchema.parse(request.query);
        const result = await service.getParlementaires(query, forcedChambre);
        return result;
      },
    });

    // ===========================================================================
    // GET /groupes - Liste des groupes politiques
    // ===========================================================================
    fastify.get('/groupes', {
      schema: {
        tags: [chambreLabel],
        summary: 'Liste des groupes politiques',
        description: `Retourne tous les groupes politiques actifs${forcedChambre ? ` de ${chambreLabel.toLowerCase()}` : ''} avec le nombre de membres`,
      },
      handler: async (_request, _reply) => {
        const groupes = await service.getGroupes(forcedChambre);
        return { data: groupes };
      },
    });

    // ===========================================================================
    // GET /compare - Comparer des parlementaires
    // ===========================================================================
    fastify.get('/compare', {
      schema: {
        tags: [chambreLabel],
        summary: `Comparer des ${chambreLabel.toLowerCase()}`,
        description: `Compare 2 à 4 ${chambreLabel.toLowerCase()} par leurs statistiques`,
        querystring: {
          type: 'object',
          required: ['slugs'],
          properties: {
            slugs: {
              type: 'string',
              description: `Slugs des ${chambreLabel.toLowerCase()} séparés par des virgules (2-4)`
            },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slugs } = request.query as { slugs: string };
        const slugList = slugs.split(',').map((s) => s.trim()).filter(Boolean);

        if (slugList.length < 2 || slugList.length > 4) {
          throw new ApiError(400, `Veuillez fournir entre 2 et 4 slugs de ${chambreLabel.toLowerCase()}`);
        }

        const parlementaires = await service.compareParlementaires(slugList);
        return { data: parlementaires };
      },
    });

    // ===========================================================================
    // GET /:slug - Détail d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug', {
      schema: {
        tags: [chambreLabel],
        summary: `Détail d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne les informations détaillées d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string', description: 'Slug unique du parlementaire' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            include: {
              type: 'string',
              description: 'Relations à inclure (votes,interventions,amendements,stats)'
            },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const { include } = parlementaireQuerySchema.parse(request.query);

        const parlementaire = await service.getParlementaireBySlug(slug, include);

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        // Vérifier la chambre si forcée
        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        return { data: parlementaire };
      },
    });

    // ===========================================================================
    // GET /:slug/stats - Statistiques d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug/stats', {
      schema: {
        tags: [chambreLabel],
        summary: `Statistiques d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne les statistiques calculées d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const stats = await service.getParlementaireStats(parlementaire.id, parlementaire.chambre as Chambre);
        return { data: stats };
      },
    });

    // ===========================================================================
    // GET /:slug/votes - Votes d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug/votes', {
      schema: {
        tags: [chambreLabel],
        summary: `Votes d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne l'historique des votes d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            position: { type: 'string', enum: ['pour', 'contre', 'abstention', 'absent'] },
            tag: { type: 'string', description: 'Filtrer par tag de scrutin' },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const query = parlementaireVotesQuerySchema.parse(request.query);

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const result = await service.getParlementaireVotes(parlementaire.id, query);
        return result;
      },
    });

    // ===========================================================================
    // GET /:slug/amendements - Amendements d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug/amendements', {
      schema: {
        tags: [chambreLabel],
        summary: `Amendements d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne les amendements déposés par un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            sort: { type: 'string', enum: ['Adopté', 'Rejeté', 'Retiré', 'Non soutenu', 'Tombé'] },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const { page = 1, limit = 20, sort } = request.query as any;

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const skip = (page - 1) * limit;

        const [amendements, total] = await Promise.all([
          fastify.prisma.amendement.findMany({
            where: {
              parlementaireId: parlementaire.id,
              ...(sort && { sort }),
            },
            orderBy: { dateDepot: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              uid: true,
              numero: true,
              legislature: true,
              chambre: true,
              texteRef: true,
              articleVise: true,
              dispositif: true,
              exposeSommaire: true,
              auteurLibelle: true,
              sort: true,
              dateDepot: true,
              dateSort: true,
            },
          }),
          fastify.prisma.amendement.count({
            where: {
              parlementaireId: parlementaire.id,
              ...(sort && { sort }),
            },
          }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
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
      },
    });

    // ===========================================================================
    // GET /:slug/interventions - Interventions d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug/interventions', {
      schema: {
        tags: [chambreLabel],
        summary: `Interventions d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne les interventions d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            type: { type: 'string', enum: ['question', 'intervention', 'explication_vote'] },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const { page = 1, limit = 20, type } = request.query as any;

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const skip = (page - 1) * limit;

        const [interventions, total] = await Promise.all([
          fastify.prisma.intervention.findMany({
            where: {
              parlementaireId: parlementaire.id,
              ...(type && { type }),
            },
            orderBy: { date: 'desc' },
            skip,
            take: limit,
          }),
          fastify.prisma.intervention.count({
            where: {
              parlementaireId: parlementaire.id,
              ...(type && { type }),
            },
          }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
          data: interventions,
          meta: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };
      },
    });
  };
}

// ===========================================================================
// ROUTES EXPORTS
// ===========================================================================

// Routes génériques pour tous les parlementaires
export const parlementairesRoutes = createParlementairesRoutes();

// Routes spécifiques pour les députés (backwards compatible)
export const deputesRoutes = createParlementairesRoutes('assemblee');

// Routes spécifiques pour les sénateurs
export const senateursRoutes = createParlementairesRoutes('senat');
