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
      description:
        "Retourne les groupes politiques actifs d'une période, avec statistiques. " +
        "Un sigle de groupe n'existe qu'à un instant donné (RE, LAREM et GDR-NUPES " +
        'coexistent en base sur trois législatures) : par défaut, seule la législature ' +
        "courante de l'Assemblée est renvoyée. Le Sénat n'a pas de législature.",
      querystring: {
        type: 'object',
        properties: {
          chambre: {
            type: 'string',
            enum: ['assemblee', 'senat'],
            description: 'Filtrer par chambre',
          },
          legislature: {
            type: 'integer',
            description: "Législature AN (15, 16, 17). Défaut : la plus récente en base.",
          },
          session: {
            type: 'string',
            description:
              "Session Sénat (année de début, ex. \"2020\"). Défaut : la session courante. " +
              "L'effectif renvoyé est celui de la composition du groupe à cette session.",
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, legislature, session } = request.query as {
        chambre?: Chambre;
        legislature?: string;
        session?: string;
      };
      const groupes = await service.getGroupes(
        chambre,
        legislature !== undefined ? Number(legislature) : undefined,
        session,
      );
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
      querystring: {
        type: 'object',
        properties: {
          legislature: {
            type: 'integer',
            description:
              "Législature AN du groupe (15, 16, 17). Défaut : la plus récente. Un même sigle " +
              'désigne un groupe différent selon la législature ; les membres et les stats ' +
              'renvoyés sont ceux de la période demandée.',
          },
          session: {
            type: 'string',
            description:
              "Session Sénat (année de début, ex. \"2020\"). Défaut : la session courante. " +
              'Renvoie la composition et les stats du groupe telles qu’à cette session.',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };
      const { legislature, session } = request.query as { legislature?: string; session?: string };

      const groupe = await service.getGroupeBySlug(
        chambre,
        slug,
        legislature !== undefined ? Number(legislature) : undefined,
        session,
      );

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
      querystring: {
        type: 'object',
        properties: {
          legislature: {
            type: 'integer',
            description:
              "Législature AN du groupe (15, 16, 17). Défaut : la plus récente. Un même sigle " +
              'désigne un groupe différent selon la législature ; sans ce paramètre, les stats ' +
              "renvoyées seraient toujours celles de la législature la plus récente, même en " +
              'vue historique (Sénat : ignoré, pas de législature).',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };
      const { legislature } = request.query as { legislature?: string };

      const stats = await service.getGroupeStats(
        chambre,
        slug,
        legislature !== undefined ? Number(legislature) : undefined,
      );

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
          legislature: {
            type: 'integer',
            description:
              "Législature AN du groupe (15, 16, 17). Défaut : la plus récente. Sans ce " +
              "paramètre, une page groupe en vue historique (ex. RN 16e) afficherait les " +
              'votes du groupe de la législature courante (17e) au lieu de ceux de la période demandée.',
          },
          session: {
            type: 'string',
            description:
              "Sénat uniquement (année de début, ex. \"2020\"). Défaut : la session courante. " +
              "Si une session passée est demandée, les scrutins et votes agrégés sont bornés à " +
              "l'intervalle de cette session ; sinon (absente ou courante), l'agrégat porte sur " +
              "tout l'historique du groupe, comme avant.",
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };
      const { groupeInitie, legislature, session } = request.query as {
        groupeInitie?: boolean;
        legislature?: string;
        session?: string;
      };

      const votingStats = await service.getGroupeVotingStats(chambre, slug, {
        groupeInitie,
        legislature: legislature !== undefined ? Number(legislature) : undefined,
        session,
      });

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
      querystring: {
        type: 'object',
        properties: {
          legislature: {
            type: 'integer',
            description:
              "Législature AN du groupe (15, 16, 17). Défaut : la plus récente. Les alliances " +
              'sont pré-calculées PAR législature en base ; sans ce paramètre, une vue historique ' +
              'AN afficherait les alliances de la législature courante. Sénat : ignoré — les ' +
              'alliances ne portent que sur la session courante (pas de recalcul à la volée).',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };
      const { legislature } = request.query as { legislature?: string };

      const alliances = await service.getGroupeAlliances(
        chambre,
        slug,
        legislature !== undefined ? Number(legislature) : undefined,
      );

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
          legislature: {
            type: 'integer',
            description:
              "Législature AN du groupe (15, 16, 17). Défaut : la plus récente. Les stats " +
              'thématiques sont pré-calculées PAR ligne de groupe (donc par législature) ; sans ' +
              'ce paramètre, une vue historique AN afficherait les thématiques du groupe de la ' +
              'législature courante. Sénat : ignoré — même limitation que pour les alliances.',
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { chambre, slug } = request.params as { chambre: Chambre; slug: string };
      const { groupeInitie, legislature } = request.query as {
        groupeInitie?: boolean;
        legislature?: string;
      };

      const thematiques = await service.getGroupeThematiques(chambre, slug, {
        groupeInitie,
        legislature: legislature !== undefined ? Number(legislature) : undefined,
      });

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
