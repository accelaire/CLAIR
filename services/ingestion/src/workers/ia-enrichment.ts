// =============================================================================
// IA Enrichment Worker — Enrichit les entités parlementaires via Mistral LLM
// =============================================================================

import { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { CLAIRMistralClient } from '../llm/mistral-client.js';
import { computeContentHash } from '../llm/content-hash.js';
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
    ...(limit ? { take: limit } : {}),
  });

  logger.info({ count: scrutins.length }, 'Scrutins to process');

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
          logger.info({ scrutinId: scrutin.id, titre: scrutin.titre.slice(0, 80) }, '[DRY RUN] Would enrich');
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

        const resumeIA = await mistral.complete(SYSTEM_PROMPT, userPrompt);

        await prisma.scrutin.update({
          where: { id: scrutin.id },
          data: { resumeIA, iaContentHash: contentHash, iaGeneratedAt: new Date() },
        });

        result.enriched++;
        logger.debug({ scrutinId: scrutin.id }, 'Scrutin enriched');
      } catch (error: any) {
        result.errors++;
        logger.warn({ scrutinId: scrutin.id, error: error.message }, 'Failed to enrich scrutin');
      }
    })
  );

  await Promise.all(tasks);
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

/**
 * Enrichit les dossiers législatifs avec un résumé IA + analyse des positions des groupes.
 * Utilise les resumeIA des scrutins (cascade) + positions agrégées des groupes + amendements clés.
 * Produit un champ resumeIA structuré en deux parties : résumé + positions groupes.
 */
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

  // Sélectionner les dossiers qui ont au moins un scrutin
  const where = force
    ? { scrutins: { some: {} } }
    : { resumeIA: null, scrutins: { some: {} } };

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
    ...(limit ? { take: limit } : {}),
  });

  logger.info({ count: dossiers.length }, 'Dossiers to process');

  const tasks = dossiers.map(dossier =>
    limiter(async () => {
      try {
        // Récupérer les scrutins clés (solennels d'abord, puis par importance)
        const scrutinsClefs = await prisma.scrutin.findMany({
          where: { dossierId: dossier.id },
          select: {
            id: true,
            titre: true,
            sort: true,
            typeVote: true,
            resumeIA: true,
          },
          orderBy: [{ typeVote: 'asc' }, { importance: 'desc' }],
          take: 10,
        });

        // Récupérer les positions agrégées des groupes
        const positionsGroupes = await prisma.$queryRaw<
          { nom: string; slug: string; pour: bigint; contre: bigint; abstention: bigint }[]
        >`
          SELECT gp.nom, gp.slug,
            SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
            SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
            SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
          FROM votes v
          JOIN parlementaires p ON p.id = v.parlementaire_id
          JOIN groupes_politiques gp ON gp.id = p.groupe_id
          JOIN scrutins s ON s.id = v.scrutin_id
          WHERE s.dossier_id = ${dossier.id}
            AND v.position != 'absent'
          GROUP BY gp.nom, gp.slug
          ORDER BY (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                    SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) DESC
        `;

        // Récupérer les amendements clés (adoptés en priorité)
        const amendementsClefs = await prisma.amendement.findMany({
          where: { dossierId: dossier.id, exposeSommaire: { not: null } },
          select: { numero: true, exposeSommaire: true, auteurLibelle: true, sort: true },
          orderBy: { dateDepot: 'desc' },
          take: 5,
        });

        // Content hash
        const hashParts = [
          dossier.titre,
          dossier.etat,
          scrutinsClefs.map(s => `${s.sort}:${s.resumeIA ?? s.titre}`).join('|'),
          positionsGroupes.map(g => `${g.slug}:${g.pour}:${g.contre}:${g.abstention}`).join('|'),
        ];
        const contentHash = computeContentHash(...hashParts);

        if (!force && dossier.iaContentHash === contentHash) {
          result.skipped++;
          return;
        }

        if (dryRun) {
          logger.info({ dossierId: dossier.id, titre: dossier.titre.slice(0, 80) }, '[DRY RUN] Would enrich dossier');
          result.enriched++;
          return;
        }

        const userPrompt = buildDossierResumePrompt({
          titre: dossier.titre,
          titreCourt: dossier.titreCourt,
          procedureLibelle: dossier.procedureLibelle,
          etat: dossier.etat,
          scrutinsResumes: scrutinsClefs.map(s => ({
            titre: s.titre,
            sort: s.sort,
            typeVote: s.typeVote,
            resumeIA: s.resumeIA,
          })),
          positionsGroupes: positionsGroupes.map(g => ({
            nom: g.nom, slug: g.slug,
            pour: Number(g.pour), contre: Number(g.contre), abstention: Number(g.abstention),
          })),
          amendementsClefs: amendementsClefs.map(a => ({
            numero: a.numero,
            exposeSommaire: a.exposeSommaire,
            auteurLibelle: a.auteurLibelle,
            sort: a.sort,
          })),
        });

        const response = await mistral.complete(SYSTEM_PROMPT_DOSSIER, userPrompt, { maxTokens: 1024 });

        // Nettoyer le séparateur ---POSITIONS--- (résumé + positions stockés ensemble)
        const resumeIA = response.replace(/\n*---POSITIONS---\n*/g, '\n\n');

        await prisma.dossierLegislatif.update({
          where: { id: dossier.id },
          data: { resumeIA, iaContentHash: contentHash, iaGeneratedAt: new Date() },
        });

        result.enriched++;
        logger.debug({ dossierId: dossier.id }, 'Dossier enriched');
      } catch (error: any) {
        result.errors++;
        logger.warn({ dossierId: dossier.id, error: error.message }, 'Failed to enrich dossier');
      }
    })
  );

  await Promise.all(tasks);
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

