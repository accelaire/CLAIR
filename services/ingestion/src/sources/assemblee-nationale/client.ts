// =============================================================================
// Client Assemblée Nationale Open Data - Récupération des amendements
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

// Structure d'un fichier JSON d'amendement AN
export interface ANAmendementFile {
  amendement: {
    uid: string;
    legislature: string;
    identification: {
      numeroLong: string;
      numeroOrdreDepot: string;
    };
    texteLegislatifRef: string;
    signataires?: {
      auteur?: {
        acteurRef?: string;
        groupePolitiqueRef?: string;
        typeAuteur?: string;
      };
      cosignataires?: {
        acteurRef: string | string[];
      };
      libelle?: string;
    };
    pointeurFragmentTexte?: {
      division?: {
        titre?: string;
        articleDesignationCourte?: string;
        articleDesignation?: string;
        type?: string;
      };
    };
    corps?: {
      contenuAuteur?: {
        dispositif?: string;
        exposeSommaire?: string;
      };
    };
    cycleDeVie?: {
      dateDepot?: string;
      datePublication?: string;
      dateSort?: string;
      sort?: string;
      etatDesTraitements?: {
        etat?: {
          libelle?: string;
        };
        sousEtat?: {
          libelle?: string;
        };
      };
    };
  };
}

// =============================================================================
// CLIENT
// =============================================================================

export class AssembleeNationaleClient {
  private legislature: number;
  private baseUrl: string;

  constructor(legislature: number = 17) {
    this.legislature = legislature;
    this.baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository';
    logger.info({ legislature }, 'AssembleeNationaleClient initialized');
  }

  // ===========================================================================
  // DOWNLOAD & EXTRACT
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.debug({ url, destPath }, 'Downloading file...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 120000, // 2 minutes
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
        Accept: 'application/zip, application/octet-stream',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.debug({ destPath }, 'File downloaded');
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<string[]> {
    logger.debug({ zipPath, extractDir }, 'Extracting zip...');

    // Use unzip command (available on most systems)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Create extract directory
    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      // -q pour quiet, -o pour overwrite, maxBuffer pour gros fichiers
      await execAsync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 50, // 50 MB buffer
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'unzip failed');
      throw new Error(`Zip extraction failed: ${error.message}`);
    }

    // List extracted files
    const files = await fs.promises.readdir(extractDir);
    logger.debug({ files }, 'Extracted files');

