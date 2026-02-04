// =============================================================================
// Module Groupes - Controller (Routes)
// Routes: /api/v1/groupes
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { GroupesService, Chambre } from './groupes.service';
import { ApiError } from '../../utils/errors';

export const groupesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new GroupesService(fastify.prisma, fastify.redis);

  // ===========================================================================
  // GET / - Liste de tous les groupes
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Groupes politiques'],
      summary: 'Liste des groupes politiques',
      description: 'Retourne tous les groupes politiques actifs avec statistiques',
      querystring: {
        type: 'object',
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
            description: 'Filtrer par chambre',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre } = request.query as { chambre?: Chambre };
      const groupes = await service.getGroupes(chambre);
      return { data: groupes };
    },
  });

  // ===========================================================================
  // GET /:chambre/:slug - Détail d'un groupe
  // ===========================================================================
  fastify.get('/:chambre/:slug', {
    schema: {
      tags: ['Groupes politiques'],
      summary: 'Détail d\'un groupe politique',
      description: 'Retourne les informations détaillées d\'un groupe avec ses membres',
      params: {
        type: 'object',
        required: ['chambre', 'slug'],
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
            description: 'Chambre du groupe',
          },
          slug: {
            type: 'string',
            description: 'Slug unique du groupe',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };

      const groupe = await service.getGroupeBySlug(chambre, slug);

      if (!groupe) {
        throw new ApiError(404, 'Groupe non trouvé');
      }

      return { data: groupe };
    },
  });

  // ===========================================================================
  // GET /:chambre/:slug/stats - Statistiques d'un groupe
  // ===========================================================================
  fastify.get('/:chambre/:slug/stats', {
    schema: {
      tags: ['Groupes politiques'],
      summary: 'Statistiques d\'un groupe',
      description: 'Retourne les statistiques agrégées d\'un groupe politique',
      params: {
        type: 'object',
        required: ['chambre', 'slug'],
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
          },
          slug: {
            type: 'string',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };

      const stats = await service.getGroupeStats(chambre, slug);

      if (!stats) {
        throw new ApiError(404, 'Groupe non trouvé');
      }

      return { data: stats };
    },
  });

  // ===========================================================================
  // GET /:chambre/:slug/votes - Statistiques de votes agrégées du groupe
  // ===========================================================================
  fastify.get('/:chambre/:slug/votes', {
    schema: {
      tags: ['Groupes politiques'],
      summary: 'Statistiques de votes du groupe',
      description: 'Retourne les statistiques de votes agrégées du groupe avec les 10 derniers scrutins',
      params: {
        type: 'object',
        required: ['chambre', 'slug'],
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
          },
          slug: {
            type: 'string',
          },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          groupeInitie: {
            type: 'boolean',
            description: 'Filtrer uniquement les scrutins initiés par ce groupe',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };
      const { groupeInitie } = request.query as { groupeInitie?: boolean };

      const votingStats = await service.getGroupeVotingStats(chambre, slug, { groupeInitie });

      if (!votingStats) {
        throw new ApiError(404, 'Groupe non trouvé');
      }

      return { data: votingStats };
    },
  });

  // ===========================================================================
  // GET /:chambre/:slug/alliances - Alliances du groupe avec les autres
  // ===========================================================================
  fastify.get('/:chambre/:slug/alliances', {
    schema: {
      tags: ['Groupes politiques'],
      summary: 'Alliances du groupe',
      description: 'Retourne les groupes alliés, neutres et opposés basé sur les votes communs',
      params: {
        type: 'object',
        required: ['chambre', 'slug'],
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
          },
          slug: {
            type: 'string',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };

      const alliances = await service.getGroupeAlliances(chambre, slug);

      if (!alliances) {
        throw new ApiError(404, 'Groupe non trouvé');
      }

      return { data: alliances };
    },
  });

  // ===========================================================================
  // GET /:chambre/:slug/thematiques - Stats par thématique pour radar chart
  // ===========================================================================
  fastify.get('/:chambre/:slug/thematiques', {
    schema: {
      tags: ['Groupes politiques'],
      summary: 'Statistiques par thématique',
      description: 'Retourne les positions du groupe par thème pour le radar chart',
      params: {
        type: 'object',
        required: ['chambre', 'slug'],
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
          },
          slug: {
            type: 'string',
          },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          groupeInitie: {
            type: 'boolean',
            description: 'Filtrer uniquement les scrutins initiés par ce groupe',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };
      const { groupeInitie } = request.query as { groupeInitie?: boolean };

      const thematiques = await service.getGroupeThematiques(chambre, slug, { groupeInitie });

      if (!thematiques) {
        throw new ApiError(404, 'Groupe non trouvé');
      }

      return { data: thematiques };
    },
  });

  // ===========================================================================
  // GET /:chambre/matrice-alliances - Matrice de tous les accords entre groupes
  // ===========================================================================
  fastify.get('/:chambre/matrice-alliances', {
    schema: {
      tags: ['Groupes politiques'],
      summary: 'Matrice d\'alliances entre tous les groupes',
      description: 'Retourne une matrice complète des taux d\'accord entre tous les groupes d\'une chambre',
      params: {
        type: 'object',
        required: ['chambre'],
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre } = request.params as { chambre: Chambre };

      const matrice = await service.getGroupesMatriceAlliances(chambre);

      return { data: matrice };
    },
  });
};
