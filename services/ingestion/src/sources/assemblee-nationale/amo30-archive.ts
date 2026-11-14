// =============================================================================
// Archive AMO30 de l'AN (« tous acteurs, tous mandats, tous organes, historique »)
//
// Lue par deux étapes du batch nocturne : les commissions et les gouvernements.
// Le CDN de l'AN ralentit fortement le second tirage d'une même archive
// (mesuré le 2026-07-26 : 45x plus lent), d'où un seul téléchargement par
// processus, partagé, et effacé par `libererArchivesAMO30()` en fin de batch.
// =============================================================================

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { LEGISLATURE_AN_COURANTE } from '../../workers/mandats';
import { downloadWithRetry } from '../../utils/download';
import { logger } from '../../utils/logger.js';

const execFileAsync = promisify(execFile);

export function urlArchiveAMO30(legislature: number = LEGISLATURE_AN_COURANTE): string {
  return (
    `https://data.assemblee-nationale.fr/static/openData/repository/${legislature}/amo/` +
    `tous_acteurs_mandats_organes_xi_legislature/` +
    `AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`
  );
}

interface ArchiveExtraite {
  racine: string; // répertoire temporaire, effacé en entier
  json: string; // json/ : organe/, acteur/, deport/
}

const archives = new Map<number, Promise<ArchiveExtraite>>();

/**
 * Le répertoire `json/` de l'archive extraite (`organe/PO….json`,
 * `acteur/PA….json`). Téléchargée au premier appel, servie telle quelle aux
 * suivants. Un échec n'est pas retenu : l'appel suivant retente.
 */
export async function repertoireAMO30(legislature: number = LEGISLATURE_AN_COURANTE): Promise<string> {
  let archive = archives.get(legislature);
  if (!archive) {
    archive = telecharger(legislature);
    archives.set(legislature, archive);
    archive.catch(() => archives.delete(legislature));
  }
  return (await archive).json;
}

async function telecharger(legislature: number): Promise<ArchiveExtraite> {
  // Répertoire propre au processus : deux commandes lancées en même temps sur
  // la même machine ne se marchent pas dessus.
  const racine = await fs.promises.mkdtemp(path.join(os.tmpdir(), `clair-amo30-${legislature}-`));
  try {
    const zip = path.join(racine, 'AMO30.zip');
    const url = urlArchiveAMO30(legislature);
    logger.info({ url }, 'Téléchargement de l’archive AMO30');
    await downloadWithRetry(url, zip);
    const { size } = await fs.promises.stat(zip);

    const extraction = path.join(racine, 'extracted');
    await fs.promises.mkdir(extraction);
    await execFileAsync('unzip', ['-q', '-o', zip, '-d', extraction], { maxBuffer: 1024 * 1024 * 200 });
    await fs.promises.rm(zip);

    const json = path.join(extraction, 'json');
    await fs.promises.access(path.join(json, 'organe'));
    await fs.promises.access(path.join(json, 'acteur'));
    logger.info({ legislature, sizeMB: (size / 1024 / 1024).toFixed(2) }, 'Archive AMO30 extraite');
    return { racine, json };
  } catch (error) {
    await fs.promises.rm(racine, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/** Efface les archives extraites par ce processus. Sans effet si aucune. */
export async function libererArchivesAMO30(): Promise<void> {
  const enCours = [...archives.values()];
  archives.clear();
  for (const archive of enCours) {
    const extraite = await archive.catch(() => null);
    if (extraite) await fs.promises.rm(extraite.racine, { recursive: true, force: true }).catch(() => {});
  }
}

/** Les fichiers `.json` d'un sous-répertoire de l'archive (`organe`, `acteur`). */
export async function fichiersAMO30(json: string, sousRepertoire: 'organe' | 'acteur'): Promise<string[]> {
  const dir = path.join(json, sousRepertoire);
  const noms = await fs.promises.readdir(dir);
  return noms.filter((n) => n.endsWith('.json')).sort().map((n) => path.join(dir, n));
}
