// =============================================================================
// Label Generator - Génération de labels pour les sujets via Mistral API
// =============================================================================

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { extractYearFromTitles, slugify, detectBudgetPattern } from '../utils/text-cleaner';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

// Categories valides
const VALID_CATEGORIES = [
  'budget',
  'sante',
  'securite',
  'immigration',
  'environnement',
  'travail',
  'education',
  'justice',
  'institutions',
  'europe',
  'international',
  'agriculture',
  'logement',
  'transports',
  'culture',
  'autre',
] as const;

type Category = typeof VALID_CATEGORIES[number];

// =============================================================================
// TYPES
// =============================================================================

interface GeneratedLabel {
  slug: string;
  sujet: string;
  description: string;
  category: Category;
  needsReview?: boolean;
}

export interface LabelGenerationResult {
  total: number;
  labeled: number;
  errors: number;
  duration: string;
}

// =============================================================================
// DATABASE CLIENT
// =============================================================================

const prisma = new PrismaClient();

// =============================================================================
// MISTRAL API CLIENT
// =============================================================================

class MistralClient {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY is required for label generation');
    }
    this.apiKey = apiKey;
  }

  async generateLabel(titres: string[]): Promise<GeneratedLabel | null> {
    const prompt = this.buildPrompt(titres);

    try {
      const response = await axios.post(
        MISTRAL_API_URL,
        {
          model: MISTRAL_MODEL,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        logger.warn('Empty response from Mistral');
        return null;
      }

      return this.parseResponse(content, titres);
    } catch (error: any) {
      logger.error({
        error: error.message,
        status: error.response?.status,
      }, 'Mistral API error');
      throw error;
    }
  }

  private buildPrompt(titres: string[]): string {
    // Limiter à 20 titres pour le contexte
    const sampleTitres = titres.slice(0, 20);

    // Détecter si c'est un PLF/PLFSS pour ajouter des instructions spécifiques
    const hasPLF = titres.some(t => /projet de loi de finances/i.test(t) && !/sécurité sociale/i.test(t));
    const hasPLFSS = titres.some(t => /financement de la sécurité sociale/i.test(t));
    const yearMatch = titres.join(' ').match(/\b(202[4-9]|203[0-9])\b/);
    const detectedYear = yearMatch ? yearMatch[1] : null;

    let budgetInstructions = '';
    if (hasPLF && detectedYear) {
      budgetInstructions = `
ATTENTION: Ces scrutins concernent le PLF (Projet de Loi de Finances) ${detectedYear}.
- slug OBLIGATOIRE: "plf-${detectedYear}" ou "budget-${detectedYear}-[precision]"
- sujet OBLIGATOIRE: "Budget ${detectedYear}" ou "Budget ${detectedYear} [precision]"
- category OBLIGATOIRE: "budget"`;
    } else if (hasPLFSS && detectedYear) {
      budgetInstructions = `
ATTENTION: Ces scrutins concernent le PLFSS (Financement Sécurité Sociale) ${detectedYear}.
- slug OBLIGATOIRE: "plfss-${detectedYear}" ou "securite-sociale-${detectedYear}-[precision]"
- sujet OBLIGATOIRE: "Sécurité sociale ${detectedYear}" ou "PLFSS ${detectedYear}"
- category OBLIGATOIRE: "sante"`;
    }

    return `Tu es un expert en politique française. Analyse ces titres de scrutins parlementaires et génère UN SEUL label descriptif pour ce groupe.

SCRUTINS:
${sampleTitres.map((t, i) => `${i + 1}. ${t}`).join('\n')}
${budgetInstructions}

RÈGLES STRICTES:
1. Réponds avec UN SEUL objet JSON (pas plusieurs)
2. slug: minuscules, sans accents, tirets uniquement
3. sujet: 2-5 mots EN FRANÇAIS, court et percutant
4. description: UNE phrase EN FRANÇAIS (jamais d'anglais)
5. category: une seule valeur parmi la liste ci-dessous
6. NE PAS ajouter d'année SAUF pour PLF/PLFSS (ex: "Nationalisation ArcelorMittal" PAS "Nationalisation ArcelorMittal 2024")

CATÉGORIES: budget, sante, securite, immigration, environnement, travail, education, justice, institutions, europe, international, agriculture, logement, transports, culture, autre

JSON uniquement (pas de markdown, pas de \`\`\`):
{"slug": "...", "sujet": "...", "description": "...", "category": "..."}`;
  }

  private parseResponse(content: string, titres: string[]): GeneratedLabel | null {
    try {
      // Nettoyer le contenu: supprimer les blocs markdown
      let cleaned = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Extraire uniquement le PREMIER objet JSON complet
      // On cherche le premier { et on parse jusqu'à trouver le } correspondant
      const startIdx = cleaned.indexOf('{');
      if (startIdx === -1) {
        logger.warn({ content }, 'No JSON found in response');
        return null;
      }

      // Trouver le } correspondant en comptant les accolades
      let depth = 0;
      let endIdx = -1;
      for (let i = startIdx; i < cleaned.length; i++) {
        if (cleaned[i] === '{') depth++;
        if (cleaned[i] === '}') depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }

      if (endIdx === -1) {
        logger.warn({ content }, 'No complete JSON object found');
        return null;
      }

      const jsonStr = cleaned.substring(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonStr);

      // Valider les champs requis
      if (!parsed.slug || !parsed.sujet || !parsed.description || !parsed.category) {
        logger.warn({ parsed }, 'Missing required fields');
        return null;
      }

      // Valider la catégorie
      let category = parsed.category.toLowerCase() as Category;
      if (!VALID_CATEGORIES.includes(category)) {
        category = 'autre';
      }

      // Nettoyer le slug
      let slug = slugify(parsed.slug);

      // Détecter si c'est un budget et forcer l'année si manquante
      const budgetPattern = detectBudgetPattern(titres);
      if (budgetPattern.type && budgetPattern.year) {
        if (!slug.includes(budgetPattern.year)) {
          slug = `${budgetPattern.type.toLowerCase()}-${budgetPattern.year}`;
        }
        category = 'budget';
      }

      // Vérifier si la description est en anglais
      const englishPatterns = /\b(the|of|for|and|with|about|concerning|related|this|that|these|those)\b/i;
      const needsReview = englishPatterns.test(parsed.description);

      if (needsReview) {
        logger.warn({ slug, description: parsed.description }, 'Description might be in English');
      }

      return {
        slug,
        sujet: parsed.sujet,
        description: parsed.description,
        category,
        needsReview,
      };
    } catch (error: any) {
      logger.error({ error: error.message, content }, 'Failed to parse Mistral response');
      return null;
    }
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Génère les labels pour les sujets qui n'en ont pas encore
 */
export async function generatePendingLabels(options: {
  limit?: number;
  dryRun?: boolean;
} = {}): Promise<LabelGenerationResult> {
  const startTime = Date.now();
  const limit = options.limit; // Pas de limite par défaut
  const dryRun = options.dryRun || false;

  logger.info({ limit: limit || 'unlimited', dryRun }, 'Starting label generation');

  // Trouver les sujets avec un label temporaire (cluster-*)
  const pendingSujets = await prisma.sujet.findMany({
    where: {
      slug: { startsWith: 'cluster-' },
      actif: true,
    },
    include: {
      scrutins: {
        include: {
          scrutin: {
            select: { titre: true },
          },
        },
        take: 30,
      },
    },
    ...(limit ? { take: limit } : {}), // Pas de limite si non spécifié
  });

  if (pendingSujets.length === 0) {
    logger.info('No pending sujets to label');
    return {
      total: 0,
      labeled: 0,
      errors: 0,
      duration: '0s',
    };
  }

  logger.info({ count: pendingSujets.length }, 'Found pending sujets');

  // Récupérer tous les slugs existants pour vérifier l'unicité
  const existingSlugs = new Set(
    (await prisma.sujet.findMany({ select: { slug: true } })).map(s => s.slug)
  );

  let mistralClient: MistralClient;
  try {
    mistralClient = new MistralClient();
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize Mistral client');
    throw error;
  }

  let labeled = 0;
  let errors = 0;

  for (const sujet of pendingSujets) {
    try {
      const titres = sujet.scrutins.map(ss => ss.scrutin.titre);

      if (titres.length === 0) {
        logger.warn({ sujetId: sujet.id }, 'Sujet has no scrutins, skipping');
        continue;
      }

      logger.info({
        sujetId: sujet.id,
        currentSlug: sujet.slug,
        scrutinsCount: titres.length,
      }, 'Generating label');

      const label = await mistralClient.generateLabel(titres);

      if (!label) {
        logger.warn({ sujetId: sujet.id }, 'Failed to generate label');
        errors++;
        continue;
      }

      // Assurer l'unicité du slug
      let newSlug = label.slug;
      let counter = 1;
      while (existingSlugs.has(newSlug) && newSlug !== sujet.slug) {
        newSlug = `${label.slug}-${counter++}`;
      }
      existingSlugs.add(newSlug);

      if (!dryRun) {
        await prisma.sujet.update({
          where: { id: sujet.id },
          data: {
            slug: newSlug,
            label: label.sujet,
            description: label.description,
            category: label.category,
          },
        });

        labeled++;
        logger.info({
          sujetId: sujet.id,
          newSlug,
          label: label.sujet,
          category: label.category,
        }, 'Label generated');
      } else {
        labeled++;
        logger.info({
          sujetId: sujet.id,
          wouldBeSlug: newSlug,
          wouldBeLabel: label.sujet,
        }, 'Would generate label (dry run)');
      }

      // Rate limiting - attendre entre les requêtes
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      logger.error({
        sujetId: sujet.id,
        error: error.message,
      }, 'Error generating label');
      errors++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

  logger.info({
    total: pendingSujets.length,
    labeled,
    errors,
    duration,
  }, 'Label generation completed');

  return {
    total: pendingSujets.length,
    labeled,
    errors,
    duration,
  };
}

/**
 * Régénère le label d'un sujet spécifique
 */
export async function regenerateSujetLabel(sujetId: string): Promise<GeneratedLabel | null> {
  const sujet = await prisma.sujet.findUnique({
    where: { id: sujetId },
    include: {
      scrutins: {
        include: {
          scrutin: { select: { titre: true } },
        },
        take: 30,
      },
    },
  });

  if (!sujet) {
    throw new Error(`Sujet not found: ${sujetId}`);
  }

  const titres = sujet.scrutins.map(ss => ss.scrutin.titre);
  if (titres.length === 0) {
    throw new Error('Sujet has no scrutins');
  }

  const mistralClient = new MistralClient();
  const label = await mistralClient.generateLabel(titres);

  if (!label) {
    throw new Error('Failed to generate label');
  }

  // Vérifier unicité
  const existingSlugs = new Set(
    (await prisma.sujet.findMany({ select: { slug: true } })).map(s => s.slug)
  );
  existingSlugs.delete(sujet.slug); // Exclure le slug actuel

  let newSlug = label.slug;
  let counter = 1;
  while (existingSlugs.has(newSlug)) {
    newSlug = `${label.slug}-${counter++}`;
  }

  await prisma.sujet.update({
    where: { id: sujetId },
    data: {
      slug: newSlug,
      label: label.sujet,
      description: label.description,
      category: label.category,
    },
  });

  logger.info({ sujetId, newSlug, label: label.sujet }, 'Regenerated sujet label');

  return { ...label, slug: newSlug };
}

/**
 * Vérifie la qualité des labels existants
 */
export async function checkLabelQuality(): Promise<{
  total: number;
  temporary: number;
  possibleDuplicates: number;
  englishDescriptions: number;
}> {
  const sujets = await prisma.sujet.findMany({
    where: { actif: true },
    select: {
      slug: true,
      label: true,
      description: true,
    },
  });

  const temporary = sujets.filter(s => s.slug.startsWith('cluster-')).length;

  // Chercher les doublons potentiels (slugs très similaires)
  const slugWords = new Map<string, number>();
  for (const s of sujets) {
    const words = s.slug.split('-').filter(w => w.length > 2);
    for (const word of words) {
      slugWords.set(word, (slugWords.get(word) || 0) + 1);
    }
  }
  const possibleDuplicates = Array.from(slugWords.values()).filter(c => c > 2).length;

  // Chercher les descriptions en anglais
  const englishPatterns = /\b(the|of|for|and|with|about|concerning)\b/i;
  const englishDescriptions = sujets.filter(s =>
    s.description && englishPatterns.test(s.description)
  ).length;

  return {
    total: sujets.length,
    temporary,
    possibleDuplicates,
    englishDescriptions,
  };
}

export default {
  generatePendingLabels,
  regenerateSujetLabel,
  checkLabelQuality,
};
