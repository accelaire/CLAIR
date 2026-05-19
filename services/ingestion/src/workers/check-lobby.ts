// =============================================================================
// Check Lobby — Correspondance sémantique actions de lobbying ↔ sujets
// Utilise les embeddings Mistral (mistral-embed) pour l'appariement sémantique.
// Les embeddings sont mis en cache dans la base de données (colonne "embed")
// pour éviter les appels API redondants.
// Seules les actions ciblant des parlementaires sont évaluées.
// Une action ne peut correspondre à un sujet que si elle a eu lieu avant
// la dateFin du sujet (si celle-ci est renseignée).
// =============================================================================

import { PrismaClient, Prisma } from "@prisma/client";
import { CLAIRMistralClient } from "../llm/mistral-client.js";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// Score de similarité cosinus minimum pour accepter une correspondance
const DEFAULT_MIN_SCORE = 0.35;
// Nombre max de sujets retournés par action
const DEFAULT_TOP_N = 3;
// Ancienneté maximale des actions prises en compte (en ms)
const DEFAULT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 an
// Dimension des embeddings Mistral (mistral-embed)
const EMBEDDING_DIM = 1024;

// =============================================================================
// Types
// =============================================================================

export interface LobbyMatch {
  actionId: string;
  lobbyisteId: string;
  actionDescription: string;
  actionDateDebut: Date;
  actionDateFin: Date | null;
  sujetId: string;
  sujetLabel: string;
  sujetDateFin: Date | null;
  score: number;
}

export interface CheckLobbyResult {
  totalActions: number;
  matched: number;
  unmatched: number;
  skipped: number;
  persisted: number;
  matches: LobbyMatch[];
  durationMs: number;
}

