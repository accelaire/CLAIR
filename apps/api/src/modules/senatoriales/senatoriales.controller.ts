import { FastifyPluginAsync } from 'fastify';
import { SenatorialesService } from './senatoriales.service';
import { sortantsQuerySchema, TRIS_SORTANTS } from './senatoriales.schema';

export const senatorialesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new SenatorialesService(fastify.prisma, fastify.redis);

  fastify.get('/2026', {
    schema: {
      tags: ['Senatoriales'],
      summary: 'Aperçu du renouvellement sénatorial du 27 septembre 2026',
      description:
        "Métadonnées du scrutin (date, série, prise de fonction, sources officielles), " +
        'répartition par groupe des sénateurs sortants et liste des circonscriptions concernées.',
    },
    handler: async () => service.getApercu(),
  });

  fastify.get('/2026/sortants', {
    schema: {
      tags: ['Senatoriales'],
      summary: 'Bilan de mandature des sénateurs sortants (série 2)',
      description:
        'Les 178 sénateurs dont le siège est remis en jeu, avec leur groupe d’époque, ' +
        'leur circonscription et les statistiques de leur mandat. Pas de pagination.',
      querystring: {
        type: 'object',
        properties: {
          departement: {
            type: 'string',
            description: 'Filtre exact sur le département de la circonscription',
          },
          groupe: {
            type: 'string',
            description:
              'Slug du groupe politique du mandat. Valeur spéciale `sans-groupe` pour les non-inscrits à un groupe.',
          },
          tri: {
            type: 'string',
            enum: [...TRIS_SORTANTS],
            default: 'departement',
          },
        },
      },
    },
    handler: async (request) => {
      const query = sortantsQuerySchema.parse(request.query);
      return service.getSortants(query);
    },
  });
};
