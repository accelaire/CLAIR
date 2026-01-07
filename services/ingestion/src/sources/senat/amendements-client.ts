// =============================================================================
// Client Sénat - Récupération des amendements (base AMELI)
// Source: https://data.senat.fr/ameli/
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import * as readline from 'readline';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SenatAmendement {
  id: number;
  numero: string;
  dispositif: string | null;
  objet: string | null;
  dateDepot: Date | null;
  sort: string | null;
  sortCode: string | null;
  texteId: number;
  auteurs: SenatAmendementAuteur[];
}

export interface SenatAmendementAuteur {
  senId: number;
  rang: number;
  qualite: string;
  nom: string;
  prenom: string;
  matricule?: string;
  groupeId?: number;
}

export interface TransformedAmendementSenat {
  uid: string;
  numero: string;
  dispositif: string | null;
  exposeSommaire: string | null;
  dateDepot: Date | null;
  sort: string | null;
  auteurNom: string | null;
  auteurPrenom: string | null;
  auteurMatricule: string | null;
  auteurLibelle: string | null;
  texteRef: string | null;
  sourceUrl: string | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&oelig;/g, 'œ')
    .replace(/&OElig;/g, 'Œ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç');
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  let text = html.replace(/<[^>]*>/g, ' ');
  text = decodeHtmlEntities(text);
  return text.replace(/\s+/g, ' ').trim();
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr === '\\N') return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Sort codes mapping
const SORT_MAP: Record<string, string> = {
  'A': 'adopte',
  'R': 'retire',
  'J': 'rejete',
  'K': 'rejete',
  'N': 'non_soutenu',
  'S': 'tombe',
  'B': 'adopte',
  '1': 'adopte',
  '2': 'adopte_modifie',
  '3': 'rejete',
  '4': 'retire',
  '5': 'satisfait',
  '6': 'non_examine',
};

// =============================================================================
// CLIENT
// =============================================================================

export class SenatAmendementsClient {
  private dataUrl: string;

  constructor() {
    this.dataUrl = 'https://data.senat.fr/data/ameli/ameli.zip';
    logger.info('SenatAmendementsClient initialized');
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.info({ url }, 'Downloading Sénat AMELI data (this may take a while ~140MB)...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 600000, // 10 minutes
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.info({ destPath }, 'File downloaded');
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 100,
      });

      // Find the SQL file
      const files = await fs.promises.readdir(extractDir, { recursive: true });
      const sqlFile = files.find(f => f.toString().endsWith('.sql'));

      if (!sqlFile) {
        throw new Error('No SQL file found in archive');
      }

