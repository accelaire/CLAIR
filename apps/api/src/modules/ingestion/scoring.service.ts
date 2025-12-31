// =============================================================================
// Service de Scoring des Candidats
// Calcule les scores sur les 8 axes à partir des votes des députés
// =============================================================================

import { PrismaClient } from '@prisma/client';

export interface ScoresAxes {
  economie: number;
  social: number;
  ecologie: number;
  securite: number;
  europe: number;
  immigration: number;
  institutions: number;
  international: number;
}

// Mapping des scrutins vers les axes politiques
// Chaque scrutin important est tagué avec son impact sur chaque axe
// Score positif = droite/libéral, Score négatif = gauche/interventionniste

// Ce mapping sera enrichi manuellement ou via interface admin
// Pour le MVP, on utilise une heuristique basée sur les mots-clés des scrutins
const SCRUTINS_KEYWORDS_MAPPING: Record<string, Partial<ScoresAxes>> = {
  // Économie
  'taxe': { economie: -30 },
  'impôt': { economie: -40 },
  'budget': { economie: 20 },
  'privatisation': { economie: 80 },
  'nationalisation': { economie: -80 },
  'smic': { social: -60, economie: -40 },
  'entreprise': { economie: 30 },
  'libéralisation': { economie: 70 },
  'régulation': { economie: -50 },

  // Social
  'retraite': { social: 40 },
  'apl': { social: -50 },
  'allocations': { social: -40 },
  'solidarité': { social: -50 },
  'chômage': { social: -30 },
  'santé': { social: -20 },
  'hôpital': { social: -30 },
  'protection sociale': { social: -60 },

  // Écologie
  'carbone': { ecologie: -60, economie: -20 },
  'climat': { ecologie: -70 },
  'nucléaire': { ecologie: 40 },
  'énergies renouvelables': { ecologie: -60 },
  'biodiversité': { ecologie: -50 },
  'pollution': { ecologie: -40 },
  'transport': { ecologie: -30 },
  'pesticide': { ecologie: -60 },

  // Sécurité
  'police': { securite: 60 },
  'sécurité': { securite: 50 },
  'surveillance': { securite: 70 },
  'terrorisme': { securite: 60 },
  'peine': { securite: 50 },
  'prison': { securite: 40 },
  'libertés': { securite: -50 },
  'vie privée': { securite: -60 },

  // Europe
  'europe': { europe: 50 },
  'européen': { europe: 40 },
  'bruxelles': { europe: 30 },
  'traité': { europe: 50 },
  'souveraineté': { europe: -60 },

  // Immigration
  'immigration': { immigration: 50 },
  'étranger': { immigration: 40 },
  'asile': { immigration: -40 },
  'frontière': { immigration: 50 },
  'expulsion': { immigration: 70 },
  'régularisation': { immigration: -60 },
  'naturalisation': { immigration: -40 },

  // Institutions
  'constitution': { institutions: 30 },
  'référendum': { institutions: -40 },
  'parlement': { institutions: 20 },
  'décentralisation': { institutions: -30 },
  'réforme institutionnelle': { institutions: -50 },

  // International
  'défense': { international: 50 },
  'otan': { international: 50 },
  'armée': { international: 40 },
  'intervention': { international: 30 },
  'multilatéral': { international: -40 },
  'onu': { international: -30 },
};

/**
 * Calcule les scores d'un candidat à partir des votes de son député associé
 */
