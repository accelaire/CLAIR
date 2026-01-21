// =============================================================================
// Client Sénat - Base DOSLEG (Dossiers Législatifs)
// Source: https://data.senat.fr/data/dosleg/dosleg.zip
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';
import { logger } from '../../utils/logger';

const execAsync = promisify(exec);

// =============================================================================
// TYPES - Structure des données DOSLEG
// =============================================================================

export interface DoslegScrutin {
  sesann: number;        // Session année (ex: 2024 pour session 2024-2025)
  scrnum: number;        // Numéro du scrutin dans la session
  code: number | null;   // Code séance (pour lien date_seance)
  scrint: string;        // Intitulé complet (contient amendement, demandeur, etc.)
  scrdat: Date;          // Date du scrutin
  scrpou: number;        // Nombre pour
  scrcon: number;        // Nombre contre
  scrvot: number;        // Nombre votants
  scrsuf: number;        // Nombre suffrages exprimés
  scrmaj: number;        // Majorité requise
  soslib: string | null; // Sort (Adopté/Rejeté)
}

export interface DoslegVote {
  sesann: number;
  scrnum: number;
  senmat: string;        // Matricule sénateur
  posvotcod: string;     // Position: 1=pour, 2=contre, 3=abstention, 4=non votant
}

export interface DoslegAmendementLink {
  sesann: number;
  scrnum: number;
  amescrnum: string;     // Numéro de l'amendement
}

export interface DoslegDateSeance {
  lecidt: string;
  datsea: Date;
  code: number;
}

// Types transformés pour l'export
export interface TransformedDoslegScrutin {
  numero: number;
  session: string;       // Format "2024-2025"
  date: Date;
  titre: string;
  sort: 'adopte' | 'rejete';
  nombreVotants: number;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  demandeurTexte: string | null;
  amendementsNumeros: string[];
  sourceUrl: string;
}

