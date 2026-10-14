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
 * État d'un dossier après une décision de séance (`statutConclusion.libelle`).
 *
 * Un texte « modifié » (ou « adopté avec modifications ») par une chambre doit
 * repasser devant l'autre : la navette continue. Sans cette règle, le libellé
 * n'était reconnu ni comme adoption ni comme rejet, et l'état restait celui de
 * l'étape PRÉCÉDENTE. Les lois d'approbation des comptes 2025, rejetées par
 * l'AN le 9 juin 2026 puis modifiées par le Sénat le 22, restaient « rejetées »,
 * donc « procédure close » pour le sujet, pendant que le dossier du Sénat
 * disait « en cours » : le résumé IA recevait les deux et affirmait que le
 * Sénat n'avait pas encore examiné le texte.
 *
 * « adopté sans modification » reste une adoption.
 */
export function etatApresDecision(etat: string | null, libelle: string): string | null {
  const statut = libelle.trim().toLowerCase();
  if (/^modifiée?$/.test(statut) || statut.includes('avec modifications')) return 'en_cours';
  if (statut.includes('adopt')) return 'adopte';
  if (statut.includes('rejet')) return 'rejete';
  return etat;
}

const CHAMBRES: Record<string, string> = { AN: 'Assemblée nationale', SN: 'Sénat' };
const LECTURES: Record<string, string> = {
  NLEC: 'nouvelle lecture', LDEF: 'lecture définitive', LUNI: 'lecture unique',
};

/** Étape lisible d'une décision de séance, `null` pour les décisions de commission. */
export function etapeDecision(codeActe: string): string | null {
  if (codeActe === 'CMP-DEC') return 'Commission mixte paritaire';
  const cmp = /^CMP-DEBATS-(AN|SN)-DEC$/.exec(codeActe);
  if (cmp) return `${CHAMBRES[cmp[1]!]}, texte de la commission mixte paritaire`;
  const lecture = /^(AN|SN)(\d+|NLEC|LDEF|LUNI)-DEBATS-DEC$/.exec(codeActe);
  if (lecture) {
    const l = lecture[2]!;
    const libelle = LECTURES[l] ?? (l === '1' ? '1re lecture' : `${l}e lecture`);
    return `${CHAMBRES[lecture[1]!]}, ${libelle}`;
  }
  if (/^CG\d*-DEBATS-DEC$/.test(codeActe)) return 'Congrès';
  return null;
}

const dateFr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Décisions datées d'un dossier AN, dans l'ordre : « 09/06/2026 — Assemblée
 * nationale, 1re lecture : rejeté ». Le dossier AN porte toute la navette, Sénat
 * compris. Sans elle, le prompt IA n'avait que l'état et les votes, sans date ni
 * chambre, et le modèle supposait l'ordre habituel : un texte rejeté par l'AN puis
 * modifié par le Sénat devenait « adopté par les députés, il doit encore être
 * examiné par le Sénat ».
 */
export function parcoursDossier(sourceData: unknown): string[] {
  const decisions: { date: string; ligne: string }[] = [];
  const visiter = (noeud: unknown): void => {
    if (Array.isArray(noeud)) { noeud.forEach(visiter); return; }
    if (!noeud || typeof noeud !== 'object') return;
    const acte = noeud as Record<string, unknown>;
    const code = typeof acte.codeActe === 'string' ? acte.codeActe : '';
    const date = typeof acte.dateActe === 'string' ? acte.dateActe.slice(0, 10) : '';
    if (code && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const statut = acte.statutConclusion as { libelle?: unknown } | undefined;
      const libelle = typeof statut?.libelle === 'string' ? statut.libelle.trim() : '';
      const etape = code.includes('DEC') && libelle ? etapeDecision(code) : null;
      if (etape) decisions.push({ date, ligne: `${dateFr(date)} — ${etape} : ${libelle}` });
      if (code === 'PROM-PUB') {
        const loi = typeof acte.codeLoi === 'string' ? ` (loi n° ${acte.codeLoi})` : '';
        decisions.push({ date, ligne: `${dateFr(date)} — Promulgation${loi}` });
      }
    }
    for (const valeur of Object.values(acte)) {
      if (valeur && typeof valeur === 'object') visiter(valeur);
    }
  };
  visiter((sourceData as { actesLegislatifs?: unknown } | null)?.actesLegislatifs);
  // Tri stable : à date égale, l'ordre du document (séance avant CMP…) est gardé.
  return decisions
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i)
    .map((d) => d.ligne);
}

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

      // TOUS les dossiers de l'archive, pas seulement ceux ouverts dans cette
      // législature. L'archive de la 17e porte aussi 196 dossiers ouverts avant
      // elle et poursuivis (texte du Sénat transmis, texte repris après la
      // dissolution) : ils gardent leur identifiant d'origine (`DLR5L16N…`) et
      // c'est ici qu'ils reçoivent leurs actes de la 17e. Le filtre sur le
      // préfixe, présent depuis le premier commit, les écartait : leurs textes,
      // amendements et votes de la 17e n'avaient pas de dossier (cf.
      // utils/legislatures-dossier.ts).
      const parLegislature: Record<string, number> = {};
      for (const f of jsonFiles) {
        const leg = /^DLR5L(\d+)N/.exec(path.basename(f))?.[1] ?? '?';
        parLegislature[leg] = (parLegislature[leg] ?? 0) + 1;
      }
      logger.info({ legislature: this.legislature, parLegislatureDOrigine: parLegislature }, 'Dossiers de l’archive');

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
        }
        etat = etatApresDecision(etat, statut);
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
