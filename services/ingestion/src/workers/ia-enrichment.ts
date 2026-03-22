// =============================================================================
// IA Enrichment Worker — Enrichit les entités parlementaires via Mistral LLM
// Batch processing pour éviter les OOM en prod (6GB heap max)
// =============================================================================

import { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { CLAIRMistralClient } from '../llm/mistral-client.js';
import { computeContentHash } from '../llm/content-hash.js';
import { cleanLLMOutput } from '../llm/clean-output.js';
import {
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_DOSSIER,
  SYSTEM_PROMPT_SUJET,
  buildScrutinResumePrompt,
  buildDossierResumePrompt,
  buildSujetResumePrompt,
} from '../llm/prompts.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

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

  const where = force ? {} : { resumeIA: null };
  let remaining = limit ?? Infinity;

  // No cursor needed: enriched items drop out of `where: { resumeIA: null }`
  // so each batch naturally picks the next unenriched items
  while (remaining > 0) {
    const take = Math.min(BATCH_SIZE, remaining);
    const scrutins = await prisma.scrutin.findMany({
      where,
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
      orderBy: { date: 'desc' },
      take,
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
          );

          if (!force && scrutin.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

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
        } catch (error: any) {
          result.errors++;
          logger.warn({ scrutinId: scrutin.id, error: error.message }, 'Failed to enrich scrutin');
        }
      })
    );

    await Promise.all(tasks);
    remaining -= scrutins.length;

    logger.info({ processed: result.enriched + result.skipped + result.errors, remaining }, 'Scrutins batch processed');
    if (scrutins.length < take) break;
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
  const { limit, dryRun = false, concurrency = 2, force = false } = options;

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

  const where = force
    ? { scrutins: { some: {} } }
    : { resumeIA: null, scrutins: { some: {} } };

  let remaining = limit ?? Infinity;

  while (remaining > 0) {
    const take = Math.min(BATCH_SIZE, remaining);
    const dossiers = await prisma.dossierLegislatif.findMany({
      where,
      select: {
        id: true,
        titre: true,
        titreCourt: true,
        procedureLibelle: true,
        etat: true,
        iaContentHash: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    if (dossiers.length === 0) break;

    const tasks = dossiers.map(dossier =>
      limiter(async () => {
        try {
          const scrutinsClefs = await prisma.scrutin.findMany({
            where: { dossierId: dossier.id },
            select: { id: true, titre: true, sort: true, typeVote: true, resumeIA: true },
            orderBy: [{ typeVote: 'asc' }, { importance: 'desc' }],
            take: 10,
          });

          type GroupeRow = { nom: string; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };
          type ArticleRow = { scrutin_id: string; article: string; sort: string; nom: string; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };

          // Votes sur l'ensemble du texte (solennel OU ordinaire avec "ensemble" dans le titre)
          const positionsEnsemble = await prisma.$queryRaw<GroupeRow[]>`
            SELECT gp.nom, gp.slug, gp.position as orientation,
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
            GROUP BY gp.nom, gp.slug, gp.position
            ORDER BY (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                      SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) DESC
          `;

          // Votes sur les articles clés (top 5 articles les plus votés)
          const votesArticlesRaw = await prisma.$queryRaw<ArticleRow[]>`
            SELECT s.id as scrutin_id, s.titre as article, s.sort,
              gp.nom, gp.slug, gp.position as orientation,
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
            GROUP BY s.id, s.titre, s.sort, gp.nom, gp.slug, gp.position
            HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                   SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) > 5
            ORDER BY s.id, (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                            SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) DESC
          `;

          // Regrouper par scrutin pour les articles
          const articlesMap = new Map<string, { article: string; sort: string; groupes: GroupeRow[] }>();
          for (const row of votesArticlesRaw) {
            if (!articlesMap.has(row.scrutin_id)) {
              articlesMap.set(row.scrutin_id, { article: row.article, sort: row.sort, groupes: [] });
            }
            articlesMap.get(row.scrutin_id)!.groupes.push(row);
          }
          // Prendre les 5 articles les plus clivants (plus gros écarts pour/contre)
          const votesArticles = [...articlesMap.values()]
            .sort((a, b) => {
              const clivageA = a.groupes.reduce((s, g) => s + Math.abs(Number(g.pour) - Number(g.contre)), 0);
              const clivageB = b.groupes.reduce((s, g) => s + Math.abs(Number(g.pour) - Number(g.contre)), 0);
              return clivageB - clivageA;
            })
            .slice(0, 5);

          // Amendements clés : adoptés en priorité, puis rejetés, avec exposé sommaire
          const amendementsClefs = await prisma.amendement.findMany({
            where: { dossierId: dossier.id, exposeSommaire: { not: null } },
            select: { numero: true, exposeSommaire: true, auteurLibelle: true, sort: true },
            orderBy: [{ sort: 'asc' }, { dateDepot: 'desc' }],
            take: 8,
          });

          const ensembleForHash = positionsEnsemble.map(g => `ens:${g.slug}:${g.pour}:${g.contre}:${g.abstention}`).join('|');
          const articlesForHash = votesArticles.map(a => `art:${a.article.slice(0, 30)}`).join('|');
          const hashParts = [
            dossier.titre,
            dossier.etat,
            scrutinsClefs.map(s => `${s.sort}:${s.resumeIA ?? s.titre}`).join('|'),
            ensembleForHash,
            articlesForHash,
          ];
          const contentHash = computeContentHash(...hashParts);

          if (!force && dossier.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

          if (dryRun) {
            result.enriched++;
            return;
          }

          const toGroupeArray = (rows: GroupeRow[]) => rows.map(g => ({
            nom: g.nom, slug: g.slug,
            pour: Number(g.pour), contre: Number(g.contre), abstention: Number(g.abstention),
            orientation: g.orientation,
          }));

          const userPrompt = buildDossierResumePrompt({
            titre: dossier.titre,
            titreCourt: dossier.titreCourt,
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
        } catch (error: any) {
          result.errors++;
          logger.warn({ dossierId: dossier.id, error: error.message }, 'Failed to enrich dossier');
        }
      })
    );

    await Promise.all(tasks);
    remaining -= dossiers.length;

    logger.info({ processed: result.enriched + result.skipped + result.errors, remaining }, 'Dossiers batch processed');
    if (dossiers.length < take) break;
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
  const { limit, dryRun = false, concurrency = 2, force = false } = options;

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

  const where = force
    ? { dossiers: { some: {} } }
    : { resume: null, dossiers: { some: {} } };

  let remaining = limit ?? Infinity;

  while (remaining > 0) {
    const take = Math.min(BATCH_SIZE, remaining);
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
      orderBy: { scrutinCount: 'desc' },
      take,
    });

    if (sujets.length === 0) break;

    const tasks = sujets.map(sujet =>
      limiter(async () => {
        try {
          const dossiers = await prisma.dossierLegislatif.findMany({
            where: { sujetId: sujet.id },
            select: { id: true, titre: true, etat: true, resumeIA: true },
          });

          const dossierIds = dossiers.map(d => d.id);

          type SujetGroupeRow = { nom: string; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };
          type SujetArticleRow = { scrutin_id: string; article: string; sort: string; nom: string; slug: string; pour: bigint; contre: bigint; abstention: bigint; orientation: string | null };

          // Votes sur l'ensemble du texte (solennel OU ordinaire avec "ensemble" dans le titre)
          const positionsEnsemble = dossierIds.length > 0
            ? await prisma.$queryRaw<SujetGroupeRow[]>`
                SELECT gp.nom, gp.slug, gp.position as orientation,
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
                GROUP BY gp.nom, gp.slug, gp.position
                ORDER BY (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                          SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) DESC
              `
            : [];

          // Votes sur les articles clés (top 5 les plus clivants)
          const votesArticlesRaw = dossierIds.length > 0
            ? await prisma.$queryRaw<SujetArticleRow[]>`
                SELECT s.id as scrutin_id, s.titre as article, s.sort,
                  gp.nom, gp.slug, gp.position as orientation,
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
                GROUP BY s.id, s.titre, s.sort, gp.nom, gp.slug, gp.position
                HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                       SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) > 5
                ORDER BY s.id, (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                                SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) DESC
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
            .sort((a, b) => {
              const clivageA = a.groupes.reduce((s, g) => s + Math.abs(Number(g.pour) - Number(g.contre)), 0);
              const clivageB = b.groupes.reduce((s, g) => s + Math.abs(Number(g.pour) - Number(g.contre)), 0);
              return clivageB - clivageA;
            })
            .slice(0, 5);

          const ensembleForHash = positionsEnsemble.map(g => `ens:${g.slug}:${g.pour}:${g.contre}:${g.abstention}`).join('|');
          const articlesForHash = votesArticles.map(a => `art:${a.article.slice(0, 30)}`).join('|');
          const hashParts = [
            sujet.label,
            sujet.status,
            sujet.description,
            dossiers.map(d => `${d.titre}:${d.resumeIA ?? ''}`).join('|'),
            ensembleForHash,
            articlesForHash,
          ];
          const contentHash = computeContentHash(...hashParts);

          if (!force && sujet.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

          if (dryRun) {
            result.enriched++;
            return;
          }

          const toGroupeArray = (rows: SujetGroupeRow[]) => rows.map(g => ({
            nom: g.nom, slug: g.slug,
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
              chambre: 'cross',
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
        } catch (error: any) {
          result.errors++;
          logger.warn({ sujetId: sujet.id, error: error.message }, 'Failed to enrich sujet');
        }
      })
    );

    await Promise.all(tasks);
    remaining -= sujets.length;

    logger.info({ processed: result.enriched + result.skipped + result.errors, remaining }, 'Sujets batch processed');
    if (sujets.length < take) break;
  }

  result.totalTokensIn = mistral.totalTokensIn;
  result.totalTokensOut = mistral.totalTokensOut;

  logger.info({
    enriched: result.enriched, skipped: result.skipped, errors: result.errors,
    tokensIn: result.totalTokensIn, tokensOut: result.totalTokensOut,
  }, 'Sujets IA enrichment completed');

  return result;
}
