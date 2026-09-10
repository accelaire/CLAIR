// =============================================================================
// Module Parlementaires - Controller (Routes)
// Routes: /api/v1/parlementaires, /api/v1/deputes, /api/v1/senateurs
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { ParlementairesService } from './parlementaires.service';
import {
  parlementaireParamsSchema,
  parlementaireQuerySchema,
  parlementairesListQuerySchema,
  parlementaireVotesQuerySchema,
  parlementaireRankQuerySchema,
  Chambre,
} from './parlementaires.schema';
import { ApiError } from '../../utils/errors';
import { INTERVENTIONS_DE_FOND, journeeDeSeance } from '../../utils/interventions';

// ===========================================================================
// FACTORY pour créer des routes avec chambre optionnelle
// ===========================================================================

function createParlementairesRoutes(forcedChambre?: Chambre): FastifyPluginAsync {
  return async (fastify) => {
    const service = new ParlementairesService(fastify.prisma, fastify.redis);

    const chambreLabel = forcedChambre === 'assemblee' ? 'Députés' :
                         forcedChambre === 'senat' ? 'Sénateurs' : 'Parlementaires';

    // ===========================================================================
    // GET / - Liste des parlementaires
    // ===========================================================================
    fastify.get('/', {
      schema: {
        tags: [chambreLabel],
        summary: `Liste des ${chambreLabel.toLowerCase()}`,
        description: `Retourne la liste paginée des ${chambreLabel.toLowerCase()} avec filtres et tri`,
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
            chambre: { type: 'string', enum: ['assemblee', 'senat'], description: 'Filtrer par chambre' },
            groupe: { type: 'string', description: 'Slug du groupe politique' },
            departement: { type: 'string', description: 'Numéro du département' },
            search: { type: 'string', description: 'Recherche par nom/prénom' },
            actif: { type: 'boolean', default: true },
            sort: { type: 'string', enum: ['nom', 'prenom', 'presence', 'loyaute', 'activite', 'amendements', 'interventions'], default: 'nom' },
            order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
      handler: async (request, _reply) => {
        const query = parlementairesListQuerySchema.parse(request.query);
        const result = await service.getParlementaires(query, forcedChambre);
        return result;
      },
    });

    // ===========================================================================
    // GET /groupes - Liste des groupes politiques
    // ===========================================================================
    fastify.get('/groupes', {
      schema: {
        tags: [chambreLabel],
        summary: 'Liste des groupes politiques',
        description:
          `Retourne les groupes politiques${forcedChambre ? ` de ${chambreLabel.toLowerCase()}` : ''} d'une période, avec leur effectif. ` +
          "Un sigle de groupe n'existe qu'à un instant donné : par défaut, seule la législature courante de l'Assemblée est renvoyée. Le Sénat n'a pas de législature.",
        querystring: {
          type: 'object',
          properties: {
            legislature: {
              type: 'integer',
              description: 'Législature AN (15, 16, 17). Défaut : la plus récente en base.',
            },
            session: {
              type: 'string',
              description:
                'Session Sénat (année de début, ex. "2020"). Défaut : la session courante. ' +
                "L'effectif renvoyé est la composition du groupe à cette session.",
            },
          },
        },
      },
      handler: async (request, _reply) => {
        const { legislature, session } = request.query as { legislature?: string; session?: string };
        const groupes = await service.getGroupes(
          forcedChambre,
          legislature !== undefined ? Number(legislature) : undefined,
          session,
        );
        return { data: groupes };
      },
    });

    // ===========================================================================
    // GET /legislatures - Législatures disponibles (sélecteur de période)
    // ===========================================================================
    fastify.get('/legislatures', {
      schema: {
        tags: [chambreLabel],
        summary: 'Législatures disponibles',
        description: `Liste des législatures pour lesquelles des mandats existent${forcedChambre ? ` (${chambreLabel.toLowerCase()})` : ''}, de la plus récente à la plus ancienne, avec le nombre de mandats.`,
      },
      handler: async (_request, _reply) => {
        const legislatures = await service.getLegislatures(forcedChambre);
        return { data: legislatures };
      },
    });

    // ===========================================================================
    // GET /sessions - Sessions Sénat disponibles (axe temporel de la chambre haute)
    // ===========================================================================
    fastify.get('/sessions', {
      schema: {
        tags: [chambreLabel],
        summary: 'Sessions disponibles (Sénat)',
        description:
          "Sessions ordinaires (1er oct. → 30 sept.) pour lesquelles la composition du Sénat est connue de façon fiable, de la plus récente à la plus ancienne. Le Sénat n'ayant pas de législature (renouvellement par moitiés), la session est le seul axe décrivant la chambre à un instant donné. Vide pour l'Assemblée (utiliser /legislatures).",
      },
      handler: async (_request, _reply) => {
        if (forcedChambre === 'assemblee') return { data: [] };
        const sessions = await service.getSessionsSenat();
        return { data: sessions };
      },
    });

    // ===========================================================================
    // GET /historique-carriere - Le tri « carrière » est-il pertinent ?
    // ===========================================================================
    fastify.get('/historique-carriere', {
      schema: {
        tags: [chambreLabel],
        summary: 'Historique de carrière disponible',
        description:
          "Indique si le tri « carrière complète » diffère du tri « mandat en cours » " +
          `dans cette chambre${forcedChambre ? ` (${chambreLabel.toLowerCase()})` : ''} : ` +
          'vrai seulement s\'il existe un élu en fonction réélu (≥ 2 mandats). Sert à ' +
          'afficher le sélecteur de période des classements uniquement quand il départage ' +
          'réellement les élus.',
      },
      handler: async (_request, _reply) => {
        const present = await service.hasCarriereHistorique(forcedChambre);
        return { data: { present } };
      },
    });

    // ===========================================================================
    // GET /compare - Comparer des parlementaires
    // ===========================================================================
    fastify.get('/compare', {
      schema: {
        tags: [chambreLabel],
        summary: `Comparer des ${chambreLabel.toLowerCase()}`,
        description: `Compare 2 à 4 ${chambreLabel.toLowerCase()} par leurs statistiques`,
        querystring: {
          type: 'object',
          required: ['slugs'],
          properties: {
            slugs: {
              type: 'string',
              description: `Slugs des ${chambreLabel.toLowerCase()} séparés par des virgules (2-4)`
            },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slugs } = request.query as { slugs: string };
        const slugList = slugs.split(',').map((s) => s.trim()).filter(Boolean);

        if (slugList.length < 2 || slugList.length > 4) {
          throw new ApiError(400, `Veuillez fournir entre 2 et 4 slugs de ${chambreLabel.toLowerCase()}`);
        }

        try {
          const parlementaires = await service.compareParlementaires(slugList);
          return { data: parlementaires };
        } catch (error) {
          fastify.log.error({ error, slugList }, 'Error in compareParlementaires');
          throw error;
        }
      },
    });

    // ===========================================================================
    // GET /:slug - Détail d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug', {
      schema: {
        tags: [chambreLabel],
        summary: `Détail d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne les informations détaillées d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string', description: 'Slug unique du parlementaire' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            include: {
              type: 'string',
              description: 'Relations à inclure (votes,interventions,amendements,stats)'
            },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const { include } = parlementaireQuerySchema.parse(request.query);

        const parlementaire = await service.getParlementaireBySlug(slug, include);

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        // Vérifier la chambre si forcée
        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        return { data: parlementaire };
      },
    });

    // ===========================================================================
    // GET /:slug/stats - Statistiques d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug/stats', {
      schema: {
        tags: [chambreLabel],
        summary: `Statistiques d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne les statistiques calculées d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const stats = await service.getParlementaireStats(parlementaire.id, parlementaire.chambre as Chambre);
        return { data: stats };
      },
    });

    // ===========================================================================
    // GET /:slug/rank - Rang dans le classement (pour deep-link + highlight)
    // ===========================================================================
    fastify.get('/:slug/rank', {
      schema: {
        tags: [chambreLabel],
        summary: `Rang d'un ${chambreLabel.toLowerCase().slice(0, -1)} dans le classement`,
        description: `Retourne la position (1-based) du parlementaire dans le classement trié et le total, pour le deep-link vers /classements.`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            sort: {
              type: 'string',
              enum: ['nom', 'prenom', 'presence', 'loyaute', 'activite', 'amendements', 'interventions'],
              default: 'presence',
            },
            order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            chambre: { type: 'string', enum: ['assemblee', 'senat'] },
            groupe: { type: 'string' },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const query = parlementaireRankQuerySchema.parse(request.query);

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const chambre = (forcedChambre || query.chambre || parlementaire.chambre) as Chambre;
        const result = await service.getParlementaireRank(slug, {
          sort: query.sort,
          order: query.order,
          chambre,
          groupe: query.groupe,
          periode: query.periode,
        });

        return { data: result };
      },
    });

    // ===========================================================================
    // GET /:slug/votes - Votes d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug/votes', {
      schema: {
        tags: [chambreLabel],
        summary: `Votes d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne l'historique des votes d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            position: { type: 'string', enum: ['pour', 'contre', 'abstention', 'absent'] },
            tag: { type: 'string', description: 'Filtrer par tag de scrutin' },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
            dissidentOnly: { type: 'boolean', default: false, description: 'Afficher uniquement les votes dissidents' },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const query = parlementaireVotesQuerySchema.parse(request.query);

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true, groupeId: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const result = await service.getParlementaireVotes(parlementaire.id, parlementaire.groupeId, query);
        return result;
      },
    });

    // ===========================================================================
    // GET /:slug/amendements - Amendements d'un parlementaire
    // ===========================================================================
    fastify.get('/:slug/amendements', {
      schema: {
        tags: [chambreLabel],
        summary: `Amendements d'un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        description: `Retourne les amendements déposés par un ${chambreLabel.toLowerCase().slice(0, -1)}`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            sort: { type: 'string', enum: ['Adopté', 'Rejeté', 'Retiré', 'Non soutenu', 'Tombé'] },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
            votedOnly: { type: 'boolean', default: false },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const { page = 1, limit = 20, sort, dateFrom, dateTo, votedOnly } = request.query as {
        page?: number; limit?: number; sort?: string;
        dateFrom?: string; dateTo?: string; votedOnly?: boolean;
      };

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        return service.getParlementaireAmendements(parlementaire.id, {
          page,
          limit,
          sort,
          dateFrom,
          dateTo,
          votedOnly,
        });
      },
    });

    // ===========================================================================
    // GET /:slug/interventions - Interventions d'un parlementaire groupées par séance
    // ===========================================================================
    fastify.get('/:slug/interventions', {
      schema: {
        tags: [chambreLabel],
        summary: `Interventions d'un ${chambreLabel.toLowerCase().slice(0, -1)} groupées par séance`,
        description: `Retourne les interventions groupées par séance avec scrutins liés`,
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
            type: {
              type: 'string',
              enum: ['question', 'intervention', 'explication_vote', 'reponse_gouvernement', 'interruption'],
            },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
          },
        },
      },
      handler: async (request, _reply) => {
        const { slug } = parlementaireParamsSchema.parse(request.params);
        const { page = 1, limit = 10, type, dateFrom, dateTo } = request.query as {
        page?: number; limit?: number; type?: string; dateFrom?: string; dateTo?: string;
      };

        const parlementaire = await fastify.prisma.parlementaire.findUnique({
          where: { slug },
          select: { id: true, chambre: true },
        });

        if (!parlementaire) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        if (forcedChambre && parlementaire.chambre !== forcedChambre) {
          throw new ApiError(404, `${chambreLabel.slice(0, -1)} non trouvé`);
        }

        const skip = (page - 1) * limit;

        const dateFilter = (dateFrom || dateTo) ? {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        } : {};

        // INTERVENTIONS_DE_FOND en premier : un `type` explicitement demandé
        // doit pouvoir l'emporter — c'est ainsi qu'on sert la section
        // « interruptions en séance », qui appelle avec type=interruption.
        const baseWhere = {
          parlementaireId: parlementaire.id,
          seanceId: { not: null },
          ...INTERVENTIONS_DE_FOND,
          ...(type && { type }),
          ...dateFilter,
        };

        // 1. Get distinct seance pages (paginated)
        const seanceRows = await fastify.prisma.intervention.findMany({
          where: baseWhere,
          distinct: ['seanceId'],
          orderBy: { date: 'desc' },
          skip,
          take: limit,
          select: { seanceId: true, date: true },
        });

        const seanceIds = seanceRows.map(s => s.seanceId).filter(Boolean) as string[];

        if (seanceIds.length === 0) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 0, hasNext: false, hasPrev: page > 1 },
          };
        }

        // 2. Get all interventions for these seances by this parlementaire
        const interventions = await fastify.prisma.intervention.findMany({
          where: {
            parlementaireId: parlementaire.id,
            seanceId: { in: seanceIds },
            ...INTERVENTIONS_DE_FOND,
            ...(type && { type }),
          },
          orderBy: [{ date: 'asc' }, { ordre: 'asc' }],
          select: {
            id: true,
            seanceId: true,
            date: true,
            type: true,
            contenu: true,
            motsCles: true,
            sourceUrl: true,
            ordre: true,
          },
        });

        // 3. Les votes auxquels ces prises de parole se rapportent.
        //
        // `intervention_scrutin` dit, pour chaque intervention, le vote qu'elle
        // a précédé et sur lequel elle porte. Sans cette table on ne savait
        // rattacher les scrutins qu'à la séance entière, par `seanceRef` ou par
        // date : Jean-Noël Barrot, le 23 juin, montrait 17 votes sous une seule
        // prise de parole, dont aucun ne s'y rapportait forcément.
        const liensFins = await fastify.prisma.interventionScrutin.findMany({
          where: { interventionId: { in: interventions.map((i) => i.id) } },
          select: { interventionId: true, scrutinId: true },
        });
        const scrutinsParIntervention = new Map<string, string[]>();
        for (const lien of liensFins) {
          const deja = scrutinsParIntervention.get(lien.interventionId) ?? [];
          deja.push(lien.scrutinId);
          scrutinsParIntervention.set(lien.interventionId, deja);
        }

        const CONTENU_PREVIEW_LENGTH = 500;
        const scrutins = await fastify.prisma.scrutin.findMany({
          where: {
            chambre: parlementaire.chambre,
            OR: [
              // Les votes rattachés nommément, d'abord : c'est la seule branche
              // qui garantit qu'un vote lié à une intervention sera bien chargé,
              // les suivantes ne servant qu'au repli.
              { id: { in: liensFins.map((l) => l.scrutinId) } },
              { seanceRef: { in: seanceIds } },
              // Le repli se cadre sur la journée, jamais sur l'horodatage : les
              // scrutins sont datés à minuit et les interventions à l'heure
              // d'ouverture de leur séance, si bien qu'une égalité stricte ne
              // rapprochait jamais rien côté Assemblée — une séance sans
              // `seanceRef` correspondant n'affichait aucun vote.
              ...seanceRows.map((r) => ({ date: journeeDeSeance(r.date) })),
            ],
          },
          select: {
            id: true,
            numero: true,
            titre: true,
            date: true,
            sort: true,
            chambre: true,
            session: true,
            seanceRef: true,
          },
        });

        // 4. Group by seanceId
        // Formes réellement poussées dans les groupes (dérivées des requêtes ci-dessus).
        type SeanceIntervention = Omit<(typeof interventions)[number], 'seanceId'> & { hasMore: boolean };
        type SeanceScrutin = Omit<(typeof scrutins)[number], 'seanceRef'>;

        const seanceMap = new Map<string, {
          seanceId: string;
          date: string;
          interventions: SeanceIntervention[];
          scrutins: SeanceScrutin[];
        }>();

        // Init with seance order from pagination
        for (const s of seanceRows) {
          if (s.seanceId) {
            seanceMap.set(s.seanceId, {
              seanceId: s.seanceId,
              date: s.date.toISOString(),
              interventions: [],
              scrutins: [],
            });
          }
        }

        // Assign interventions with truncation
        for (const i of interventions) {
          const group = i.seanceId ? seanceMap.get(i.seanceId) : null;
          if (!group) continue;
          const { contenu, seanceId: _s, ...rest } = i;
          group.interventions.push({
            ...rest,
            contenu: contenu.length > CONTENU_PREVIEW_LENGTH
              ? contenu.substring(0, CONTENU_PREVIEW_LENGTH)
              : contenu,
            hasMore: contenu.length > CONTENU_PREVIEW_LENGTH,
          });
        }

        // Les votes de chaque séance : ceux que les interventions du
        // parlementaire ont précédés, quand on le sait.
        //
        // Le repli sur la séance entière reste nécessaire — le Sénat n'a pas ce
        // rattachement, et une partie des votes de l'Assemblée ne trouve pas le
        // sien de façon certaine. Il se décide séance par séance : une séance
        // dont au moins une intervention est rattachée n'affiche que ses votes,
        // les autres continuent de montrer ceux de la journée.
        const scrutinsRattaches = new Map<string, Set<string>>();
        for (const [seanceId, group] of seanceMap) {
          const ids = new Set<string>();
          for (const i of group.interventions) {
            for (const scrutinId of scrutinsParIntervention.get(i.id) ?? []) ids.add(scrutinId);
          }
          if (ids.size > 0) scrutinsRattaches.set(seanceId, ids);
        }

        for (const s of scrutins) {
          for (const [seanceId, group] of seanceMap) {
            const rattaches = scrutinsRattaches.get(seanceId);
            const retenu = rattaches
              ? rattaches.has(s.id)
              : s.seanceRef === seanceId ||
                new Date(s.date).toDateString() === new Date(group.date).toDateString();
            if (!retenu) continue;
            // Avoid duplicate scrutins in same group
            if (!group.scrutins.some((gs) => gs.id === s.id)) {
              const { seanceRef: _r, ...scrutinData } = s;
              group.scrutins.push(scrutinData);
            }
          }
        }

        // Sort scrutins by numero within each seance
        for (const group of seanceMap.values()) {
          group.scrutins.sort((a, b) => a.numero - b.numero);
        }

        // 5. Count total distinct seances for pagination
        const totalSeances = await fastify.prisma.intervention.groupBy({
          by: ['seanceId'],
          where: baseWhere,
          _count: true,
        });
        const total = totalSeances.length;
        const totalPages = Math.ceil(total / limit);

        return {
          data: Array.from(seanceMap.values()),
          meta: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };
      },
    });
  };
}

// ===========================================================================
// ROUTES EXPORTS
// ===========================================================================

// Routes génériques pour tous les parlementaires
export const parlementairesRoutes = createParlementairesRoutes();

// Routes spécifiques pour les députés (backwards compatible)
export const deputesRoutes = createParlementairesRoutes('assemblee');

// Routes spécifiques pour les sénateurs
export const senateursRoutes = createParlementairesRoutes('senat');