export async function calculateScoresFromVotes(
  prisma: PrismaClient,
  deputeId: string
): Promise<{ scores: ScoresAxes; votesAnalyzed: number }> {
  // Récupérer tous les votes du député avec les détails du scrutin
  const votes = await prisma.vote.findMany({
    where: {
      deputeId,
      position: { in: ['pour', 'contre'] }, // Ignorer abstentions et non-votants
    },
    include: {
      scrutin: true,
    },
  });

  // Initialiser les scores et compteurs
  const scores: ScoresAxes = {
    economie: 0,
    social: 0,
    ecologie: 0,
    securite: 0,
    europe: 0,
    immigration: 0,
    institutions: 0,
    international: 0,
  };

  const counts: Record<keyof ScoresAxes, number> = {
    economie: 0,
    social: 0,
    ecologie: 0,
    securite: 0,
    europe: 0,
    immigration: 0,
    institutions: 0,
    international: 0,
  };

  let votesAnalyzed = 0;

  for (const vote of votes) {
    const titre = vote.scrutin.titre.toLowerCase();
    const multiplier = vote.position === 'pour' ? 1 : -1;

    // Trouver les axes impactés par ce scrutin via mots-clés
    let axesImpacted = false;

    for (const [keyword, impacts] of Object.entries(SCRUTINS_KEYWORDS_MAPPING)) {
      if (titre.includes(keyword.toLowerCase())) {
        axesImpacted = true;

        for (const [axe, impact] of Object.entries(impacts)) {
          const axeKey = axe as keyof ScoresAxes;
          scores[axeKey] += impact * multiplier;
          counts[axeKey] += 1;
        }
      }
    }

    if (axesImpacted) {
      votesAnalyzed++;
    }
  }

  // Normaliser les scores entre -100 et +100
  for (const axe of Object.keys(scores) as (keyof ScoresAxes)[]) {
    if (counts[axe] > 0) {
      scores[axe] = Math.round(scores[axe] / counts[axe]);
      scores[axe] = Math.max(-100, Math.min(100, scores[axe]));
    }
  }

  return { scores, votesAnalyzed };
}

/**
 * Calcule le score de cohérence entre les positions déclarées et les votes réels
 */
export async function calculateCoherence(
  prisma: PrismaClient,
  candidatId: string
): Promise<{ score: number; details: { coherent: number; incoherent: number; total: number } }> {
  const candidat = await prisma.candidat2027.findUnique({
    where: { id: candidatId },
    include: {
      positions: true,
      depute: {
        include: {
          votes: {
            include: {
              scrutin: true,
            },
            take: 500, // Derniers 500 votes
            orderBy: { scrutin: { date: 'desc' } },
          },
        },
      },
    },
  });

  if (!candidat?.depute) {
    return { score: 100, details: { coherent: 0, incoherent: 0, total: 0 } };
  }

  let coherent = 0;
  let incoherent = 0;

  // Pour chaque position déclarée (programme ou déclaration)
  for (const position of candidat.positions) {
    if (position.sourceType !== 'programme' && position.sourceType !== 'declaration') {
      continue;
    }

    // Chercher des votes liés au même sujet
    type VoteWithScrutin = typeof candidat.depute.votes[number];
    const relatedVotes = candidat.depute.votes.filter((vote: VoteWithScrutin) => {
      const titre = vote.scrutin.titre.toLowerCase();
      const sujet = position.sujet.toLowerCase();
      return titre.includes(sujet) || sujet.split(' ').some((mot: string) => mot.length > 4 && titre.includes(mot));
    });

    if (relatedVotes.length === 0) continue;

    // Vérifier la cohérence
    for (const vote of relatedVotes) {
      const positionScore = position.score;
      const voteScore = vote.position === 'pour' ? 50 : -50;

      // Si le signe est le même, c'est cohérent
      const isCoherent = (positionScore >= 0 && voteScore >= 0) || (positionScore < 0 && voteScore < 0);

      if (isCoherent) {
        coherent++;
      } else {
        incoherent++;

        // Mettre à jour la position comme incohérente
        await prisma.positionCandidat.update({
          where: { id: position.id },
          data: {
            coherent: false,
            explication: `Incohérence détectée avec le vote sur "${vote.scrutin.titre}"`,
          },
        });
      }
    }
  }

  const total = coherent + incoherent;
  const score = total > 0 ? Math.round((coherent / total) * 100) : 100;

  return { score, details: { coherent, incoherent, total } };
}

/**
 * Met à jour les scores d'un candidat
 */
