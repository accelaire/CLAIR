// =============================================================================
// Client Assemblée Nationale Open Data - Réunions / Agenda
// Source: Agenda.json.zip (réunions de commission, séances, etc.)
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import axios from 'axios';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES BRUTS (structure AN)
// =============================================================================

export interface ANReunionFile {
  reunion: {
    '@xsi:type'?: string; // 'reunionCommission_type', 'seance_type', 'reunionInitParlementaire_type'
    uid: string;
    formatReunion?: string; // 'Ordinaire' (unreliable for type detection)
    organeReuniRef?: string; // UID de l'organe (ex: PO59048)
    timeStampDebut?: string;
    timeStampFin?: string;
    lieu?: {
      lieuRef?: string | null;
      libelleLong?: string | null;
    };
    cycleDeVie?: {
      etat?: string; // 'Confirmé', 'Annulé', 'Supprimé', 'Éventuel'
      chrono?: {
        creation?: string;
        cloture?: string;
      };
    };
    ODJ?: {
      convocationODJ?: {
        item?: string | string[];
      };
      resumeODJ?: {
        item?: string | string[];
      };
      pointsODJ?: unknown;
    };
    participants?: {
      participantsInternes?: {
        participantInterne?: Array<{
          acteurRef?: string; // PA123456
          presence?: string; // 'présent', 'absent', 'excusé'
        }>;
      } | null;
      personnesAuditionnees?: {
        personneAuditionnee?: Array<{
          libelle?: string;
          qualite?: string;
        } | null>;
      } | null;
    };
    captationVideo?: string; // 'true' | 'false'
    ouverturePresse?: string; // 'true' | 'false'
    compteRenduRef?: string;
  };
}

export interface TransformedReunion {
  uid: string;
  type: string; // 'commission', 'seance', 'initiative_parlementaire'
  organeReuniRef: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  lieu: string | null;
  etat: string; // 'confirme', 'annule', 'supprime', 'eventuel'
  odjResume: string | null;
  odjComplet: string | null;
  captationVideo: boolean;
  ouvertePresse: boolean;
  compteRenduRef: string | null;
  participants: Array<{
    acteurRef: string;
    presence: string; // 'present', 'absent', 'excuse'
  }>;
  auditionnes: Array<{
    libelle: string;
    qualite: string | null;
  }>;
}

// =============================================================================
// CLIENT
// =============================================================================

export class AssembleeNationaleReunionsClient {
  private legislature: number;
  private baseUrl: string;

