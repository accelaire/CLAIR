// =============================================================================
// IA Enrichment Worker — Enrichit les entités parlementaires via Mistral LLM
// Batch processing pour éviter les OOM en prod (6GB heap max)
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import pLimit from 'p-limit';
import { CLAIRMistralClient } from '../llm/mistral-client.js';
import { computeContentHash } from '../llm/content-hash.js';
import { cleanLLMOutput } from '../llm/clean-output.js';
import {
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_DOSSIER,
  SYSTEM_PROMPT_SUJET,
  SYSTEM_PROMPT_SUJET_GROUPES,
  buildScrutinResumePrompt,
  buildDossierResumePrompt,
  buildSujetResumePrompt,
  buildGroupeAmendementPrompt,
} from '../llm/prompts.js';
import { logger } from '../utils/logger.js';
import { errorMessage } from '../utils/errors.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

/** Nombre d'articles transmis au LLM pour illustrer les positions nuancées. */
const MAX_ARTICLES_PROMPT = 5;

/**
 * Score de clivage d'un scrutin : nombre de voix exprimées hors de la position
 * majoritaire de l'hémicycle. Une abstention de groupe face à une majorité "pour"
 * compte donc comme un clivage, contrairement à un simple écart pour/contre.
 */
function scoreClivage(groupes: { pour: bigint; contre: bigint; abstention: bigint }[]): number {
  let pour = 0, contre = 0, abstention = 0;
  for (const g of groupes) {
    pour += Number(g.pour);
    contre += Number(g.contre);
    abstention += Number(g.abstention);
  }
  const total = pour + contre + abstention;
  return total - Math.max(pour, contre, abstention);
}

