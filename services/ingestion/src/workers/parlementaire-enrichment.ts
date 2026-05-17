// =============================================================================
// Enrichissement IA des fiches parlementaires
// Pipeline : DB stats + mandats sourceData + HATVP declarations + Wikipedia + Tavily → Mistral → DB
// =============================================================================

import { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { CLAIRMistralClient } from '../llm/mistral-client.js';
import { computeContentHash } from '../llm/content-hash.js';
import { cleanLLMOutput } from '../llm/clean-output.js';
import {
  SYSTEM_PROMPT_PARLEMENTAIRE,
  buildParlementaireResumePrompt,
  type ParlementairePromptData,
} from '../llm/prompts.js';
import { fetchWikipediaBio } from '../sources/wikipedia/client.js';
import { searchParlementaire as tavilySearch, isTavilyAvailable } from '../sources/tavily/client.js';
import { DECLARATION_TYPES } from '../sources/hatvp/declarations-client.js';
import { logger } from '../utils/logger.js';
import type { EnrichmentResult, EnrichmentOptions } from './ia-enrichment.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 50; // Smaller than scrutins — more data per item + web fetches

// =============================================================================
// Mapping typeOrgane AN → libellé lisible
// =============================================================================

const TYPE_ORGANE_LABELS: Record<string, string> = {
  ASSEMBLEE: 'Assemblée nationale',
  SENAT: 'Sénat',
  COMPER: 'Commission permanente',
  CMP: 'Commission mixte paritaire',
  DELEG: 'Délégation parlementaire',
  DELEGBUREAU: 'Délégation du Bureau',
  ORGEXTPARL: 'Organisme extra-parlementaire',
  GA: "Groupe d'amitié",
  GE: "Groupe d'études",
  GEVI: "Groupe d'études à vocation internationale",
  MISINFO: "Mission d'information",
  MISINFOCOM: "Mission d'information commune",
  MISINFOPRE: "Mission d'information de la Conférence des présidents",
  CNPE: "Commission d'enquête",
  CNPS: 'Commission spéciale',
  COMNL: 'Commission (autre)',
  OFFPAR: 'Office parlementaire',
  CONFPT: 'Conférence des présidents',
  BUREAU: "Bureau de l'Assemblée",
  PARPOL: 'Parti politique',
  GP: 'Groupe politique',
  GOUVERNEMENT: 'Gouvernement',
  MINISTERE: 'Ministère',
  PRESREP: 'Présidence de la République',
  API: 'Assemblée parlementaire internationale',
  // Sénat types
  COMMISSION: 'Commission',
  'DELEGATION/OFFICE': 'Délégation/Office',
  ETUDE: "Groupe d'études",
  INTERNE: 'Organe interne',
  AUTRE: 'Autre organisme',
};

// Types intéressants pour la fiche (on exclut GA, GE, PARPOL, GP, ASSEMBLEE)
const INTERESTING_TYPE_ORGANES = new Set([
  'COMPER', 'CMP', 'DELEG', 'DELEGBUREAU', 'ORGEXTPARL',
  'MISINFO', 'MISINFOCOM', 'MISINFOPRE', 'CNPE', 'CNPS',
  'COMNL', 'OFFPAR', 'CONFPT', 'BUREAU', 'GOUVERNEMENT',
  'MINISTERE', 'PRESREP', 'API',
  // Sénat
  'COMMISSION', 'DELEGATION/OFFICE', 'INTERNE',
]);

// =============================================================================
// Extract mandats from sourceData
// =============================================================================

interface ExtractedMandat {
  typeOrgane: string;
  institution: string;
  qualite: string;
  dateDebut: string;
  dateFin?: string | null;
  sourceUid?: string;
  organeRef?: string | null;
}

function extractMandatsAN(sourceData: any): ExtractedMandat[] {
  const mandats = sourceData?.mandats?.mandat;
  if (!Array.isArray(mandats)) return [];

  return mandats
    .filter((m: any) => INTERESTING_TYPE_ORGANES.has(m.typeOrgane))
    .map((m: any) => ({
      typeOrgane: m.typeOrgane,
      institution: TYPE_ORGANE_LABELS[m.typeOrgane] || m.typeOrgane,
      qualite: m.infosQualite?.libQualite || 'Membre',
      dateDebut: m.dateDebut,
      dateFin: m.dateFin || null,
      sourceUid: m.uid || null,
      organeRef: m.organes?.organeRef || null,
    }))
    .sort((a: ExtractedMandat, b: ExtractedMandat) =>
      (b.dateDebut || '').localeCompare(a.dateDebut || '')
    );
}

function extractMandatsSenat(sourceData: any): ExtractedMandat[] {
  const organismes = sourceData?.organismes;
  if (!Array.isArray(organismes)) return [];

  return organismes
    .filter((o: any) => {
      const type = o.type;
      return INTERESTING_TYPE_ORGANES.has(type) || type === 'COMMISSION' || type === 'DELEGATION/OFFICE';
    })
    .map((o: any) => ({
      typeOrgane: o.type,
      institution: o.libelle || TYPE_ORGANE_LABELS[o.type] || o.type,
      qualite: 'Membre', // Sénat data doesn't include qualite per organisme
      dateDebut: new Date().toISOString().split('T')[0], // Current membership (no start date in Sénat data)
      dateFin: null,
      sourceUid: `senat-${o.code}`,
    }));
}

// =============================================================================
// Main enrichment function
// =============================================================================

export async function enrichParlementairesIA(
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const { limit, dryRun = false, concurrency = 2, force = false } = options;

  const result: EnrichmentResult = {
    enriched: 0, skipped: 0, errors: 0, totalTokensIn: 0, totalTokensOut: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not set — skipping parlementaire IA enrichment');
    return result;
  }

  const mistral = new CLAIRMistralClient();
  const limiter = pLimit(concurrency);

  const tavilyEnabled = isTavilyAvailable();
  logger.info(
    { dryRun, concurrency, limit, force, tavilyEnabled },
    'Starting parlementaires IA enrichment...'
  );

  // Only enrich active parlementaires (or all if force)
  const where = force
    ? { actif: true }
    : { actif: true, resumeIA: null };

  let remaining = limit ?? Infinity;

  while (remaining > 0) {
    const take = Math.min(BATCH_SIZE, remaining);
    // No cursor pagination: enriched items drop out of the where filter (resumeIA: null → not null),
    // so we always take from the top. With --force, use offset-based pagination.
    const parlementaires = await prisma.parlementaire.findMany({
      where,
      select: {
        id: true,
        prenom: true,
        nom: true,
        chambre: true,
        profession: true,
        dateNaissance: true,
        actif: true,
        commissionPermanente: true,
        iaContentHash: true,
        sourceData: true,
        // Stats
        statsPresence: true,
        statsLoyaute: true,
        statsParticipation: true,
        statsInterventions: true,
        statsAmendements: true,
        statsAmendementsAdoptes: true,
        // Relations
        groupe: { select: { nom: true } },
        circonscription: { select: { departement: true, numero: true, nom: true } },
      },
      orderBy: [{ chambre: 'asc' }, { nom: 'asc' }],
      take,
    });

    if (parlementaires.length === 0) break;

    const tasks = parlementaires.map(parl =>
      limiter(async () => {
        try {
          // Extract mandats from sourceData
          const mandats = parl.chambre === 'senat'
            ? extractMandatsSenat(parl.sourceData as any)
            : extractMandatsAN(parl.sourceData as any);

          // Fetch lobbying actions targeting this parlementaire
          const lobbyActions = await prisma.actionLobby.findMany({
            where: { parlementaireId: parl.id },
            select: {
              lobbyiste: { select: { nom: true, type: true } },
              actionDescription: { select: { texte: true } },
              secteurs: { select: { secteur: { select: { label: true } } } },
            },
            take: 10,
          });

          // Fetch HATVP declarations
          const declarations = await prisma.declarationHATVP.findMany({
            where: { parlementaireId: parl.id },
            select: {
              typeDocument: true,
              datePublication: true,
              urlDossier: true,
            },
            orderBy: { datePublication: 'desc' },
          });

          // Build content hash from structured data (before web fetches)
          const hashParts = [
            parl.nom, parl.prenom, parl.chambre,
            parl.groupe?.nom,
            String(parl.statsPresence), String(parl.statsLoyaute),
            String(parl.statsParticipation), String(parl.statsAmendements),
            mandats.map(m => `${m.typeOrgane}:${m.qualite}:${m.dateDebut}`).join('|'),
            lobbyActions.map(a => a.lobbyiste.nom).join('|'),
            declarations.map(d => `${d.typeDocument}:${d.datePublication?.toISOString() ?? ''}`).join('|'),
          ];
          const contentHash = computeContentHash(...hashParts);

          if (!force && parl.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

          if (dryRun) {
            result.enriched++;
            return;
          }

          // Fetch Wikipedia bio (rate-limit friendly, 1 req per parl)
          const role = parl.chambre === 'senat' ? 'sénateur' : 'député';
          const wikiBio = await fetchWikipediaBio(parl.prenom, parl.nom, { role });

          // Fetch Tavily results (optional)
          const tavilyResults = tavilyEnabled
            ? await tavilySearch(parl.prenom, parl.nom, {
                chambre: parl.chambre,
                maxResults: 3,
              })
            : null;

          // Build prompt data
          const circoStr = parl.circonscription
            ? `${parl.circonscription.nom || parl.circonscription.departement} (${parl.circonscription.numero})`
            : null;

          const promptData: ParlementairePromptData = {
            prenom: parl.prenom,
            nom: parl.nom,
            chambre: parl.chambre,
            groupe: parl.groupe?.nom,
            profession: parl.profession,
            dateNaissance: parl.dateNaissance?.toISOString().split('T')[0],
            circonscription: circoStr,
            commissionPermanente: parl.commissionPermanente,
            actif: parl.actif,
            stats: {
              presence: parl.statsPresence,
              loyaute: parl.statsLoyaute,
              participation: parl.statsParticipation,
              interventions: parl.statsInterventions,
              amendements: parl.statsAmendements,
              amendementsAdoptes: parl.statsAmendementsAdoptes,
            },
            mandats: mandats.map(m => ({
              typeOrgane: m.typeOrgane,
              institution: m.institution,
              qualite: m.qualite,
              dateDebut: m.dateDebut,
              dateFin: m.dateFin,
            })),
            lobbyingActions: lobbyActions.map(a => ({
              lobbyiste: a.lobbyiste.nom,
              type: a.lobbyiste.type,
              description: a.actionDescription.texte,
              secteurs: a.secteurs.map(s => s.secteur.label),
            })),
            declarations: declarations.map(d => ({
              type: d.typeDocument,
              label: DECLARATION_TYPES[d.typeDocument] || d.typeDocument,
              datePublication: d.datePublication?.toISOString().split('T')[0],
              urlDossier: d.urlDossier,
            })),
            wikipediaBio: wikiBio?.extract,
            tavilyResults: tavilyResults?.results.map(r => ({
              title: r.title,
              content: r.content,
            })),
          };

          const userPrompt = buildParlementaireResumePrompt(promptData);

          const response = await mistral.complete(
            SYSTEM_PROMPT_PARLEMENTAIRE,
            userPrompt,
            { maxTokens: 1500 },
          );

          // Parse structured response
          const parcoursSep = '---PARCOURS---';
          const positionsSep = '---POSITIONS---';
          const faitsSep = '---FAITS---';

          const parcoursIdx = response.indexOf(parcoursSep);
          const positionsIdx = response.indexOf(positionsSep);
          const faitsIdx = response.indexOf(faitsSep);

          let resumeIA: string;
          let parcoursIA: string | null = null;
          let positionsClesIA: string | null = null;
          let faitsNotablesIA: string | null = null;

          if (parcoursIdx !== -1 && positionsIdx !== -1 && faitsIdx !== -1) {
            resumeIA = cleanLLMOutput(response.slice(0, parcoursIdx));
            parcoursIA = cleanLLMOutput(response.slice(parcoursIdx + parcoursSep.length, positionsIdx));
            positionsClesIA = cleanLLMOutput(response.slice(positionsIdx + positionsSep.length, faitsIdx));
            faitsNotablesIA = cleanLLMOutput(response.slice(faitsIdx + faitsSep.length));
          } else if (parcoursIdx !== -1 && positionsIdx !== -1) {
            resumeIA = cleanLLMOutput(response.slice(0, parcoursIdx));
            parcoursIA = cleanLLMOutput(response.slice(parcoursIdx + parcoursSep.length, positionsIdx));
            positionsClesIA = cleanLLMOutput(response.slice(positionsIdx + positionsSep.length));
            logger.warn({ parlId: parl.id }, 'Parlementaire response missing ---FAITS--- separator');
          } else {
            // Fallback: entire response as resumeIA
            resumeIA = response;
            logger.warn({ parlId: parl.id }, 'Parlementaire response missing separators');
          }

          // Persist mandats to DB (upsert by sourceUid)
          await persistMandats(parl.id, mandats);

          // Save enrichment
          await prisma.parlementaire.update({
            where: { id: parl.id },
            data: {
              resumeIA,
              parcoursIA,
              positionsClesIA,
              faitsNotablesIA,
              iaContentHash: contentHash,
              iaGeneratedAt: new Date(),
            },
          });

          result.enriched++;

          if (result.enriched % 10 === 0) {
            logger.info(
              { enriched: result.enriched, skipped: result.skipped, errors: result.errors },
              'Parlementaires enrichment progress'
            );
          }
        } catch (error: any) {
          result.errors++;
          logger.warn(
            { parlId: parl.id, nom: parl.nom, error: error.message },
            'Failed to enrich parlementaire'
          );
        }
      })
    );

    await Promise.all(tasks);
    remaining -= parlementaires.length;

    if (parlementaires.length < take) break;
    logger.info(
      { batch: result.enriched + result.skipped + result.errors },
      'Parlementaires batch processed'
    );
  }

  result.totalTokensIn = mistral.totalTokensIn;
  result.totalTokensOut = mistral.totalTokensOut;

  logger.info({
    enriched: result.enriched, skipped: result.skipped, errors: result.errors,
    tokensIn: result.totalTokensIn, tokensOut: result.totalTokensOut,
  }, 'Parlementaires IA enrichment completed');

  return result;
}

// =============================================================================
// Persist mandats to DB
// =============================================================================

async function persistMandats(parlementaireId: string, mandats: ExtractedMandat[]): Promise<void> {
  if (mandats.length === 0) return;

  for (const m of mandats) {
    if (!m.sourceUid) continue;

    try {
      await prisma.mandat.upsert({
        where: { sourceUid: m.sourceUid },
        create: {
          parlementaireId,
          typeOrgane: m.typeOrgane,
          institution: m.institution,
          qualite: m.qualite,
          dateDebut: new Date(m.dateDebut),
          dateFin: m.dateFin ? new Date(m.dateFin) : null,
          sourceUid: m.sourceUid,
          organeRef: m.organeRef || null,
        },
        update: {
          institution: m.institution,
          qualite: m.qualite,
          dateFin: m.dateFin ? new Date(m.dateFin) : null,
          organeRef: m.organeRef || undefined,
        },
      });
    } catch (error: any) {
      // Skip duplicate / invalid date errors silently
      logger.debug({ sourceUid: m.sourceUid, error: error.message }, 'Mandat upsert failed');
    }
  }
}
