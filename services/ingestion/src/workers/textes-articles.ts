// =============================================================================
// Worker — Texte des articles des textes législatifs (AN)
// =============================================================================
//
// Alimente `textes_articles` à partir des `texteRef` déjà présents sur les
// amendements. Sans cette table, un scrutin portant sur « l'article 15 » n'a
// aucune matière : le résumé IA n'a que le numéro de l'article, et l'invente.
//
// Périmètre : Assemblée nationale uniquement. Les `texteRef` du Sénat suivent
// un autre schéma (`SENAT-TXT-105426`) que la source AN ne sert pas.
//
// Idempotence : chaque exécution recalcule l'état complet d'un texte. Les
// articles qui n'existent plus dans la version publiée sont supprimés, sans
// quoi un article renuméroté resterait affiché indéfiniment. Un texte déjà
// ingéré est ignoré sauf `force` — les versions publiées ne bougent plus une
// fois le texte voté, l'intérêt d'un rafraîchissement systématique est nul et
// le CDN de l'AN throttle au-delà de quelques dizaines de requêtes.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { fetchTexteArticles } from '../sources/assemblee-nationale/textes-client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';

const prisma = new PrismaClient();

/** Le CDN de l'AN throttle les rafales : une requête à la fois, espacée. */
const DELAY_BETWEEN_FETCHES_MS = 400;

export interface TextesArticlesSyncOptions {
  /** Ne traiter que ce texte. */
  texteRef?: string;
  /** Nombre maximum de textes traités. */
  limit?: number;
  /** Retraiter les textes déjà en base. */
  force?: boolean;
  dryRun?: boolean;
}

export interface TextesArticlesSyncResult {
  textesConsideres: number;
  textesTraites: number;
  textesIgnores: number;
  /** Textes que la source ne sert pas (404/500) — tout le Sénat en fait partie. */
  textesNonServis: number;
  /** Textes servis mais bâtis sur un gabarit non couvert (budgets). */
  textesGabaritInconnu: number;
  /** `texteRef` des textes au gabarit non couvert, pour mesurer le trou. */
  refsGabaritInconnu: string[];
  articlesCrees: number;
  articlesMisAJour: number;
  articlesSupprimes: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Textes AN à ingérer, du plus amendé au moins amendé.
 *
 * L'ordre n'est pas cosmétique : il fait porter les premiers appels sur les
 * textes les plus discutés, donc les scrutins les plus consultés. Un `--limit`
 * couvre ainsi le trafic réel plutôt qu'un échantillon arbitraire. Le `texteRef`
 * départage pour que deux exécutions traitent la même chose.
 */
async function selectTexteRefs(
  options: TextesArticlesSyncOptions
): Promise<{ texteRef: string; legislature: number; dossierId: string | null }[]> {
  if (options.texteRef) {
    const sample = await prisma.amendement.findFirst({
      where: { texteRef: options.texteRef },
      select: { texteRef: true, legislature: true, dossierId: true },
    });
    if (!sample?.texteRef) return [];
    return [
      { texteRef: sample.texteRef, legislature: sample.legislature, dossierId: sample.dossierId },
    ];
  }

  const rows = await prisma.$queryRaw<
    { texte_ref: string; legislature: number; dossier_id: string | null }[]
  >`
    SELECT DISTINCT ON (a.texte_ref)
           a.texte_ref, a.legislature, a.dossier_id
    FROM amendements a
    WHERE a.chambre = 'assemblee'
      AND a.texte_ref IS NOT NULL
    ORDER BY a.texte_ref, a.dossier_id NULLS LAST
  `;

  const counts = await prisma.amendement.groupBy({
    by: ['texteRef'],
    where: { chambre: 'assemblee', texteRef: { not: null } },
    _count: { _all: true },
  });
  const countByRef = new Map(counts.map((c) => [c.texteRef!, c._count._all]));

  return rows
    .map((r) => ({
      texteRef: r.texte_ref,
      legislature: r.legislature,
      dossierId: r.dossier_id,
    }))
    .sort((a, b) => {
      const diff = (countByRef.get(b.texteRef) ?? 0) - (countByRef.get(a.texteRef) ?? 0);
      return diff !== 0 ? diff : a.texteRef.localeCompare(b.texteRef);
    });
}

export async function syncTextesArticles(
  options: TextesArticlesSyncOptions = {}
): Promise<TextesArticlesSyncResult> {
  const { force = false, dryRun = false, limit } = options;
  logger.info({ ...options }, 'Starting textes-articles sync...');

  const result: TextesArticlesSyncResult = {
    textesConsideres: 0,
    textesTraites: 0,
    textesIgnores: 0,
    textesNonServis: 0,
    textesGabaritInconnu: 0,
    refsGabaritInconnu: [],
    articlesCrees: 0,
    articlesMisAJour: 0,
    articlesSupprimes: 0,
  };

  const candidates = await selectTexteRefs(options);
  result.textesConsideres = candidates.length;

  const dejaIngeres = force
    ? new Set<string>()
    : new Set(
        (
          await prisma.texteArticle.groupBy({ by: ['texteRef'] })
        ).map((row) => row.texteRef)
      );

  let traites = 0;
  for (const candidate of candidates) {
    if (limit !== undefined && traites >= limit) break;

    if (dejaIngeres.has(candidate.texteRef)) {
      result.textesIgnores++;
      continue;
    }

    traites++;
    const fetched = await fetchTexteArticles(candidate.texteRef);
    await sleep(DELAY_BETWEEN_FETCHES_MS);

    if (fetched.status === 'unavailable') {
      result.textesNonServis++;
      continue;
    }
    if (fetched.status === 'unparsed') {
      result.textesGabaritInconnu++;
      result.refsGabaritInconnu.push(candidate.texteRef);
      continue;
    }

    result.textesTraites++;
    if (dryRun) {
      result.articlesCrees += fetched.articles.length;
      continue;
    }

    for (const article of fetched.articles) {
      const data = {
        libelle: article.libelle,
        ordre: article.ordre,
        contenu: article.contenu,
        chambre: 'assemblee',
        legislature: candidate.legislature,
        dossierId: candidate.dossierId,
        sourceUrl: fetched.sourceUrl,
      };
      try {
        const upserted = await prisma.texteArticle.upsert({
          where: { texteRef_numero: { texteRef: candidate.texteRef, numero: article.numero } },
          create: { texteRef: candidate.texteRef, numero: article.numero, ...data },
          update: data,
          select: { createdAt: true, updatedAt: true },
        });
        if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
          result.articlesCrees++;
        } else {
          result.articlesMisAJour++;
        }
      } catch (error) {
        logger.warn(
          { texteRef: candidate.texteRef, article: article.numero, error: errorMessage(error) },
          'Échec upsert article'
        );
      }
    }

    // Un article disparu de la version publiée doit disparaître de la base.
    const numerosPublies = fetched.articles.map((a) => a.numero);
    const supprimes = await prisma.texteArticle.deleteMany({
      where: { texteRef: candidate.texteRef, numero: { notIn: numerosPublies } },
    });
    result.articlesSupprimes += supprimes.count;
  }

  logger.info({ ...result }, 'Textes-articles sync completed');
  return result;
}
