// =============================================================================
// Client Sénat — dump de la base des sénateurs (export_sens.zip)
// =============================================================================
//
// Les CSV ODSEN (`senat-histo-client.ts`) ne publient ni le bureau du Sénat ni
// les fonctions en commission ou dans les groupes. Le dump PostgreSQL complet
// de la même base, lui, les contient, datées : `senbur` (président,
// vice-présidents, questeurs, secrétaires), `memcom` + `fonmemcom` (président,
// rapporteur général… en commission), `memgrppol` + `fonmemgrppol`.
//
// ~8,5 Mo zippés, ~60 Mo de SQL, régénéré chaque nuit (Last-Modified vers
// 2h30). Encodé en UTF-8, contrairement aux CSV ODSEN.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { downloadWithRetry } from '../../utils/download';

const execAsync = promisify(exec);

export const SENS_URL = 'https://data.senat.fr/data/senateurs/export_sens.zip';

/** Une ligne d'une table du dump : colonne → valeur (`null` pour `\N`). */
export type LigneDump = Record<string, string | null>;

/**
 * Valeur d'un champ au format texte de `COPY` : `\N` est NULL, et les
 * caractères spéciaux sont échappés par un antislash (`\t`, `\n`, `\\`).
 */
export function champCopy(brut: string): string | null {
  if (brut === '\\N') return null;
  if (!brut.includes('\\')) return brut;
  return brut.replace(/\\(.)/g, (_, c: string) => {
    switch (c) {
      case 't': return '\t';
      case 'n': return '\n';
      case 'r': return '\r';
      default: return c;
    }
  });
}

/**
 * Lit les blocs `COPY table (colonnes) FROM stdin;` des tables demandées.
 * Les autres tables sont sautées sans être découpées.
 */
export async function lireTablesDump(
  lignes: AsyncIterable<string>,
  tables: readonly string[],
): Promise<Map<string, LigneDump[]>> {
  const voulues = new Set(tables);
  const resultat = new Map<string, LigneDump[]>(tables.map((t) => [t, []]));
  let colonnes: string[] | null = null;
  let courante: LigneDump[] | null = null;

  for await (const ligne of lignes) {
    if (courante === null) {
      if (!ligne.startsWith('COPY ')) continue;
      const m = ligne.match(/^COPY (?:public\.)?(\w+) \(([^)]*)\) FROM stdin;$/);
      if (!m || !voulues.has(m[1]!)) continue;
      colonnes = m[2]!.split(',').map((c) => c.trim());
      courante = resultat.get(m[1]!)!;
      continue;
    }
    if (ligne === '\\.') {
      courante = null;
      colonnes = null;
      continue;
    }
    const champs = ligne.split('\t');
    const enregistrement: LigneDump = {};
    colonnes!.forEach((c, i) => {
      enregistrement[c] = champs[i] === undefined ? null : champCopy(champs[i]!);
    });
    courante.push(enregistrement);
  }
  return resultat;
}

/**
 * Télécharge le dump (ou lit `archive`, un zip déjà téléchargé), en lit les
 * tables demandées, puis efface les fichiers temporaires.
 *
 * Une table vide fait échouer la lecture : le 01/11/2026, le Sénat a publié un
 * dump de 444 octets, schéma seul, sans aucune table. L'écrire aurait effacé
 * toutes les fonctions.
 */
export async function telechargerTablesSens(
  tables: readonly string[],
  options: { archive?: string } = {},
): Promise<Map<string, LigneDump[]>> {
  const dossier = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clair-sens-'));
  try {
    let zip = options.archive;
    if (!zip) {
      zip = path.join(dossier, 'export_sens.zip');
      const { bytes } = await downloadWithRetry(SENS_URL, zip, { timeoutMs: 300_000 });
      logger.info({ mo: (bytes / 1024 / 1024).toFixed(1) }, 'Dump de la base des sénateurs téléchargé');
    }

    await execAsync(`unzip -o "${zip}" -d "${dossier}"`, { maxBuffer: 16 * 1024 * 1024 });
    const sql = path.join(dossier, 'export_sens.sql');
    if (!(await fs.promises.stat(sql).catch(() => null))) {
      throw new Error('export_sens.sql absent de export_sens.zip');
    }

    const rl = readline.createInterface({
      input: fs.createReadStream(sql, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });
    const resultat = await lireTablesDump(rl, tables);
    for (const t of tables) {
      if ((resultat.get(t)?.length ?? 0) === 0) throw new Error(`Table ${t} vide ou absente du dump export_sens`);
    }
    return resultat;
  } finally {
    await fs.promises.rm(dossier, { recursive: true, force: true }).catch(() => {});
  }
}
