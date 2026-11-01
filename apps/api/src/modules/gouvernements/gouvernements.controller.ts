import { FastifyPluginAsync } from 'fastify';
import { GouvernementsService } from './gouvernements.service';
import { gouvernementDetailSchema } from './gouvernements.schema';
import { ApiError } from '../../utils/errors';

export const gouvernementsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new GouvernementsService(fastify.prisma, fastify.redis);

  fastify.get('/', {
    schema: {
      tags: ['Gouvernements'],
      summary: 'Liste des gouvernements depuis 2007',
      description:
        'Les gouvernements de la Ve République publiés par l’Assemblée nationale (depuis Fillon I, mai 2007), ' +
        'du plus récent au plus ancien : Premier ministre, présidence de la République au début du gouvernement, ' +
        'dates telles que publiées par la source, nombre de postes et de membres.',
    },
    handler: async () => service.getGouvernements(),
  });

  fastify.get('/:slug', {
    schema: {
      tags: ['Gouvernements'],
      summary: "Détail d'un gouvernement",
      description:
        'Les postes ministériels dans l’ordre protocolaire, avec les dates de chaque titulaire (remaniements compris) ' +
        'et le lien vers la fiche parlementaire quand la personne en a une.',
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request) => {
      const { slug } = gouvernementDetailSchema.parse(request.params);
      const gouvernement = await service.getGouvernementBySlug(slug);
      if (!gouvernement) throw new ApiError(404, 'Gouvernement non trouvé');
      return gouvernement;
    },
  });
};
