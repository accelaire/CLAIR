// =============================================================================
// Enrichissement IA des fiches parlementaires
// Pipeline : DB stats + mandats sourceData + HATVP declarations + Wikipedia + Tavily → Mistral → DB
// =============================================================================

import { Prisma, PrismaClient } from '@prisma/client';
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
import {
  tavilySearch,
  isTavilyAvailable,
  getTavilyStatus,
  fetchTavilyCredits,
} from '../sources/tavily/client.js';

// Réseaux sociaux / sites non pertinents exclus des recherches Tavily de bios.
const TAVILY_SOCIAL_EXCLUDE = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'youtube.com', 'linkedin.com',
];
import { DECLARATION_TYPES } from '../sources/hatvp/declarations-client.js';
import { logger } from '../utils/logger.js';
import { isRecord, readString, type JsonRecord } from '../utils/json.js';
import { errorMessage } from '../utils/errors.js';
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

function extractMandatsAN(sourceData: unknown): ExtractedMandat[] {
  const mandats = isRecord(sourceData) && isRecord(sourceData.mandats)
    ? sourceData.mandats.mandat
    : undefined;
  if (!Array.isArray(mandats)) return [];

  return mandats
    .filter((m: unknown): m is JsonRecord =>
      isRecord(m) && INTERESTING_TYPE_ORGANES.has(readString(m, 'typeOrgane') ?? '')
    )
    .map((m) => {
      const typeOrgane = readString(m, 'typeOrgane') ?? '';
      return {
        typeOrgane,
        institution: TYPE_ORGANE_LABELS[typeOrgane] || typeOrgane,
        qualite: readString(m.infosQualite, 'libQualite') || 'Membre',
        dateDebut: readString(m, 'dateDebut') ?? '',
        dateFin: readString(m, 'dateFin') || null,
        sourceUid: readString(m, 'uid') || undefined,
        organeRef: readString(m.organes, 'organeRef') || null,
      };
    })
    .sort((a: ExtractedMandat, b: ExtractedMandat) =>
      (b.dateDebut || '').localeCompare(a.dateDebut || '')
    );
}

function extractMandatsSenat(sourceData: unknown): ExtractedMandat[] {
  const organismes = isRecord(sourceData) ? sourceData.organismes : undefined;
  if (!Array.isArray(organismes)) return [];

  return organismes
    .filter((o: unknown): o is JsonRecord => {
      if (!isRecord(o)) return false;
      const type = readString(o, 'type') ?? '';
      return INTERESTING_TYPE_ORGANES.has(type) || type === 'COMMISSION' || type === 'DELEGATION/OFFICE';
    })
    .map((o) => {
      const type = readString(o, 'type') ?? '';
      return {
        typeOrgane: type,
        institution: readString(o, 'libelle') || TYPE_ORGANE_LABELS[type] || type,
        qualite: 'Membre', // Sénat data doesn't include qualite per organisme
        dateDebut: new Date().toISOString().slice(0, 10), // Current membership (no start date in Sénat data)
        dateFin: null,
        sourceUid: `senat-${readString(o, 'code') ?? ''}`,
      };
    });
}

// =============================================================================
// Main enrichment function
// =============================================================================