export interface TransformedDoslegVote {
  scrutinSession: string;
  scrutinNumero: number;
  senmatricule: string;
  position: 'pour' | 'contre' | 'abstention' | 'absent';
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extrait le demandeur depuis le champ scrint
 * Ex: "sur l'amendement n° 99, présenté par MM. Jean-Pierre Godefroy..."
 */
function extractDemandeur(scrint: string): string | null {
  // Pattern: "présenté par..." jusqu'à la virgule ou fin de phrase
  const patterns = [
    /présenté(?:e|s)?\s+par\s+([^,]+(?:,\s*(?:MM?\.|Mme|Mmes)[^,]+)*)/i,
    /déposé(?:e|s)?\s+par\s+([^,]+(?:,\s*(?:MM?\.|Mme|Mmes)[^,]+)*)/i,
    /tendant à[^,]+,\s*présenté(?:e|s)?\s+par\s+([^,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = scrint.match(pattern);
    if (match && match[1]) {
      let demandeur = match[1].trim();
      // Nettoyer et limiter la longueur
      demandeur = demandeur
        .replace(/\s+/g, ' ')
        .replace(/,\s*$/, '')
        .trim();

      if (demandeur.length > 500) {
        demandeur = demandeur.substring(0, 500) + '...';
      }

      return demandeur;
    }
  }

  return null;
}

/**
 * Extrait les numéros d'amendements depuis le champ scrint
 */
function extractAmendementNumbers(scrint: string): string[] {
  const numbers: string[] = [];

  // Pattern pour amendement n° XXX
  const pattern = /amendements?\s+(?:identiques?\s+)?n[°o]\s*([A-Z0-9-]+(?:\s+rectifié)?)/gi;
  let match;

  while ((match = pattern.exec(scrint)) !== null) {
    if (match[1]) {
      numbers.push(match[1].trim());
    }
  }

  return [...new Set(numbers)]; // Dédupliquer
}

/**
 * Parse une date depuis le format PostgreSQL timestamp
 */
function parseTimestamp(ts: string | null): Date | null {
  if (!ts || ts === '\\N') return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

// =============================================================================
// CLIENT
// =============================================================================

export class DoslegClient {
  private dataUrl: string;
  private tempDir: string;

  constructor() {
    this.dataUrl = 'https://data.senat.fr/data/dosleg/dosleg.zip';
    this.tempDir = path.join(os.tmpdir(), 'clair-dosleg');
    logger.info('DoslegClient initialized');
  }

  // ===========================================================================
  // DOWNLOAD & EXTRACT
  // ===========================================================================

  private async downloadAndExtract(): Promise<string> {
    const zipPath = path.join(this.tempDir, 'dosleg.zip');
    const extractDir = path.join(this.tempDir, 'extracted');

    // Nettoyer le répertoire temporaire
    await fs.promises.rm(this.tempDir, { recursive: true, force: true });
    await fs.promises.mkdir(this.tempDir, { recursive: true });

    logger.info({ url: this.dataUrl }, 'Downloading DOSLEG database...');

    const response = await axios({
      method: 'GET',
      url: this.dataUrl,
      responseType: 'stream',
      timeout: 300000, // 5 minutes
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
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

  // ===========================================================================
  // PARSING
  // ===========================================================================

  async getScrutinsAndVotes(options: {
    sessionStart?: number;
    sessionEnd?: number;
    limit?: number;
  } = {}): Promise<{
    scrutins: TransformedDoslegScrutin[];
    votes: TransformedDoslegVote[];
    amendementLinks: DoslegAmendementLink[];
  }> {
    const sessionStart = options.sessionStart || 2020;
    const sessionEnd = options.sessionEnd || new Date().getFullYear();

    let sqlPath: string;
    try {
      sqlPath = await this.downloadAndExtract();
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to download DOSLEG');
      throw error;
    }

    try {
      logger.info({ sessionStart, sessionEnd }, 'Parsing DOSLEG SQL dump...');

      const scrutinsMap = new Map<string, DoslegScrutin>();
      const votes: DoslegVote[] = [];
      const amendementLinks: DoslegAmendementLink[] = [];

      // Safety limit to prevent OOM
      const MAX_VOTES = 1_000_000;

      const rl = readline.createInterface({
        input: createReadStream(sqlPath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      let currentTable: string | null = null;
      let lineCount = 0;
      let scrutinCount = 0;
      let voteCount = 0;

      for await (const line of rl) {
        lineCount++;

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
          // Parse scr table (scrutins)
          if (currentTable === 'scr') {
            // Columns: sesann, scrnum, code, scrint, scrdat, scrpou, scrcon, scrvot, scrsuf, ...
            if (fields.length < 15) continue;

            const sesann = parseInt(fields[0] || '0', 10);

            // Filter by session range
            if (sesann < sessionStart || sesann > sessionEnd) continue;

            const scrnum = parseInt(fields[1] || '0', 10);
            const code = fields[2] && fields[2] !== '\\N' ? parseInt(fields[2], 10) : null;
            const scrint = fields[3] || '';
            const scrdat = parseTimestamp(fields[4]);
            const scrpou = parseInt(fields[5] || '0', 10);
            const scrcon = parseInt(fields[6] || '0', 10);
            const scrvot = parseInt(fields[7] || '0', 10);
            const scrsuf = parseInt(fields[8] || '0', 10);
            const scrmaj = parseInt(fields[13] || '0', 10);
            const soslib = fields[15] && fields[15] !== '\\N' ? fields[15] : null;

            if (!scrdat) continue; // Skip if no date

            const key = `${sesann}-${scrnum}`;
            scrutinsMap.set(key, {
              sesann,
              scrnum,
              code,
              scrint,
              scrdat,
              scrpou,
              scrcon,
              scrvot,
              scrsuf,
              scrmaj,
              soslib,
            });

            scrutinCount++;
            if (options.limit && scrutinCount >= options.limit) {
              // Continue parsing votes for already collected scrutins
            }
          }

          // Parse votsen table (votes individuels)
          if (currentTable === 'votsen') {
            // Columns: sesann, scrnum, senmat, posvotcod, ...
            if (fields.length < 4) continue;

            const sesann = parseInt(fields[0] || '0', 10);
            const scrnum = parseInt(fields[1] || '0', 10);

            // Only collect votes for scrutins we have
            const key = `${sesann}-${scrnum}`;
            if (!scrutinsMap.has(key)) continue;

            const senmat = (fields[2] || '').trim();
            const posvotcod = (fields[3] || '').trim();

            if (senmat && posvotcod && votes.length < MAX_VOTES) {
              votes.push({ sesann, scrnum, senmat, posvotcod });
              voteCount++;
            }
          }

          // Parse amescr table (liens amendements)
          if (currentTable === 'amescr') {
            // Columns: sesann, scrnum, amescrnum
            if (fields.length < 3) continue;

            const sesann = parseInt(fields[0] || '0', 10);
            const scrnum = parseInt(fields[1] || '0', 10);
            const amescrnum = (fields[2] || '').trim();

            const key = `${sesann}-${scrnum}`;
            if (scrutinsMap.has(key) && amescrnum) {
              amendementLinks.push({ sesann, scrnum, amescrnum });
            }
          }

        } catch (e: any) {
          // Skip malformed lines
          if (lineCount % 100000 === 0) {
            logger.debug({ line: lineCount, error: e.message }, 'Parse error (continuing)');
          }
        }

        // Progress log
        if (lineCount % 500000 === 0) {
          logger.debug({
            lines: lineCount,
            scrutins: scrutinCount,
            votes: voteCount
          }, 'Parsing progress...');
        }
      }

      if (votes.length >= MAX_VOTES) {
        logger.warn({ max: MAX_VOTES }, 'Vote limit reached - some votes may be missing');
      }

      logger.info({
        scrutins: scrutinsMap.size,
        votes: votes.length,
        amendementLinks: amendementLinks.length
      }, 'DOSLEG parsing completed');

      // Transform to output format
      const transformedScrutins: TransformedDoslegScrutin[] = [];

      for (const scr of scrutinsMap.values()) {
        const session = `${scr.sesann}-${scr.sesann + 1}`;

        // Extract amendements from amescr + scrint
        const amescrNums = amendementLinks
          .filter(l => l.sesann === scr.sesann && l.scrnum === scr.scrnum)
          .map(l => l.amescrnum);
        const scrintNums = extractAmendementNumbers(scr.scrint);
        const amendementsNumeros = [...new Set([...amescrNums, ...scrintNums])];

        // Determine sort
        const sort: 'adopte' | 'rejete' =
          scr.soslib?.toLowerCase().includes('adopt') ? 'adopte' : 'rejete';

        // Calculate abstentions
        const nombreAbstention = Math.max(0, scr.scrvot - scr.scrpou - scr.scrcon);

        transformedScrutins.push({
          numero: scr.scrnum,
          session,
          date: scr.scrdat,
          titre: scr.scrint,
          sort,
          nombreVotants: scr.scrvot,
          nombrePour: scr.scrpou,
          nombreContre: scr.scrcon,
          nombreAbstention,
          demandeurTexte: extractDemandeur(scr.scrint),
          amendementsNumeros,
          sourceUrl: `https://www.senat.fr/scrutin-public/${scr.sesann}/scr${scr.sesann}-${scr.scrnum}.html`,
        });
      }

      // Transform votes
      const transformedVotes: TransformedDoslegVote[] = votes.map(v => {
        let position: 'pour' | 'contre' | 'abstention' | 'absent';
        switch (v.posvotcod) {
          case '1': position = 'pour'; break;
          case '2': position = 'contre'; break;
          case '3': position = 'abstention'; break;
          default: position = 'absent';
        }

        return {
          scrutinSession: `${v.sesann}-${v.sesann + 1}`,
          scrutinNumero: v.scrnum,
          senmatricule: v.senmat,
          position,
        };
      });

      // Sort by date desc
      transformedScrutins.sort((a, b) => b.date.getTime() - a.date.getTime());

      // Apply limit after sorting (most recent first)
      const limitedScrutins = options.limit
        ? transformedScrutins.slice(0, options.limit)
        : transformedScrutins;

      // Filter votes to only include those for limited scrutins
      const limitedScrutinKeys = new Set(
        limitedScrutins.map(s => `${s.session}-${s.numero}`)
      );
      const limitedVotes = options.limit
        ? transformedVotes.filter(v => limitedScrutinKeys.has(`${v.scrutinSession}-${v.scrutinNumero}`))
        : transformedVotes;

      return {
        scrutins: limitedScrutins,
        votes: limitedVotes,
        amendementLinks: amendementLinks.filter(l =>
          !options.limit || limitedScrutinKeys.has(`${l.sesann}-${l.sesann + 1}-${l.scrnum}`)
        ),
      };

    } finally {
      await this.cleanup();
    }
  }
}

export default DoslegClient;
