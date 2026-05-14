import { FastifyPluginAsync } from 'fastify';
import { CommissionsService } from './commissions.service';
import {
  commissionQuerySchema,
  commissionDetailSchema,
  commissionReunionsQuerySchema,
  commissionDossiersQuerySchema,
} from './commissions.schema';
import { ApiError } from '../../utils/errors';

export const commissionsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new CommissionsService(fastify.prisma, fastify.redis);

  fastify.get('/', {
    schema: {
      tags: ['Commissions'],
      summary: 'Liste des commissions parlementaires',
      description: 'Retourne toutes les commissions avec pagination et filtres',
      querystring: {
        type: 'object',
        properties: {
          chambre: { type: 'string', enum: ['assemblee', 'senat'] },
          type: {
            type: 'string',
            enum: [
              'permanente',
              'enquete',
              'speciale',
              'mixte_paritaire',
              'office',
              'delegation',
              'mission_info',
              'groupe_etudes',
              'groupe_amitie',
              'assemblee_internationale',
              'hemicycle',
              'autre',
            ],
          },
          actif: { type: 'string', enum: ['true', 'false'] },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
    },
    handler: async (request) => {
      const parsed = commissionQuerySchema.parse(request.query);
      return service.getCommissions(parsed);
    },
  });

  fastify.get('/:slug', {
    schema: {
      tags: ['Commissions'],
      summary: "Détail d'une commission",
      description: 'Informations, membres actuels et prochaines réunions',
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request) => {
      const { slug } = commissionDetailSchema.parse(request.params);
      const commission = await service.getCommissionBySlug(slug);
      if (!commission) throw new ApiError(404, 'Commission non trouvée');
      return { data: commission };
    },
  });

  fastify.get('/:slug/reunions', {
    schema: {
      tags: ['Commissions'],
      summary: "Réunions d'une commission",
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          passees: { type: 'string', enum: ['true', 'false'] },
        },
      },
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request) => {
      const { slug } = commissionDetailSchema.parse(request.params);
      const parsed = commissionReunionsQuerySchema.parse(request.query);
      const result = await service.getCommissionReunions(slug, parsed);
      if (!result) throw new ApiError(404, 'Commission non trouvée');
      return result;
    },
  });

  fastify.get('/:slug/dossiers', {
    schema: {
      tags: ['Commissions'],
      summary: "Dossiers législatifs d'une commission",
      description: 'Dossiers examinés par la commission (fond ou avis)',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          role: { type: 'string', enum: ['fond', 'avis'] },
          etat: { type: 'string', enum: ['adopte', 'en_cours', 'promulgue', 'rejete', 'retire', 'caduc', 'fusionne'] },
        },
      },
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request) => {
      const { slug } = commissionDetailSchema.parse(request.params);
      const query = commissionDossiersQuerySchema.parse(request.query);
      const result = await service.getDossiersByCommission(slug, query);
      if (!result) throw new ApiError(404, 'Commission non trouvée');
      return result;
    },
  });
};
