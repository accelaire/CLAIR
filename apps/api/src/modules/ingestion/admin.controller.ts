// =============================================================================
// Module Admin Candidats - Controller (Routes)
// Interface d'administration pour gérer les candidats et l'ingestion
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../utils/errors';
import { updateCandidatScores, recalculateAllCandidats } from './scoring.service';

// Schemas
const createCandidatSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  parti: z.string().min(1),
  photoUrl: z.string().url().optional(),
  deputeSlug: z.string().optional(),
  programmeUrl: z.string().url().optional(),
});

const updateCandidatSchema = z.object({
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  parti: z.string().min(1).optional(),
  photoUrl: z.string().url().nullable().optional(),
  programmeUrl: z.string().url().nullable().optional(),
  actif: z.boolean().optional(),
  ingestionStatus: z.enum(['pending', 'processing', 'ready', 'published']).optional(),
});

const validatePositionSchema = z.object({
  coherent: z.boolean(),
  explication: z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const candidatsAdminRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/admin/candidats - Liste des candidats avec statut
  // ===========================================================================
  fastify.get('/candidats', {
    schema: {
      tags: ['Admin'],
      summary: 'Liste des candidats (admin)',
      description: 'Retourne tous les candidats avec leur statut d\'ingestion',
    },
  }, async () => {
    const candidats = await fastify.prisma.candidat2027.findMany({
      include: {
        depute: {
          select: { id: true, slug: true, nom: true, prenom: true },
        },
        _count: {
          select: { positions: true, ingestionLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: candidats.map((c) => ({
        id: c.id,
        slug: c.slug,
        nom: c.nom,
        prenom: c.prenom,
        parti: c.parti,
        photoUrl: c.photoUrl,
        hasDeputeLink: !!c.deputeId,
        depute: c.depute,
        scores: {
          economie: c.scoreEconomie,
          social: c.scoreSocial,
          ecologie: c.scoreEcologie,
          securite: c.scoreSecurite,
          europe: c.scoreEurope,
          immigration: c.scoreImmigration,
          institutions: c.scoreInstitutions,
          international: c.scoreInternational,
        },
        scoreType: c.scoreType,
        coherenceScore: c.coherenceScore,
        ingestionStatus: c.ingestionStatus,
        actif: c.actif,
        positionsCount: c._count.positions,
        logsCount: c._count.ingestionLogs,
        programmeUrl: c.programmeUrl,
        programmeParsedAt: c.programmeParsedAt,
        publishedAt: c.publishedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  });

  // ===========================================================================
  // POST /api/v1/admin/candidats - Créer un candidat
  // ===========================================================================
  fastify.post('/candidats', {
    schema: {
      tags: ['Admin'],
      summary: 'Créer un candidat',
      description: 'Ajoute un nouveau candidat au simulateur',
    },
  }, async (request) => {
    const body = createCandidatSchema.parse(request.body);

    // Vérifier si le slug existe déjà
    const slug = slugify(`${body.prenom}-${body.nom}`);
    const existing = await fastify.prisma.candidat2027.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ApiError(400, 'Un candidat avec ce nom existe déjà');
    }

    // Chercher le député si fourni
    let deputeId: string | null = null;
    if (body.deputeSlug) {
      const depute = await fastify.prisma.depute.findUnique({
        where: { slug: body.deputeSlug },
      });
      if (!depute) {
        throw new ApiError(404, 'Député non trouvé');
      }
      deputeId = depute.id;
    }

    const candidat = await fastify.prisma.candidat2027.create({
      data: {
        slug,
        nom: body.nom,
        prenom: body.prenom,
        parti: body.parti,
        photoUrl: body.photoUrl,
        deputeId,
        programmeUrl: body.programmeUrl,
        programme: {},
      },
      include: {
        depute: {
          select: { id: true, slug: true, nom: true, prenom: true },
        },
      },
    });

    // Si lié à un député, lancer le calcul des scores automatiquement
    if (deputeId) {
      // Lancer en background (non-bloquant)
      updateCandidatScores(fastify.prisma, candidat.id).catch((err) => {
        fastify.log.error({ err, candidatId: candidat.id }, 'Erreur calcul scores initial');
      });
    }

    return { data: candidat };
  });

  // ===========================================================================
  // GET /api/v1/admin/candidats/:id - Détail d'un candidat
  // ===========================================================================
  fastify.get('/candidats/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Détail d\'un candidat (admin)',
    },
  }, async (request) => {
    const { id } = request.params as { id: string };

    const candidat = await fastify.prisma.candidat2027.findUnique({
      where: { id },
      include: {
        depute: {
          select: { id: true, slug: true, nom: true, prenom: true },
        },
        positions: {
          orderBy: { createdAt: 'desc' },
        },
        ingestionLogs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!candidat) {
      throw new ApiError(404, 'Candidat non trouvé');
    }

    return { data: candidat };
  });

  // ===========================================================================
  // PUT /api/v1/admin/candidats/:id - Mettre à jour un candidat
  // ===========================================================================
  fastify.put('/candidats/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Mettre à jour un candidat',
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateCandidatSchema.parse(request.body);

    const candidat = await fastify.prisma.candidat2027.update({
      where: { id },
      data: body,
    });

    return { data: candidat };
  });

  // ===========================================================================
  // POST /api/v1/admin/candidats/:id/recalculate - Recalculer les scores
  // ===========================================================================
  fastify.post('/candidats/:id/recalculate', {
    schema: {
      tags: ['Admin'],
      summary: 'Recalculer les scores d\'un candidat',
      description: 'Force le recalcul des scores depuis les votes du député associé',
    },
  }, async (request) => {
    const { id } = request.params as { id: string };

    const candidat = await fastify.prisma.candidat2027.findUnique({
      where: { id },
    });

    if (!candidat) {
      throw new ApiError(404, 'Candidat non trouvé');
    }

    // Mettre à jour le statut
    await fastify.prisma.candidat2027.update({
      where: { id },
      data: { ingestionStatus: 'processing' },
    });

    // Lancer le recalcul
    const result = await updateCandidatScores(fastify.prisma, id);

    return {
      data: {
        scores: result.scores,
        coherenceScore: result.coherenceScore,
        scoreType: result.scoreType,
        votesAnalyzed: result.votesAnalyzed,
      },
    };
  });

  // ===========================================================================
  // POST /api/v1/admin/candidats/:id/publish - Publier un candidat
  // ===========================================================================
  fastify.post('/candidats/:id/publish', {
    schema: {
      tags: ['Admin'],
      summary: 'Publier un candidat',
      description: 'Rend le candidat visible dans le simulateur',
    },
  }, async (request) => {
    const { id } = request.params as { id: string };

    const candidat = await fastify.prisma.candidat2027.update({
      where: { id },
      data: {
        ingestionStatus: 'published',
        publishedAt: new Date(),
        actif: true,
      },
    });

    return { data: candidat };
  });

  // ===========================================================================
  // POST /api/v1/admin/candidats/recalculate-all - Recalculer tous les candidats
  // ===========================================================================
  fastify.post('/candidats/recalculate-all', {
    schema: {
      tags: ['Admin'],
      summary: 'Recalculer tous les candidats',
      description: 'Force le recalcul des scores de tous les candidats actifs',
    },
  }, async () => {
    const result = await recalculateAllCandidats(fastify.prisma);

    return {
      data: result,
    };
  });

  // ===========================================================================
  // GET /api/v1/admin/validation-queue - File de validation
  // ===========================================================================
  fastify.get('/validation-queue', {
    schema: {
      tags: ['Admin'],
      summary: 'File de validation',
      description: 'Positions et déclarations en attente de validation',
    },
  }, async () => {
    // Positions incohérentes à valider
    const incoherentPositions = await fastify.prisma.positionCandidat.findMany({
      where: {
        coherent: false,
      },
      include: {
        candidat: {
          select: { id: true, slug: true, nom: true, prenom: true, parti: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Items dans la queue de validation
    const pendingValidation = await fastify.prisma.validationQueue.findMany({
      where: { status: 'pending' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      data: {
        incoherentPositions,
        pendingValidation,
        counts: {
          incoherent: incoherentPositions.length,
          pending: pendingValidation.length,
        },
      },
    };
  });

  // ===========================================================================
  // POST /api/v1/admin/positions/:id/validate - Valider une position
  // ===========================================================================
  fastify.post('/positions/:id/validate', {
    schema: {
      tags: ['Admin'],
      summary: 'Valider une position',
      description: 'Marque une position comme cohérente ou confirme l\'incohérence',
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { coherent, explication } = validatePositionSchema.parse(request.body);

    const position = await fastify.prisma.positionCandidat.update({
      where: { id },
      data: {
        coherent,
        explication: explication || null,
      },
    });

    return { data: position };
  });

  // ===========================================================================
  // GET /api/v1/admin/ingestion-logs - Logs d'ingestion
  // ===========================================================================
  fastify.get('/ingestion-logs', {
    schema: {
      tags: ['Admin'],
      summary: 'Logs d\'ingestion',
      description: 'Historique des opérations d\'ingestion',
      querystring: {
        type: 'object',
        properties: {
          candidatId: { type: 'string' },
          type: { type: 'string' },
          limit: { type: 'number', default: 50 },
        },
      },
    },
  }, async (request) => {
    const { candidatId, type, limit = 50 } = request.query as {
      candidatId?: string;
      type?: string;
      limit?: number;
    };

    const logs = await fastify.prisma.ingestionLog.findMany({
      where: {
        ...(candidatId && { candidatId }),
        ...(type && { type }),
      },
      include: {
        candidat: {
          select: { id: true, slug: true, nom: true, prenom: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return { data: logs };
  });

  // ===========================================================================
  // GET /api/v1/admin/deputes/search - Rechercher un député pour liaison
  // ===========================================================================
  fastify.get('/deputes/search', {
    schema: {
      tags: ['Admin'],
      summary: 'Rechercher un député',
      description: 'Recherche un député pour le lier à un candidat',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2 },
        },
      },
    },
  }, async (request) => {
    const { q } = request.query as { q: string };

    const deputes = await fastify.prisma.depute.findMany({
      where: {
        OR: [
          { nom: { contains: q, mode: 'insensitive' } },
          { prenom: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        slug: true,
        nom: true,
        prenom: true,
        groupe: { select: { nom: true } },
        candidat2027: { select: { id: true } },
      },
      take: 20,
    });

    return {
      data: deputes.map((d) => ({
        ...d,
        alreadyLinked: !!d.candidat2027,
      })),
    };
  });

  // ===========================================================================
  // POST /api/v1/admin/candidats/:id/link-depute - Lier un député
  // ===========================================================================
  fastify.post('/candidats/:id/link-depute', {
    schema: {
      tags: ['Admin'],
      summary: 'Lier un député à un candidat',
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { deputeId } = request.body as { deputeId: string };

    // Vérifier que le député n'est pas déjà lié
    const existing = await fastify.prisma.candidat2027.findFirst({
      where: {
        deputeId,
        id: { not: id },
      },
    });

    if (existing) {
      throw new ApiError(400, 'Ce député est déjà lié à un autre candidat');
    }

    const candidat = await fastify.prisma.candidat2027.update({
      where: { id },
      data: { deputeId },
      include: {
        depute: {
          select: { id: true, slug: true, nom: true, prenom: true },
        },
      },
    });

    // Lancer le calcul des scores
    updateCandidatScores(fastify.prisma, id).catch((err) => {
      fastify.log.error({ err, candidatId: id }, 'Erreur calcul scores après liaison');
    });

    return { data: candidat };
  });
};
