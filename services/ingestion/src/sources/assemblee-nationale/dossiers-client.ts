// =============================================================================
// Client Assemblée Nationale Open Data - Dossiers Législatifs
// =============================================================================

import { LEGISLATURE_AN_COURANTE } from '../../workers/mandats';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';
import { downloadWithRetry } from '../../utils/download';

// =============================================================================
// TYPES BRUTS (structure JSON de l'AN)
// =============================================================================

interface ANActeLegislatif {
  '@xsi:type'?: string;
  uid: string;
  codeActe: string;
  libelleActe?: {
    nomCanonique?: string;
    libelleCourt?: string;
  };
  dateActe?: string;
  actesLegislatifs?: {
    acteLegislatif?: ANActeLegislatif | ANActeLegislatif[];
  };
  // Pour les votes
  voteRefs?: {
    voteRef?: string | string[];
  };
  // Pour les textes
  texteAssocie?: string | { typeTexte?: string; refTexteAssocie?: string } | Array<{ typeTexte?: string; refTexteAssocie?: string }>;
  texteAdopte?: string;
  // Pour la promulgation
  codeLoi?: string;
  titreLoi?: string;
  infoJO?: {
    dateJO?: string;
    urlLegifrance?: string;
    referenceNOR?: string;
  };
  statutConclusion?: {
    fam_code?: string;
    libelle?: string;
  };
}

interface ANDossierParlementaire {
  '@xmlns'?: string;
  '@xmlns:xsi'?: string;
  '@xsi:type'?: string;
  uid: string;
  legislature: string;
  titreDossier?: {
    titre?: string;
    titreChemin?: string;
    senatChemin?: string;
  };
  procedureParlementaire?: {
    code?: string;
    libelle?: string;
  };
  initiateur?: {
    acteurs?: {
      acteur?: { acteurRef?: string; mandatRef?: string } | Array<{ acteurRef?: string; mandatRef?: string }>;
    };
    organes?: {
      organe?: { organeRef?: { uid?: string } };
    };
  };
  actesLegislatifs?: {
    acteLegislatif?: ANActeLegislatif | ANActeLegislatif[];
  };
  fusionDossier?: unknown;
}

interface ANDossierFile {
  dossierParlementaire: ANDossierParlementaire;
}

// =============================================================================
// TYPES TRANSFORMÉS
// =============================================================================

export interface TransformedDossier {
  uid: string;
  legislature: number;
  titre: string;
  titreCourt: string | null;
  procedureCode: string | null;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  etat: string | null;
  dateDepot: Date | null;
  dateAdoption: Date | null;
  loiNumero: string | null;
  loiTitre: string | null;
  loiDateJO: Date | null;
  urlLegifrance: string | null;
  // Références extraites pour le matching
  voteRefs: string[];      // UIDs des scrutins (ex: VTANR5L17V451)
  texteRefs: string[];     // Références des textes (pour matcher les amendements)
  sourceData: ANDossierParlementaire;
}

// =============================================================================
// CLIENT
// =============================================================================

/**
 * Nom de l'archive des dossiers pour une législature donnée.
 *
 * L'AN n'a pas rétro-nommé ses anciennes archives : la 15e est publiée sous
 * `Dossiers_Legislatifs_XV.json.zip` (suffixe en chiffres romains), alors que
 * la 16e et la 17e utilisent le nom court. Vérifié le 2026-07-29 — la variante
 * romaine renvoie 404 sur 16 et 17, et le nom court renvoie 404 sur 15.
 */
export function archiveName(legislature: number): string {
  const ROMAN: Record<number, string> = { 15: 'XV' };
  const suffix = ROMAN[legislature];
  return suffix
    ? `Dossiers_Legislatifs_${suffix}.json.zip`
    : 'Dossiers_Legislatifs.json.zip';
}

export class DossiersLegislatifsClient {
  private legislature: number;
  private baseUrl: string;

  constructor(legislature: number = LEGISLATURE_AN_COURANTE) {
    this.legislature = legislature;
    this.baseUrl = 'https://data.assemblee-nationale.fr/static/openData/repository';
    logger.info({ legislature }, 'DossiersLegislatifsClient initialized');
  }

  // ===========================================================================
  // DOWNLOAD & EXTRACT
  // ===========================================================================