  constructor(legislature: number = 17) {
    this.legislature = legislature;
    this.baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository';
    logger.info({ legislature }, 'AssembleeNationaleReunionsClient initialized');
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.debug({ url, destPath }, 'Downloading file...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 120000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
        'Accept': 'application/zip, application/octet-stream',
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
        maxBuffer: 1024 * 1024 * 50,
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'unzip failed');
      throw new Error(`Zip extraction failed: ${error.message}`);
    }
  }

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

  async getReunions(limit?: number): Promise<TransformedReunion[]> {
    const zipUrl = `${this.baseUrl}/${this.legislature}/vp/reunions/Agenda.json.zip`;
    const tempDir = path.join(os.tmpdir(), 'clair-reunions');
    const zipPath = path.join(tempDir, 'Agenda.json.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      logger.info({ url: zipUrl }, 'Downloading reunions archive...');
      await this.downloadFile(zipUrl, zipPath);

      const stats = await fs.promises.stat(zipPath);
      logger.info({ sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'Archive downloaded');

      logger.info('Extracting archive...');
      await this.extractZip(zipPath, extractDir);

      logger.info('Scanning for JSON files...');
      const jsonFiles = await this.findJsonFiles(extractDir);
      logger.info({ totalFiles: jsonFiles.length }, 'JSON files found');

      const filesToProcess = limit && limit > 0 ? jsonFiles.slice(0, limit) : jsonFiles;

      const reunions: TransformedReunion[] = [];
      let processed = 0;
      let skipped = 0;

      for (const jsonFile of filesToProcess) {
        try {
          const content = await fs.promises.readFile(jsonFile, 'utf-8');
          const data = JSON.parse(content) as ANReunionFile;

          if (!data?.reunion) continue;

          const transformed = this.transformReunion(data.reunion);
          if (transformed) {
            reunions.push(transformed);
          } else {
            skipped++;
          }

          processed++;
          if (processed % 500 === 0) {
            logger.debug({ processed, total: filesToProcess.length }, 'Parsing progress');
          }
        } catch (e: any) {
          logger.warn({ file: jsonFile, error: e.message }, 'Failed to parse reunion file');
        }
      }

      logger.info({ total: reunions.length, skipped }, 'Reunions parsed');
      return reunions;
    } finally {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  transformReunion(raw: ANReunionFile['reunion']): TransformedReunion | null {
    const etat = raw.cycleDeVie?.etat;
    // Skip deleted meetings
    if (etat === 'Supprimé') return null;

    const safeDate = (val: string | undefined): Date | null => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const dateDebut = safeDate(raw.timeStampDebut);
    if (!dateDebut) return null;

    // Map type from @xsi:type (formatReunion is unreliable — always 'Ordinaire' or absent)
    const xsiType = raw['@xsi:type'] || '';
    let type = 'commission';
    if (xsiType === 'seance_type') type = 'seance';
    else if (xsiType === 'reunionInitParlementaire_type') type = 'initiative_parlementaire';

    // Map etat
    const etatMap: Record<string, string> = {
      'Confirmé': 'confirme',
      'Annulé': 'annule',
      'Supprimé': 'supprime',
      'Éventuel': 'eventuel',
    };
    const mappedEtat = etatMap[etat || ''] || 'confirme';

    // Build ODJ
    let odjResume = '';
    let odjComplet = '';
    const odj = raw.ODJ;

    // Helper: normalize item to array (can be string or array in AN data)
    const toArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.filter((x): x is string => typeof x === 'string');
      if (typeof val === 'string') return [val];
      return [];
    };

    if (odj?.resumeODJ?.item) {
      const items = toArray(odj.resumeODJ.item);
      odjResume = items.slice(0, 3).join(' | ');
    }
    if (odj?.convocationODJ?.item) {
      const items = toArray(odj.convocationODJ.item);
      odjComplet = items.join('\n');
    }

    // Participants
    const participants: TransformedReunion['participants'] = [];
    if (raw.participants?.participantsInternes?.participantInterne) {
      for (const p of raw.participants.participantsInternes.participantInterne) {
        if (!p.acteurRef) continue;
        const presence = (p.presence || '').toLowerCase();
        participants.push({
          acteurRef: p.acteurRef,
          presence:
            presence.includes('présent') || presence.includes('present')
              ? 'present'
              : presence.includes('excus')
                ? 'excuse'
                : 'absent',
        });
      }
    }

    // Auditionnés
    const auditionnes: TransformedReunion['auditionnes'] = [];
    if (raw.participants?.personnesAuditionnees?.personneAuditionnee) {
      for (const a of raw.participants.personnesAuditionnees.personneAuditionnee) {
        if (!a || !a.libelle) continue;
        auditionnes.push({
          libelle: a.libelle,
          qualite: a.qualite || null,
        });
      }
    }

    // Append auditionnés to odjComplet
    if (auditionnes.length > 0) {
      const auditionText =
        '\n\nPersonnes auditionnées:\n' +
        auditionnes.map((a) => `- ${a.libelle}${a.qualite ? ` (${a.qualite})` : ''}`).join('\n');
      odjComplet += auditionText;
    }

    return {
      uid: raw.uid,
      type,
      organeReuniRef: raw.organeReuniRef || null,
      dateDebut,
      dateFin: safeDate(raw.timeStampFin),
      lieu: raw.lieu?.libelleLong || null,
      etat: mappedEtat,
      odjResume: odjResume || null,
      odjComplet: odjComplet || null,
      captationVideo: raw.captationVideo === 'true',
      ouvertePresse: raw.ouverturePresse === 'true',
      compteRenduRef: raw.compteRenduRef || null,
      participants,
      auditionnes,
    };
  }
}

export default AssembleeNationaleReunionsClient;
