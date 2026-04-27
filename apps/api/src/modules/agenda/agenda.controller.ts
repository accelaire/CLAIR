import { FastifyPluginAsync } from 'fastify';
import { AgendaService } from './agenda.service';
import { agendaQuerySchema, reunionDetailSchema } from './agenda.schema';
import { ApiError } from '../../utils/errors';

export const agendaRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AgendaService(fastify.prisma, fastify.redis);

  fastify.get('/', {
    schema: {
      tags: ['Agenda'],
      summary: 'Calendrier parlementaire',
      description: 'Réunions groupées par jour pour une période donnée',
      querystring: {
        type: 'object',
        required: ['dateFrom'],
        properties: {
          dateFrom: { type: 'string', format: 'date', description: 'Date de début (YYYY-MM-DD)' },
          dateTo: { type: 'string', format: 'date', description: 'Date de fin (YYYY-MM-DD, défaut: fin du mois)' },
          type: { type: 'string', enum: ['commission', 'seance', 'tous'], default: 'tous' },
          commissionId: { type: 'string', format: 'uuid' },
          chambre: { type: 'string', enum: ['assemblee', 'senat'] },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 },
        },
      },
    },
    handler: async (request) => {
      const parsed = agendaQuerySchema.parse(request.query);
      return service.getAgenda(parsed);
    },
  });

  fastify.get('/:uid', {
    schema: {
      tags: ['Agenda'],
      summary: "Détail d'une réunion",
      description: 'ODJ, participants avec présence, commission associée',
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
    },
    handler: async (request) => {
      const { uid } = reunionDetailSchema.parse(request.params);
      const reunion = await service.getReunionByUid(uid);
      if (!reunion) throw new ApiError(404, 'Réunion non trouvée');
      return { data: reunion };
    },
  });
};
