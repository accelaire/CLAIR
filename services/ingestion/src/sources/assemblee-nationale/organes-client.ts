// =============================================================================
// Client Assemblée Nationale Open Data - Organes historiques (AMO30)
// Source: AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip
// Contient ~10 800 organes ; après filtrage commissions/dérivés → ~2 990
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import axios from 'axios';
import { logger } from '../../utils/logger.js';

// =============================================================================
// MAPPING codeType → type Commission
// Les codeTypes absents de cette map sont filtrés (CIRCONSCRIPTION, MINISTERE,
// GP, PARPOL, GOUVERNEMENT, ORGEXTPARL, PRESREP, HCJ, CONSTITU, CJR, etc.)
//
// EXCLUSIONS INTENTIONNELLES :
//   - GROUPESENAT : groupes politiques du Sénat → table groupes_politiques, pas commissions
// =============================================================================

const CODE_TYPE_MAP: Record<string, string> = {
  COMPER: 'permanente',
  COMSENAT: 'permanente',
  CNPE: 'enquete',
  CNPS: 'speciale',
  COMSPSENAT: 'speciale',
  CMP: 'mixte_paritaire',
  OFFPAR: 'office',
  DELEG: 'delegation',
  DELEGBUREAU: 'delegation',
  DELEGSENAT: 'delegation',
  MISINFO: 'mission_info',
  MISINFOCOM: 'mission_info',
  MISINFOPRE: 'mission_info',
  GE: 'groupe_etudes',
  GEVI: 'groupe_etudes',
  GA: 'groupe_amitie',
  API: 'assemblee_internationale',
  ASSEMBLEE: 'hemicycle',
  SENAT: 'hemicycle',
  COMNL: 'autre',
  BUREAU: 'autre',
  CONFPT: 'autre',
  // GROUPESENAT intentionnellement absent : ce sont des groupes politiques Sénat,
  // pas des commissions — ils appartiennent à la table groupes_politiques.
};

// codeTypes qui impliquent chambre = 'senat'
const SENAT_CODE_TYPES = new Set([
  'COMSENAT',
  'COMSPSENAT',
  'DELEGSENAT',
  'SENAT',
]);

// =============================================================================
// TYPES
// =============================================================================

/** Structure brute d'un organe dans AMO30 */
interface ANOrganeRaw {
  uid: string;
  codeType: string;
  libelle: string;
  libelleAbrev?: string | null;
  libelleAbrege?: string | null;
  viMoDe?: {
    /** Présent pour la plupart des types */
    dateDebut?: string | null;
    /** Utilisé à la place de dateDebut pour GA/GE/GEVI (groupes d'études et d'amitié) */
    dateAgrement?: string | null;
    dateFin?: string | null;
  } | null;
}

/** Un fichier JSON de l'archive AMO30 contient { "organe": { ... } } */
interface ANOrganeFile {
  organe: ANOrganeRaw;
}

export interface TransformedOrgane {
  uid: string;
  codeType: string;          // raw, utile pour debug
  type: string;              // permanente | enquete | speciale | …
  chambre: 'assemblee' | 'senat';
  libelle: string;
  libelleAbrev: string | null;
  libelleAbrege: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  actif: boolean;            // true si dateFin null OU dateFin > now
}

// =============================================================================
// CLIENT
// =============================================================================

export class AssembleeNationaleOrganesClient {
  private legislature: number;
  private baseUrl: string;

  constructor(legislature: number = 17) {
    this.legislature = legislature;
    this.baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository';
    logger.info({ legislature }, 'AssembleeNationaleOrganesClient initialized');
  }