/**
 * Enrichit les sujets parlementaires avec resume + enjeux.
 * Utilise les resumeIA des dossiers (cascade) + positions agrégées cross-chambre.
 * Produit : resume (synthèse accessible) + enjeux (analyse politique).
 */
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

  const sujets = await prisma.sujet.findMany({
    where,
    select: {
      id: true,
      label: true,
      description: true,
      category: true,
      status: true,
      iaContentHash: true,
      dossiers: {
        select: {
          id: true,
          titre: true,
          etat: true,
          resumeIA: true,
          scrutins: {
            select: { id: true },
            take: 1, // Juste pour savoir la chambre dominante
          },
        },
      },
    },
    orderBy: { scrutinCount: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  logger.info({ count: sujets.length }, 'Sujets to process');

  const tasks = sujets.map(sujet =>
    limiter(async () => {
      try {
        // Récupérer les positions agrégées cross-dossiers
        const dossierIds = sujet.dossiers.map(d => d.id);

        const positionsGroupes = dossierIds.length > 0
          ? await prisma.$queryRaw<
              { nom: string; slug: string; pour: bigint; contre: bigint; abstention: bigint }[]
            >`
              SELECT gp.nom, gp.slug,
                SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
                SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre,
                SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END)::bigint AS abstention
              FROM votes v
              JOIN parlementaires p ON p.id = v.parlementaire_id
              JOIN groupes_politiques gp ON gp.id = p.groupe_id
              JOIN scrutins s ON s.id = v.scrutin_id
              WHERE s.dossier_id = ANY(${dossierIds})
                AND v.position != 'absent'
              GROUP BY gp.nom, gp.slug
              ORDER BY (SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
                        SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) DESC
            `
          : [];

        // Content hash
        const hashParts = [
          sujet.label,
          sujet.status,
          sujet.description,
          sujet.dossiers.map(d => `${d.titre}:${d.resumeIA ?? ''}`).join('|'),
          positionsGroupes.map(g => `${g.slug}:${g.pour}:${g.contre}:${g.abstention}`).join('|'),
        ];
        const contentHash = computeContentHash(...hashParts);

        if (!force && sujet.iaContentHash === contentHash) {
          result.skipped++;
          return;
        }

        if (dryRun) {
          logger.info({ sujetId: sujet.id, label: sujet.label }, '[DRY RUN] Would enrich sujet');
          result.enriched++;
          return;
        }

        const userPrompt = buildSujetResumePrompt({
          label: sujet.label,
          description: sujet.description,
          category: sujet.category,
          status: sujet.status,
          dossiersResumes: sujet.dossiers.map(d => ({
            titre: d.titre,
            chambre: 'cross', // Sujet = cross-chambre par nature
            etat: d.etat,
            resumeIA: d.resumeIA,
          })),
          positionsGroupes: positionsGroupes.map(g => ({
            nom: g.nom, slug: g.slug,
            pour: Number(g.pour), contre: Number(g.contre), abstention: Number(g.abstention),
          })),
        });

        const response = await mistral.complete(SYSTEM_PROMPT_SUJET, userPrompt, { maxTokens: 1024 });

        // Parser la réponse : label + resume + enjeux
        const resumeSep = '---RESUME---';
        const enjeuxSep = '---ENJEUX---';
        const resumeSepIdx = response.indexOf(resumeSep);
        const enjeuxSepIdx = response.indexOf(enjeuxSep);

        let labelIA: string | null = null;
        let resume: string;
        let enjeux: string | null = null;

        if (resumeSepIdx !== -1 && enjeuxSepIdx !== -1) {
          // Format complet : label \n ---RESUME--- \n resume \n ---ENJEUX--- \n enjeux
          labelIA = response.slice(0, resumeSepIdx).trim();
          resume = response.slice(resumeSepIdx + resumeSep.length, enjeuxSepIdx).trim();
          enjeux = response.slice(enjeuxSepIdx + enjeuxSep.length).trim();
        } else if (enjeuxSepIdx !== -1) {
          // Ancien format sans label : resume \n ---ENJEUX--- \n enjeux
          resume = response.slice(0, enjeuxSepIdx).trim();
          enjeux = response.slice(enjeuxSepIdx + enjeuxSep.length).trim();
        } else {
          resume = response;
          logger.warn({ sujetId: sujet.id }, 'Sujet response missing separators, using full response as resume');
        }

        // Valider le label (non vide, pas trop long, pas un séparateur résiduel)
        if (labelIA && labelIA.length > 2 && labelIA.length < 120 && !labelIA.startsWith('---')) {
          logger.debug({ sujetId: sujet.id, oldLabel: sujet.label, newLabel: labelIA }, 'Sujet label updated by IA');
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
        logger.debug({ sujetId: sujet.id }, 'Sujet enriched');
      } catch (error: any) {
        result.errors++;
        logger.warn({ sujetId: sujet.id, error: error.message }, 'Failed to enrich sujet');
      }
    })
  );

  await Promise.all(tasks);
  result.totalTokensIn = mistral.totalTokensIn;
  result.totalTokensOut = mistral.totalTokensOut;

  logger.info({
    enriched: result.enriched, skipped: result.skipped, errors: result.errors,
    tokensIn: result.totalTokensIn, tokensOut: result.totalTokensOut,
  }, 'Sujets IA enrichment completed');

  return result;
}
