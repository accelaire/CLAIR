// =============================================================================
// Module Simulateur 2027 - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../utils/errors';
import {
  calculateMatch,
  calculateUserScores,
  determineProfilPolitique,
  generateSessionToken,
  ScoresAxes,
  AXES_LABELS,
} from './matching';

// Schemas
const startSessionSchema = z.object({
  profil: z.object({
    trancheAge: z.string().optional(),
    situation: z.string().optional(),
    localisation: z.string().optional(),
    habitat: z.string().optional(),
  }).optional(),
});

const reponseSchema = z.object({
  sessionToken: z.string(),
  questionId: z.string().uuid(),
  reponse: z.any(),
  tempsReponseMs: z.number().optional(),
});

const completeSchema = z.object({
  sessionToken: z.string(),
});

export const simulateurRoutes: FastifyPluginAsync = async (fastify) => {

  // ===========================================================================
  // POST /api/v1/simulateur/start - Démarrer une session
  // ===========================================================================
  fastify.post('/start', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Démarrer une session de simulation',
      description: 'Crée une nouvelle session et retourne les questions du quiz',
    },
  }, async (request, reply) => {
    const body = startSessionSchema.parse(request.body || {});
    const profil = body.profil || {};

    const session = await fastify.prisma.sessionSimulateur.create({
      data: {
        sessionToken: generateSessionToken(),
        userId: (request as any).user?.userId || null,
        trancheAge: profil.trancheAge,
        situation: profil.situation,
        localisation: profil.localisation,
        habitat: profil.habitat,
      },
    });

    // Récupérer les questions
    const questions = await fastify.prisma.questionSimulateur.findMany({
      where: { actif: true },
      orderBy: { ordre: 'asc' },
    });

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      questions: questions.map(q => ({
        id: q.id,
        ordre: q.ordre,
        type: q.type,
        texte: q.texte,
        contexte: q.contexte,
        optionA: q.optionA,
        optionB: q.optionB,
        labelGauche: q.labelGauche,
        labelDroite: q.labelDroite,
        options: q.options,
        citation: q.citation,
      })),
      totalQuestions: questions.length,
    };
  });

  // ===========================================================================
  // POST /api/v1/simulateur/reponse - Enregistrer une réponse
  // ===========================================================================
  fastify.post('/reponse', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Enregistrer une réponse',
      description: 'Sauvegarde la réponse à une question du quiz',
    },
  }, async (request, reply) => {
    const { sessionToken, questionId, reponse, tempsReponseMs } = reponseSchema.parse(request.body);

    const session = await fastify.prisma.sessionSimulateur.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      throw new ApiError(404, 'Session non trouvée');
    }

    if (session.statut === 'complete') {
      throw new ApiError(400, 'Session déjà terminée');
    }

    await fastify.prisma.reponseSimulateur.upsert({
      where: {
        sessionId_questionId: {
          sessionId: session.id,
          questionId,
        },
      },
      create: {
        sessionId: session.id,
        questionId,
        reponse,
        tempsReponseMs,
      },
      update: {
        reponse,
        tempsReponseMs,
      },
    });

    return { success: true };
  });

  // ===========================================================================
  // POST /api/v1/simulateur/complete - Terminer et calculer les résultats
  // ===========================================================================
  fastify.post('/complete', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Terminer la simulation',
      description: 'Calcule les résultats et retourne les matchs avec les candidats',
    },
  }, async (request, reply) => {
    const { sessionToken } = completeSchema.parse(request.body);

    const session = await fastify.prisma.sessionSimulateur.findUnique({
      where: { sessionToken },
      include: {
        reponses: {
          include: { question: true },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'Session non trouvée');
    }

    // Calculer les scores utilisateur
    const reponsesFormatted = session.reponses.map(r => ({
      reponse: r.reponse as any,
      question: {
        type: r.question.type,
        axesPoids: r.question.axesPoids as Record<string, number>,
        citationScore: r.question.citationScore || undefined,
      },
    }));

    const { scores, priorities } = calculateUserScores(reponsesFormatted);

    // Déterminer le profil politique
    const profilPolitique = determineProfilPolitique(scores);

    // Récupérer tous les candidats actifs
    const candidats = await fastify.prisma.candidat2027.findMany({
      where: { actif: true, ingestionStatus: 'published' },
    });

    // Calculer les matchs
    const resultats = candidats.map((candidat) => {
      const candidatScores: ScoresAxes = {
        economie: candidat.scoreEconomie,
        social: candidat.scoreSocial,
        ecologie: candidat.scoreEcologie,
        securite: candidat.scoreSecurite,
        europe: candidat.scoreEurope,
        immigration: candidat.scoreImmigration,
        institutions: candidat.scoreInstitutions,
        international: candidat.scoreInternational,
      };

      const match = calculateMatch(scores, priorities as any, candidatScores);

      return {
        ...match,
        candidatId: candidat.id,
        candidat,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    // Sauvegarder les résultats
    await fastify.prisma.sessionSimulateur.update({
      where: { id: session.id },
      data: {
        statut: 'complete',
        completedAt: new Date(),
        profilPolitique,
        scoresAxes: scores,
      },
    });

    // Sauvegarder les résultats par candidat
    if (resultats.length > 0) {
      await Promise.all(
        resultats.map((r) =>
          fastify.prisma.simulationResultat.upsert({
            where: {
              sessionId_candidatId: {
                sessionId: session.id,
                candidatId: r.candidatId,
              },
            },
            create: {
              sessionId: session.id,
              candidatId: r.candidatId,
              matchScore: r.matchScore,
              scoresDetail: r.scoresDetail,
              pointsForts: r.pointsForts,
              divergences: r.divergences,
            },
            update: {
              matchScore: r.matchScore,
              scoresDetail: r.scoresDetail,
              pointsForts: r.pointsForts,
              divergences: r.divergences,
            },
          })
        )
      );
    }

    return {
      profilPolitique,
      scoresAxes: scores,
      axesLabels: AXES_LABELS,
      resultats: resultats.map((r) => ({
        candidat: {
          id: r.candidat.id,
          slug: r.candidat.slug,
          nom: r.candidat.nom,
          prenom: r.candidat.prenom,
          parti: r.candidat.parti,
          photoUrl: r.candidat.photoUrl,
          coherenceScore: r.candidat.coherenceScore,
        },
        matchScore: r.matchScore,
        scoresDetail: r.scoresDetail,
        pointsForts: r.pointsForts,
        divergences: r.divergences,
      })),
    };
  });

  // ===========================================================================
  // GET /api/v1/simulateur/candidats - Liste des candidats
  // ===========================================================================
  fastify.get('/candidats', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Liste des candidats 2027',
      description: 'Retourne la liste des candidats avec leurs positions',
    },
  }, async () => {
    const candidats = await fastify.prisma.candidat2027.findMany({
      where: { actif: true },
      include: {
        positions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        depute: {
          select: { slug: true, nom: true, prenom: true },
        },
      },
      orderBy: { nom: 'asc' },
    });

    return { data: candidats };
  });

  // ===========================================================================
  // GET /api/v1/simulateur/candidats/:slug - Détail d'un candidat
  // ===========================================================================
  fastify.get('/candidats/:slug', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Détail d\'un candidat',
      description: 'Retourne les informations détaillées d\'un candidat avec toutes ses positions',
    },
  }, async (request) => {
    const { slug } = request.params as { slug: string };

    const candidat = await fastify.prisma.candidat2027.findUnique({
      where: { slug },
      include: {
        depute: {
          select: {
            id: true,
            slug: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            groupe: { select: { nom: true, couleur: true } },
          },
        },
        positions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!candidat) {
      throw new ApiError(404, 'Candidat non trouvé');
    }

    return { data: candidat };
  });

  // ===========================================================================
  // GET /api/v1/simulateur/questions - Questions du quiz
  // ===========================================================================
  fastify.get('/questions', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Liste des questions',
      description: 'Retourne toutes les questions du simulateur',
    },
  }, async () => {
    const questions = await fastify.prisma.questionSimulateur.findMany({
      where: { actif: true },
      orderBy: { ordre: 'asc' },
    });

    return { data: questions };
  });

  // ===========================================================================
  // GET /api/v1/simulateur/session/:token - Récupérer une session
  // ===========================================================================
  fastify.get('/session/:token', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Récupérer une session',
      description: 'Retourne les données d\'une session (pour reprise ou partage)',
    },
  }, async (request) => {
    const { token } = request.params as { token: string };

    const session = await fastify.prisma.sessionSimulateur.findUnique({
      where: { sessionToken: token },
      include: {
        reponses: true,
        resultats: {
          include: {
            candidat: {
              select: {
                id: true,
                slug: true,
                nom: true,
                prenom: true,
                parti: true,
                photoUrl: true,
              },
            },
          },
          orderBy: { matchScore: 'desc' },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'Session non trouvée');
    }

    return {
      data: {
        id: session.id,
        statut: session.statut,
        profilPolitique: session.profilPolitique,
        scoresAxes: session.scoresAxes,
        axesLabels: AXES_LABELS,
        reponsesCount: session.reponses.length,
        resultats: session.resultats.map(r => ({
          candidat: r.candidat,
          matchScore: r.matchScore,
          scoresDetail: r.scoresDetail,
          pointsForts: r.pointsForts,
          divergences: r.divergences,
        })),
        completedAt: session.completedAt,
        createdAt: session.createdAt,
      },
    };
  });

  // ===========================================================================
  // GET /api/v1/simulateur/stats - Statistiques nationales
  // ===========================================================================
  fastify.get('/stats', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Statistiques du simulateur',
      description: 'Retourne les statistiques agrégées des simulations',
    },
  }, async () => {
    const [totalSessions, completedSessions, profilsRaw] = await Promise.all([
      fastify.prisma.sessionSimulateur.count(),
      fastify.prisma.sessionSimulateur.count({ where: { statut: 'complete' } }),
      fastify.prisma.sessionSimulateur.groupBy({
        by: ['profilPolitique'],
        where: { statut: 'complete', profilPolitique: { not: null } },
        _count: { profilPolitique: true },
      }),
    ]);

    const profils = profilsRaw
      .filter(p => p.profilPolitique)
      .map(p => ({
        profil: p.profilPolitique,
        count: p._count.profilPolitique,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      data: {
        totalSessions,
        completedSessions,
        tauxCompletion: totalSessions > 0
          ? Math.round((completedSessions / totalSessions) * 100)
          : 0,
        repartitionProfils: profils,
      },
    };
  });

  // ===========================================================================
  // GET /api/v1/simulateur/compare - Comparer deux candidats
  // ===========================================================================
  fastify.get('/compare', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Comparer des candidats',
      description: 'Compare deux ou trois candidats sur tous les axes',
      querystring: {
        type: 'object',
        required: ['candidats'],
        properties: {
          candidats: { type: 'string', description: 'Slugs séparés par des virgules' },
        },
      },
    },
  }, async (request) => {
    const { candidats: candidatsSlugs } = request.query as { candidats: string };
    const slugs = candidatsSlugs.split(',').map(s => s.trim()).slice(0, 3);

    const candidats = await fastify.prisma.candidat2027.findMany({
      where: { slug: { in: slugs } },
      include: {
        positions: {
          where: { sourceType: 'programme' },
          take: 5,
        },
      },
    });

    if (candidats.length < 2) {
      throw new ApiError(400, 'Au moins 2 candidats requis');
    }

    // Comparer par axe
    const axes = ['economie', 'social', 'ecologie', 'securite', 'europe', 'immigration', 'institutions', 'international'] as const;

    const comparaison = axes.map(axe => ({
      axe,
      label: AXES_LABELS[axe],
      candidats: candidats.map(c => ({
        slug: c.slug,
        nom: `${c.prenom} ${c.nom}`,
        score: c[`score${axe.charAt(0).toUpperCase() + axe.slice(1)}` as keyof typeof c] as number,
      })),
    }));

    return {
      data: {
        candidats: candidats.map(c => ({
          slug: c.slug,
          nom: c.nom,
          prenom: c.prenom,
          parti: c.parti,
          photoUrl: c.photoUrl,
          coherenceScore: c.coherenceScore,
          positions: c.positions,
        })),
        comparaison,
      },
    };
  });

  // ===========================================================================
  // POST /api/v1/simulateur/vie - Life Simulator
  // ===========================================================================
  const vieSimulatorSchema = z.object({
    sessionToken: z.string().optional(),
    candidatSlug: z.string(),
    profil: z.object({
      age: z.number().min(18).max(100),
      situation: z.enum(['etudiant', 'salarie', 'independant', 'chomeur', 'retraite']),
      revenus: z.number().min(0),
      logement: z.enum(['locataire', 'proprietaire', 'heberge']),
      ville: z.string(),
      typeVille: z.enum(['grande_ville', 'ville_moyenne', 'rural']),
      voiture: z.boolean(),
      enfants: z.number().min(0).max(10),
    }),
  });

  fastify.post('/vie', {
    schema: {
      tags: ['Simulateur'],
      summary: 'Life Simulator - Impact sur ta vie',
      description: 'Simule l\'impact concret des politiques d\'un candidat sur la vie de l\'utilisateur',
    },
  }, async (request) => {
    const { candidatSlug, profil, sessionToken } = vieSimulatorSchema.parse(request.body);

    const candidat = await fastify.prisma.candidat2027.findUnique({
      where: { slug: candidatSlug },
      include: {
        positions: {
          where: { sourceType: { in: ['programme', 'vote'] } },
        },
      },
    });

    if (!candidat) {
      throw new ApiError(404, 'Candidat non trouvé');
    }

    // Calculer les impacts basés sur le profil et les positions du candidat
    const impacts = calculateLifeImpacts(profil, candidat);

    // Sauvegarder si session fournie
    if (sessionToken) {
      const session = await fastify.prisma.sessionSimulateur.findUnique({
        where: { sessionToken },
      });

      if (session) {
        await fastify.prisma.simulationVie.upsert({
          where: {
            sessionId_candidatId: {
              sessionId: session.id,
              candidatId: candidat.id,
            },
          },
          create: {
            sessionId: session.id,
            candidatId: candidat.id,
            profilUtilisateur: profil,
            impactPouvoirAchat: impacts.pouvoirAchat,
            impactSante: impacts.sante,
            impactEnvironnement: impacts.environnement,
            impactCarriere: impacts.carriere,
            impactLogement: impacts.logement,
            sources: impacts.sources,
          },
          update: {
            profilUtilisateur: profil,
            impactPouvoirAchat: impacts.pouvoirAchat,
            impactSante: impacts.sante,
            impactEnvironnement: impacts.environnement,
            impactCarriere: impacts.carriere,
            impactLogement: impacts.logement,
            sources: impacts.sources,
          },
        });
      }
    }

    return {
      data: {
        candidat: {
          slug: candidat.slug,
          nom: candidat.nom,
          prenom: candidat.prenom,
          parti: candidat.parti,
          photoUrl: candidat.photoUrl,
        },
        profil,
        impacts,
        disclaimer: "Ces projections sont des ESTIMATIONS basées sur le programme du candidat et ses votes passés. La réalité peut différer selon le contexte économique, la composition de l'Assemblée et les compromis politiques.",
      },
    };
  });
};