  /**
   * Toutes les archives AN viennent du même CDN, qui throttle sévèrement les
   * tirages répétés (mesuré le 2026-07-26 : 45x plus lent au 2e tirage
   * consécutif de la même archive). Un run télécharge plusieurs de ces archives
   * d'affilée, d'où des coupures dont le message « aborted » ne disait rien.
   * `downloadWithRetry` reprend avec backoff et journalise le contexte réel.
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    await downloadWithRetry(url, destPath);
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<string[]> {
    logger.debug({ zipPath, extractDir }, 'Extracting zip...');

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 100, // 100 MB buffer
      });
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'unzip failed');
      throw new Error(`Zip extraction failed: ${errorMessage(error)}`);
    }

    const files = await fs.promises.readdir(extractDir);
    logger.debug({ files }, 'Extracted files');

    return files.map(f => path.join(extractDir, f));
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

  // ===========================================================================
  // FETCH DOSSIERS
  // ===========================================================================

  async getDossiers(limit?: number): Promise<TransformedDossier[]> {
    const zipUrl = `${this.baseUrl}/${this.legislature}/loi/dossiers_legislatifs/${archiveName(this.legislature)}`;
    const tempDir = path.join(os.tmpdir(), 'clair-dossiers');
    const zipPath = path.join(tempDir, 'Dossiers_Legislatifs.json.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      // Clean up previous temp files
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Download
      logger.info({ url: zipUrl }, 'Downloading dossiers archive...');
      await this.downloadFile(zipUrl, zipPath);

      // Check file size
      const stats = await fs.promises.stat(zipPath);
      logger.info({ sizeBytes: stats.size, sizeMB: (stats.size / 1024 / 1024).toFixed(2) }, 'Archive downloaded');

      // Extract
      logger.info('Extracting archive...');
      await this.extractZip(zipPath, extractDir);

      // Find dossierParlementaire JSON files
      const dossierDir = path.join(extractDir, 'json', 'dossierParlementaire');
      let jsonFiles: string[] = [];

      if (await fs.promises.access(dossierDir).then(() => true).catch(() => false)) {
        jsonFiles = await this.findJsonFiles(dossierDir);
      } else {
        // Fallback: search in all json folder
        const jsonDir = path.join(extractDir, 'json');
        jsonFiles = await this.findJsonFiles(jsonDir);
        // Filter only dossier files
        jsonFiles = jsonFiles.filter(f => f.includes('DLR'));
      }

      logger.info({ totalFiles: jsonFiles.length }, 'Dossier files found');

      // Filter to current legislature only
      const legislaturePrefix = `DLR5L${this.legislature}`;
      jsonFiles = jsonFiles.filter(f => path.basename(f).startsWith(legislaturePrefix));
      logger.info({ filteredFiles: jsonFiles.length }, `Filtered to legislature ${this.legislature}`);

      // Apply limit
      const filesToProcess = limit && limit > 0 ? jsonFiles.slice(0, limit) : jsonFiles;

      // Parse each JSON file
      const dossiers: TransformedDossier[] = [];
      let processed = 0;

      for (const jsonFile of filesToProcess) {
        try {
          const content = await fs.promises.readFile(jsonFile, 'utf-8');
          const data = JSON.parse(content) as ANDossierFile;
          if (data?.dossierParlementaire) {
            const transformed = this.transformDossier(data.dossierParlementaire);
            if (transformed) {
              dossiers.push(transformed);
            }
          }
          processed++;

          if (processed % 100 === 0) {
            logger.debug({ processed, total: filesToProcess.length }, 'Parsing progress');
          }
        } catch (e) {
          logger.warn({ file: jsonFile, error: errorMessage(e) }, 'Failed to parse dossier file');
        }
      }

      logger.info({ total: dossiers.length }, 'Dossiers parsed');
      return dossiers;

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
  // TRANSFORM
  // ===========================================================================

  private transformDossier(raw: ANDossierParlementaire): TransformedDossier | null {
    try {
      const uid = raw.uid;
      const legislature = parseInt(raw.legislature, 10);
      const titre = raw.titreDossier?.titre || `Dossier ${uid}`;
      const titreCourt = raw.titreDossier?.titreChemin || null;

      const procedureCode = raw.procedureParlementaire?.code || null;
      const procedureLibelle = raw.procedureParlementaire?.libelle || null;

      // URLs
      const urlAN = titreCourt
        ? `https://www.assemblee-nationale.fr/dyn/${legislature}/dossiers/${titreCourt}`
        : null;
      const urlSenat = raw.titreDossier?.senatChemin || null;

      // Extract dates, votes, and state from actes législatifs
      const { dateDepot, dateAdoption, voteRefs, texteRefs, etat, loiInfo } =
        this.extractFromActes(raw.actesLegislatifs?.acteLegislatif);

      return {
        uid,
        legislature,
        titre,
        titreCourt,
        procedureCode,
        procedureLibelle,
        urlAN,
        urlSenat,
        etat,
        dateDepot,
        dateAdoption,
        loiNumero: loiInfo.numero,
        loiTitre: loiInfo.titre,
        loiDateJO: loiInfo.dateJO,
        urlLegifrance: loiInfo.urlLegifrance,
        voteRefs,
        texteRefs,
        sourceData: raw,
      };
    } catch (e) {
      logger.warn({ uid: raw.uid, error: errorMessage(e) }, 'Error transforming dossier');
      return null;
    }
  }

  /**
   * Parse une date de manière sécurisée, retourne null si invalide
   */
  private parseDate(dateStr: string | undefined | null): Date | null {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      // Vérifier que la date est valide
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  }

