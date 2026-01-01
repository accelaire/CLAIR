// =============================================================================
// Client DILA - Récupération des interventions en séance (comptes rendus)
// Source: https://echanges.dila.gouv.fr/OPENDATA/Debats/AN/
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { parseStringPromise } from 'xml2js';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface DILAIntervention {
  seanceId: string;
  date: Date;
  orateur: string;
  orateurHref?: string; // Lien vers la fiche député AN
  contenu: string;
  type: 'intervention' | 'question' | 'explication_vote';
}

export interface TransformedIntervention {
  seanceId: string;
  date: Date;
  orateurNom: string;
  orateurPrenom?: string;
  orateurRef?: string; // PA123456 si disponible
  contenu: string;
  type: string;
  sourceUrl?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

function getSessionName(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  // Session parlementaire: octobre année N à septembre année N+1
  if (month >= 9) { // octobre à décembre
    return `session-ordinaire-de-${year}-${year + 1}`;
  } else { // janvier à septembre
    return `session-ordinaire-de-${year - 1}-${year}`;
  }
}

function generateSeanceUrl(date: Date): string {
  const jour = JOURS_FR[date.getDay()];
  const dateNum = date.getDate();
  const mois = MOIS_FR[date.getMonth()];
  const annee = date.getFullYear();
  const session = getSessionName(date);

  return `https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/seance/${session}/seance-du-${jour}-${dateNum}-${mois}-${annee}`;
}

// =============================================================================
// CLIENT
// =============================================================================

export class DILAInterventionsClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://echanges.dila.gouv.fr/OPENDATA/Debats/AN';
    logger.info('DILAInterventionsClient initialized');
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.debug({ url, destPath }, 'Downloading file...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 120000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.debug({ destPath }, 'File downloaded');
  }

