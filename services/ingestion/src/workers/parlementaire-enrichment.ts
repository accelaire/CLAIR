// =============================================================================
// Enrichissement IA des fiches parlementaires
// Pipeline : DB stats + mandats sourceData + HATVP declarations + Wikipedia + Wikidata → Mistral → DB
// =============================================================================

import { Prisma, PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { CLAIRMistralClient } from '../llm/mistral-client.js';
import { cleanLLMOutput } from '../llm/clean-output.js';
import {
  SYSTEM_PROMPT_PARLEMENTAIRE,
  buildParlementaireResumePrompt,
  type ParlementairePromptData,
} from '../llm/prompts.js';
import { defautsBio, signatureEditoriale } from '../llm/bio-parlementaire.js';
import { fetchWikipediaBio } from '../sources/wikipedia/client.js';
import { fetchWikidataFacts } from '../sources/wikidata/client.js';
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
  const { limit, dryRun = false, concurrency = 2, force = false, randomSample, skipRecentDays = 3, only, preview = false, perimees } = options;
  const cibles = only?.length ? only : null;

  const result: EnrichmentResult = {
    enriched: 0, skipped: 0, errors: 0, totalTokensIn: 0, totalTokensOut: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn('MISTRAL_API_KEY not set — skipping parlementaire IA enrichment');
    return result;
  }

  const mistral = new CLAIRMistralClient();
  const limiter = pLimit(concurrency);

  // Plus de dépendance web dure. Le socle sourcé de chaque fiche, c'est NOTRE dossier
  // parlementaire (mandats, votes, présence, HATVP), toujours présent. Wikipédia et
  // Wikidata ne font qu'ajouter du contexte biographique traçable : leur absence
  // appauvrit la fiche mais ne bloque jamais la génération (fini les 76 fiches sautées
  // et la boucle infinie du quota Tavily épuisé).
  logger.info(
    { dryRun, concurrency, limit, force, cibles: cibles?.length ?? 0 },
    'Starting parlementaires IA enrichment...'
  );

  // bypassHash: with --force or --random we regenerate regardless of content hash,
  // which also refreshes iaGeneratedAt (the "mise à jour" date shown on the public fiche).
  // Désigner une fiche par son slug vaut demande de régénération : le hash ne
  // couvre que les données structurées, donc une fiche dont seul le TEXTE est
  // fautif a un hash inchangé et serait sautée. C'est le cas d'usage que la
  // ligne d'aide de `--only` décrit : corriger une fiche sans relancer le corpus.
  const bypassHash = force || randomSample != null || cibles != null;

  // Optional random sample: pick N parlementaires at random (ORDER BY random()),
  // excluding those already refreshed in the last `skipRecentDays` days so a daily rotation
  // converges over the whole parc instead of re-hitting fresh fiches.
  // skipRecentDays = 0 disables the exclusion.
  //
  // Le tirage couvre les élus en exercice ET les anciens qui ont une fiche : la
  // rotation est le seul moyen d'apprendre ce que nos données ignorent (un ancien
  // député devenu maire de Roubaix n'apparaît que dans Wikidata).
  let sampleIds: string[] | null = null;
  if (randomSample != null) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM parlementaires
      WHERE (actif = true OR resume_ia IS NOT NULL)
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

  // Fiches périmées : celles dont l'empreinte éditoriale ne correspond plus aux
  // données. Calcul en mémoire sur le parc entier (quelques milliers de lignes
  // légères, sans `sourceData`), par la même fonction que l'écriture.
  let perimeesIds: string[] | null = null;
  if (randomSample == null && perimees != null) {
    const fiches = await prisma.parlementaire.findMany({
      where: { resumeIA: { not: null } },
      select: {
        id: true,
        nom: true,
        prenom: true,
        chambre: true,
        actif: true,
        commissionPermanente: true,
        iaContentHash: true,
        iaGeneratedAt: true,
        groupe: { select: { nom: true } },
        circonscription: { select: { departement: true, numero: true } },
        mandatsParlementaires: {
          select: { chambre: true, legislature: true, mandature: true, dateDebut: true, dateFin: true },
        },
      },
    });
    const perimes = fiches
      .filter(f => f.iaContentHash !== signatureEditoriale({ ...f, groupe: f.groupe?.nom }))
      // Les plus anciennes d'abord ; départage par id pour un ordre stable.
      .sort((a, b) =>
        (a.iaGeneratedAt?.getTime() ?? 0) - (b.iaGeneratedAt?.getTime() ?? 0) || a.id.localeCompare(b.id));
    perimeesIds = perimes.slice(0, perimees).map(f => f.id);
    logger.info(
      { fiches: fiches.length, perimees: perimes.length, retenues: perimeesIds.length },
      'Fiches parlementaires périmées sélectionnées',
    );
  }

  // Working set : les fiches désignées par `--only` si elles le sont, sinon les
  // fiches neuves — ou toutes les fiches actives avec `--force`.
  //
  // `--only` ne filtre pas sur `actif` : on corrige aussi bien la fiche d'un
  // ancien parlementaire, qui reste publiée et indexée.
  const baseWhere: Prisma.ParlementaireWhereInput = cibles
    ? { slug: { in: cibles } }
    : force
      ? { actif: true }
      : { actif: true, resumeIA: null };

  // Single source of truth for the projection — ParlRecord is inferred from this select.
  async function fetchBatch(where: Prisma.ParlementaireWhereInput, take: number, skip = 0) {
    return prisma.parlementaire.findMany({
      where,
      select: {
        id: true,
        slug: true,
        prenom: true,
        nom: true,
        chambre: true,
        profession: true,
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
        groupe: { select: { nom: true, nomComplet: true } },
        circonscription: { select: { departement: true, numero: true, nom: true } },
        // Les mandats de député ou de sénateur eux-mêmes : `extractMandatsAN`
        // écarte le type ASSEMBLEE, le modèle ne voyait donc que des commissions
        // et devinait la carrière (« ne se représente pas en 2024 » pour un
        // député réélu en 2024).
        mandatsParlementaires: {
          select: { chambre: true, legislature: true, mandature: true, dateDebut: true, dateFin: true },
          orderBy: [{ dateDebut: 'asc' }, { id: 'asc' }],
        },
      },
      // Départage obligatoire dès qu'on pagine avec un décalage : deux
      // parlementaires de même chambre et de même nom ne sont pas rendus dans
      // un ordre garanti, et un tri non total fait sauter des lignes d'un lot
      // à l'autre tout en en répétant d'autres.
      orderBy: [{ chambre: 'asc' }, { nom: 'asc' }, { id: 'asc' }],
      take,
      skip,
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

          // Empreinte des seuls faits que la fiche affirme (statut, chambre, groupe,
          // commission, mandats, version du prompt) : cf. llm/bio-parlementaire.ts.
          // Les statistiques et le lobbying n'y entrent plus : ils changeaient à
          // chaque scrutin, et le prompt interdit désormais d'en citer les chiffres.
          const contentHash = signatureEditoriale({
            nom: parl.nom,
            prenom: parl.prenom,
            chambre: parl.chambre,
            actif: parl.actif,
            groupe: parl.groupe?.nom,
            commissionPermanente: parl.commissionPermanente,
            circonscription: parl.circonscription,
            mandatsParlementaires: parl.mandatsParlementaires,
          });

          if (!bypassHash && parl.iaContentHash === contentHash) {
            result.skipped++;
            return;
          }

          if (dryRun) {
            result.enriched++;
            return;
          }

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

          // Fetch Wikipedia bio (rate-limit friendly, 1 req per parl)
          const role = parl.chambre === 'senat' ? 'sénateur' : 'député';
          const wikiBio = await fetchWikipediaBio(parl.prenom, parl.nom, { role });

          // Faits structurés Wikidata (best-effort, sourcé et traçable).
          // Gratuit, sans quota, sans clé. En cas d'indisponibilité, on continue :
          // la fiche reste ancrée sur nos données + Wikipédia.
          const wikidata = await fetchWikidataFacts(parl.prenom, parl.nom);

          // Build prompt data
          const circoStr = parl.circonscription
            ? `${parl.circonscription.nom || parl.circonscription.departement} (${parl.circonscription.numero})`
            : null;

          const promptData: ParlementairePromptData = {
            prenom: parl.prenom,
            nom: parl.nom,
            chambre: parl.chambre,
            groupe: parl.groupe?.nom,
            groupeIntitule: parl.groupe?.nomComplet,
            profession: parl.profession,
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
            mandatsParlementaires: parl.mandatsParlementaires.map(m => ({
              chambre: m.chambre,
              legislature: m.legislature,
              mandature: m.mandature,
              anneeDebut: m.dateDebut.getUTCFullYear(),
              anneeFin: m.dateFin?.getUTCFullYear() ?? null,
            })),
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
            wikidataFacts: wikidata && {
              description: wikidata.description,
              partis: wikidata.partis,
              fonctions: wikidata.fonctions,
            },
          };

          // Provenance des sources web utilisées — chaque fiche devient traçable.
          const fetchedAt = new Date().toISOString();
          const iaSources = {
            wikipedia: wikiBio?.found ? { url: wikiBio.pageUrl, fetchedAt } : null,
            wikidata: wikidata ? { url: wikidata.pageUrl, fetchedAt } : null,
          };

          const userPrompt = buildParlementaireResumePrompt(promptData);

          // Une consigne ne suffit pas : le modèle écrit encore des âges, des
          // chiffres d'activité ou un mandat terminé au présent. Une fiche qui en
          // porte n'est pas publiée ; chaque nouvel essai lui renvoie ses fautes.
          const ctxDefauts = { actif: parl.actif, chambre: parl.chambre };
          let fiche = decouperFiche(await mistral.complete(
            SYSTEM_PROMPT_PARLEMENTAIRE,
            userPrompt,
            { maxTokens: 1500 },
          ));
          let defauts = defautsBio(texteDeLaFiche(fiche), ctxDefauts);
          // Deux essais de plus au maximum : sur 8 fiches de prod le 2026-10-11,
          // un seul nouvel essai laissait encore 2 fiches refusées (des durées).
          for (let essai = 2; defauts.length > 0 && essai <= ESSAIS_MAX; essai++) {
            logger.info({ slug: parl.slug, essai, defauts }, 'Fiche parlementaire refusée, nouvel essai');
            fiche = decouperFiche(await mistral.complete(
              SYSTEM_PROMPT_PARLEMENTAIRE,
              userPrompt + consigneDeNouvelEssai(defauts),
              { maxTokens: 1500 },
            ));
            defauts = defautsBio(texteDeLaFiche(fiche), ctxDefauts);
          }
          if (fiche.separateursManquants) {
            logger.warn({ parlId: parl.id, manquants: fiche.separateursManquants }, 'Parlementaire response missing separators');
          }
          const { resumeIA, parcoursIA, positionsClesIA, faitsNotablesIA } = fiche;

          if (preview) {
            console.log(
              `\n===== APERÇU ${parl.chambre} ${parl.prenom} ${parl.nom}${parl.actif ? '' : ' (ancien)'} =====\n`
              + `${resumeIA}\n\n--- PARCOURS ---\n${parcoursIA ?? ''}\n\n--- POSITIONS ---\n${positionsClesIA ?? ''}\n\n--- FAITS ---\n${faitsNotablesIA ?? ''}\n`,
            );
            if (defauts.length > 0) console.log(`⛔ REFUSÉE après ${ESSAIS_MAX} essais :\n- ${defauts.join('\n- ')}\n`);
            result.enriched++;
            return;
          }

          // Refusée à chaque essai : la fiche en ligne reste, et comme l'empreinte
          // n'est pas mise à jour, la fiche sera retentée la nuit suivante.
          if (defauts.length > 0) {
            result.errors++;
            logger.warn({ slug: parl.slug, defauts }, 'Fiche parlementaire refusée à chaque essai, non publiée');
            return;
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

          // Provenance : écriture best-effort et découplée. Si la colonne ia_sources
          // n'a pas encore été migrée, on n'échoue PAS la génération (elle s'activera
          // d'elle-même après le ALTER). Voir migration ia_sources.
          try {
            await prisma.parlementaire.update({
              where: { id: parl.id },
              data: { iaSources },
            });
          } catch (e) {
            logger.debug({ parlId: parl.id, error: errorMessage(e) }, 'Provenance ia_sources non persistée (colonne absente ?)');
          }

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
  const idsDesignes = sampleIds ?? perimeesIds;
  if (idsDesignes) {
    for (let off = 0; off < idsDesignes.length; off += BATCH_SIZE) {
      const chunk = idsDesignes.slice(off, off + BATCH_SIZE);
      const records = await fetchBatch({ id: { in: chunk } }, chunk.length);
      await Promise.all(records.map(processParl));
      logger.info(
        { processed: Math.min(off + BATCH_SIZE, idsDesignes.length), total: idsDesignes.length },
        sampleIds ? 'Random sample batch processed' : 'Fiches périmées : lot traité',
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
    //
    // Ce « re-take depuis le haut » ne vaut QUE pour le set qui se draine. Les
    // fiches désignées par `--only`, comme celles de `--force`, restent dans
    // leur set une fois enrichies : repiocher depuis le début y rendait
    // indéfiniment les mêmes cinquante lignes, et au-delà de cinquante cibles
    // sans `--limit` la commande tournait sans fin en brûlant des appels
    // Mistral et Tavily. Ces sets-là se parcourent donc au décalage.
    const setSeDraine = !cibles && !force;
    let deja = 0;
    let remaining = limit ?? Infinity;
    while (remaining > 0) {
      const take = Math.min(BATCH_SIZE, remaining);
      const records = await fetchBatch(baseWhere, take, setSeDraine ? 0 : deja);
      if (records.length === 0) break;
      const enrichedBefore = result.enriched;
      await Promise.all(records.map(processParl));
      remaining -= records.length;
      deja += records.length;
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
// Réponse du modèle : découpage et nouvel essai
// =============================================================================

interface FicheGeneree {
  resumeIA: string;
  parcoursIA: string | null;
  positionsClesIA: string | null;
  faitsNotablesIA: string | null;
  /** Séparateurs absents de la réponse, `null` si elle est complète. */
  separateursManquants: string | null;
}

function decouperFiche(response: string): FicheGeneree {
  const parcoursSep = '---PARCOURS---';
  const positionsSep = '---POSITIONS---';
  const faitsSep = '---FAITS---';

  const parcoursIdx = response.indexOf(parcoursSep);
  const positionsIdx = response.indexOf(positionsSep);
  const faitsIdx = response.indexOf(faitsSep);

  if (parcoursIdx !== -1 && positionsIdx !== -1 && faitsIdx !== -1) {
    return {
      resumeIA: cleanLLMOutput(response.slice(0, parcoursIdx)),
      parcoursIA: cleanLLMOutput(response.slice(parcoursIdx + parcoursSep.length, positionsIdx)),
      positionsClesIA: cleanLLMOutput(response.slice(positionsIdx + positionsSep.length, faitsIdx)),
      faitsNotablesIA: cleanLLMOutput(response.slice(faitsIdx + faitsSep.length)),
      separateursManquants: null,
    };
  }
  if (parcoursIdx !== -1 && positionsIdx !== -1) {
    return {
      resumeIA: cleanLLMOutput(response.slice(0, parcoursIdx)),
      parcoursIA: cleanLLMOutput(response.slice(parcoursIdx + parcoursSep.length, positionsIdx)),
      positionsClesIA: cleanLLMOutput(response.slice(positionsIdx + positionsSep.length)),
      faitsNotablesIA: null,
      separateursManquants: faitsSep,
    };
  }
  // Sans séparateurs : la réponse entière tient lieu de résumé.
  return {
    resumeIA: response,
    parcoursIA: null,
    positionsClesIA: null,
    faitsNotablesIA: null,
    separateursManquants: [parcoursSep, positionsSep, faitsSep].join(' '),
  };
}

function texteDeLaFiche(f: FicheGeneree): string {
  return [f.resumeIA, f.parcoursIA, f.positionsClesIA, f.faitsNotablesIA].filter(Boolean).join('\n\n');
}

/** Nombre total d'appels au modèle pour une fiche, premier compris. */
const ESSAIS_MAX = 3;

function consigneDeNouvelEssai(defauts: string[]): string {
  return [
    '',
    '',
    'Ta réponse précédente a été refusée pour ces raisons :',
    ...defauts.map(d => `- ${d}`),
    'Réécris la fiche entière, avec les mêmes séparateurs, en respectant toutes les règles.',
    'Pour une durée ou un âge : ne le reformule pas autrement (« une décennie », « près de vingt ans ») ; écris les années de début et de fin tirées des données (« de 2004 à 2026 »), ou supprime la précision.',
    'Pour un chiffre d\'activité : supprime-le, sans le remplacer par un autre chiffre.',
    'Pour un mandat terminé : écris-le au passé (« a été sénateur »).',
  ].join('\n');
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