export async function updateCandidatScores(
  prisma: PrismaClient,
  candidatId: string
): Promise<{
  scores: ScoresAxes;
  coherenceScore: number;
  scoreType: 'verified' | 'estimated';
  votesAnalyzed: number;
}> {
  const candidat = await prisma.candidat2027.findUnique({
    where: { id: candidatId },
    include: { depute: true },
  });

  if (!candidat) {
    throw new Error('Candidat non trouvé');
  }

  // Créer un log d'ingestion
  const log = await prisma.ingestionLog.create({
    data: {
      candidatId,
      type: 'scores',
      status: 'started',
      startedAt: new Date(),
    },
  });

  try {
    let scores: ScoresAxes;
    let scoreType: 'verified' | 'estimated' = 'estimated';
    let votesAnalyzed = 0;

    // Si le candidat est lié à un député, calculer depuis les votes
    if (candidat.deputeId) {
      const result = await calculateScoresFromVotes(prisma, candidat.deputeId);
      scores = result.scores;
      votesAnalyzed = result.votesAnalyzed;

      // Si on a analysé suffisamment de votes, marquer comme vérifié
      if (votesAnalyzed >= 20) {
        scoreType = 'verified';
      }
    } else {
      // Sinon, estimer depuis les positions du programme
      scores = await estimateScoresFromPositions(prisma, candidatId);
    }

    // Calculer la cohérence
    const coherence = await calculateCoherence(prisma, candidatId);

    // Mettre à jour le candidat
    await prisma.candidat2027.update({
      where: { id: candidatId },
      data: {
        scoreEconomie: scores.economie,
        scoreSocial: scores.social,
        scoreEcologie: scores.ecologie,
        scoreSecurite: scores.securite,
        scoreEurope: scores.europe,
        scoreImmigration: scores.immigration,
        scoreInstitutions: scores.institutions,
        scoreInternational: scores.international,
        scoreType,
        coherenceScore: coherence.score,
        ingestionStatus: 'ready',
      },
    });

    // Marquer le log comme complété
    await prisma.ingestionLog.update({
      where: { id: log.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: JSON.parse(JSON.stringify({
          scores,
          coherence: coherence.details,
          votesAnalyzed,
        })),
      },
    });

    return {
      scores,
      coherenceScore: coherence.score,
      scoreType,
      votesAnalyzed,
    };
  } catch (error) {
    // Marquer le log comme échoué
    await prisma.ingestionLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
    });

    throw error;
  }
}

/**
 * Estime les scores à partir des positions du programme (pour candidats sans historique de votes)
 */
async function estimateScoresFromPositions(
  prisma: PrismaClient,
  candidatId: string
): Promise<ScoresAxes> {
  const positions = await prisma.positionCandidat.findMany({
    where: { candidatId },
  });

  const scores: ScoresAxes = {
    economie: 0,
    social: 0,
    ecologie: 0,
    securite: 0,
    europe: 0,
    immigration: 0,
    institutions: 0,
    international: 0,
  };

  const counts: Record<keyof ScoresAxes, number> = { ...scores };

  for (const position of positions) {
    const axe = position.axe as keyof ScoresAxes;
    if (axe in scores) {
      scores[axe] += position.score;
      counts[axe] += 1;
    }
  }

  // Normaliser
  for (const axe of Object.keys(scores) as (keyof ScoresAxes)[]) {
    if (counts[axe] > 0) {
      scores[axe] = Math.round(scores[axe] / counts[axe]);
      scores[axe] = Math.max(-100, Math.min(100, scores[axe]));
    }
  }

  return scores;
}

/**
 * Recalcule les scores de tous les candidats actifs
 */
export async function recalculateAllCandidats(prisma: PrismaClient): Promise<{
  processed: number;
  success: number;
  failed: number;
}> {
  const candidats = await prisma.candidat2027.findMany({
    where: { actif: true },
  });

  let success = 0;
  let failed = 0;

  for (const candidat of candidats) {
    try {
      await updateCandidatScores(prisma, candidat.id);
      success++;
    } catch (error) {
      console.error(`Erreur recalcul ${candidat.nom}:`, error);
      failed++;
    }
  }

  return {
    processed: candidats.length,
    success,
    failed,
  };
}