// =============================================================================
// Life Simulator - Calcul des impacts
// =============================================================================

interface ProfilUtilisateur {
  age: number;
  situation: 'etudiant' | 'salarie' | 'independant' | 'chomeur' | 'retraite';
  revenus: number;
  logement: 'locataire' | 'proprietaire' | 'heberge';
  ville: string;
  typeVille: 'grande_ville' | 'ville_moyenne' | 'rural';
  voiture: boolean;
  enfants: number;
}

interface Candidat {
  scoreEconomie: number;
  scoreSocial: number;
  scoreEcologie: number;
  scoreSecurite: number;
  scoreEurope: number;
  scoreImmigration: number;
  scoreInstitutions: number;
  scoreInternational: number;
  positions: Array<{
    axe: string;
    sujet: string;
    score: number;
    sourceType: string;
  }>;
}

function calculateLifeImpacts(profil: ProfilUtilisateur, candidat: Candidat) {
  // Base values (2024 reference)
  const smic2024 = 1398.69;
  const loyerMoyenParis = 1200;
  const loyerMoyenProvince = 650;
  const prixEssence = 1.85;
  const consultationMedecin = 26.50;

  // Calculate impacts based on candidate scores (-100 to +100)
  // Negative = left-leaning, Positive = right-leaning

  // Pouvoir d'achat
  const baseLoyer = profil.typeVille === 'grande_ville' ? loyerMoyenParis : loyerMoyenProvince;
  const loyerChange = candidat.scoreSocial < 0
    ? -0.10 - (Math.abs(candidat.scoreSocial) / 1000) // More regulation = lower rents
    : 0.05 + (candidat.scoreSocial / 1000); // Less regulation = higher rents

  const salaireChange = candidat.scoreEconomie > 0
    ? 0.03 + (candidat.scoreEconomie / 2000) // Liberal = slight wage growth via market
    : 0.05 + (Math.abs(candidat.scoreEconomie) / 1500); // Interventionist = wage increases via policy

  const impots = profil.revenus > 0
    ? calculateTaxImpact(profil.revenus, candidat.scoreSocial)
    : { actuel: 0, projection: 0, changement: 0 };

  const pouvoirAchat = {
    salaireActuel: profil.revenus,
    salaireProjection: Math.round(profil.revenus * (1 + salaireChange)),
    changementSalaire: Math.round(salaireChange * 100 * 10) / 10,
    loyerActuel: profil.logement === 'locataire' ? baseLoyer : 0,
    loyerProjection: profil.logement === 'locataire' ? Math.round(baseLoyer * (1 + loyerChange)) : 0,
    changementLoyer: profil.logement === 'locataire' ? Math.round(loyerChange * 100 * 10) / 10 : null,
    impotActuel: impots.actuel,
    impotProjection: impots.projection,
    changementImpot: impots.changement,
    resteAVivre: {
      actuel: profil.revenus - (profil.logement === 'locataire' ? baseLoyer : 0) - impots.actuel,
      projection: Math.round(profil.revenus * (1 + salaireChange)) -
        (profil.logement === 'locataire' ? Math.round(baseLoyer * (1 + loyerChange)) : 0) -
        impots.projection,
    },
  };

  // Santé
  const delaiRdvActuel = 45; // jours
  const delaiChange = candidat.scoreSocial < 0
    ? 0.20 // More public = longer waits initially
    : -0.10; // More private = faster access for those who pay

  const resteAChargeChange = candidat.scoreSocial < 0
    ? -0.80 // More social = better coverage
    : 0.15; // Less social = higher out-of-pocket

  const sante = {
    resteAChargeActuel: consultationMedecin,
    resteAChargeProjection: Math.max(0, Math.round(consultationMedecin * (1 + resteAChargeChange))),
    changementCharge: Math.round(resteAChargeChange * 100),
    delaiRdvActuel: delaiRdvActuel,
    delaiRdvProjection: Math.round(delaiRdvActuel * (1 + delaiChange)),
    changementDelai: Math.round(delaiChange * 100),
    explication: candidat.scoreSocial < 0
      ? "Politique de renforcement du service public de santé"
      : "Développement du secteur privé et des complémentaires",
  };

  // Environnement
  const qualiteAirActuel = profil.typeVille === 'grande_ville' ? 'Moyenne' : 'Bonne';
  const qualiteAirChange = candidat.scoreEcologie < 0 ? 1 : (candidat.scoreEcologie > 50 ? -1 : 0);
  const qualiteAirProjection = qualiteAirChange > 0
    ? (qualiteAirActuel === 'Moyenne' ? 'Bonne' : 'Très bonne')
    : (qualiteAirChange < 0 ? (qualiteAirActuel === 'Bonne' ? 'Moyenne' : qualiteAirActuel) : qualiteAirActuel);

  const prixEssenceChange = candidat.scoreEcologie < 0
    ? 0.30 + (Math.abs(candidat.scoreEcologie) / 300) // Taxe carbone = +30-60%
    : -0.05; // Moins de taxes = -5%

  const transportCommun = profil.typeVille === 'grande_ville' ? 86 : 45;
  const transportChange = candidat.scoreEcologie < 0 ? -0.35 : 0.10;

  const environnement = {
    qualiteAirActuel,
    qualiteAirProjection,
    ameliorationAir: qualiteAirChange > 0,
    prixEssenceActuel: profil.voiture ? prixEssence : null,
    prixEssenceProjection: profil.voiture ? Math.round((prixEssence * (1 + prixEssenceChange)) * 100) / 100 : null,
    changementEssence: profil.voiture ? Math.round(prixEssenceChange * 100) : null,
    transportCommunActuel: transportCommun,
    transportCommunProjection: Math.round(transportCommun * (1 + transportChange)),
    changementTransport: Math.round(transportChange * 100),
    explication: candidat.scoreEcologie < 0
      ? "Investissements massifs dans la transition écologique"
      : "Approche pragmatique privilégiant l'économie",
  };

  // Carrière
  const tauxChomageJeunes = 17.5;
  const tauxCDI = 35;
  const chomageChange = candidat.scoreEconomie > 0
    ? -0.15 // Liberal = more flexibility, potentially lower unemployment
    : -0.08; // Interventionist = slower but stable employment

  const cdiChange = candidat.scoreEconomie > 0
    ? -0.05 // More flexibility = fewer CDIs
    : 0.12; // More regulation = more CDIs

  const carriere = {
    tauxChomageActuel: tauxChomageJeunes,
    tauxChomageProjection: Math.round((tauxChomageJeunes * (1 + chomageChange)) * 10) / 10,
    changementChomage: Math.round(chomageChange * 100),
    tauxCDIActuel: tauxCDI,
    tauxCDIProjection: Math.round((tauxCDI * (1 + cdiChange)) * 10) / 10,
    changementCDI: Math.round(cdiChange * 100),
    pertinentPour: profil.situation === 'etudiant' || profil.situation === 'chomeur' || profil.age < 30,
    explication: candidat.scoreEconomie > 0
      ? "Flexibilisation du marché du travail"
      : "Renforcement des protections et du dialogue social",
  };

  // Logement
  const prixM2Paris = 10500;
  const prixM2Province = 2800;
  const basePrixM2 = profil.typeVille === 'grande_ville' ? prixM2Paris : prixM2Province;

  const prixM2Change = candidat.scoreSocial < 0
    ? -0.05 // More regulation = price control
    : 0.08; // Less regulation = price increase

  const logement = {
    prixM2Actuel: basePrixM2,
    prixM2Projection: Math.round(basePrixM2 * (1 + prixM2Change)),
    changementPrix: Math.round(prixM2Change * 100),
    aideLogement: candidat.scoreSocial < 0 ? 'Augmentation des APL' : 'Maintien du dispositif actuel',
    construction: candidat.scoreEcologie < 0
      ? 'Priorité à la rénovation énergétique'
      : 'Relance de la construction neuve',
    pertinentPour: profil.logement === 'locataire' || (profil.age < 40 && profil.logement !== 'proprietaire'),
  };

  const sources = [
    { nom: 'INSEE', url: 'https://www.insee.fr/', description: 'Données démographiques et économiques' },
    { nom: 'OFCE', url: 'https://www.ofce.sciences-po.fr/', description: 'Études d\'impact économique' },
    { nom: 'Banque de France', url: 'https://www.banque-france.fr/', description: 'Projections économiques' },
    { nom: 'Programme du candidat', url: null, description: 'Mesures annoncées officiellement' },
    { nom: 'Votes à l\'Assemblée', url: '/deputes', description: 'Historique des votes (si député)' },
  ];

  return {
    pouvoirAchat,
    sante,
    environnement,
    carriere,
    logement,
    sources,
  };
}

function calculateTaxImpact(revenus: number, scoreSocial: number): { actuel: number; projection: number; changement: number } {
  // Simplified tax calculation
  let tauxActuel = 0;
  if (revenus > 10777) tauxActuel = 0.11;
  if (revenus > 27478) tauxActuel = 0.30;
  if (revenus > 78570) tauxActuel = 0.41;
  if (revenus > 168994) tauxActuel = 0.45;

  const impotActuel = Math.round(revenus * tauxActuel / 12); // Monthly

  // Score social: negative = more redistribution, positive = less taxes for high earners
  const changementTaux = scoreSocial < 0
    ? (revenus > 50000 ? 0.15 : -0.10) // Higher taxes for rich, lower for modest
    : (revenus > 50000 ? -0.10 : 0.05); // Lower taxes for rich, slightly higher for others

  const impotProjection = Math.round(impotActuel * (1 + changementTaux));

  return {
    actuel: impotActuel,
    projection: impotProjection,
    changement: Math.round(changementTaux * 100),
  };
}
