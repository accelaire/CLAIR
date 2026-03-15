// =============================================================================
// Client Sénat - Récupération des interventions en séance (comptes rendus)
// Source: https://data.senat.fr/la-base-comptes-rendus/
// =============================================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '../../utils/logger';
import { removeOrateurPrefix } from '../../utils/text-cleaning';

// Helper pour décoder les entités HTML
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
    .replace(/&OElig;/g, 'Œ');
}

// =============================================================================
// TYPES
// =============================================================================

export interface TransformedInterventionSenat {
  seanceId: string;
  date: Date;
  ordre: number; // Ordre chronologique dans la séance (1, 2, 3...)
  orateurNom: string;
  orateurPrenom?: string;
  orateurRef?: string; // Matricule sénateur si disponible
  orateurQualite?: string; // 'ministre...', 'secrétaire d\'état...', etc.
  contenu: string;
  type: string;
  sourceUrl?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function generateSeanceUrl(seanceRef: string, date: Date): string {
  // Format URL Sénat pour les comptes rendus analytiques
  // Ex: https://www.senat.fr/cra/s20250217/s20250217.html
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  return `https://www.senat.fr/cra/s${dateStr}/s${dateStr}_mono.html`;
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatInterventionsClient {
  private dataUrl: string;

  constructor() {
    this.dataUrl = 'https://data.senat.fr/data/debats/cri.zip';
    logger.info('SenatInterventionsClient initialized');
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.info({ url }, 'Downloading Sénat CRI data (this may take a while ~500MB)...');

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 600000, // 10 minutes pour un gros fichier
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
      },
    });

    const writer = createWriteStream(destPath);
    await pipeline(response.data, writer);