export async function enrichParlementairesIA(
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const { limit, dryRun = false, concurrency = 2, force = false, randomSample, skipRecentDays = 3 } = options;

  const result: EnrichmentResult = {
    enriched: 0, skipped: 0, errors: 0, totalTokensIn: 0, totalTokensOut: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not set — skipping parlementaire IA enrichment');
    return result;
  }

  const mistral = new CLAIRMistralClient();
  const limiter = pLimit(concurrency);

  // Garde-fou en amont : Tavily est une dépendance dure de cet enrichissement,
  // pas un bonus. Le plan est à 1000 crédits par mois et la rotation quotidienne
  // en consomme ~25/jour — soit 750/mois pour les seuls parlementaires. Mieux
  // vaut ne pas démarrer que produire des fiches non sourcées.
  if (!isTavilyAvailable()) {
    logger.error('TAVILY_API_KEY absente — enrichissement parlementaires annulé');
    return result;
  }

  const credits = await fetchTavilyCredits();
  if (credits && credits.remaining === 0) {
    logger.error(
      { used: credits.used, limit: credits.limit },
      'Crédits Tavily épuisés — enrichissement parlementaires annulé',
    );
    return result;
  }

  logger.info(
    {
      dryRun, concurrency, limit, force,
      tavilyCreditsRestants: credits?.remaining ?? 'inconnu',
    },
    'Starting parlementaires IA enrichment...'
  );

  // bypassHash: with --force or --random we regenerate regardless of content hash,
  // which also refreshes iaGeneratedAt (the "mise à jour" date shown on the public fiche).
  const bypassHash = force || randomSample != null;

  // Optional random sample: pick N active parlementaires at random (ORDER BY random()),
  // excluding those already refreshed in the last `skipRecentDays` days so a daily rotation
  // converges over the whole parc instead of re-hitting fresh fiches (waste of Tavily quota).
  // skipRecentDays = 0 disables the exclusion (pure random over all active).
  let sampleIds: string[] | null = null;
  if (randomSample != null) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM parlementaires
      WHERE actif = true
        AND (ia_generated_at IS NULL OR ia_generated_at < now() - make_interval(days => ${skipRecentDays}::int))
      ORDER BY random()
      LIMIT ${randomSample}
    `;
    sampleIds = rows.map((r) => r.id);
    logger.info(
      { requested: randomSample, selected: sampleIds.length, skipRecentDays },
      'Random parlementaire sample selected'
    );
  }

  // Default working set: new fiches only (or all active with --force).
  const baseWhere: Prisma.ParlementaireWhereInput = force
    ? { actif: true }
    : { actif: true, resumeIA: null };

  // Single source of truth for the projection — ParlRecord is inferred from this select.
  async function fetchBatch(where: Prisma.ParlementaireWhereInput, take: number) {
    return prisma.parlementaire.findMany({
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
  }
  type ParlRecord = Awaited<ReturnType<typeof fetchBatch>>[number];

  const processParl = (parl: ParlRecord) =>
      limiter(async () => {
        try {
          // Extract mandats from sourceData
          const mandats = parl.chambre === 'senat'
            ? extractMandatsSenat(parl.sourceData)
            : extractMandatsAN(parl.sourceData);

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

          if (!bypassHash && parl.iaContentHash === contentHash) {
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

          // Recherche Tavily — obligatoire, pas optionnelle.
          //
          // Un résultat `null` signifie que la source n'a pas répondu (quota,
          // clé refusée, réseau), pas qu'elle n'a rien trouvé — l'absence de
          // résultat est un tableau vide. Produire la fiche quand même
          // reviendrait à publier un texte non sourcé en le datant comme frais,
          // ce qui s'est produit 76 fois entre le 24 et le 26 juillet 2026.
          // On saute la fiche : elle garde son contenu et sa date précédents,
          // et sera reprise au prochain passage.
          const tavilyResults = await tavilySearch(
            `${parl.prenom} ${parl.nom} ${role} France actualité politique`,
            { excludeDomains: TAVILY_SOCIAL_EXCLUDE, maxResults: 3 },
          );

          if (tavilyResults === null) {
            const { reason } = getTavilyStatus();
            logger.warn(
              { parlementaireId: parl.id, raison: reason ?? 'erreur' },
              'Tavily indisponible — fiche non enrichie',
            );
            result.skipped++;
            return;
          }

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
            tavilyResults: tavilyResults?.map(r => ({
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
        } catch (error) {
          result.errors++;
          logger.warn(
            { parlId: parl.id, nom: parl.nom, error: errorMessage(error) },
            'Failed to enrich parlementaire'
          );
        }
      });

  // Run the per-parlementaire enrichment over the chosen working set.
  if (sampleIds) {
    for (let off = 0; off < sampleIds.length; off += BATCH_SIZE) {
      const chunk = sampleIds.slice(off, off + BATCH_SIZE);
      const records = await fetchBatch({ id: { in: chunk } }, chunk.length);
      await Promise.all(records.map(processParl));
      logger.info(
        { processed: Math.min(off + BATCH_SIZE, sampleIds.length), total: sampleIds.length },
        'Random sample batch processed'
      );
    }
  } else {
    // Cursor-free pagination: enriched rows drop out of `resumeIA: null`, so we re-take
    // from the top each batch (the legacy behaviour for the non-sample path).
    //
    // Garde anti-boucle infinie : cette pagination ne progresse QUE si les fiches
    // traitées quittent le set `resumeIA: null`. Si un batch entier échoue sans enrichir
    // une seule fiche (ex. quota Tavily épuisé en cours de run), les mêmes lignes sont
    // repiochées indéfiniment. On s'arrête donc dès qu'un batch ne fait aucun progrès.
    let remaining = limit ?? Infinity;
    while (remaining > 0) {
      const take = Math.min(BATCH_SIZE, remaining);
      const records = await fetchBatch(baseWhere, take);
      if (records.length === 0) break;
      const enrichedBefore = result.enriched;
      await Promise.all(records.map(processParl));
      remaining -= records.length;
      if (result.enriched === enrichedBefore) {
        logger.error(
          { errors: result.errors, restants: records.length },
          'Backfill parlementaires interrompu : batch sans aucun progrès (dépendance externe en échec ?)',
        );
        break;
      }
      if (records.length < take) break;
    }
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
    } catch (error) {
      // Skip duplicate / invalid date errors silently
      logger.debug({ sourceUid: m.sourceUid, error: errorMessage(error) }, 'Mandat upsert failed');
    }
  }
}