export interface EnrichmentResult {
  enriched: number;
  skipped: number;
  errors: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

export interface EnrichmentOptions {
  limit?: number;
  dryRun?: boolean;
  concurrency?: number;
  force?: boolean;
  /** Parlementaires only: regenerate a random sample of N active fiches (ORDER BY random()). */
  randomSample?: number;
  /** Parlementaires + randomSample only: exclude fiches enrichies dans les N derniers jours (défaut 3). */
  skipRecentDays?: number;
  /**
   * Restreint le balayage à des entités précises (uid de dossier, slug de sujet).
   * Permet de corriger une fiche fautive sans relancer tout le corpus — un
   * `--force` global coûte plusieurs milliers d'appels LLM.
   */
  only?: string[];
}

// =============================================================================
// SCRUTINS
// =============================================================================

export async function enrichScrutinsIA(options: EnrichmentOptions = {}): Promise<EnrichmentResult> {
  const { limit, dryRun = false, concurrency = 3, force = false } = options;

  const result: EnrichmentResult = {
    enriched: 0, skipped: 0, errors: 0, totalTokensIn: 0, totalTokensOut: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not set — skipping IA enrichment');
    return result;
  }

  const mistral = new CLAIRMistralClient();
  const limiter = pLimit(concurrency);

  logger.info({ dryRun, concurrency, limit, force }, 'Starting scrutins IA enrichment...');

  // `limit` borne le nombre de fiches RÉGÉNÉRÉES, pas le nombre examinées : les
  // fiches inchangées ne doivent pas le consommer. Le budget est décrémenté au
  // plus près de l'appel LLM (pas de `await` entre le test et la décrémentation,
  // donc pas de dépassement malgré la parallélisation).
  let budget = limit ?? Infinity;
  let offset = 0;

  // On balaie TOUT le corpus, pas seulement les non-enrichis : c'est le hash de
  // contenu qui décide de régénérer ou non. Filtrer sur `resumeIA: null` rendait
  // le hash inatteignable — une fiche générée une fois ne repassait jamais, même
  // après changement de son contenu source.
  // Le balayage impose une pagination explicite (`offset`) et un tri TOTAL : sans
  // départage, deux lignes de même date peuvent s'échanger entre deux pages et
  // l'une d'elles n'est jamais examinée.
  while (budget > 0) {
    const scrutins = await prisma.scrutin.findMany({
      select: {
        id: true,
        titre: true,
        sort: true,
        typeVote: true,
        objetLibelle: true,
        tags: true,
        iaContentHash: true,
        dossier: { select: { titre: true } },
        amendements: {
          select: { numero: true, exposeSommaire: true, dispositif: true },
          take: 3,
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: BATCH_SIZE,
    });

    if (scrutins.length === 0) break;

    const tasks = scrutins.map(scrutin =>
      limiter(async () => {
        try {
          const amendementsHash = scrutin.amendements
            .map(a => `${a.numero}:${a.exposeSommaire ?? ''}:${a.dispositif ?? ''}`)
            .join('|');
          const contentHash = computeContentHash(
            scrutin.titre, scrutin.sort, scrutin.typeVote,
            scrutin.objetLibelle, scrutin.tags?.join(','), amendementsHash,
            // Le titre du dossier est injecté dans le prompt : un scrutin
            // rattaché à un autre dossier change de contexte, donc de résumé.
            scrutin.dossier?.titre ?? '',
          );

          if (!force && scrutin.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

          // Quota atteint : ni régénéré, ni comptabilisé comme inchangé.
          if (budget <= 0) return;
          budget--;

          if (dryRun) {
            result.enriched++;
            return;
          }

          const userPrompt = buildScrutinResumePrompt({
            titre: scrutin.titre,
            sort: scrutin.sort,
            typeVote: scrutin.typeVote,
            objetLibelle: scrutin.objetLibelle,
            tags: scrutin.tags,
            dossierTitre: scrutin.dossier?.titre,
            amendements: scrutin.amendements,
          });

          const resumeIA = cleanLLMOutput(await mistral.complete(SYSTEM_PROMPT, userPrompt));

          await prisma.scrutin.update({
            where: { id: scrutin.id },
            data: { resumeIA, iaContentHash: contentHash, iaGeneratedAt: new Date() },
          });

          result.enriched++;
        } catch (error) {
          result.errors++;
          logger.warn({ scrutinId: scrutin.id, error: errorMessage(error) }, 'Failed to enrich scrutin');
        }
      })
    );

    await Promise.all(tasks);
    // `limit` borne le nombre de fiches RÉGÉNÉRÉES, pas le nombre examinées :
    // sinon les fiches inchangées le consommeraient sans rien produire.
    offset += scrutins.length;

    logger.info({ processed: result.enriched + result.skipped + result.errors, offset, budget }, 'Scrutins batch processed');
    if (scrutins.length < BATCH_SIZE) break;
  }

  result.totalTokensIn = mistral.totalTokensIn;
  result.totalTokensOut = mistral.totalTokensOut;

  logger.info({
    enriched: result.enriched, skipped: result.skipped, errors: result.errors,
    tokensIn: result.totalTokensIn, tokensOut: result.totalTokensOut,
  }, 'Scrutins IA enrichment completed');

  return result;
}

// =============================================================================
// DOSSIERS LÉGISLATIFS
// =============================================================================

export async function enrichDossiersIA(options: EnrichmentOptions = {}): Promise<EnrichmentResult> {
  const { limit, dryRun = false, concurrency = 2, force = false, only } = options;

  const result: EnrichmentResult = {
    enriched: 0, skipped: 0, errors: 0, totalTokensIn: 0, totalTokensOut: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not set — skipping IA enrichment');
    return result;
  }

  const mistral = new CLAIRMistralClient();
  const limiter = pLimit(concurrency);

  logger.info({ dryRun, concurrency, limit, force }, 'Starting dossiers IA enrichment...');

  // Voir enrichScrutinsIA : balayage complet, le hash arbitre. Le filtre sur
  // l'existence de scrutins reste — un dossier sans vote n'a rien à résumer.
  // `only` cible des uid de dossier.
  const where: Prisma.DossierLegislatifWhereInput = {
    scrutins: { some: {} },
    ...(only && only.length > 0 ? { uid: { in: only } } : {}),
  };

  // `limit` borne le nombre de fiches RÉGÉNÉRÉES, pas le nombre examinées : les
  // fiches inchangées ne doivent pas le consommer. Le budget est décrémenté au
  // plus près de l'appel LLM (pas de `await` entre le test et la décrémentation,
  // donc pas de dépassement malgré la parallélisation).
  let budget = limit ?? Infinity;
  let offset = 0;

  while (budget > 0) {
    const dossiers = await prisma.dossierLegislatif.findMany({
      where,
      select: {
        id: true,
        uid: true,
        titre: true,
        titreCourt: true,
        procedureLibelle: true,
        etat: true,
        iaContentHash: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: BATCH_SIZE,
    });

    if (dossiers.length === 0) break;

    const tasks = dossiers.map(dossier =>
      limiter(async () => {
        try {
          const scrutinsClefs = await prisma.scrutin.findMany({
            where: { dossierId: dossier.id },
            select: { id: true, titre: true, sort: true, typeVote: true, resumeIA: true },
            // `id` départage : le tri alimente le hash ET la sélection des 10
            // scrutins clefs, deux ex æquo qui permutent suffiraient à faire
            // croire à un changement de contenu.
            orderBy: [{ typeVote: 'asc' }, { importance: 'desc' }, { id: 'asc' }],
            take: 10,
          });

          type GroupeRow = { nom: string; nom_complet: string | null; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };
          type ArticleRow = { scrutin_id: string; article: string; sort: string; nom: string; nom_complet: string | null; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };

          // Votes sur l'ensemble du texte (solennel OU ordinaire avec "ensemble" dans le titre)
          const positionsEnsemble = await prisma.$queryRaw<GroupeRow[]>`
            SELECT gp.nom, gp.nom_complet, gp.slug, gp.position as orientation,
              SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
              SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
              SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
            FROM votes v
            JOIN parlementaires p ON p.id = v.parlementaire_id
            JOIN groupes_politiques gp ON gp.id = p.groupe_id
            JOIN scrutins s ON s.id = v.scrutin_id
            WHERE s.dossier_id = ${dossier.id}
              AND (s.type_vote = 'solennel' OR s.titre ILIKE '%ensemble%')
              AND v.position != 'absent'
            GROUP BY gp.nom, gp.nom_complet, gp.slug, gp.position
            ORDER BY (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                      SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
                      SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)) DESC
          `;

          // Votes sur les articles clés (top 5 articles les plus votés).
          // L'abstention compte dans le seuil et le tri : une abstention de groupe EST une
          // position politique. L'exclure faisait disparaître du prompt les groupes qui
          // s'abstenaient en bloc, et le modèle leur inventait alors un vote.
          const votesArticlesRaw = await prisma.$queryRaw<ArticleRow[]>`
            SELECT s.id as scrutin_id, s.titre as article, s.sort,
              gp.nom, gp.nom_complet, gp.slug, gp.position as orientation,
              SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
              SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
              SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
            FROM votes v
            JOIN parlementaires p ON p.id = v.parlementaire_id
            JOIN groupes_politiques gp ON gp.id = p.groupe_id
            JOIN scrutins s ON s.id = v.scrutin_id
            WHERE s.dossier_id = ${dossier.id}
              AND s.titre ILIKE '%article%'
              AND s.titre NOT ILIKE '%amendement%'
              AND s.titre NOT ILIKE '%ensemble%'
              AND v.position != 'absent'
            GROUP BY s.id, s.titre, s.sort, gp.nom, gp.nom_complet, gp.slug, gp.position
            HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                   SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
                   SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END) > 1
            ORDER BY s.id, (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                            SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
                            SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)) DESC
          `;

          // Regrouper par scrutin pour les articles
          const articlesMap = new Map<string, { article: string; sort: string; groupes: GroupeRow[] }>();
          for (const row of votesArticlesRaw) {
            if (!articlesMap.has(row.scrutin_id)) {
              articlesMap.set(row.scrutin_id, { article: row.article, sort: row.sort, groupes: [] });
            }
            articlesMap.get(row.scrutin_id)!.groupes.push(row);
          }
          // Prendre les articles les plus clivants
          const votesArticles = [...articlesMap.values()]
            .sort((a, b) => scoreClivage(b.groupes) - scoreClivage(a.groupes) || a.article.localeCompare(b.article))
            .slice(0, MAX_ARTICLES_PROMPT);

          // Amendements clés : adoptés en priorité, puis rejetés, avec exposé sommaire
          const amendementsClefs = await prisma.amendement.findMany({
            where: { dossierId: dossier.id, exposeSommaire: { not: null } },
            select: { numero: true, exposeSommaire: true, auteurLibelle: true, sort: true },
            orderBy: [{ sort: 'asc' }, { dateDepot: 'desc' }, { id: 'asc' }],
            take: 8,
          });

          const ensembleForHash = positionsEnsemble.map(g => `ens:${g.slug}:${g.pour}:${g.contre}:${g.abstention}`).join('|');
          const articlesForHash = votesArticles
            .map(a => `art:${a.article.slice(0, 30)}:${a.groupes.map(g => `${g.slug}:${g.pour}/${g.contre}/${g.abstention}`).join(',')}`)
            .join('|');
          // Tout ce qui entre dans le prompt doit entrer dans le hash, sinon un
          // changement de contenu source ne déclenche aucune régénération.
          const amendementsForHash = amendementsClefs
            .map(a => `amd:${a.numero}:${a.sort ?? ''}`)
            .join('|');
          const hashParts = [
            dossier.titre,
            dossier.titreCourt,
            dossier.procedureLibelle,
            dossier.etat,
            scrutinsClefs.map(s => `${s.sort}:${s.resumeIA ?? s.titre}`).join('|'),
            ensembleForHash,
            articlesForHash,
            amendementsForHash,
          ];
          const contentHash = computeContentHash(...hashParts);

          if (!force && dossier.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

          // Quota atteint : ni régénéré, ni comptabilisé comme inchangé.
          if (budget <= 0) return;
          budget--;

          if (dryRun) {
            result.enriched++;
            return;
          }

          const toGroupeArray = (rows: GroupeRow[]) => rows.map(g => ({
            nom: g.nom, nomComplet: g.nom_complet, slug: g.slug,
            pour: Number(g.pour), contre: Number(g.contre), abstention: Number(g.abstention),
            orientation: g.orientation,
          }));

          const chambre = dossier.uid.startsWith('SENAT') ? 'senat' : 'assemblee';
          const userPrompt = buildDossierResumePrompt({
            titre: dossier.titre,
            titreCourt: dossier.titreCourt,
            chambre,
            procedureLibelle: dossier.procedureLibelle,
            etat: dossier.etat,
            scrutinsResumes: scrutinsClefs.map(s => ({
              titre: s.titre, sort: s.sort, typeVote: s.typeVote, resumeIA: s.resumeIA,
            })),
            positionsEnsemble: toGroupeArray(positionsEnsemble),
            votesArticles: votesArticles.map(va => ({
              article: va.article,
              sort: va.sort,
              groupes: toGroupeArray(va.groupes),
            })),
            amendementsClefs: amendementsClefs.map(a => ({
              numero: a.numero, exposeSommaire: a.exposeSommaire,
              auteurLibelle: a.auteurLibelle, sort: a.sort,
            })),
          });

          const response = await mistral.complete(SYSTEM_PROMPT_DOSSIER, userPrompt, { maxTokens: 1024 });
          const resumeIA = cleanLLMOutput(response.replace(/\n*---POSITIONS---\n*/g, '\n\n'));

          await prisma.dossierLegislatif.update({
            where: { id: dossier.id },
            data: { resumeIA, iaContentHash: contentHash, iaGeneratedAt: new Date() },
          });

          result.enriched++;
        } catch (error) {
          result.errors++;
          logger.warn({ dossierId: dossier.id, error: errorMessage(error) }, 'Failed to enrich dossier');
        }
      })
    );

    await Promise.all(tasks);
    offset += dossiers.length;

    logger.info({ processed: result.enriched + result.skipped + result.errors, offset, budget }, 'Dossiers batch processed');
    if (dossiers.length < BATCH_SIZE) break;
  }

  result.totalTokensIn = mistral.totalTokensIn;
  result.totalTokensOut = mistral.totalTokensOut;

  logger.info({
    enriched: result.enriched, skipped: result.skipped, errors: result.errors,
    tokensIn: result.totalTokensIn, tokensOut: result.totalTokensOut,
  }, 'Dossiers IA enrichment completed');

  return result;
}

// =============================================================================
// SUJETS PARLEMENTAIRES
// =============================================================================

export async function enrichSujetsIA(options: EnrichmentOptions = {}): Promise<EnrichmentResult> {
  const { limit, dryRun = false, concurrency = 2, force = false, only } = options;

  const result: EnrichmentResult = {
    enriched: 0, skipped: 0, errors: 0, totalTokensIn: 0, totalTokensOut: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not set — skipping IA enrichment');
    return result;
  }

  const mistral = new CLAIRMistralClient();
  const limiter = pLimit(concurrency);

  logger.info({ dryRun, concurrency, limit, force }, 'Starting sujets IA enrichment...');

  // Voir enrichScrutinsIA : balayage complet, le hash arbitre.
  // `only` cible des slugs de sujet.
  const where: Prisma.SujetWhereInput = {
    dossiers: { some: {} },
    ...(only && only.length > 0 ? { slug: { in: only } } : {}),
  };

  // `limit` borne le nombre de fiches RÉGÉNÉRÉES, pas le nombre examinées : les
  // fiches inchangées ne doivent pas le consommer. Le budget est décrémenté au
  // plus près de l'appel LLM (pas de `await` entre le test et la décrémentation,
  // donc pas de dépassement malgré la parallélisation).
  let budget = limit ?? Infinity;
  let offset = 0;

  while (budget > 0) {
    const sujets = await prisma.sujet.findMany({
      where,
      select: {
        id: true,
        label: true,
        description: true,
        category: true,
        status: true,
        iaContentHash: true,
      },
      orderBy: [{ scrutinCount: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: BATCH_SIZE,
    });

    if (sujets.length === 0) break;

    const tasks = sujets.map(sujet =>
      limiter(async () => {
        try {
          const dossiers = await prisma.dossierLegislatif.findMany({
            where: { sujetId: sujet.id },
            select: { id: true, uid: true, titre: true, etat: true, resumeIA: true },
            // Ordre imposé : ces lignes alimentent le hash, un ordre non
            // déterministe le ferait varier à contenu identique.
            orderBy: { uid: 'asc' },
          });

          const dossierIds = dossiers.map(d => d.id);

          type SujetGroupeRow = { nom: string; nom_complet: string | null; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };
          type SujetArticleRow = { scrutin_id: string; article: string; sort: string; nom: string; nom_complet: string | null; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };

          // Votes sur l'ensemble du texte (solennel OU ordinaire avec "ensemble" dans le titre)
          const positionsEnsemble = dossierIds.length > 0
            ? await prisma.$queryRaw<SujetGroupeRow[]>`
                SELECT gp.nom, gp.nom_complet, gp.slug, gp.position as orientation,
                  SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
                  SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
                  SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
                FROM votes v
                JOIN parlementaires p ON p.id = v.parlementaire_id
                JOIN groupes_politiques gp ON gp.id = p.groupe_id
                JOIN scrutins s ON s.id = v.scrutin_id
                WHERE s.dossier_id = ANY(${dossierIds})
                  AND (s.type_vote = 'solennel' OR s.titre ILIKE '%ensemble%')
                  AND v.position != 'absent'
                GROUP BY gp.nom, gp.nom_complet, gp.slug, gp.position
                ORDER BY (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                          SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
                          SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)) DESC
              `
            : [];

          // Votes sur les articles clés, les plus clivants d'abord.
          // L'abstention compte dans le seuil et le tri (cf. scoreClivage) : sans ça,
          // un groupe qui s'abstient en bloc disparaît du prompt et le modèle lui
          // invente une position.
          const votesArticlesRaw = dossierIds.length > 0
            ? await prisma.$queryRaw<SujetArticleRow[]>`
                SELECT s.id as scrutin_id, s.titre as article, s.sort,
                  gp.nom, gp.nom_complet, gp.slug, gp.position as orientation,
                  SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
                  SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
                  SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
                FROM votes v
                JOIN parlementaires p ON p.id = v.parlementaire_id
                JOIN groupes_politiques gp ON gp.id = p.groupe_id
                JOIN scrutins s ON s.id = v.scrutin_id
                WHERE s.dossier_id = ANY(${dossierIds})
                  AND s.titre ILIKE '%article%'
                  AND s.titre NOT ILIKE '%amendement%'
                  AND s.titre NOT ILIKE '%ensemble%'
                  AND v.position != 'absent'
                GROUP BY s.id, s.titre, s.sort, gp.nom, gp.nom_complet, gp.slug, gp.position
                HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                       SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
                       SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END) > 1
                ORDER BY s.id, (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                                SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) +
                                SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)) DESC
              `
            : [];

          const articlesMap = new Map<string, { article: string; sort: string; groupes: SujetGroupeRow[] }>();
          for (const row of votesArticlesRaw) {
            if (!articlesMap.has(row.scrutin_id)) {
              articlesMap.set(row.scrutin_id, { article: row.article, sort: row.sort, groupes: [] });
            }
            articlesMap.get(row.scrutin_id)!.groupes.push(row);
          }
          const votesArticles = [...articlesMap.values()]
            .sort((a, b) => scoreClivage(b.groupes) - scoreClivage(a.groupes) || a.article.localeCompare(b.article))
            .slice(0, MAX_ARTICLES_PROMPT);

          const ensembleForHash = positionsEnsemble.map(g => `ens:${g.slug}:${g.pour}:${g.contre}:${g.abstention}`).join('|');
          const articlesForHash = votesArticles
            .map(a => `art:${a.article.slice(0, 30)}:${a.groupes.map(g => `${g.slug}:${g.pour}/${g.contre}/${g.abstention}`).join(',')}`)
            .join('|');
          // `etat` et `chambre` sont injectés par dossier dans le prompt
          // (« Sénat [en_cours] : … ») : les omettre ici fige le résumé sur
          // l'état d'avancement du jour de sa génération. C'est ce qui laissait
          // des textes promulgués annoncer un examen « encore en cours ».
          const dossiersForHash = dossiers
            .map(d => {
              const chambre = d.uid.startsWith('SENAT') ? 'senat' : 'assemblee';
              return `${chambre}:${d.etat ?? ''}:${d.titre}:${d.resumeIA ?? ''}`;
            })
            .join('|');
          const hashParts = [
            sujet.label,
            sujet.status,
            sujet.description,
            sujet.category,
            dossiersForHash,
            ensembleForHash,
            articlesForHash,
          ];
          const contentHash = computeContentHash(...hashParts);

          if (!force && sujet.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

          // Quota atteint : ni régénéré, ni comptabilisé comme inchangé.
          if (budget <= 0) return;
          budget--;

          if (dryRun) {
            result.enriched++;
            return;
          }

          const toGroupeArray = (rows: SujetGroupeRow[]) => rows.map(g => ({
            nom: g.nom, nomComplet: g.nom_complet, slug: g.slug,
            pour: Number(g.pour), contre: Number(g.contre), abstention: Number(g.abstention),
            orientation: g.orientation,
          }));

          const userPrompt = buildSujetResumePrompt({
            label: sujet.label,
            description: sujet.description,
            category: sujet.category,
            status: sujet.status,
            dossiersResumes: dossiers.map(d => ({
              titre: d.titre,
              chambre: d.uid.startsWith('SENAT') ? 'senat' : 'assemblee',
              etat: d.etat,
              resumeIA: d.resumeIA,
            })),
            positionsEnsemble: toGroupeArray(positionsEnsemble),
            votesArticles: votesArticles.map(va => ({
              article: va.article,
              sort: va.sort,
              groupes: toGroupeArray(va.groupes),
            })),
          });

          const response = await mistral.complete(SYSTEM_PROMPT_SUJET, userPrompt, { maxTokens: 1024 });

          const resumeSep = '---RESUME---';
          const enjeuxSep = '---ENJEUX---';
          const resumeSepIdx = response.indexOf(resumeSep);
          const enjeuxSepIdx = response.indexOf(enjeuxSep);

          let labelIA: string | null = null;
          let resume: string;
          let enjeux: string | null = null;

          if (resumeSepIdx !== -1 && enjeuxSepIdx !== -1) {
            labelIA = response.slice(0, resumeSepIdx).trim();
            resume = cleanLLMOutput(response.slice(resumeSepIdx + resumeSep.length, enjeuxSepIdx));
            enjeux = cleanLLMOutput(response.slice(enjeuxSepIdx + enjeuxSep.length));
          } else if (enjeuxSepIdx !== -1) {
            resume = cleanLLMOutput(response.slice(0, enjeuxSepIdx));
            enjeux = cleanLLMOutput(response.slice(enjeuxSepIdx + enjeuxSep.length));
          } else {
            resume = cleanLLMOutput(response);
            logger.warn({ sujetId: sujet.id }, 'Sujet response missing separators');
          }

          if (labelIA && labelIA.length > 2 && labelIA.length < 120 && !labelIA.startsWith('---')) {
            logger.debug({ sujetId: sujet.id, oldLabel: sujet.label, newLabel: labelIA }, 'Sujet label updated');
          } else {
            labelIA = null;
          }

          await prisma.sujet.update({
            where: { id: sujet.id },
            data: {
              ...(labelIA ? { label: labelIA } : {}),
              resume,
              enjeux,
              iaContentHash: contentHash,
              iaGeneratedAt: new Date(),
            },
          });

          result.enriched++;
        } catch (error) {
          result.errors++;
          logger.warn({ sujetId: sujet.id, error: errorMessage(error) }, 'Failed to enrich sujet');
        }
      })
    );

    await Promise.all(tasks);
    offset += sujets.length;

    logger.info({ processed: result.enriched + result.skipped + result.errors, offset, budget }, 'Sujets batch processed');
    if (sujets.length < BATCH_SIZE) break;
  }

  result.totalTokensIn = mistral.totalTokensIn;
  result.totalTokensOut = mistral.totalTokensOut;

  logger.info({
    enriched: result.enriched, skipped: result.skipped, errors: result.errors,
    tokensIn: result.totalTokensIn, tokensOut: result.totalTokensOut,
  }, 'Sujets IA enrichment completed');

  return result;
}

// =============================================================================
// SUJETS — DESCRIPTIONS AMENDEMENTS PAR GROUPE
// =============================================================================

export async function enrichSujetGroupeAmendements(options: EnrichmentOptions = {}): Promise<EnrichmentResult> {
  const { limit, dryRun = false, concurrency = 2, force = false } = options;

  const result: EnrichmentResult = {
    enriched: 0, skipped: 0, errors: 0, totalTokensIn: 0, totalTokensOut: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not set — skipping groupe amendement enrichment');
    return result;
  }

  const mistral = new CLAIRMistralClient();
  const limiter = pLimit(concurrency);

  logger.info({ dryRun, concurrency, limit, force }, 'Starting groupe amendement descriptions enrichment...');

  // Voir enrichScrutinsIA : balayage complet, le hash arbitre.
  const where: Prisma.SujetWhereInput = { dossiers: { some: { amendements: { some: {} } } } };

  // `limit` borne le nombre de fiches RÉGÉNÉRÉES, pas le nombre examinées : les
  // fiches inchangées ne doivent pas le consommer. Le budget est décrémenté au
  // plus près de l'appel LLM (pas de `await` entre le test et la décrémentation,
  // donc pas de dépassement malgré la parallélisation).
  let budget = limit ?? Infinity;
  let offset = 0;

  while (budget > 0) {
    const sujets = await prisma.sujet.findMany({
      where,
      select: {
        id: true,
        label: true,
        iaGroupeAmendementHash: true,
      },
      orderBy: [{ scrutinCount: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: BATCH_SIZE,
    });

    if (sujets.length === 0) break;

    const tasks = sujets.map(sujet =>
      limiter(async () => {
        try {
          const amendements = await prisma.$queryRaw<Array<{
            groupe_nom: string;
            groupe_slug: string;
            groupe_chambre: string;
            numero: string;
            expose_sommaire: string | null;
            sort: string | null;
          }>>`
            SELECT
              gp.nom as groupe_nom,
              gp.slug as groupe_slug,
              gp.chambre as groupe_chambre,
              a.numero,
              a.expose_sommaire,
              a.sort
            FROM amendements a
            JOIN dossiers_legislatifs dl ON a.dossier_id = dl.id
            JOIN parlementaires p ON a.parlementaire_id = p.id
            JOIN groupes_politiques gp ON p.groupe_id = gp.id
            WHERE dl.sujet_id = ${sujet.id}
              AND a.expose_sommaire IS NOT NULL
              AND a.expose_sommaire != ''
            ORDER BY gp.slug, gp.chambre, a.date_depot DESC NULLS LAST
          `;

          if (amendements.length === 0) {
            result.skipped++;
            return;
          }

          const groupeMap = new Map<string, {
            nom: string;
            slug: string;
            chambre: string;
            amendements: Array<{ numero: string; exposeSommaire: string; sort: string | null }>;
          }>();

          for (const a of amendements) {
            const key = `${a.groupe_slug}-${a.groupe_chambre}`;
            if (!groupeMap.has(key)) {
              groupeMap.set(key, {
                nom: a.groupe_nom,
                slug: a.groupe_slug,
                chambre: a.groupe_chambre,
                amendements: [],
              });
            }
            const group = groupeMap.get(key)!;
            if (group.amendements.length < 8) {
              group.amendements.push({
                numero: a.numero,
                exposeSommaire: a.expose_sommaire!,
                sort: a.sort,
              });
            }
          }

          const groupes = [...groupeMap.values()].filter(g => g.amendements.length > 0);
          if (groupes.length === 0) {
            result.skipped++;
            return;
          }

          const hashParts = groupes.map(g =>
            `${g.slug}-${g.chambre}:${g.amendements.map(a => a.numero).join(',')}`
          );
          const contentHash = computeContentHash(sujet.id, ...hashParts);

          if (!force && sujet.iaGroupeAmendementHash === contentHash) {
            result.skipped++;
            return;
          }

          // Quota atteint : ni régénéré, ni comptabilisé comme inchangé.
          if (budget <= 0) return;
          budget--;

          if (dryRun) {
            result.enriched++;
            return;
          }

          const userPrompt = buildGroupeAmendementPrompt({
            sujetLabel: sujet.label,
            groupes,
          });

          const response = await mistral.complete(SYSTEM_PROMPT_SUJET_GROUPES, userPrompt, { maxTokens: 1500 });

          const descriptions: Record<string, string> = {};
          const blocks = response.split('---').map(b => b.trim()).filter(Boolean);

          for (const block of blocks) {
            const lines = block.split('\n').map(l => l.trim()).filter((l): l is string => l.length > 0);
            if (lines.length < 2) continue;

            const firstLine = lines[0];
            const headerMatch = firstLine ? firstLine.match(/^GROUPE:\s*(.+)$/i) : null;
            if (headerMatch && headerMatch[1]) {
              const key = headerMatch[1].trim();
              const description = cleanLLMOutput(lines.slice(1).join(' '));
              if (description && description.length > 10) {
                descriptions[key] = description;
              }
            }
          }

          if (Object.keys(descriptions).length === 0 && blocks.length > 0) {
            const groupKeys = groupes.map(g => `${g.slug}-${g.chambre}`);
            let blockIdx = 0;
            for (const key of groupKeys) {
              const rawBlock = blocks[blockIdx];
              if (blockIdx < blocks.length && rawBlock !== undefined) {
                const desc = cleanLLMOutput(rawBlock);
                if (desc && desc.length > 10) {
                  descriptions[key] = desc;
                }
                blockIdx++;
              }
            }
          }

          if (Object.keys(descriptions).length > 0) {
            await prisma.sujet.update({
              where: { id: sujet.id },
              data: {
                groupeAmendementDescriptions: descriptions,
                iaGroupeAmendementHash: contentHash,
              },
            });
            result.enriched++;
          } else {
            logger.warn({ sujetId: sujet.id }, 'Failed to parse groupe amendement descriptions');
            result.errors++;
          }
        } catch (error) {
          result.errors++;
          logger.warn({ sujetId: sujet.id, error: errorMessage(error) }, 'Failed to enrich groupe amendement descriptions');
        }
      })
    );

    await Promise.all(tasks);
    offset += sujets.length;

    logger.info({ processed: result.enriched + result.skipped + result.errors, offset, budget }, 'Groupe amendement batch processed');
    if (sujets.length < BATCH_SIZE) break;
  }

  result.totalTokensIn = mistral.totalTokensIn;
  result.totalTokensOut = mistral.totalTokensOut;

  logger.info({
    enriched: result.enriched, skipped: result.skipped, errors: result.errors,
    tokensIn: result.totalTokensIn, tokensOut: result.totalTokensOut,
  }, 'Groupe amendement descriptions enrichment completed');

  return result;
}
