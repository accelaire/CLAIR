// =============================================================================
// Client Sénat - Dossiers Législatifs (via DOSLEG)
// Source: https://data.senat.fr/data/dosleg/dosleg.zip
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createReadStream } from 'fs';
import * as readline from 'readline';
import { logger } from '../../utils/logger';
import { DoslegClient } from './dosleg-client';

// =============================================================================
// TYPES
// =============================================================================

interface DoslegLoi {
  loicod: string;           // Ex: "150" (ID interne)
  signet: string | null;    // Ex: "pjl99-342" (ref pour le lien - IMPORTANT!)
  typloicod: string;        // Ex: "PPL " (proposition de loi)
  etaloicod: string | null; // État: "AD" (adopté), "RE" (rejeté), etc.
  numero: string | null;    // Numéro de la loi promulguée
  loient: string | null;    // Titre court
  loitit: string | null;    // Titre complet
  loiint: string | null;    // Intitulé
  urgence: string | null;   // Procédure accélérée
  urlJo: string | null;     // URL Journal Officiel
  loidatjo: Date | null;    // Date publication JO
  dateLoi: Date | null;     // Date de la loi
}

interface DoslegTexte {
  texcod: number;
  typtxtcod: string;        // Type de texte
  sesann: number | null;    // Session année
  texnum: number | null;    // Numéro du texte
  texurl: string | null;    // URL relative (ex: "ppl24-661.html")
  lecassidt: string | null; // Lien vers lecture
}

interface DoslegLecture {
  lecidt: string;           // ID lecture
  loicod: string;           // Lien vers loi
  typleccod: string;        // Type de lecture
}

export interface TransformedDossierSenat {
  uid: string;              // Ex: "SENAT-ppl24-661"
  ref: string;              // Ex: "ppl24-661" (pour matching avec scrutins)
  titre: string;
  titreCourt: string | null;
  procedureCode: string | null;
  procedureLibelle: string | null;
  urlSenat: string;
  etat: 'en_cours' | 'adopte' | 'rejete' | 'promulgue' | 'caduc' | 'fusionne' | 'retire' | null;
  loiNumero: string | null;
  loiDateJO: Date | null;
  urgence: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr === '\\N' || dateStr.trim() === '') return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function cleanString(s: string | null): string | null {
  if (!s || s === '\\N') return null;
  return s.trim() || null;
}

/**
 * Mappe le code etaloicod DOSLEG vers un état normalisé.
 * Table de référence DOSLEG (etaloi):
 *   01 = en cours de discussion
 *   02 = fusionné
 *   03 = rejeté
 *   04 = promulgué ou adopté (ppr)
 *   05 = caduc
 *   06 = retiré
 */
function mapEtat(etaloicod: string | null): TransformedDossierSenat['etat'] {
  if (!etaloicod) return null;
  const code = etaloicod.trim();
  switch (code) {
    case '01': return 'en_cours';
    case '02': return 'fusionne';
    case '03': return 'rejete';
    case '04': return 'promulgue';
    case '05': return 'caduc';
    case '06': return 'retire';
    default:
      logger.warn({ etaloicod: code }, 'Unknown DOSLEG etaloicod, defaulting to en_cours');
      return 'en_cours';
  }
}

