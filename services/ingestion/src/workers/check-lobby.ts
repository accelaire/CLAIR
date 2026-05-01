// =============================================================================
// Check Lobby — Correspondance sémantique actions de lobbying ↔ sujets
// Seules les actions ciblant des parlementaires sont évaluées.
// Une action ne peut correspondre à un sujet que si elle a eu lieu avant
// la dateFin du sujet (si celle-ci est renseignée).
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { TfidfVectorizer, cosineSimilarity, type SparseMatrix } from '../utils/tfidf.js';
import { tokenize } from '../utils/preprocess-scrutin.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// Score TF-IDF minimum pour accepter une correspondance
const DEFAULT_MIN_SCORE = 0.15;
// Nombre max de sujets retournés par action
const DEFAULT_TOP_N = 3;
// Ancienneté maximale des actions prises en compte (en ms)
const DEFAULT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 an

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
  /** Score TF-IDF minimum pour accepter une correspondance (défaut : 0.15) */
  minScore?: number;
  /** Nombre max de sujets retournés par action (défaut : 3) */
  topN?: number;
  /** Ancienneté maximale des actions à prendre en compte (défaut : 1 an) */
  maxAgeMs?: number;
  /** Upsert les correspondances dans sujet_action_lobby (défaut : false) */
  persist?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Sélectionne le texte d'un sujet pour TF-IDF selon la priorité :
 * resume → description → label (première valeur non vide).
 */
function pickSujetText(sujet: {
  id: string;
  label: string;
  description: string | null;
  resume: string | null;
}): { text: string; source: 'resume' | 'description' | 'label' } {
  if (sujet.resume) return { text: sujet.resume, source: 'resume' };
  if (sujet.description) return { text: sujet.description, source: 'description' };
  return { text: sujet.label, source: 'label' };
}

/**
 * Sélectionne le texte d'une action pour TF-IDF selon la priorité :
 * description → texteViseNom (première valeur non vide).
 */
function pickActionText(
  description: string | null | undefined,
  texteViseNom: string | null | undefined,
): { text: string; source: 'description' | 'texteVise' } | null {
  if (description) return { text: description, source: 'description' };
  if (texteViseNom) return { text: texteViseNom, source: 'texteVise' };
  return null;
}

// =============================================================================
// Worker principal
// =============================================================================

export async function checkLobby(options: CheckLobbyOptions = {}): Promise<CheckLobbyResult> {
  const {
    limit,
    minScore = DEFAULT_MIN_SCORE,
    topN = DEFAULT_TOP_N,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    persist = false,
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

  logger.info('Démarrage de la correspondance sémantique actions lobby ↔ sujets...');

  // 1. Charger tous les sujets actifs
  const sujets = await prisma.sujet.findMany({
    where: { actif: true },
    select: {
      id: true,
      label: true,
      description: true,
      resume: true,
      dateFin: true,
    },
  });

  if (sujets.length === 0) {
    logger.warn('Aucun sujet actif trouvé — abandon');
    result.durationMs = Date.now() - startTime;
    return result;
  }

  logger.info({ count: sujets.length }, 'Sujets chargés');

  // 2. Construire le corpus TF-IDF des sujets (resume → description → label)
  const sujetTexts: string[] = [];
  const sourceCounts = { resume: 0, description: 0, label: 0 };

  for (const s of sujets) {
    const { text, source } = pickSujetText(s);
    sujetTexts.push(tokenize(text).join(' '));
    sourceCounts[source]++;
    logger.debug({ sujetId: s.id, label: s.label, source }, 'Texte sujet sélectionné');
  }

  logger.info(
    { sourceCounts },
    'Sources utilisées pour les textes sujets (priorité : resume > description > label)'
  );

  const vectorizer = new TfidfVectorizer();
  const sujetVectors: SparseMatrix = vectorizer.fitTransform(sujetTexts);

  logger.info(
    { sujets: sujets.length, vocabSize: vectorizer.vocabularySize },
    'Corpus TF-IDF des sujets construit'
  );

  // 3. Charger les actions de lobbying ciblant des parlementaires (≥ seuil d'ancienneté)
  logger.info({ threshold }, 'Seuil d\'ancienneté des actions lobby');
  const actions = await prisma.actionLobby.findMany({
    where: { cible: 'parlementaire', dateDebut: { gte: threshold } },
    select: {
      id: true,
      lobbyisteId: true,
      dateDebut: true,
      dateFin: true,
      texteViseNom: true,
      actionDescription: {
        select: { texte: true },
      },
    },
    ...(limit ? { take: limit } : {}),
  });

  result.totalActions = actions.length;
  logger.info({ count: actions.length }, 'Actions lobby (cible=parlementaire) chargées');

  // 4. Apparier chaque action aux sujets éligibles
  for (const action of actions) {
    const picked = pickActionText(action.actionDescription?.texte, action.texteViseNom);

    if (!picked) {
      logger.debug({ actionId: action.id }, 'Action ignorée — ni description ni texteVise disponible');
      result.skipped++;
      continue;
    }

    logger.debug({ actionId: action.id, source: picked.source }, 'Texte action sélectionné');

    const actionTokens = tokenize(picked.text).join(' ');

    if (!actionTokens) {
      result.skipped++;
      continue;
    }

    // Projeter l'action dans l'espace vectoriel des sujets
    const actionVectors = vectorizer.transform([actionTokens]);
    const actionVector = actionVectors[0];
    if (!actionVector) {
      result.skipped++;
      continue;
    }

    // Filtrer les sujets par contrainte temporelle :
    // l'action doit avoir débuté avant la dateFin du sujet (si renseignée)
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

    // Calculer les similarités et garder le top-N au-dessus du seuil
    const scored: Array<{ index: number; score: number }> = [];
    for (const idx of candidateIndices) {
      const sujetVector = sujetVectors[idx];
      if (!sujetVector) continue;
      const score = cosineSimilarity(actionVector, sujetVector);
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

  // 5. Persister les correspondances dans sujet_action_lobby
  if (persist && result.matches.length > 0) {
    logger.info({ count: result.matches.length }, 'Persistance des correspondances...');
    for (const m of result.matches) {
      await prisma.sujetActionLobby.upsert({
        where: { sujetId_actionLobbyId: { sujetId: m.sujetId, actionLobbyId: m.actionId } },
        create: { sujetId: m.sujetId, actionLobbyId: m.actionId, score: m.score },
        update: { score: m.score },
      });
      result.persisted++;
    }
    logger.info({ persisted: result.persisted }, 'Correspondances persistées');
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
    },
    'Correspondance sémantique actions lobby ↔ sujets terminée'
  );

  return result;
}