  private async extractTaz(tazPath: string, extractDir: string): Promise<string[]> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });

    // Les .taz sont des tar (pas gzip) contenant un .tar interne
    try {
      await execAsync(`tar -xf "${tazPath}" -C "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 50,
      });

      // Extraire le tar interne s'il existe
      const files = await fs.promises.readdir(extractDir);
      for (const f of files) {
        if (f.endsWith('.tar')) {
          await execAsync(`tar -xf "${path.join(extractDir, f)}" -C "${extractDir}"`, {
            maxBuffer: 1024 * 1024 * 50,
          });
        }
      }

      // Retourner la liste des fichiers XML
      const allFiles = await fs.promises.readdir(extractDir);
      return allFiles.filter(f => f.endsWith('.xml')).map(f => path.join(extractDir, f));

    } catch (error: any) {
      logger.error({ error: error.message }, 'Extraction failed');
      throw new Error(`TAZ extraction failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // FETCH INTERVENTIONS
  // ===========================================================================

  async getInterventions(options: { maxSeances?: number; year?: number } = {}): Promise<TransformedIntervention[]> {
    const maxSeances = options.maxSeances || 100; // Par défaut: 100 séances
    const currentYear = new Date().getFullYear();

    const tempDir = path.join(os.tmpdir(), 'clair-interventions-dila');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Collecter les séances sur plusieurs années si nécessaire
      const allTazFiles: { year: number; file: string; numero: number }[] = [];
      const yearsToTry = options.year ? [options.year] : [currentYear, currentYear - 1, currentYear - 2];

      for (const year of yearsToTry) {
        try {
          logger.info({ year }, 'Fetching séances list...');
          const listUrl = `${this.baseUrl}/${year}/`;

          const listResponse = await axios.get(listUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'CLAIR-Bot/1.0' },
          });

          // Parser la liste HTML pour extraire les noms de fichiers .taz
          const regex = /href="(AN_\d+\.taz)"/g;
          let match;
          while ((match = regex.exec(listResponse.data)) !== null) {
            if (match[1]) {
              const numero = parseInt(match[1].replace(/\D/g, ''), 10);
              allTazFiles.push({ year, file: match[1], numero });
            }
          }

          logger.info({ year, count: allTazFiles.length }, 'Found séances for year');

          // Si on a assez de séances, on arrête
          if (allTazFiles.length >= maxSeances) break;

        } catch (error: any) {
          if (error.response?.status === 404) {
            logger.warn({ year }, 'No data for year, trying previous year...');
          } else {
            throw error;
          }
        }
      }

      if (allTazFiles.length === 0) {
        logger.warn('No séances found for any year');
        return [];
      }

      // Trier par numéro décroissant (plus récents d'abord) - les numéros sont globaux
      allTazFiles.sort((a, b) => b.numero - a.numero);

      // Prendre seulement les N premières séances
      const tazFilesToProcess = allTazFiles.slice(0, maxSeances);

      logger.info({ total: allTazFiles.length, processing: tazFilesToProcess.length }, 'Found séances');

      const allInterventions: TransformedIntervention[] = [];
      let processed = 0;

      for (const { year, file: tazFile } of tazFilesToProcess) {
        try {
          const tazUrl = `${this.baseUrl}/${year}/${tazFile}`;
          const tazPath = path.join(tempDir, tazFile);
          const extractDir = path.join(tempDir, `extract_${processed}`);

          logger.debug({ tazFile, year }, 'Downloading séance...');
          await this.downloadFile(tazUrl, tazPath);
          const xmlFiles = await this.extractTaz(tazPath, extractDir);

          // Traiter les fichiers CRI (Compte Rendu Intégral)
          for (const xmlFile of xmlFiles) {
            if (path.basename(xmlFile).startsWith('CRI_')) {
              const interventions = await this.parseCompteRendu(xmlFile);
              allInterventions.push(...interventions);
            }
          }

          processed++;
          logger.debug({ seance: tazFile, interventions: allInterventions.length }, 'Séance processed');

        } catch (error: any) {
          logger.warn({ file: tazFile, error: error.message }, 'Error processing séance');
        }
      }

      logger.info({ seances: processed, interventions: allInterventions.length }, 'Interventions extraction completed');
      return allInterventions;

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // PARSER
  // ===========================================================================

  private async parseCompteRendu(xmlPath: string): Promise<TransformedIntervention[]> {
    const interventions: TransformedIntervention[] = [];

    try {
      const content = await fs.promises.readFile(xmlPath, 'utf-8');
      const result = await parseStringPromise(content, {
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true,
      });

      // Extraire les métadonnées
      const metadonnees = result?.PublicationDANBlanc?.ContenuDANBlanc?.CompteRendu?.Metadonnees;
      const dateSeance = metadonnees?.dateSeance ? new Date(metadonnees.dateSeance) : new Date();
      const seanceId = metadonnees?.parution || path.basename(xmlPath, '.xml');

      // Parcourir le contenu pour trouver les interventions
      const contenu = result?.PublicationDANBlanc?.ContenuDANBlanc?.CompteRendu?.Contenu;
      if (!contenu) return interventions;

      // Extraire les paragraphes avec orateurs
      const extractParagraphs = (obj: any, collected: any[] = []): any[] => {
        if (!obj) return collected;

        if (Array.isArray(obj)) {
          for (const item of obj) {
            extractParagraphs(item, collected);
          }
        } else if (typeof obj === 'object') {
          // Si c'est un Para avec un Orateur
          if (obj.Para) {
            const paras = Array.isArray(obj.Para) ? obj.Para : [obj.Para];
            for (const para of paras) {
              if (para?.Orateur) {
                collected.push(para);
              }
            }
          }

          // Récursion dans les sous-objets
          for (const key of Object.keys(obj)) {
            if (key !== 'Para' && typeof obj[key] === 'object') {
              extractParagraphs(obj[key], collected);
            }
          }
        }

        return collected;
      };

      const paragraphs = extractParagraphs(contenu);

      for (const para of paragraphs) {
        const orateur = para.Orateur;
        if (!orateur) continue;

        const nom = typeof orateur.Nom === 'string' ? orateur.Nom : orateur.Nom?._ || orateur.Nom?.$text || '';
        const href = orateur.href;

        // Extraire le texte du paragraphe
        let texte = '';
        if (typeof para === 'string') {
          texte = para;
        } else if (para._) {
          texte = para._;
        } else {
          // Concaténer les parties texte
          const getText = (obj: any): string => {
            if (typeof obj === 'string') return obj;
            if (obj?._) return obj._;
            if (obj?.$text) return obj.$text;
            if (Array.isArray(obj)) return obj.map(getText).join(' ');
            if (typeof obj === 'object') {
              return Object.values(obj).map(getText).join(' ');
            }
            return '';
          };
          texte = getText(para);
        }

        // Nettoyer le texte
        texte = texte
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          // Supprimer le point initial (artefact du parsing XML)
          .replace(/^\.\s*/, '');

        if (!texte || texte.length < 20) continue;

        // Extraire le PA ID du href si disponible
        let orateurRef: string | undefined;
        if (href && href.includes('/tribun/fiches_id/')) {
          const match = href.match(/fiches_id\/(PA\d+)/);
          if (match) orateurRef = match[1];
        }

        // Déterminer le type d'intervention
        let type = 'intervention';
        const texteLower = texte.toLowerCase();
        if (texteLower.includes('question') || nom.toLowerCase().includes('présidente') && texteLower.includes('question')) {
          type = 'question';
        } else if (texteLower.includes('explication de vote') || texteLower.includes('explications de vote')) {
          type = 'explication_vote';
        }

        // Parser le nom de l'orateur (ex: "M. François Bayrou," -> prenom: François, nom: Bayrou)
        const cleanName = nom.replace(/^(M\.|Mme|Mme\.)\s*/, '').replace(/,$/, '').trim();
        const [prenom, ...nomParts] = cleanName.split(' ');

        interventions.push({
          seanceId,
          date: dateSeance,
          orateurNom: nomParts.join(' ') || cleanName,
          orateurPrenom: nomParts.length > 0 ? prenom : undefined,
          orateurRef,
          contenu: texte.substring(0, 5000), // Limiter la taille
          type,
          sourceUrl: generateSeanceUrl(dateSeance),
        });
      }

    } catch (error: any) {
      logger.warn({ file: xmlPath, error: error.message }, 'Error parsing compte rendu');
    }

    return interventions;
  }
}

export default DILAInterventionsClient;