    logger.info({ destPath }, 'File downloaded');
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<string[]> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
        maxBuffer: 1024 * 1024 * 100,
      });

      // Retourner la liste des fichiers XML
      const allFiles = await this.findXmlFiles(extractDir);
      logger.info({ count: allFiles.length }, 'XML files extracted');
      return allFiles;

    } catch (error: any) {
      logger.error({ error: error.message }, 'Extraction failed');
      throw new Error(`ZIP extraction failed: ${error.message}`);
    }
  }

  private async findXmlFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.findXmlFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.xml')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  // ===========================================================================
  // FETCH INTERVENTIONS
  // ===========================================================================

  async getInterventions(options: { maxSeances?: number; minYear?: number } = {}): Promise<TransformedInterventionSenat[]> {
    const maxSeances = options.maxSeances || 100;
    const minYear = options.minYear || new Date().getFullYear() - 2; // 2 dernières années par défaut

    const tempDir = path.join(os.tmpdir(), 'clair-interventions-senat');
    const zipPath = path.join(tempDir, 'cri.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Télécharger le fichier ZIP
      await this.downloadFile(this.dataUrl, zipPath);

      // Extraire
      const xmlFiles = await this.extractZip(zipPath, extractDir);

      // Filtrer et trier les fichiers par date (plus récents d'abord)
      // Les fichiers sont nommés comme dYYYYMMDD.xml (ex: d20250212.xml)
      const sortedFiles = xmlFiles
        .map(f => {
          const match = path.basename(f).match(/^d(\d{4})(\d{2})(\d{2})\.xml$/i);
          if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const day = parseInt(match[3], 10);
            return { path: f, date: new Date(year, month - 1, day), year };
          }
          return null;
        })
        .filter((f): f is { path: string; date: Date; year: number } => f !== null && f.year >= minYear && f.date <= new Date())
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, maxSeances);

      logger.info({ total: xmlFiles.length, filtered: sortedFiles.length, minYear }, 'Files filtered');

      const allInterventions: TransformedInterventionSenat[] = [];
      let processed = 0;

      for (const { path: xmlFile, date } of sortedFiles) {
        try {
          const interventions = await this.parseCompteRendu(xmlFile, date);
          allInterventions.push(...interventions);
          processed++;

          if (processed % 10 === 0) {
            logger.debug({ processed, interventions: allInterventions.length }, 'Progress...');
          }

        } catch (error: any) {
          logger.warn({ file: xmlFile, error: error.message }, 'Error parsing compte rendu');
        }
      }

      logger.info({ seances: processed, interventions: allInterventions.length }, 'Interventions Sénat extraction completed');
      return allInterventions;

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // PARSER
  // ===========================================================================

  private async parseCompteRendu(xmlPath: string, seanceDate: Date): Promise<TransformedInterventionSenat[]> {
    const interventions: TransformedInterventionSenat[] = [];

    try {
      const content = await fs.promises.readFile(xmlPath, 'utf-8');
      const seanceId = path.basename(xmlPath, '.xml');
      const baseUrl = generateSeanceUrl(seanceId, seanceDate);

      // Structure du CRI Sénat :
      // - <p id="par_N"> avec <cri:orateurnom> = début d'une prise de parole
      // - <p id="par_N"> sans <cri:orateurnom> = suite de la même prise de parole
      // On agrège les paragraphes consécutifs d'un même orateur.

      // 1. Collecter TOUS les paragraphes dans l'ordre
      const paragraphRegex = /<p\s+id="(par_\d+)"[^>]*>([\s\S]*?)<\/p>/g;
      const allParagraphs: { parId: string; content: string; hasOrateur: boolean }[] = [];

      let match;
      while ((match = paragraphRegex.exec(content)) !== null) {
        allParagraphs.push({
          parId: match[1],
          content: match[2],
          hasOrateur: match[2].includes('cri:orateurnom'),
        });
      }

      // 2. Agréger en interventions (une par prise de parole)
      let currentSpeaker: {
        parId: string; // par_N du premier paragraphe (pour l'ancre)
        nom: string;
        prenom: string;
        orateurRef?: string;
        orateurQualite?: string;
        paragraphs: string[];
        isPresident: boolean;
      } | null = null;
      let ordre = 0;

      const finalizeSpeaker = () => {
        if (!currentSpeaker || currentSpeaker.isPresident || currentSpeaker.paragraphs.length === 0) return;

        const fullText = currentSpeaker.paragraphs.join('\n\n');
        if (fullText.length < 20) return;

        const contenuNettoye = removeOrateurPrefix(fullText, currentSpeaker.prenom, currentSpeaker.nom);

        // Déterminer le type d'intervention
        let type = 'intervention';
        const texteLower = contenuNettoye.toLowerCase();
        if (texteLower.includes('question')) {
          type = 'question';
        } else if (texteLower.includes('explication de vote')) {
          type = 'explication_vote';
        }

        ordre++;

        interventions.push({
          seanceId,
          date: seanceDate,
          ordre,
          orateurNom: currentSpeaker.nom,
          orateurPrenom: currentSpeaker.prenom || undefined,
          orateurRef: currentSpeaker.orateurRef,
          orateurQualite: currentSpeaker.orateurQualite,
          contenu: contenuNettoye,
          type,
          sourceUrl: `${baseUrl}#${currentSpeaker.parId}`,
        });
      };

      for (const para of allParagraphs) {
        if (para.hasOrateur) {
          // Nouveau locuteur → finaliser le précédent
          finalizeSpeaker();

          // Extraire les infos du locuteur
          const senateurLinkMatch = para.content.match(/href="\/senateur\/([^"]+)\.html"/);
          const orateurRef = senateurLinkMatch ? senateurLinkMatch[1] : undefined;

          const orateurSpans = para.content.match(/<span class="orateur_nom">([^<]*)<\/span>/g);
          let nomComplet = '';
          if (orateurSpans) {
            nomComplet = orateurSpans
              .map(s => decodeHtmlEntities(s.replace(/<[^>]+>/g, '')))
              .join('')
              .trim();
          }

          let nom = nomComplet
            .replace(/^(M\.|Mme|Mme\.|MM\.|Mmes)\s*/i, '')
            .replace(/\s*\.\s*$/, '')
            .replace(/,\s*$/, '')
            .trim();

          const nomLower = nom.toLowerCase();
          const isPresident = nomLower.includes('président') || nomLower.includes('présidente')
            || nomLower === 'le président' || nomLower === 'la présidente';

          // Extraire la qualité — concaténer tous les fragments <cri:orateurqualite>
          let orateurQualite: string | undefined;
          const qualiteRegex = /<cri:orateurqualite>([^<]*)<\/cri:orateurqualite>/g;
          const qualiteParts: string[] = [];
          let qualiteMatch;
          while ((qualiteMatch = qualiteRegex.exec(para.content)) !== null) {
            qualiteParts.push(qualiteMatch[1]);
          }
          if (qualiteParts.length > 0) {
            let qualiteRaw = decodeHtmlEntities(qualiteParts.join('')).trim();
            qualiteRaw = qualiteRaw.replace(/\.\s*$/, '').trim();
            if (qualiteRaw) {
              orateurQualite = qualiteRaw.charAt(0).toUpperCase() + qualiteRaw.slice(1);
            }
          }

          // Extraire prénom/nom
          let prenom = '';
          const parts = nom.split(/\s+/);
          if (parts.length >= 2) {
            prenom = parts.slice(0, -1).join(' ');
            nom = parts[parts.length - 1];
          }

          if (!nom || nom.length < 2) {
            currentSpeaker = null;
            continue;
          }

          currentSpeaker = {
            parId: para.parId,
            nom,
            prenom,
            orateurRef,
            orateurQualite,
            paragraphs: [],
            isPresident,
          };

          // Extraire le texte de CE paragraphe (après les tags orateur/qualité)
          const texte = this.extractParagraphText(para.content);
          if (texte) currentSpeaker.paragraphs.push(texte);

        } else if (currentSpeaker) {
          // Paragraphe de suite → ajouter au locuteur en cours
          const texte = this.extractParagraphText(para.content);
          if (texte) currentSpeaker.paragraphs.push(texte);
        }
      }

      // Finaliser le dernier locuteur
      finalizeSpeaker();

    } catch (error: any) {
      logger.warn({ file: xmlPath, error: error.message }, 'Error parsing XML');
    }

    return interventions;
  }

  /** Extrait le texte brut d'un paragraphe HTML, en supprimant les tags orateur/qualité. */
  private extractParagraphText(html: string): string {
    let texte = html
      // Supprimer les blocs orateur + qualité (greedy pour le dernier fragment qualité)
      .replace(/^[\s\S]*<\/cri:orateurqualite><\/span>/, '')
      .replace(/^[\s\S]*?<\/cri:orateurnom><\/span>/, '')
      // Supprimer les tags HTML restants
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    texte = decodeHtmlEntities(texte);
    return texte;
  }
}

export default SenatInterventionsClient;
