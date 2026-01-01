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
  orateurNom: string;
  orateurPrenom?: string;
  orateurRef?: string; // Matricule sénateur si disponible
  contenu: string;
  type: string;
  sourceUrl?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function generateSeanceUrl(seanceRef: string, date: Date): string {
  // Format URL Sénat pour les comptes rendus
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `https://www.senat.fr/seances/${year}${month}${day}.html`;
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
        .filter((f): f is { path: string; date: Date; year: number } => f !== null && f.year >= minYear)
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

      // La structure est HTML avec namespace cri:
      // Les interventions sont dans <p id="par_N"> avec <cri:orateurnom>
      // Format: <p id="par_N"><span class="orateur_nom"><cri:orateurnom><a class="lien_senfic" href="/senateur/nom_prenom_code.html">...</a></cri:orateurnom></span> Texte...</p>

      // Regex pour trouver les paragraphes avec orateur
      const paragraphRegex = /<p\s+id="par_\d+"[^>]*>([\s\S]*?)<\/p>/g;

      let match;
      while ((match = paragraphRegex.exec(content)) !== null) {
        const paragraphContent = match[1];

        // Vérifier s'il y a un orateur
        if (!paragraphContent.includes('cri:orateurnom')) continue;

        // Extraire le lien sénateur si disponible
        // Format: href="/senateur/nom_prenom_code.html"
        const senateurLinkMatch = paragraphContent.match(/href="\/senateur\/([^"]+)\.html"/);
        let orateurRef = '';
        if (senateurLinkMatch) {
          orateurRef = senateurLinkMatch[1]; // ex: "larcher_gerard86034e"
        }

        // Extraire le nom de l'orateur
        // Chercher le contenu dans les spans orateur_nom
        const orateurSpans = paragraphContent.match(/<span class="orateur_nom">([^<]*)<\/span>/g);
        let nomComplet = '';
        if (orateurSpans) {
          nomComplet = orateurSpans
            .map(s => decodeHtmlEntities(s.replace(/<[^>]+>/g, '')))
            .join('')
            .trim();
        }

        // Nettoyer le nom (enlever M., Mme, "le président", etc.)
        let nom = nomComplet
          .replace(/^(M\.|Mme|Mme\.|MM\.|Mmes)\s*/i, '')
          .replace(/\s*\.\s*$/, '')
          .replace(/,\s*$/, '')
          .trim();

        // Ignorer les interventions du président de séance
        const nomLower = nom.toLowerCase();
        if (nomLower.includes('président') || nomLower.includes('présidente') || nomLower === 'le président' || nomLower === 'la présidente') {
          continue;
        }

        // Ignorer les ministres (on veut seulement les sénateurs)
        const qualiteMatch = paragraphContent.match(/<cri:orateurqualite>([^<]+)<\/cri:orateurqualite>/);
        if (qualiteMatch) {
          const qualite = qualiteMatch[1].toLowerCase();
          if (qualite.includes('ministre') || qualite.includes('secrétaire d') || qualite.includes('garde des sceaux')) {
            continue;
          }
        }

        if (!nom || nom.length < 2) continue;

        // Extraire le texte de l'intervention (tout après </cri:orateurnom> ou </cri:orateurqualite>)
        let texte = paragraphContent
          // Supprimer tout jusqu'à la fin du tag orateur
          .replace(/^[\s\S]*?<\/cri:orateurnom><\/span><\/span>/, '')
          .replace(/^[\s\S]*?<\/cri:orateurqualite><\/span>/, '')
          // Supprimer les tags HTML restants
          .replace(/<[^>]+>/g, ' ')
          // Nettoyer les espaces
          .replace(/\s+/g, ' ')
          .trim();
        // Décoder les entités HTML
        texte = decodeHtmlEntities(texte);

        if (!texte || texte.length < 20) continue;

        // Extraire prénom/nom depuis le nom complet
        let prenom = '';
        const parts = nom.split(/\s+/);
        if (parts.length >= 2) {
          // Le dernier mot est souvent le nom de famille
          prenom = parts.slice(0, -1).join(' ');
          nom = parts[parts.length - 1];
        }

        // Déterminer le type d'intervention
        let type = 'intervention';
        const texteLower = texte.toLowerCase();
        if (texteLower.includes('question')) {
          type = 'question';
        } else if (texteLower.includes('explication de vote')) {
          type = 'explication_vote';
        }

        interventions.push({
          seanceId,
          date: seanceDate,
          orateurNom: nom,
          orateurPrenom: prenom || undefined,
          orateurRef: orateurRef || undefined,
          contenu: texte.substring(0, 5000),
          type,
          sourceUrl: generateSeanceUrl(seanceId, seanceDate),
        });
      }

    } catch (error: any) {
      logger.warn({ file: xmlPath, error: error.message }, 'Error parsing XML');
    }

    return interventions;
  }
}

export default SenatInterventionsClient;
