// =============================================================================
// Module Pétitions - Routes
// Routes: /api/v1/petitions
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { ApiError } from '../../utils/errors';
import { ETAPES_PETITION, petitionParamsSchema, petitionsQuerySchema } from './petitions.schema';
import { PetitionsService } from './petitions.service';

export const petitionsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new PetitionsService(fastify.prisma, fastify.redis);

  fastify.get('/', {
    schema: {
      tags: ['Pétitions'],
      summary: 'Liste des pétitions citoyennes',
      description:
        "Pétitions des plateformes de l'Assemblée nationale et du Sénat (jeux data.gouv.fr, Licence Ouverte), " +
        'triées par signatures. `etape` est la dernière étape connue du parcours ; `statutSource` est le statut ' +
        "affiché par la plateforme, qui ne dit pas le sort de la pétition. `extrait` donne le début du texte, " +
        '`url` mène à la page officielle.',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20, maximum: 100 },
          chambre: { type: 'string', enum: ['assemblee', 'senat'] },
          commission: { type: 'string', description: 'Slug de la commission (Assemblée nationale)' },
          collecte: { type: 'string', enum: ['ouverte', 'close'] },
          etape: { type: 'string', enum: [...ETAPES_PETITION, 'aucune'] },
          suivies: { type: 'boolean', description: 'Au moins 10 000 signatures ou une étape institutionnelle' },
          search: { type: 'string', description: 'Mot du titre, ou numéro de la pétition' },
          sort: { type: 'string', enum: ['signatures', 'date', 'etape'], default: 'signatures' },
        },
      },
    },
    handler: async (request) => service.lister(petitionsQuerySchema.parse(request.query)),
  });

  fastify.get('/dernieres-etapes', {
    schema: {
      tags: ['Pétitions'],
      summary: 'Les dernières pétitions à franchir une étape',
      description:
        'Les 3 pétitions dont la dernière étape datée est la plus tardive (un examen annoncé en tête), ' +
        'au format de la liste. Les classements ne comptent que pour une pétition suivie (au moins ' +
        '10 000 signatures) : les commissions classent par lots des pétitions peu signées.',
    },
    handler: async () => service.dernieresEtapes(),
  });

  fastify.get('/filtres', {
    schema: {
      tags: ['Pétitions'],
      summary: 'Compteurs des filtres de la liste des pétitions',
      description: 'Pétitions par chambre, par dernière étape et par commission, et nombre de pétitions suivies.',
    },
    handler: async () => service.filtres(),
  });

  fastify.get('/:chambre/:numero', {
    schema: {
      tags: ['Pétitions'],
      summary: "Détail d'une pétition et son parcours",
      description:
        'Étapes datées et sourcées (agenda des commissions, dossiers de la procédure « Pétitions », ' +
        'plateforme), décision officielle, relevés du compteur de signatures. `texte` : le texte entier, ' +
        'paragraphes séparés par une ligne vide, éléments de liste par un retour simple, coordonnées masquées ; ' +
        '`texteIncomplet` : assez long pour que le jeu de données l\'ait coupé (vers 10 000 caractères).',
      params: {
        type: 'object',
        required: ['chambre', 'numero'],
        properties: {
          chambre: { type: 'string', enum: ['assemblee', 'senat'] },
          numero: { type: 'integer', minimum: 1 },
        },
      },
    },
    handler: async (request) => {
      const petition = await service.detail(petitionParamsSchema.parse(request.params));
      if (!petition) throw new ApiError(404, 'Pétition non trouvée');
      return { data: petition };
    },
  });
};