export interface CheckLobbyOptions {
  /** Limite le nombre d'actions à traiter (utile pour les tests) */
  limit?: number;
  /** Score de similarité cosinus minimum (défaut : 0.35) */
  minScore?: number;
  /** Nombre max de sujets retournés par action (défaut : 3) */
  topN?: number;
  /** Ancienneté maximale des actions à prendre en compte (défaut : 1 an) */
  maxAgeMs?: number;
  /** Upsert les correspondances dans sujet_action_lobby (défaut : false) */
  persist?: boolean;
  /** Dimension des embeddings (défaut : 1024 pour mistral-embed) */
  embedDim?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function cosineSimilarity(a: number[], b: number[], dim: number): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < dim; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Sélectionne le texte d'un sujet pour l'embedding selon la priorité :
 * enjeux → resume → label → slug (première valeur non vide).
 */
function pickSujetText(sujet: {
  id: string;
  label: string;
  slug: string;
  resume: string | null;
  enjeux: string | null;
}): { text: string; source: "enjeux" | "resume" | "label" | "slug" } {
  if (sujet.resume) return { text: sujet.resume, source: "resume" };
  if (sujet.enjeux) return { text: sujet.enjeux, source: "enjeux" };
  if (sujet.label) return { text: sujet.label, source: "label" };
  return { text: sujet.slug, source: "slug" };
}

/**
 * Sélectionne le texte d'une action pour l'embedding selon la priorité :
 * description → texteViseNom (première valeur non vide).
 */
function pickActionText(
  description: string | null | undefined,
  texteViseNom: string | null | undefined,
): { text: string; source: "description" | "texteVise" } | null {
  if (description) return { text: description, source: "description" };
  if (texteViseNom) return { text: texteViseNom, source: "texteVise" };
  return null;
}

/**
 * Parse un embedding JSONB stocké en DB en number[].
 */
function parseEmbed(raw: Prisma.JsonValue | null): number[] | null {
  if (!raw) return null;
  const arr = raw as number[];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr as number[];
}

// =============================================================================
// Worker principal
// =============================================================================

export async function checkLobby(
  options: CheckLobbyOptions = {},
): Promise<CheckLobbyResult> {
  const {
    limit,
    minScore = DEFAULT_MIN_SCORE,
    topN = DEFAULT_TOP_N,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    persist = false,
    embedDim = EMBEDDING_DIM,
  } = options;
  const threshold = new Date(Date.now() - maxAgeMs);
  const startTime = Date.now();

  const result: CheckLobbyResult = {
    totalActions: 0,
    matched: 0,
    unmatched: 0,
    skipped: 0,
    persisted: 0,
    matches: [],
    durationMs: 0,
  };

  if (!process.env.MISTRAL_API_KEY) {
    logger.warn("MISTRAL_API_KEY not set — skipping lobby-sujet matching");
    return result;
  }

  logger.info(
    "Démarrage de la correspondance sémantique actions lobby ↔ sujets (embeddings Mistral)...",
  );

  const mistral = new CLAIRMistralClient();

  // ===========================================================================
  // 1. Charger tous les sujets actifs
  // ===========================================================================
  const sujets = await prisma.sujet.findMany({
    where: { actif: true },
    select: {
      id: true,
      label: true,
      slug: true,
      resume: true,
      enjeux: true,
      dateFin: true,
      embed: true,
    },
  });

  if (sujets.length === 0) {
    logger.warn("Aucun sujet actif trouvé — abandon");
    result.durationMs = Date.now() - startTime;
    return result;
  }

  logger.info({ count: sujets.length }, "Sujets chargés");

  // ===========================================================================
  // 2. Générer ou charger les embeddings des sujets
  // ===========================================================================
  const sujetTexts: string[] = [];
  const sujetEmbeddings: (number[] | null)[] = [];
  const sujetSources: Array<"enjeux" | "resume" | "label" | "slug"> = [];
  const sourceCounts = { enjeux: 0, resume: 0, label: 0, slug: 0 };
  const sujetIdsNeedingEmbed: string[] = [];
  const sujetIdxById = new Map<string, number>();

  for (let i = 0; i < sujets.length; i++) {
    const s = sujets[i]!;
    const { text, source } = pickSujetText(s);
    sujetTexts.push(text);
    sujetSources.push(source);
    sourceCounts[source]++;
    sujetIdxById.set(s.id, i);

    const cached = parseEmbed(s.embed);
    if (cached && cached.length === embedDim) {
      sujetEmbeddings.push(cached);
    } else {
      sujetEmbeddings.push(null);
      sujetIdsNeedingEmbed.push(s.id);
    }
  }

  if (sujetIdsNeedingEmbed.length > 0) {
    logger.info(
      {
        total: sujets.length,
        toGenerate: sujetIdsNeedingEmbed.length,
        sources: sourceCounts,
      },
      "Génération des embeddings manquants pour les sujets...",
    );

    // Build the texts for only the sujets needing embedding (in order)
    const textsToEmbed = sujetIdsNeedingEmbed.map((id) => {
      const idx = sujetIdxById.get(id)!;
      return sujetTexts[idx]!;
    });

    const newEmbeddings = await mistral.embed(textsToEmbed);

    // Store in memory and persist to DB
    for (let j = 0; j < sujetIdsNeedingEmbed.length; j++) {
      const id = sujetIdsNeedingEmbed[j]!;
      const idx = sujetIdxById.get(id)!;
      const vec = newEmbeddings[j]!;
      sujetEmbeddings[idx] = vec;

      if (persist) {
        await prisma.sujet.update({
          where: { id },
          data: { embed: vec as any },
        });
      }
    }

    logger.info(
      { generated: newEmbeddings.length, dim: newEmbeddings[0]?.length },
      "Embeddings sujets générés et mis en cache",
    );
  } else {
    logger.info(
      { count: sujets.length },
      "Tous les embeddings sujets sont déjà en cache",
    );
  }

  // ===========================================================================
  // 3. Charger les actions de lobbying ciblant des parlementaires
  // ===========================================================================
  logger.info({ threshold }, "Seuil d'ancienneté des actions lobby");
  const actions = await prisma.actionLobby.findMany({
    where: { cible: "parlementaire", dateDebut: { gte: threshold } },
    select: {
      id: true,
      lobbyisteId: true,
      dateDebut: true,
      dateFin: true,
      texteViseNom: true,
      embed: true,
      actionDescription: {
        select: { texte: true },
      },
    },
    ...(limit ? { take: limit } : {}),
  });

  result.totalActions = actions.length;
  logger.info(
    { count: actions.length },
    "Actions lobby (cible=parlementaire) chargées",
  );

  // ===========================================================================
  // 4. Apparier chaque action aux sujets éligibles
  // ===========================================================================
  const actionSourceCounts = { description: 0, texteVise: 0, vide: 0 };
  let actionIdx = 0;

  for (const action of actions) {
    actionIdx++;
    const picked = pickActionText(
      action.actionDescription?.texte,
      action.texteViseNom,
    );

    if (!picked) {
      actionSourceCounts.vide++;
      result.skipped++;
      continue;
    }

    actionSourceCounts[picked.source]++;

    // Embedding de l'action — utiliser le cache si disponible
    let actionEmbedding = parseEmbed(action.embed);

    if (!actionEmbedding || actionEmbedding.length !== embedDim) {
      logger.debug(
        { actionIdx, total: actions.length, source: picked.source },
        "Génération embedding action (pas de cache)...",
      );

      try {
        const embeddings = await mistral.embed([picked.text]);
        actionEmbedding = embeddings[0]!;

        // Persister le cache si demandé
        if (persist) {
          await prisma.actionLobby.update({
            where: { id: action.id },
            data: { embed: actionEmbedding as any },
          });
        }
      } catch (error: any) {
        logger.warn(
          { actionId: action.id, error: error.message },
          "Échec embedding action, ignorée",
        );
        result.skipped++;
        continue;
      }
    } else {
      logger.debug(
        { actionIdx, total: actions.length },
        "Embedding action (cache)",
      );
    }

    if (!actionEmbedding || actionEmbedding.length !== embedDim) {
      result.skipped++;
      continue;
    }

    // Filtrer les sujets par contrainte temporelle
    const candidateIndices: number[] = [];
    for (let i = 0; i < sujets.length; i++) {
      const sujetItem = sujets[i];
      if (!sujetItem) continue;
      if (sujetItem.dateFin !== null && action.dateDebut >= sujetItem.dateFin) {
        continue;
      }
      candidateIndices.push(i);
    }

    if (candidateIndices.length === 0) {
      result.unmatched++;
      continue;
    }

    // Calculer les similarités cosinus et garder le top-N au-dessus du seuil
    const scored: Array<{ index: number; score: number }> = [];
    for (const idx of candidateIndices) {
      const sujetVector = sujetEmbeddings[idx];
      if (!sujetVector) continue;
      const score = cosineSimilarity(actionEmbedding, sujetVector, embedDim);
      if (score >= minScore) {
        scored.push({ index: idx, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, topN);

    if (topMatches.length === 0) {
      result.unmatched++;
      continue;
    }

    result.matched++;
    for (const { index, score } of topMatches) {
      const sujet = sujets[index];
      if (!sujet) continue;
      result.matches.push({
        actionId: action.id,
        lobbyisteId: action.lobbyisteId,
        actionDescription: picked.text,
        actionDateDebut: action.dateDebut,
        actionDateFin: action.dateFin,
        sujetId: sujet.id,
        sujetLabel: sujet.label,
        sujetDateFin: sujet.dateFin,
        score,
      });
    }
  }

  // ===========================================================================
  // 5. Persister les correspondances dans sujet_action_lobby
  // ===========================================================================
  if (persist && result.matches.length > 0) {
    logger.info(
      { count: result.matches.length },
      "Persistance des correspondances...",
    );
    for (const m of result.matches) {
      await prisma.sujetActionLobby.upsert({
        where: {
          sujetId_actionLobbyId: {
            sujetId: m.sujetId,
            actionLobbyId: m.actionId,
          },
        },
        create: {
          sujetId: m.sujetId,
          actionLobbyId: m.actionId,
          score: m.score,
        },
        update: { score: m.score },
      });
      result.persisted++;
    }
    logger.info({ persisted: result.persisted }, "Correspondances persistées");
  }

  result.durationMs = Date.now() - startTime;

  logger.info(
    {
      totalActions: result.totalActions,
      matched: result.matched,
      unmatched: result.unmatched,
      skipped: result.skipped,
      persisted: result.persisted,
      totalMatches: result.matches.length,
      durationMs: result.durationMs,
      tokensIn: mistral.totalTokensIn,
      sujetSources: sourceCounts,
      actionSources: actionSourceCounts,
    },
    "Correspondance sémantique actions lobby ↔ sujets terminée",
  );

  return result;
}
