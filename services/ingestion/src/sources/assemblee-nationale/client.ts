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

// Valeur absente : l'archive écrit `{ "@xsi:nil": "true" }` plutôt que null.
type Nil = { '@xsi:nil'?: string };

// Discussion commune ou identique : les amendements appelés ensemble en séance.
interface ANDiscussion {
  idDiscussion?: string | Nil;
  typePosition?: string | Nil;
}

// Structure d'un fichier JSON d'amendement AN
export interface ANAmendementFile {
  amendement: {
    uid: string;
    legislature: string;
    // Date de la dernière modification, en millisecondes depuis l'epoch.
    chronotag?: string;
    identification: {
      numeroLong: string;
      numeroOrdreDepot: string;
    };
    texteLegislatifRef: string;
    // Clé de l'ordre d'appel en séance, à comparer en ordre lexicographique.
    triAmendement?: string | Nil;
    amendementParentRef?: string | Nil;
    seanceDiscussionRef?: string | Nil;
    discussionCommune?: ANDiscussion | Nil;
    discussionIdentique?: ANDiscussion | Nil;
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
      amendementStandard?: {
        alinea?: {
          numero?: string | Nil;
          avant_A_Apres?: string | Nil;
          alineaDesignation?: string | Nil;
        } | Nil;
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

  /**
   * L'archive des amendements d'une législature. La 15e est rangée ailleurs et
   * porte le suffixe en chiffres romains, comme ses dossiers et ses scrutins.
   */
  static urlArchiveAmendements(legislature: number, baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository'): string {
    return legislature === 15
      ? `${baseUrl}/15/loi/amendements_legis/Amendements_XV.json.zip`
      : `${baseUrl}/${legislature}/loi/amendements_div_legis/Amendements.json.zip`;
  }

  /**
   * `archiveLocale` : une archive déjà téléchargée, lue telle quelle. Pour les
   * rattrapages de législatures passées, que le CDN de l'AN coupe et bride
   * quand on les tire plusieurs fois (cf. utils/download.ts).
   */
  async getAmendements(limit?: number, archiveLocale?: string): Promise<ANAmendementFile['amendement'][]> {
    const zipUrl = AssembleeNationaleClient.urlArchiveAmendements(this.legislature, this.baseUrl);
    const tempDir = path.join(os.tmpdir(), 'clair-amendements');
    const zipPath = archiveLocale ?? path.join(tempDir, 'Amendements.json.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      // Clean up previous temp files
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      if (archiveLocale) {
        logger.info({ archive: archiveLocale }, 'Archive des amendements lue en local');
      } else {
        logger.info({ url: zipUrl }, 'Downloading amendements archive...');
        await this.downloadFile(zipUrl, zipPath);
      }

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
    alinea: string | null;
    alineaNumero: number | null;
    idDiscussionCommune: string | null;
    positionDiscussionCommune: string | null;
    idDiscussionIdentique: string | null;
    positionDiscussionIdentique: string | null;
    chronotag: Date | null;
    triAmendement: string | null;
    seanceDiscussionRef: string | null;
    amendementParentRef: string | null;
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

    const alinea = (() => {
      const a = raw.pointeurFragmentTexte?.amendementStandard?.alinea;
      return a && typeof a === 'object' && !('@xsi:nil' in a)
        ? a as { numero?: string | Nil; alineaDesignation?: string | Nil }
        : null;
    })();
    const numeroAlinea = safeString(alinea?.numero)?.trim() ?? null;
    const discussion = (d: ANDiscussion | Nil | undefined) => {
      const v = d && !('@xsi:nil' in d) ? d as ANDiscussion : null;
      return { id: safeString(v?.idDiscussion), position: safeString(v?.typePosition) };
    };
    const commune = discussion(raw.discussionCommune);
    const identique = discussion(raw.discussionIdentique);
    const chronotag = /^\d+$/.test(raw.chronotag ?? '') ? new Date(Number(raw.chronotag)) : null;

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
      alinea: safeString(alinea?.alineaDesignation)?.trim() || null,
      alineaNumero: numeroAlinea && /^\d+$/.test(numeroAlinea) ? parseInt(numeroAlinea, 10) : null,
      idDiscussionCommune: commune.id,
      positionDiscussionCommune: commune.position,
      idDiscussionIdentique: identique.id,
      positionDiscussionIdentique: identique.position,
      chronotag: chronotag && !isNaN(chronotag.getTime()) ? chronotag : null,
      triAmendement: safeString(raw.triAmendement),
      seanceDiscussionRef: safeString(raw.seanceDiscussionRef),
      amendementParentRef: safeString(raw.amendementParentRef),
    };
  }
}

export default AssembleeNationaleClient;