    return files.map(f => path.join(extractDir, f));
  }

  // ===========================================================================
  // AMENDEMENTS
  // ===========================================================================

  private async findJsonFiles(dir: string, files: string[] = []): Promise<string[]> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.findJsonFiles(fullPath, files);
      } else if (entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  async getAmendements(limit?: number): Promise<ANAmendementFile['amendement'][]> {
    const zipUrl = `${this.baseUrl}/${this.legislature}/loi/amendements_div_legis/Amendements.json.zip`;
    const tempDir = path.join(os.tmpdir(), 'clair-amendements');
    const zipPath = path.join(tempDir, 'Amendements.json.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      // Clean up previous temp files
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download
      logger.info({ url: zipUrl }, 'Downloading amendements archive...');
      await this.downloadFile(zipUrl, zipPath);

      // Check file size
      const stats = await fs.promises.stat(zipPath);
      logger.info({ sizeBytes: stats.size, sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'Archive downloaded');

      // Extract
      logger.info('Extracting archive...');
      await this.extractZip(zipPath, extractDir);

      // Find all JSON files recursively
      logger.info('Scanning for JSON files...');
      const jsonFiles = await this.findJsonFiles(extractDir);
      logger.info({ totalFiles: jsonFiles.length }, 'JSON files found');

      // Apply limit to files to process
      const filesToProcess = limit && limit > 0 ? jsonFiles.slice(0, limit) : jsonFiles;

      // Parse each JSON file
      const amendements: ANAmendementFile['amendement'][] = [];
      let processed = 0;

      for (const jsonFile of filesToProcess) {
        try {
          const content = await fs.promises.readFile(jsonFile, 'utf-8');
          const data = JSON.parse(content) as ANAmendementFile;
          if (data?.amendement) {
            amendements.push(data.amendement);
          }
          processed++;

          // Log progress every 1000 files
          if (processed % 1000 === 0) {
            logger.debug({ processed, total: filesToProcess.length }, 'Parsing progress');
          }
        } catch (e: any) {
          logger.warn({ file: jsonFile, error: e.message }, 'Failed to parse amendement file');
        }
      }

      logger.info({ total: amendements.length }, 'Amendements parsed');
      return amendements;

    } finally {
      // Cleanup temp files
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  // ===========================================================================
  // TRANSFORM TO DB FORMAT
  // ===========================================================================

  transformAmendement(raw: ANAmendementFile['amendement']): {
    uid: string;
    legislature: number;
    numero: string;
    texteLegislatifRef: string | null;
    article: string | null;
    dispositif: string | null;
    exposeSommaire: string | null;
    auteurRef: string | null;
    groupeRef: string | null;
    auteurLibelle: string | null;
    sort: string | null;
    dateDepot: Date | null;
    dateSort: Date | null;
  } {
    // Decode HTML entities helper
    const decodeHtmlEntities = (text: string): string => {
      // Decode hex entities (&#x00E9; -> é)
      text = text.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
      // Decode decimal entities (&#233; -> é)
      text = text.replace(/&#(\d+);/g, (_, dec) =>
        String.fromCharCode(parseInt(dec, 10))
      );
      // Decode common named entities
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&laquo;/g, '\u00AB')
        .replace(/&raquo;/g, '\u00BB')
        .replace(/&euro;/g, '\u20AC')
        .replace(/&ndash;/g, '\u2013')
        .replace(/&mdash;/g, '\u2014')
        .replace(/&hellip;/g, '\u2026')
        .replace(/&rsquo;/g, '\u2019')
        .replace(/&lsquo;/g, '\u2018')
        .replace(/&rdquo;/g, '\u201D')
        .replace(/&ldquo;/g, '\u201C')
        .replace(/&oelig;/g, '\u0153')
        .replace(/&OElig;/g, '\u0152');
      return text;
    };

    // Strip HTML tags and decode entities
    const stripHtml = (html: string | undefined): string | null => {
      if (!html) return null;
      // Remove HTML tags first
      let text = html.replace(/<[^>]*>/g, '');
      // Decode HTML entities
      text = decodeHtmlEntities(text);
      // Clean up whitespace
      return text.replace(/\s+/g, ' ').trim();
    };

    // Safe string extraction (some fields can be objects with @xsi:nil)
    const safeString = (val: any): string | null => {
      if (typeof val === 'string') return val;
      return null;
    };

    // Safe date parsing
    const safeDate = (val: string | undefined): Date | null => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    return {
      uid: raw.uid,
      legislature: parseInt(raw.legislature || String(this.legislature), 10),
      numero: raw.identification?.numeroLong || raw.identification?.numeroOrdreDepot || '',
      texteLegislatifRef: raw.texteLegislatifRef || null,
      article: raw.pointeurFragmentTexte?.division?.articleDesignationCourte
        || raw.pointeurFragmentTexte?.division?.titre || null,
      dispositif: stripHtml(raw.corps?.contenuAuteur?.dispositif),
      exposeSommaire: stripHtml(raw.corps?.contenuAuteur?.exposeSommaire),
      auteurRef: safeString(raw.signataires?.auteur?.acteurRef),
      groupeRef: safeString(raw.signataires?.auteur?.groupePolitiqueRef),
      auteurLibelle: stripHtml(raw.signataires?.libelle),
      sort: typeof raw.cycleDeVie?.sort === 'string' ? raw.cycleDeVie.sort
        : raw.cycleDeVie?.etatDesTraitements?.sousEtat?.libelle
        || raw.cycleDeVie?.etatDesTraitements?.etat?.libelle || null,
      dateDepot: safeDate(raw.cycleDeVie?.dateDepot),
      dateSort: safeDate(raw.cycleDeVie?.dateSort),
    };
  }
}

export default AssembleeNationaleClient;
