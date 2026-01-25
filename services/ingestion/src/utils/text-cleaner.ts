// =============================================================================
// Text Cleaner - Extraction et nettoyage de texte pour embeddings
// =============================================================================

/**
 * Patterns syntaxiques à supprimer des titres de scrutins
 * Ces éléments n'apportent pas de valeur sémantique pour le clustering
 */
const NOISE_PATTERNS = [
  // Procédures et lectures
  /\s*-\s*(?:première|deuxième|troisième|nouvelle)\s+lecture\s*/gi,
  /\s*\(\s*(?:première|deuxième|troisième|nouvelle)\s+lecture\s*\)\s*/gi,
  /\s*(?:en\s+)?(?:première|seconde|nouvelle)\s+lecture\s*/gi,

  // Articles et amendements
  /\s*-\s*article\s+\d+[a-z]*\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)?\s*/gi,
  /\s*-\s*amendement(?:s)?\s+(?:n[°o°]\s*)?[\d\w\-,\s]+(?:rect\.?)?\s*/gi,
  /\s*amendement(?:s)?\s+(?:n[°o°]\s*)?[\d\w\-]+\s*/gi,
  /\s*sur\s+l['']amendement\s+(?:n[°o°]\s*)?[\d\w\-]+\s*/gi,

  // Références légales
  /\s*-\s*texte\s+(?:n[°o°]\s*)?\d+\s*/gi,
  /\s*-\s*(?:ta|an)\s*\d+\s*/gi,
  /\s*\(\s*(?:ta|an)\s*\d+\s*\)\s*/gi,

  // Numéros de scrutin
  /\s*scrutin\s+(?:n[°o°]\s*)?\d+\s*/gi,

  // Procédures spéciales
  /\s*motion\s+de\s+(?:rejet\s+préalable|renvoi\s+en\s+commission|censure)\s*/gi,
  /\s*(?:ensemble|sur l['']ensemble)\s+(?:du|de la|des)\s+(?:projet|proposition)\s*/gi,
  /\s*vote\s+(?:solennel\s+)?sur\s+(?:l['']ensemble|le\s+texte)\s*/gi,

  // Expressions procédurales
  /\s*présenté(?:e|s)?\s+par\s+[^,]+(?:,\s*(?:MM?\.|Mme|Mmes)[^,]+)*/gi,
  /\s*déposé(?:e|s)?\s+par\s+[^,]+/gi,
  /\s*et\s+plusieurs\s+de\s+ses\s+collègues\s*/gi,
  /\s*au\s+nom\s+de\s+la\s+commission\s+\w+\s*/gi,
  /\s*au\s+nom\s+du\s+groupe\s+\w+\s*/gi,
  /\s*tendant\s+à\s*/gi,

  // Ponctuation excessive
  /\s*-+\s*/g,
  /\s*–+\s*/g,
  /\s+,\s+,\s+/g,
  /\s*[,;:]+\s*$/g,
  /^\s*[,;:]+\s*/g,
];

/**
 * Extrait le sujet principal d'un titre de scrutin
 * Supprime le bruit syntaxique pour ne garder que le contenu sémantique
 */
export function extractSujet(titre: string): string {
  let result = titre;

  // Appliquer tous les patterns de nettoyage
  for (const pattern of NOISE_PATTERNS) {
    result = result.replace(pattern, ' ');
  }

  // Nettoyer les espaces multiples
  result = result.replace(/\s+/g, ' ').trim();

  // Si le résultat est trop court, retourner le titre original nettoyé basiquement
  if (result.length < 10) {
    return titre.replace(/\s+/g, ' ').trim();
  }

  return result;
}

/**
 * Construit le texte d'embedding à partir d'un scrutin
 * Combine le titre nettoyé avec le contexte du dossier si disponible
 */
export function buildEmbeddingText(scrutin: {
  titre: string;
  objetLibelle?: string | null;
  dossier?: {
    titre?: string | null;
    titreCourt?: string | null;
  } | null;
}): string {
  const parts: string[] = [];

  // 1. Titre nettoyé du scrutin
  const cleanedTitle = extractSujet(scrutin.titre);
  parts.push(cleanedTitle);

  // 2. Objet du vote si différent du titre
  if (scrutin.objetLibelle) {
    const cleanedObjet = extractSujet(scrutin.objetLibelle);
    // N'ajouter que si ça apporte du contexte
    if (cleanedObjet.length > 10 && !cleanedTitle.includes(cleanedObjet)) {
      parts.push(cleanedObjet);
    }
  }

  // 3. Titre du dossier législatif si disponible
  if (scrutin.dossier?.titreCourt || scrutin.dossier?.titre) {
    const dossierTitle = scrutin.dossier.titreCourt || scrutin.dossier.titre;
    if (dossierTitle && !cleanedTitle.toLowerCase().includes(dossierTitle.toLowerCase())) {
      parts.push(dossierTitle);
    }
  }

  return parts.join(' - ');
}

/**
 * Détecte si un ensemble de titres correspond à un pattern budget
 * Retourne le type (PLF, PLFSS) et l'année si détecté
 */
export function detectBudgetPattern(titres: string[]): {
  type: 'PLF' | 'PLFSS' | null;
  year: string | null;
} {
  const yearPattern = /\b(202[4-9]|203[0-9])\b/;
  const plfPattern = /\b(?:PLF|projet\s+de\s+loi\s+de\s+finances)\b/i;
  const plfssPattern = /\b(?:PLFSS|financement\s+de\s+la\s+sécurité\s+sociale)\b/i;

  let plfCount = 0;
  let plfssCount = 0;
  const years = new Set<string>();

  for (const titre of titres) {
    if (plfPattern.test(titre)) plfCount++;
    if (plfssPattern.test(titre)) plfssCount++;

    const yearMatch = titre.match(yearPattern);
    if (yearMatch) years.add(yearMatch[1]);
  }

  // Majorité de PLF ou PLFSS ?
  const threshold = titres.length * 0.5;

  if (plfssCount >= threshold) {
    return {
      type: 'PLFSS',
      year: years.size === 1 ? Array.from(years)[0] : null,
    };
  }

  if (plfCount >= threshold) {
    return {
      type: 'PLF',
      year: years.size === 1 ? Array.from(years)[0] : null,
    };
  }

  return { type: null, year: null };
}

/**
 * Extrait l'année d'un ensemble de titres (pour les budgets)
 */
export function extractYearFromTitles(titres: string[]): string | null {
  const yearPattern = /\b(202[4-9]|203[0-9])\b/;
  const years = new Map<string, number>();

  for (const titre of titres) {
    const match = titre.match(yearPattern);
    if (match) {
      const year = match[1];
      years.set(year, (years.get(year) || 0) + 1);
    }
  }

  // Retourner l'année la plus fréquente
  if (years.size === 0) return null;

  let maxYear = null;
  let maxCount = 0;
  for (const [year, count] of years) {
    if (count > maxCount) {
      maxYear = year;
      maxCount = count;
    }
  }

  return maxYear;
}

/**
 * Génère un slug à partir d'un label
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export default {
  extractSujet,
  buildEmbeddingText,
  detectBudgetPattern,
  extractYearFromTitles,
  slugify,
};
