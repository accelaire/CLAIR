// =============================================================================
// Téléchargement d'archives avec reprise et diagnostic
// =============================================================================
//
// Motivation — panne des amendements AN, 7 échecs sur 8 jours (19 → 26 juillet
// 2026), tous avec le même message : « aborted ».
//
// Ce message ne disait rien. `pipeline()` détruit le flux source dès que
// n'importe quoi échoue en aval, et axios remonte alors un `aborted` sec :
// l'erreur d'origine (disque plein, connexion coupée, réponse tronquée) est
// perdue. Sept jours d'enquête impossible faute d'avoir su QUOI avait échoué.
//
// Ce module corrige deux choses :
//  1. Il capture le contexte au moment de l'échec — octets reçus, taille
//     attendue, durée, code d'erreur, chaîne de causes, espace disque restant.
//  2. Il réessaie avec backoff. Une coupure transitoire ne doit plus faire
//     perdre une source pour 24 h.
//
// Il vérifie aussi que la taille reçue correspond à `content-length` : une
// archive tronquée sans erreur réseau produirait sinon un ZIP corrompu, échec
// bien plus difficile à diagnostiquer.
// =============================================================================

import fs from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import axios from 'axios';

import { logger } from './logger.js';
import { errorMessage, httpStatus } from './errors.js';

export interface DownloadOptions {
  /**
   * Timeout d'une tentative. Défaut : 10 min.
   *
   * Volontairement large : le CDN de l'AN throttle sévèrement les tirages
   * répétés. Mesuré le 2026-07-26 sur la même archive de 283 Mo depuis la même
   * machine — 1er tirage 5,4 s à 54,9 Mo/s, 2e tirage consécutif 241 s à
   * 1,23 Mo/s, soit 45x plus lent. Un timeout serré transformerait un simple
   * ralentissement en échec.
   */
  timeoutMs?: number;
  /** Nombre total de tentatives, reprises comprises. Défaut : 3. */
  maxAttempts?: number;
  /**
   * Attente avant la 1re reprise, doublée à chaque fois. Défaut : 30 s.
   *
   * Assez long pour laisser retomber une fenêtre de throttling : réessayer
   * dans la seconde ne ferait que se heurter au même refus.
   */
  backoffMs?: number;
  userAgent?: string;
  accept?: string;
}

export interface DownloadResult {
  bytes: number;
  attempts: number;
  durationMs: number;
}

const DEFAULTS = {
  timeoutMs: 600_000,
  maxAttempts: 3,
  backoffMs: 30_000,
  userAgent: 'CLAIR-Bot/1.0 (https://github.com/clair)',
  accept: 'application/zip, application/octet-stream',
};

/** Espace libre sur le système de fichiers contenant `p`, en octets. */
async function freeBytes(p: string): Promise<number | null> {
  try {
    const st = await fs.promises.statfs(p);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    // statfs n'existe pas partout ; l'absence de mesure ne doit rien casser.
    return null;
  }
}

/** Déplie `error.cause` pour retrouver l'erreur réellement à l'origine. */
function causeChain(error: unknown): string[] {
  const chain: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const e = current as { code?: string; message?: string; cause?: unknown };
    const label = [e.code, e.message].filter(Boolean).join(' ');
    if (label) chain.push(label);
    current = e.cause;
  }
  return chain;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Une reprise n'a de sens que si l'échec peut se résoudre tout seul.
 *
 * Les erreurs réseau et les 5xx sont transitoires. Un 404 ou un 403 ne le sont
 * pas : les réessayer ne ferait que perdre du temps. 429 et 408 font exception,
 * ce sont précisément des invitations à réessayer plus tard.
 */
function isRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === undefined) return true; // erreur réseau / socket coupée
  if (status === 429 || status === 408) return true;
  return status >= 500;
}

/**
 * Télécharge `url` vers `destPath`, avec reprises et diagnostic détaillé.
 *
 * Lève une erreur enrichie du contexte de la dernière tentative si toutes
 * échouent — de quoi savoir enfin pourquoi, sans avoir à reproduire.
 */
export async function downloadWithRetry(
  url: string,
  destPath: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  const opts = { ...DEFAULTS, ...options };
  const startedAt = Date.now();
  let lastDiagnostic = '';

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const attemptStart = Date.now();
    let expected: number | null = null;
    let received = 0;

    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: opts.timeoutMs,
        headers: { 'User-Agent': opts.userAgent, Accept: opts.accept },
      });

      const declared = Number(response.headers['content-length']);
      expected = Number.isFinite(declared) && declared > 0 ? declared : null;

      const writer = createWriteStream(destPath);
      await pipeline(response.data, writer);
      received = writer.bytesWritten;

      // Une archive tronquée ne lève pas toujours d'erreur : on le détecte ici
      // plutôt que de laisser l'extraction échouer sur un ZIP corrompu.
      if (expected !== null && received !== expected) {
        throw new Error(`téléchargement tronqué : ${received} octets reçus sur ${expected} attendus`);
      }

      logger.info(
        { url, bytes: received, attempt, durationMs: Date.now() - attemptStart },
        'Archive downloaded',
      );

      return { bytes: received, attempts: attempt, durationMs: Date.now() - startedAt };
    } catch (error) {
      // Ce que `aborted` ne disait pas.
      try {
        received = (await fs.promises.stat(destPath)).size;
      } catch {
        received = 0;
      }
      const libre = await freeBytes(destPath.substring(0, destPath.lastIndexOf('/')) || '/tmp');

      const diagnostic = {
        url,
        attempt,
        maxAttempts: opts.maxAttempts,
        httpStatus: httpStatus(error),
        error: errorMessage(error),
        causes: causeChain(error),
        bytesReceived: received,
        bytesExpected: expected,
        freeDiskBytes: libre,
        attemptDurationMs: Date.now() - attemptStart,
      };
      lastDiagnostic = JSON.stringify(diagnostic);

      // On relance TOUJOURS l'erreur d'origine, jamais une Error enveloppée :
      // des appelants s'appuient sur `httpStatus(error)` pour décider quoi
      // faire — scrutins-client bascule sur un autre nom d'archive quand il
      // reçoit un 404. Envelopper l'erreur casserait ce repli en silence.
      if (!isRetryable(error)) {
        logger.error(diagnostic, 'Download failed, not retryable');
        throw error;
      }

      if (attempt === opts.maxAttempts) {
        logger.error(diagnostic, 'Download failed, no attempts left');
        throw error;
      }

      const wait = opts.backoffMs * 2 ** (attempt - 1);
      logger.warn({ ...diagnostic, retryInMs: wait }, 'Download failed, retrying');
      await sleep(wait);
    }
  }

  // Inatteignable : la boucle sort par return ou par throw.
  throw new Error(`Téléchargement échoué — ${lastDiagnostic}`);
}