  private extractFromActes(actes: ANActeLegislatif | ANActeLegislatif[] | undefined): {
    dateDepot: Date | null;
    dateAdoption: Date | null;
    voteRefs: string[];
    texteRefs: string[];
    etat: string | null;
    loiInfo: { numero: string | null; titre: string | null; dateJO: Date | null; urlLegifrance: string | null };
  } {
    const voteRefs: string[] = [];
    const texteRefs: string[] = [];
    let dateDepot: Date | null = null;
    let dateAdoption: Date | null = null;
    let etat: string | null = 'en_cours';
    const loiInfo = { numero: null as string | null, titre: null as string | null, dateJO: null as Date | null, urlLegifrance: null as string | null };

    if (!actes) {
      return { dateDepot, dateAdoption, voteRefs, texteRefs, etat, loiInfo };
    }

    const actesArray = Array.isArray(actes) ? actes : [actes];

    const processActe = (acte: ANActeLegislatif) => {
      // Extract depot date
      if (acte.codeActe?.includes('DEPOT') && acte.dateActe && !dateDepot) {
        dateDepot = this.parseDate(acte.dateActe);
      }

      // Extract vote references
      if (acte.voteRefs?.voteRef) {
        const refs = Array.isArray(acte.voteRefs.voteRef)
          ? acte.voteRefs.voteRef
          : [acte.voteRefs.voteRef];
        voteRefs.push(...refs);
      }

      // Extract texte references
      if (acte.texteAssocie) {
        if (typeof acte.texteAssocie === 'string') {
          texteRefs.push(acte.texteAssocie);
        } else if (Array.isArray(acte.texteAssocie)) {
          acte.texteAssocie.forEach(t => {
            if (t.refTexteAssocie) texteRefs.push(t.refTexteAssocie);
          });
        } else if (acte.texteAssocie.refTexteAssocie) {
          texteRefs.push(acte.texteAssocie.refTexteAssocie);
        }
      }
      if (acte.texteAdopte) {
        texteRefs.push(acte.texteAdopte);
      }

      // Extract decision/adoption info
      if (acte.codeActe?.includes('DEC') && acte.statutConclusion) {
        const statut = acte.statutConclusion.libelle?.toLowerCase() || '';
        if (statut.includes('adopt') && acte.dateActe) {
          dateAdoption = this.parseDate(acte.dateActe);
          etat = 'adopte';
        } else if (statut.includes('rejet')) {
          etat = 'rejete';
        }
      }

      // Extract promulgation info
      if (acte.codeActe?.includes('PROM')) {
        etat = 'promulgue';
        if (acte.codeLoi) loiInfo.numero = acte.codeLoi;
        if (acte.titreLoi) loiInfo.titre = acte.titreLoi;
        if (acte.infoJO?.dateJO) {
          loiInfo.dateJO = this.parseDate(acte.infoJO.dateJO);
        }
        if (acte.infoJO?.urlLegifrance) {
          loiInfo.urlLegifrance = acte.infoJO.urlLegifrance;
        }
      }

      // Recursively process nested actes
      if (acte.actesLegislatifs?.acteLegislatif) {
        const nested = acte.actesLegislatifs.acteLegislatif;
        const nestedArray = Array.isArray(nested) ? nested : [nested];
        nestedArray.forEach(processActe);
      }
    };

    actesArray.forEach(processActe);

    return { dateDepot, dateAdoption, voteRefs, texteRefs, etat, loiInfo };
  }
}

export default DossiersLegislatifsClient;