      const sqlPath = path.join(extractDir, sqlFile.toString());
      logger.info({ sqlPath }, 'SQL file extracted');
      return sqlPath;

    } catch (error: any) {
      logger.error({ error: error.message }, 'Extraction failed');
      throw new Error(`ZIP extraction failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // SQL PARSER
  // ===========================================================================

  private async parseSqlDump(sqlPath: string, options: { maxAmendements?: number; minYear?: number } = {}): Promise<{
    amendements: Map<number, SenatAmendement>;
    senateurs: Map<number, { matricule: string; nom: string; prenom: string }>;
  }> {
    const maxAmendements = options.maxAmendements || 50000;
    const minYear = options.minYear || new Date().getFullYear() - 3;
    const minDate = new Date(minYear, 0, 1);

    const amendements = new Map<number, SenatAmendement>();
    const amdSenLinks: Array<{ amdId: number; senId: number; rang: number; qua: string; nom: string; prenom: string; grpId: number }> = [];
    const senateurs = new Map<number, { matricule: string; nom: string; prenom: string }>();
    const sortMap = new Map<string, { lib: string; cod: string }>();

    const rl = readline.createInterface({
      input: createReadStream(sqlPath, { encoding: 'latin1' }),
      crlfDelay: Infinity,
    });

    let currentTable: string | null = null;
    let lineCount = 0;
    let amendementCount = 0;

    for await (const line of rl) {
      lineCount++;

      // Detect COPY statements
      if (line.startsWith('COPY ')) {
        const match = line.match(/COPY (\w+)/);
        if (match) {
          currentTable = match[1];
        }
        continue;
      }

      // End of COPY block
      if (line === '\\.' || line === '\\.') {
        currentTable = null;
        continue;
      }

      if (!currentTable) continue;

      const fields = line.split('\t');

      try {
        // Parse amendments (amd table)
        if (currentTable === 'amd' && amendementCount < maxAmendements) {
          // Fields: id, subid, amdperid, motid, etaid, nomentid, sorid, avcid, avgid, irrid, txtid, ...
          // num(15), rev(16), typ(17), dis(18), obj(19), datdep(20)
          if (fields.length < 21) continue;
          const id = parseInt(fields[0] ?? '0', 10);
          const sorid = (fields[6] ?? '') !== '\\N' ? (fields[6] ?? null) : null;
          const txtid = parseInt(fields[10] ?? '0', 10);
          const num = (fields[15] ?? '') !== '\\N' ? (fields[15] ?? '') : '';
          const dis = (fields[18] ?? '') !== '\\N' ? (fields[18] ?? null) : null;
          const obj = (fields[19] ?? '') !== '\\N' ? (fields[19] ?? null) : null;
          const datdep = (fields[20] ?? '') !== '\\N' ? (fields[20] ?? null) : null;

          const dateDepot = parseDate(datdep ?? null);

          // Filter by date
          if (dateDepot && dateDepot >= minDate) {
            amendements.set(id, {
              id,
              numero: (num ?? '').trim(),
              dispositif: stripHtml(dis ?? null),
              objet: stripHtml(obj ?? null),
              dateDepot,
              sort: sortMap.get(sorid ?? '')?.lib ?? null,
              sortCode: sorid,
              texteId: txtid,
              auteurs: [],
            });
            amendementCount++;

            if (amendementCount % 5000 === 0) {
              logger.debug({ count: amendementCount }, 'Parsing amendments...');
            }
          }
        }

        // Parse amendment-senator links (amdsen table)
        if (currentTable === 'amdsen') {
          // Fields: amdid, senid, rng, qua, nomuse, prenomuse, hom, grpid
          if (fields.length < 8) continue;
          const amdId = parseInt(fields[0] ?? '0', 10);
          const senId = parseInt(fields[1] ?? '0', 10);
          const rang = parseInt(fields[2] ?? '0', 10) || 0;
          const qua = fields[3] ?? '';
          const nom = fields[4] ?? '';
          const prenom = fields[5] ?? '';
          const grpId = parseInt(fields[7] ?? '0', 10) || 0;

          amdSenLinks.push({ amdId, senId, rang, qua, nom, prenom, grpId });
        }

        // Parse senators (sen_ameli table)
        if (currentTable === 'sen_ameli') {
          // Fields: entid, grpid, comid, comspcid, mat, qua, nomuse, prenomuse, ...
          if (fields.length < 8) continue;
          const entId = parseInt(fields[0] ?? '0', 10);
          const mat = (fields[4] ?? '') !== '\\N' ? (fields[4] ?? '') : '';
          const nom = fields[6] ?? '';
          const prenom = fields[7] ?? '';

          senateurs.set(entId, { matricule: mat, nom, prenom });
        }

        // Parse sort codes (sor table)
        if (currentTable === 'sor') {
          // Fields: id, lib, cod, typ
          if (fields.length < 3) continue;
          const id = fields[0] ?? '';
          const lib = fields[1] ?? '';
          const cod = fields[2] ?? '';
          sortMap.set(id, { lib, cod });
        }

      } catch (e: any) {
        // Skip malformed lines
        if (lineCount % 100000 === 0) {
          logger.warn({ line: lineCount, error: e.message }, 'Parse error');
        }
      }
    }

    logger.info({ amendements: amendements.size, senateurs: senateurs.size, links: amdSenLinks.length }, 'SQL parsing completed');

    // Link authors to amendments
    for (const link of amdSenLinks) {
      const amd = amendements.get(link.amdId);
      if (amd) {
        const sen = senateurs.get(link.senId);
        amd.auteurs.push({
          senId: link.senId,
          rang: link.rang,
          qualite: link.qua,
          nom: link.nom,
          prenom: link.prenom,
          matricule: sen?.matricule,
          groupeId: link.grpId,
        });
      }
    }

    // Sort authors by rang
    for (const amd of Array.from(amendements.values())) {
      amd.auteurs.sort((a, b) => a.rang - b.rang);
    }

    return { amendements, senateurs };
  }

  // ===========================================================================
  // FETCH AMENDEMENTS
  // ===========================================================================

  async getAmendements(options: { maxAmendements?: number; minYear?: number } = {}): Promise<TransformedAmendementSenat[]> {
    const tempDir = path.join(os.tmpdir(), 'clair-amendements-senat');
    const zipPath = path.join(tempDir, 'ameli.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download
      await this.downloadFile(this.dataUrl, zipPath);

      // Extract
      const sqlPath = await this.extractZip(zipPath, extractDir);

      // Parse
      logger.info('Parsing SQL dump...');
      const { amendements } = await this.parseSqlDump(sqlPath, options);

      // Transform
      const transformed: TransformedAmendementSenat[] = [];

      for (const amd of Array.from(amendements.values())) {
        const auteurPrincipal = amd.auteurs[0];

        // Build auteur libelle
        let auteurLibelle: string | null = null;
        if (amd.auteurs.length > 0) {
          const noms = amd.auteurs.map(a => `${a.qualite} ${a.prenom} ${a.nom}`.trim());
          auteurLibelle = noms.join(', ');
          if (auteurLibelle.length > 500) {
            auteurLibelle = noms.slice(0, 3).join(', ') + ` et ${noms.length - 3} autres`;
          }
        }

        transformed.push({
          uid: `SENAT-AMD-${amd.id}`,
          numero: amd.numero,
          dispositif: amd.dispositif?.substring(0, 5000) || null,
          exposeSommaire: amd.objet?.substring(0, 5000) || null,
          dateDepot: amd.dateDepot,
          sort: amd.sortCode ? (SORT_MAP[amd.sortCode] || amd.sort) : null,
          auteurNom: auteurPrincipal?.nom || null,
          auteurPrenom: auteurPrincipal?.prenom || null,
          auteurMatricule: auteurPrincipal?.matricule || null,
          auteurLibelle,
          texteRef: amd.texteId ? `SENAT-TXT-${amd.texteId}` : null,
          sourceUrl: amd.numero ? `https://www.senat.fr/amendements/${amd.numero}.html` : null,
        });
      }

      logger.info({ count: transformed.length }, 'Amendements Sénat extracted');
      return transformed;

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export default SenatAmendementsClient;
