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
        'dates telles que publiées par la source, nombre de postes et de membres, nombre de recours au 49.3 et de ' +
        'motions de censure (`bilan`, null avant juin 2017).',
    },
    handler: async () => service.getGouvernements(),
  });

  fastify.get('/membres/:slug', {
    schema: {
      tags: ['Gouvernements'],
      summary: "Un membre du Gouvernement et son bilan",
      description:
        'Une personne qui a occupé au moins un poste ministériel depuis 2007, qu’elle ait une fiche parlementaire ou non : ' +
        'ses postes, et pour chaque poste depuis juin 2017 les projets de loi signés (chef de file ou cosignataire, avec leur ' +
        'stade), le nombre de réponses en séance par chambre et, pour un Premier ministre, ses recours au 49.3 et les ' +
        'motions de censure votées contre son gouvernement. `bilan` vaut null pour un poste fini avant juin 2017.',
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request) => {
      const { slug } = gouvernementDetailSchema.parse(request.params);
      const membre = await service.getMembreBySlug(slug);
      if (!membre) throw new ApiError(404, 'Membre du Gouvernement non trouvé');
      return membre;
    },
  });

  fastify.get('/:slug', {
    schema: {
      tags: ['Gouvernements'],
      summary: "Détail d'un gouvernement",
      description:
        'Les postes ministériels dans l’ordre protocolaire, avec les dates de chaque titulaire (remaniements compris) ' +
        'et le lien vers la fiche parlementaire quand la personne en a une. `bilan` (depuis juin 2017) : les projets de ' +
        'loi déposés, leur nature et leur stade (promulgué, adopté, examiné, déposé sans examen), les recours au 49.3 et ' +
        'les motions de censure. Pour un gouvernement fini avant juin 2017, `bilan` vaut null et `couverture` ' +
        '« avant_2017 » : pas de données, et non zéro.',
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