function mapProcedure(typloicod: string | null): { code: string | null; libelle: string | null } {
  if (!typloicod) return { code: null, libelle: null };
  const code = typloicod.trim().toUpperCase();
  const mapping: Record<string, string> = {
    'PJL': 'Projet de loi',
    'PPL': 'Proposition de loi',
    'PJLC': 'Projet de loi constitutionnelle',
    'PPLC': 'Proposition de loi constitutionnelle',
    'PJLF': 'Projet de loi de finances',
    'PJLFR': 'Projet de loi de finances rectificative',
    'PJLFSS': 'Projet de loi de financement de la sécurité sociale',
    'PJFS': 'Projet de loi de financement de la sécurité sociale',
    'PJLO': 'Projet de loi organique',
    'PPLO': 'Proposition de loi organique',
    'PPLR': 'Proposition de résolution',
    'PPRP': 'Proposition de résolution',
    'PPRE': 'Proposition de résolution européenne',
    'PPRA': 'Proposition de résolution',
    'CVN': 'Convention internationale',
    'PAC': 'Proposition de résolution européenne',
    'PJLR': 'Projet de loi portant règlement des comptes',
    'PJLG': 'Projet de loi de programmation',
    'PROG': 'Projet de loi de programmation',
    'ENQ': "Commission d'enquête",
    'MREF': "Mission d'information",
  };
  return {
    code,
    libelle: mapping[code] || null,
  };
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatDossiersClient {
  private dataUrl: string;
  private tempDir: string;

  constructor() {
    this.dataUrl = 'https://data.senat.fr/data/dosleg/dosleg.zip';
    this.tempDir = path.join(os.tmpdir(), 'clair-dosleg-dossiers');
    logger.info('SenatDossiersClient initialized');
  }

  async getDossiers(options: {
    sessionStart?: number;
    sessionEnd?: number;
    limit?: number;
  } = {}): Promise<TransformedDossierSenat[]> {
    const sessionStart = options.sessionStart || 2020;
    const sessionEnd = options.sessionEnd || new Date().getFullYear();

    logger.info({ sessionStart, sessionEnd, limit: options.limit }, 'Fetching dossiers from DOSLEG...');

    // Use the existing DoslegClient to download and extract
    const doslegClient = new DoslegClient();

    // We need to access the SQL file directly, so let's do our own download
    const sqlPath = await this.downloadAndExtract();

    try {
      const lois = new Map<string, DoslegLoi>();
      const textes = new Map<number, DoslegTexte>();
      const lectures = new Map<string, DoslegLecture>();

      const rl = readline.createInterface({
        input: createReadStream(sqlPath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      let currentTable: string | null = null;
      let loiCount = 0;
      let texteCount = 0;
      let lectureCount = 0;

      for await (const line of rl) {
        // Detect COPY statement
        if (line.startsWith('COPY ')) {
          const match = line.match(/COPY (\w+)/);
          if (match) {
            currentTable = match[1];
          }
          continue;
        }

        // End of COPY block
        if (line === '\\.') {
          currentTable = null;
          continue;
        }

        if (!currentTable) continue;

        const fields = line.split('\t');

        try {
          // Parse loi table
          // COPY loi (loicod, typloicod, etaloicod, deccoccod, numero, signet, loient, motclef, loitit, loiint, urgence, url_jo, ...)
          if (currentTable === 'loi') {
            if (fields.length < 15) continue;

            const loicod = cleanString(fields[0]);
            const signet = cleanString(fields[5]); // Important: signet is the ref (e.g., "pjl24-661")
            if (!loicod) continue;

            // Filter by session (extract year from signet like "ppl24-661" or "pjl99-342")
            if (signet) {
              const yearMatch = signet.match(/(\d{2})-/);
              if (yearMatch) {
                let year = parseInt(yearMatch[1], 10);
                // Convert 2-digit year to 4-digit (assume 20xx for years < 50, 19xx otherwise)
                year = year < 50 ? 2000 + year : 1900 + year;
                if (year < sessionStart || year > sessionEnd) continue;
              }
            }

            lois.set(loicod, {
              loicod,
              signet,
              typloicod: cleanString(fields[1]),
              etaloicod: cleanString(fields[2]),
              numero: cleanString(fields[4]),
              loient: cleanString(fields[6]), // index 6, not 7 (after signet)
              loitit: cleanString(fields[8]), // index 8, not 9
              loiint: cleanString(fields[9]), // index 9, not 10
              urgence: cleanString(fields[10]), // index 10, not 11
              urlJo: cleanString(fields[11]), // index 11, not 12
              loidatjo: parseDate(fields[13]),
              dateLoi: parseDate(fields[14]),
            });
            loiCount++;
          }

          // Parse texte table (to get the ref like "ppl24-661")
          if (currentTable === 'texte') {
            if (fields.length < 10) continue;

            const texcod = parseInt(fields[0] || '0', 10);
            const sesann = fields[5] && fields[5] !== '\\N' ? parseInt(fields[5], 10) : null;

            // Filter by session
            if (sesann && (sesann < sessionStart || sesann > sessionEnd)) continue;

            textes.set(texcod, {
              texcod,
              typtxtcod: cleanString(fields[2]) || '',
              sesann,
              texnum: fields[7] && fields[7] !== '\\N' ? parseInt(fields[7], 10) : null,
              texurl: cleanString(fields[8]),
              lecassidt: cleanString(fields[4]),
            });
            texteCount++;
          }

          // Parse lecture table (to link texte to loi)
          if (currentTable === 'lecture') {
            if (fields.length < 3) continue;

            const lecidt = cleanString(fields[0]);
            const loicod = cleanString(fields[1]);
            if (!lecidt || !loicod) continue;

            lectures.set(lecidt, {
              lecidt,
              loicod,
              typleccod: cleanString(fields[2]) || '',
            });
            lectureCount++;
          }

        } catch (e: any) {
          // Skip malformed lines
        }
      }

      logger.info({
        lois: lois.size,
        textes: textes.size,
        lectures: lectures.size,
      }, 'DOSLEG dossiers parsing completed');

      // Build dossiers from loi table
      const dossiers: TransformedDossierSenat[] = [];

      for (const [loicod, loi] of lois) {
        // Use signet as the ref (e.g., "pjl24-661") - skip if no signet
        if (!loi.signet) continue;
        const ref = loi.signet.trim().toLowerCase();

        const procedure = mapProcedure(loi.typloicod);
        const titre = loi.loitit || loi.loiint || loi.loient || ref;

        dossiers.push({
          uid: `SENAT-${ref}`,
          ref,
          titre: titre.substring(0, 1000),
          titreCourt: loi.loient?.substring(0, 255) || null,
          procedureCode: procedure.code,
          procedureLibelle: procedure.libelle,
          urlSenat: `https://www.senat.fr/dossier-legislatif/${ref}.html`,
          etat: mapEtat(loi.etaloicod),
          loiNumero: loi.numero,
          loiDateJO: loi.loidatjo,
          urgence: loi.urgence === 'OUI',
        });
      }

      // Sort by ref (most recent first based on year in ref)
      dossiers.sort((a, b) => {
        const yearA = parseInt(a.ref.match(/(\d{2})-/)?.[1] || '0', 10);
        const yearB = parseInt(b.ref.match(/(\d{2})-/)?.[1] || '0', 10);
        return yearB - yearA;
      });

      // Apply limit
      const result = options.limit ? dossiers.slice(0, options.limit) : dossiers;

      logger.info({ count: result.length }, 'Dossiers Sénat extracted');
      return result;

    } finally {
      await this.cleanup();
    }
  }

  private async downloadAndExtract(): Promise<string> {
    const axios = (await import('axios')).default;
    const { createWriteStream } = await import('fs');
    const { pipeline } = await import('stream/promises');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const zipPath = path.join(this.tempDir, 'dosleg.zip');
    const extractDir = path.join(this.tempDir, 'extracted');

    // Clean up temp directory
    await fs.promises.rm(this.tempDir, { recursive: true, force: true });
    await fs.promises.mkdir(this.tempDir, { recursive: true });

    logger.info({ url: this.dataUrl }, 'Downloading DOSLEG for dossiers...');

    const response = await axios({
      method: 'GET',
      url: this.dataUrl,
      responseType: 'stream',
      timeout: 300000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0',
      },
    });

    const writer = createWriteStream(zipPath);
    await pipeline(response.data, writer);

    const stats = await fs.promises.stat(zipPath);
    logger.info({ size: `${(stats.size / 1024 / 1024).toFixed(2)} MB` }, 'DOSLEG downloaded');

    logger.info('Extracting DOSLEG...');
    await fs.promises.mkdir(extractDir, { recursive: true });
    await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
      maxBuffer: 1024 * 1024 * 200,
    });

    const sqlPath = path.join(extractDir, 'dosleg.sql');
    if (!await fs.promises.stat(sqlPath).catch(() => null)) {
      throw new Error('dosleg.sql not found in archive');
    }

    logger.info('DOSLEG extracted successfully');
    return sqlPath;
  }

  async cleanup(): Promise<void> {
    await fs.promises.rm(this.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export default SenatDossiersClient;
