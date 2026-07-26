// =============================================================================
// Client Assemblée Nationale Open Data - Récupération des amendements
// =============================================================================

import { LEGISLATURE_AN_COURANTE } from '../../workers/mandats';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';
import { downloadWithRetry } from '../../utils/download';

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

  constructor(legislature: number = LEGISLATURE_AN_COURANTE) {
    this.legislature = legislature;
    this.baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository';
    logger.info({ legislature }, 'AssembleeNationaleClient initialized');
  }

  // ===========================================================================
  // DOWNLOAD & EXTRACT
  // ===========================================================================

  /**
   * L'archive des amendements pèse ~283 Mo et son téléchargement a échoué sept
   * jours sur huit entre le 19 et le 26 juillet 2026, toujours sur un « aborted »
   * survenu en moins de 3,2 s — sans qu'aucune trace ne permette de savoir
   * pourquoi. `downloadWithRetry` reprend sur échec transitoire et journalise le
   * contexte réel (octets reçus, taille attendue, chaîne de causes, disque
   * restant). Les autres clients AN gardent pour l'instant leur copie locale.
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    await downloadWithRetry(url, destPath);
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'unzip failed');
      throw new Error(`Zip extraction failed: ${errorMessage(error)}`);
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
        } catch (e) {
          logger.warn({ file: jsonFile, error: errorMessage(e) }, 'Failed to parse amendement file');
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
    cosignatairesRefs: string[];
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

    // Strip HTML tags and decode entities, preserving paragraph breaks
    const stripHtml = (html: string | undefined): string | null => {
      if (!html) return null;
      // Convert block elements to newlines before stripping
      let text = html
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n');
      // Remove remaining HTML tags
      text = text.replace(/<[^>]*>/g, '');
      // Decode HTML entities
      text = decodeHtmlEntities(text);
      // Collapse multiple spaces (but preserve newlines)
      text = text.replace(/[^\S\n]+/g, ' ');
      // Collapse multiple newlines to max 2
      text = text.replace(/\n{3,}/g, '\n\n');
      // Trim each line
      text = text.split('\n').map(line => line.trim()).join('\n');
      return text.trim();
    };

    // Safe string extraction (some fields can be objects with @xsi:nil)
    const safeString = (val: unknown): string | null => {
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
      cosignatairesRefs: (() => {
        const refs = raw.signataires?.cosignataires?.acteurRef;
        if (!refs) return [];
        return Array.isArray(refs) ? refs.filter((r): r is string => typeof r === 'string') : typeof refs === 'string' ? [refs] : [];
      })(),
    };
  }
}

export default AssembleeNationaleClient;
