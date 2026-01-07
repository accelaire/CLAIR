// =============================================================================
// Simulateur 2027 - Algorithme de matching
// =============================================================================

export interface ScoresAxes {
  economie: number;      // -100 (interventionniste) à +100 (libéral)
  social: number;        // -100 (redistribution) à +100 (responsabilité)
  ecologie: number;      // -100 (transition forte) à +100 (pragmatisme)
  securite: number;      // -100 (libertés) à +100 (autorité)
  europe: number;        // -100 (souverainisme) à +100 (fédéralisme)
  immigration: number;   // -100 (ouverture) à +100 (restriction)
  institutions: number;  // -100 (réforme) à +100 (stabilité)
  international: number; // -100 (multilatéralisme) à +100 (indépendance)
}

export interface MatchResult {
  candidatId: string;
  matchScore: number;
  scoresDetail: Record<string, number>;
  pointsForts: string[];
  divergences: string[];
}

export interface ReponseWithQuestion {
  reponse: any;
  question: {
    type: string;
    axesPoids: Record<string, number>;
    citationScore?: number;
  };
}

// Noms des axes en français pour l'affichage
export const AXES_LABELS: Record<keyof ScoresAxes, string> = {
  economie: 'Économie',
  social: 'Social',
  ecologie: 'Écologie',
  securite: 'Sécurité',
  europe: 'Europe',
  immigration: 'Immigration',
  institutions: 'Institutions',
  international: 'International',
};

// Profils politiques basés sur les scores
const PROFILS_POLITIQUES = [
  {
    nom: 'Social-démocrate',
    conditions: (s: ScoresAxes) => s.economie < 0 && s.social < 0 && s.ecologie < 30,
  },
  {
    nom: 'Écolo-progressiste',
    conditions: (s: ScoresAxes) => s.ecologie < -30 && s.social < 0,
  },
  {
    nom: 'Libéral-progressiste',
    conditions: (s: ScoresAxes) => s.economie > 30 && s.social > 0 && s.securite < 0,
  },
  {
    nom: 'Conservateur-libéral',
    conditions: (s: ScoresAxes) => s.economie > 30 && s.securite > 30,
  },
  {
    nom: 'Souverainiste',
    conditions: (s: ScoresAxes) => s.europe < -30 && s.immigration > 30,
  },
  {
    nom: 'Centriste',
    conditions: (s: ScoresAxes) =>
      Math.abs(s.economie) < 30 && Math.abs(s.social) < 30,
  },
  {
    nom: 'Réformiste social-écologique',
    conditions: (s: ScoresAxes) => s.ecologie < 0 && s.social < 0 && s.institutions < 0,
  },
  {
    nom: 'Républicain social',
    conditions: (s: ScoresAxes) => s.securite > 0 && s.social < 0 && s.economie < 30,
  },
];

/**
 * Calcule le match entre un utilisateur et un candidat
 */
export function calculateMatch(
  userScores: ScoresAxes,
  userPriorities: Record<keyof ScoresAxes, number>,
  candidatScores: ScoresAxes
): Omit<MatchResult, 'candidatId'> {
  const axes = Object.keys(userScores) as (keyof ScoresAxes)[];

  let totalDistance = 0;
  let totalWeight = 0;
  const scoresDetail: Record<string, number> = {};
  const pointsForts: string[] = [];
  const divergences: string[] = [];

  for (const axe of axes) {
    const userScore = userScores[axe];
    const candidatScore = candidatScores[axe];
    const priority = userPriorities[axe] || 3;

    // Distance normalisée (0-200 max)
    const distance = Math.abs(userScore - candidatScore);
    const similarity = Math.round(100 - (distance / 2));

    scoresDetail[axe] = similarity;

    // Pondération
    totalDistance += distance * priority;
    totalWeight += 200 * priority;

    // Identifier points forts et divergences
    if (similarity >= 75) {
      pointsForts.push(axe);
    } else if (similarity < 45) {
      divergences.push(axe);
    }
  }

  // Score final (0-100)
  const matchScore = Math.round(100 - (totalDistance / totalWeight) * 100);

  return {
    matchScore,
    scoresDetail,
    pointsForts,
    divergences,
  };
}

/**
 * Calcule les scores utilisateur à partir des réponses au quiz
 */
export function calculateUserScores(
  reponses: ReponseWithQuestion[]
): { scores: ScoresAxes; priorities: Record<string, number> } {
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
  const priorities: Record<string, number> = {
    economie: 3,
    social: 3,
    ecologie: 3,
    securite: 3,
    europe: 3,
    immigration: 3,
    institutions: 3,
    international: 3,
  };

  for (const reponse of reponses) {
    const question = reponse.question;
    const axesPoids = question.axesPoids || {};

    let impact = 0;

    switch (question.type) {
      case 'dilemme':
        // Option A = -100, Option B = +100, NSP = 0
        impact = reponse.reponse.choix === 'A' ? -100
               : reponse.reponse.choix === 'B' ? 100
               : 0;
        break;

      case 'curseur':
        // Valeur de 0 à 100, convertie en -100 à +100
        impact = (reponse.reponse.valeur - 50) * 2;
        break;

      case 'classement':
        // Les questions de classement définissent les priorités
        const ordre = reponse.reponse.ordre as string[];
        if (ordre && Array.isArray(ordre)) {
          ordre.forEach((axe, index) => {
            priorities[axe] = 5 - index; // Premier = 5, dernier = 1
          });
        }
        continue; // Pas d'impact sur les scores

      case 'citation':
        // Accord = direction de la citation, désaccord = inverse
        const citationScore = question.citationScore || 100;
        impact = reponse.reponse.accord === 'oui' ? citationScore
               : reponse.reponse.accord === 'non' ? -citationScore
               : 0;
        break;
    }

    // Appliquer l'impact aux axes concernés
    for (const [axe, poids] of Object.entries(axesPoids)) {
      const axeKey = axe as keyof ScoresAxes;
      if (axeKey in scores) {
        scores[axeKey] += impact * (poids as number);
        counts[axeKey]++;
      }
    }
  }

  // Moyenner les scores et clamp
  for (const axe of Object.keys(scores) as (keyof ScoresAxes)[]) {
    if (counts[axe] > 0) {
      scores[axe] = Math.round(scores[axe] / counts[axe]);
      scores[axe] = Math.max(-100, Math.min(100, scores[axe]));
    }
  }

  return { scores, priorities };
}

/**
 * Détermine le profil politique à partir des scores
 */
export function determineProfilPolitique(scores: ScoresAxes): string {
  for (const profil of PROFILS_POLITIQUES) {
    if (profil.conditions(scores)) {
      return profil.nom;
    }
  }
  return 'Inclassable';
}

/**
 * Génère un token de session unique
 */
export function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
