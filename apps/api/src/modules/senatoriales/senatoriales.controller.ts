import { FastifyPluginAsync } from 'fastify';
import { SenatorialesService } from './senatoriales.service';
import {
  candidatsQuerySchema,
  FAMILLES_CANDIDATS,
  sortantsQuerySchema,
  TRIS_SORTANTS,
} from './senatoriales.schema';

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
          candidat: {
            type: 'string',
            enum: ['oui', 'non'],
            description:
              'Ne retenir que les sortants qui se représentent (`oui`) ou que ceux qui ne se ' +
              'représentent pas (`non`). Sans effet tant que les candidatures ne sont pas publiées.',
          },
        },
      },
    },
    handler: async (request) => {
      const query = sortantsQuerySchema.parse(request.query);
      return service.getSortants(query);
    },
  });

  fastify.get('/2026/candidats', {
    schema: {
      tags: ['Senatoriales'],
      summary: 'Candidats au renouvellement du 27 septembre 2026',
      description:
        'Les unités de vote du scrutin — une liste au scrutin proportionnel, un binôme ' +
        'titulaire-suppléant au scrutin majoritaire — avec leurs candidats. Un candidat ' +
        'déjà passé par le Parlement porte un lien vers sa fiche. La date de naissance ' +
        "n'est pas exposée : seule l'année l'est. Réponse vide tant que le ministère de " +
        "l'Intérieur n'a pas publié son fichier, une semaine environ avant le scrutin.",
      querystring: {
        type: 'object',
        properties: {
          departement: {
            type: 'string',
            description: 'Code INSEE du département de la circonscription',
          },
          famille: {
            type: 'string',
            enum: [...FAMILLES_CANDIDATS],
            description:
              'Famille politique dérivée de la nuance préfectorale. `sans-famille` cible ' +
              'les nuances laissées volontairement sans rattachement.',
          },
          sortants: {
            type: 'string',
            enum: ['true', '1', 'false', '0'],
            description: 'Ne retenir que les unités de vote portant au moins un sortant',
          },
        },
      },
    },
    handler: async (request) => {
      const query = candidatsQuerySchema.parse(request.query);
      return service.getCandidats(query);
    },
  });
};
