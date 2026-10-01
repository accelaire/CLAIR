import { FastifyPluginAsync } from 'fastify';
import { SenatorialesService } from './senatoriales.service';
import { ResultatsService } from './resultats.service';
import {
  candidatsQuerySchema,
  FAMILLES_CANDIDATS,
  sortantsQuerySchema,
  TRIS_SORTANTS,
} from './senatoriales.schema';

export const senatorialesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new SenatorialesService(fastify.prisma, fastify.redis);
  const resultats = new ResultatsService(fastify.prisma, fastify.redis);

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

  fastify.get('/2026/resultats', {
    schema: {
      tags: ['Senatoriales'],
      summary: 'Résultats du 27 septembre 2026, circonscription par circonscription',
      description:
        "État de chacune des 64 circonscriptions (vote en cours, 2nd tour, pourvue…), sièges " +
        "attribués par famille politique et hémicycle avant / après. Résultats PROVISOIRES, lus " +
        "sur le site de résultats du ministère de l'Intérieur ; mis en cache une minute.",
    },
    handler: async () => resultats.getNational(),
  });

  fastify.get('/2026/resultats/:departement', {
    schema: {
      tags: ['Senatoriales'],
      summary: 'Résultats détaillés d\'une circonscription',
      description:
        'Participation et voix de chaque tour, élus, répartition des sièges à la plus forte ' +
        'moyenne au proportionnel, et sort des sénateurs sortants. Résultats provisoires.',
      params: {
        type: 'object',
        properties: { departement: { type: 'string', pattern: '^(?:[0-9]{2,3}|2[AB])$' } },
        required: ['departement'],
      },
    },
    handler: async (request, reply) => {
      const { departement } = request.params as { departement: string };
      const detail = await resultats.getCirconscription(departement);
      if (!detail) return reply.status(404).send({ error: 'Circonscription inconnue' });
      return detail;
    },
  });

  fastify.get('/2026/elus', {
    schema: {
      tags: ['Senatoriales'],
      summary: 'Sénateurs élus le 27 septembre 2026 qui ont une fiche provisoire',
      description: 'Slug, nom et circonscription de chaque élu sans fiche de sénateur, en attendant le 1er octobre.',
    },
    handler: async () => ({ data: await resultats.getElusProvisoires() }),
  });

  fastify.get('/2026/elus/:slug', {
    schema: {
      tags: ['Senatoriales'],
      summary: "Fiche provisoire d'un sénateur élu le 27 septembre 2026",
      description:
        "Pour un élu qui n'a pas encore de fiche de sénateur (il entre dans l'annuaire du Sénat " +
        "à sa prise de fonction, le 1er octobre) : son élection, sa nuance et ses mandats locaux " +
        "du Répertoire national des élus. 404 pour un slug inconnu ou un élu qui a déjà une fiche.",
      params: {
        type: 'object',
        properties: { slug: { type: 'string', pattern: '^[a-z0-9-]{3,120}$' } },
        required: ['slug'],
      },
    },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const fiche = await resultats.getEluProvisoire(slug);
      if (!fiche) return reply.status(404).send({ error: 'Élu inconnu' });
      return fiche;
    },
  });
};