  // ===========================================================================
  // DOWNLOAD & EXTRACT HELPERS
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.debug({ url, destPath }, 'Downloading file...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 180000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
        Accept: 'application/zip, application/octet-stream',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.debug({ destPath }, 'File downloaded');
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<void> {
    logger.debug({ zipPath, extractDir }, 'Extracting zip...');

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 200, // 200 MB — AMO30 est volumineux
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'unzip failed');
      throw new Error(`Zip extraction failed: ${error.message}`);
    }
  }

  /** Parcourt récursivement un répertoire et retourne les chemins des .json */
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

  // ===========================================================================
  // TRANSFORMER
  // ===========================================================================

  private transformOrgane(raw: ANOrganeRaw): TransformedOrgane | null {
    const mappedType = CODE_TYPE_MAP[raw.codeType];
    if (!mappedType) {
      // codeType non pertinent pour CLAIR → filtré
      return null;
    }

    const viMoDe = raw.viMoDe;
    const dateFin = viMoDe?.dateFin ? new Date(viMoDe.dateFin) : null;

    // GA/GE/GEVI ont dateDebut=null mais utilisent dateAgrement comme date de création
    const dateDebutRaw = viMoDe?.dateDebut ?? viMoDe?.dateAgrement;

    if (!dateDebutRaw) {
      logger.warn({ uid: raw.uid, codeType: raw.codeType }, 'Organe sans dateDebut ni dateAgrement — ignoré');
      return null;
    }

    const dateDebut = new Date(dateDebutRaw);
    if (isNaN(dateDebut.getTime())) {
      logger.warn({ uid: raw.uid, dateDebut: dateDebutRaw }, 'dateDebut invalide — ignoré');
      return null;
    }

    const chambre: 'assemblee' | 'senat' = SENAT_CODE_TYPES.has(raw.codeType)
      ? 'senat'
      : 'assemblee';

    const now = new Date();
    const actif = dateFin === null || dateFin > now;

    return {
      uid: raw.uid,
      codeType: raw.codeType,
      type: mappedType,
      chambre,
      libelle: raw.libelle,
      libelleAbrev: raw.libelleAbrev ?? null,
      libelleAbrege: raw.libelleAbrege ?? null,
      dateDebut,
      dateFin,
      actif,
    };
  }

  // ===========================================================================
  // MÉTHODE PRINCIPALE
  // ===========================================================================

  async getOrganes(): Promise<TransformedOrgane[]> {
    const zipUrl =
      `${this.baseUrl}/${this.legislature}/amo/` +
      `tous_acteurs_mandats_organes_xi_legislature/` +
      `AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`;

    const tempDir = path.join(os.tmpdir(), 'clair-amo30');
    const zipPath = path.join(tempDir, 'AMO30.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      logger.info({ url: zipUrl }, 'Downloading AMO30 archive...');
      await this.downloadFile(zipUrl, zipPath);

      const stats = await fs.promises.stat(zipPath);
      logger.info({ sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'AMO30 archive downloaded');

      logger.info('Extracting AMO30 archive...');
      await this.extractZip(zipPath, extractDir);

      logger.info('Scanning for JSON files...');
      const jsonFiles = await this.findJsonFiles(extractDir);
      logger.info({ totalFiles: jsonFiles.length }, 'JSON files found in AMO30');

      const organes: TransformedOrgane[] = [];
      let totalParsed = 0;
      let totalFiltered = 0;
      let parseErrors = 0;

      for (const jsonFile of jsonFiles) {
        try {
          const content = await fs.promises.readFile(jsonFile, 'utf-8');
          const data = JSON.parse(content) as ANOrganeFile;

          if (!data?.organe) continue;

          totalParsed++;
          const transformed = this.transformOrgane(data.organe);

          if (transformed) {
            organes.push(transformed);
          } else {
            totalFiltered++;
          }

          if (totalParsed % 1000 === 0) {
            logger.debug(
              { parsed: totalParsed, kept: organes.length, filtered: totalFiltered },
              'AMO30 parsing progress',
            );
          }
        } catch (e: any) {
          parseErrors++;
          logger.warn({ file: jsonFile, error: e.message }, 'Failed to parse organe file');
        }
      }

      logger.info(
        {
          totalFiles: jsonFiles.length,
          totalParsed,
          kept: organes.length,
          filtered: totalFiltered,
          parseErrors,
        },
        'AMO30 parsing complete',
      );

      return organes;
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export default AssembleeNationaleOrganesClient;
