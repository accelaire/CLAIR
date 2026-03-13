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
  ordre: number; // Ordre chronologique dans la séance (1, 2, 3...)
  orateurNom: string;
  orateurPrenom?: string;
  orateurRef?: string; // PA123456 si disponible
  orateurQualite?: string; // 'ministre', 'secrétaire d\'état', etc.
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
  const dateNum = String(date.getDate()).padStart(2, '0');
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

      // Dédupliquer par seanceId + contenu (les archives .taz contiennent souvent
      // plusieurs fichiers CRI qui couvrent la même séance avec des attributions
      // d'orateurs différentes). On garde l'exemplaire le plus fiable :
      // priorité à celui avec un orateurRef (PA ID extrait du href AN).
      const seen = new Map<string, number>(); // clé -> index dans deduplicated
      const deduplicated: TransformedIntervention[] = [];

      for (const intervention of allInterventions) {
        const key = `${intervention.seanceId}::${intervention.contenu.substring(0, 200)}`;
        const existingIdx = seen.get(key);

        if (existingIdx === undefined) {
          seen.set(key, deduplicated.length);
          deduplicated.push(intervention);
        } else {
          // Remplacer si le nouveau a un orateurRef et pas l'existant
          if (!deduplicated[existingIdx].orateurRef && intervention.orateurRef) {
            deduplicated[existingIdx] = intervention;
          }
        }
      }

      // Renuméroter les ordres séquentiellement par séance.
      // Les fichiers CRI ont des ordres qui recommencent à 1, ce qui crée des
      // chevauchements après dédup. On réassigne un ordre global par séance.
      const seanceOrdre = new Map<string, number>();
      for (const int of deduplicated) {
        const current = (seanceOrdre.get(int.seanceId) || 0) + 1;
        seanceOrdre.set(int.seanceId, current);
        int.ordre = current;
      }

      logger.info({
        seances: processed,
        raw: allInterventions.length,
        deduplicated: deduplicated.length,
        removed: allInterventions.length - deduplicated.length,
      }, 'Interventions extraction completed');
      return deduplicated;

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ===========================================================================
  // PARSER
  // ===========================================================================

  // Patterns de qualités non-parlementaires (Article 31 Constitution)
  private static readonly QUALITE_PATTERNS: RegExp[] = [
    /premi[eè]re?\s+ministre/i,
    /ministre\s+d['\u2019]état/i,
    /garde\s+des\s+sceaux/i,
    /ministre\s+délégué/i,
    /ministre\s+déléguée/i,
    /secrétaire\s+d['\u2019]état/i,
    /secrétaire\s+d['\u2019]etat/i,
    /haut[\s-]commissaire/i,
    /commissaire\s+du\s+gouvernement/i,
    /ministre/i, // pattern générique en dernier
  ];

  private async parseCompteRendu(xmlPath: string): Promise<TransformedIntervention[]> {
    const interventions: TransformedIntervention[] = [];

    try {
      const content = await fs.promises.readFile(xmlPath, 'utf-8');

      // Extraire les métadonnées directement depuis le XML (pas besoin de xml2js)
      const dateMatch = content.match(/<dateSeance>(\d{4}-\d{2}-\d{2})<\/dateSeance>/);
      const dateSeance = dateMatch ? new Date(dateMatch[1]) : new Date();
      const parutionMatch = content.match(/<parution>([^<]+)<\/parution>/);
      const seanceId = parutionMatch ? parutionMatch[1] : path.basename(xmlPath, '.xml');
      const baseUrl = generateSeanceUrl(dateSeance);

      // 1. Collecter tous les <Para> avec idsyceron (le contenu du débat)
      //    Les Para du sommaire n'ont pas d'idsyceron → ignorés automatiquement
      const paraRegex = /<Para\s+Ident="([^"]*)"(?:\s+idsyceron="(\d+)")?[^>]*>([\s\S]*?)<\/Para>/g;
      const allParagraphs: { ident: string; idsyceron: string; content: string }[] = [];

      let match;
      while ((match = paraRegex.exec(content)) !== null) {
        if (!match[2]) continue; // Pas d'idsyceron → sommaire, ignorer
        allParagraphs.push({
          ident: match[1],
          idsyceron: match[2],
          content: match[3],
        });
      }

      // 2. Grouper les paragraphes consécutifs par idsyceron
      //    Chaque groupe = une prise de parole (un tour entre interruptions)
      const groups: { idsyceron: string; paragraphs: { ident: string; content: string }[] }[] = [];
      let currentGroup: typeof groups[0] | null = null;

      for (const para of allParagraphs) {
        if (!currentGroup || currentGroup.idsyceron !== para.idsyceron) {
          if (currentGroup) groups.push(currentGroup);
          currentGroup = { idsyceron: para.idsyceron, paragraphs: [] };
        }
        currentGroup.paragraphs.push({ ident: para.ident, content: para.content });
      }
      if (currentGroup) groups.push(currentGroup);

      // 3. Transformer chaque groupe en intervention
      let ordre = 0;

      for (const group of groups) {
        // Trouver le paragraphe avec l'Orateur
        let orateurHtml = '';
        for (const p of group.paragraphs) {
          if (p.content.includes('<Orateur')) {
            orateurHtml = p.content;
            break;
          }
        }
        if (!orateurHtml) continue;

        // Extraire les infos de l'orateur
        const hrefMatch = orateurHtml.match(/<Orateur\s+href="([^"]*)"/);
        const href = hrefMatch ? hrefMatch[1] : '';
        const nomMatch = orateurHtml.match(/<Nom[^>]*>([^<]*)<\/Nom>/);
        const nomBrut = nomMatch ? nomMatch[1].trim() : '';

        if (!nomBrut) continue;

        // Ignorer les interventions du président/présidente de séance
        const nomLower = nomBrut.toLowerCase();
        if (nomLower.includes('président') || nomLower.includes('présidente')) continue;

        // Ignorer les interventions collectives ("Un député du groupe...", "Plusieurs députés...")
        if (nomLower.startsWith('un député') || nomLower.startsWith('une députée') ||
            nomLower.startsWith('plusieurs') || nomLower.startsWith('des député')) continue;

        // Extraire le PA ID du href (ex: .../fiches_id/721202.asp → PA721202)
        let orateurRef: string | undefined;
        if (href && href.includes('/tribun/fiches_id/')) {
          const paMatch = href.match(/fiches_id\/(\d+)/);
          if (paMatch) orateurRef = `PA${paMatch[1]}`;
        }

        // Détecter la qualité :
        // 1. Depuis <QualiteMouvement> (ex: premier ministre, rapporteur)
        // 2. Fallback : depuis le <Nom> si il contient un pattern de qualité
        let orateurQualite: string | undefined;
        const qualiteMvtMatch = orateurHtml.match(/<QualiteMouvement>([^<]*)<\/QualiteMouvement>/);
        if (qualiteMvtMatch) {
          orateurQualite = qualiteMvtMatch[1].replace(/\.\s*$/, '').trim();
          if (orateurQualite) {
            orateurQualite = orateurQualite.charAt(0).toUpperCase() + orateurQualite.slice(1);
          }
        }
        if (!orateurQualite) {
          for (const pattern of DILAInterventionsClient.QUALITE_PATTERNS) {
            if (pattern.test(nomLower)) {
              const commaIdx = nomBrut.indexOf(',');
              if (commaIdx !== -1) {
                orateurQualite = nomBrut.substring(commaIdx + 1).replace(/[,.]$/g, '').trim();
              }
              if (!orateurQualite) {
                const m = nomBrut.match(pattern);
                orateurQualite = m ? m[0] : undefined;
              }
              if (orateurQualite) {
                orateurQualite = orateurQualite.replace(/\.\s*$/, '').trim();
                orateurQualite = orateurQualite.charAt(0).toUpperCase() + orateurQualite.slice(1);
              }
              break;
            }
          }
        }

        // Parser le nom de l'orateur
        let cleanName = nomBrut
          .replace(/^(M\.|Mme|Mme\.)\s*/, '')
          .replace(/[,.]$/g, '')
          .trim();
        // Retirer le groupe politique entre parenthèses (ex: "(RN)", "(LFI-NFP)")
        cleanName = cleanName.replace(/\s*\([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü\s/-]*\)\s*$/, '').trim();
        // Retirer la qualité après virgule dans le nom
        const commaIdx = cleanName.indexOf(',');
        if (commaIdx !== -1) {
          cleanName = cleanName.substring(0, commaIdx).trim();
        }

        const nameParts = cleanName.split(' ');
        const prenom = nameParts.length > 1 ? nameParts[0] : undefined;
        const nomFamille = nameParts.length > 1 ? nameParts.slice(1).join(' ') : cleanName;

        if (!nomFamille || nomFamille.length < 2) continue;

        // Extraire le texte de TOUS les paragraphes du groupe (agrégation)
        const textParts: string[] = [];
        for (const p of group.paragraphs) {
          const texte = this.extractParagraphText(p.content);
          if (texte) textParts.push(texte);
        }

        const fullText = textParts.join('\n\n');
        if (fullText.length < 20) continue;

        // Déterminer le type d'intervention
        let type = 'intervention';
        const texteLower = fullText.toLowerCase();
        if (texteLower.includes('question')) {
          type = 'question';
        } else if (texteLower.includes('explication de vote') || texteLower.includes('explications de vote')) {
          type = 'explication_vote';
        }

        ordre++;

        interventions.push({
          seanceId,
          date: dateSeance,
          ordre,
          orateurNom: nomFamille,
          orateurPrenom: prenom,
          orateurRef,
          orateurQualite,
          contenu: fullText,
          type,
          sourceUrl: `${baseUrl}#${group.idsyceron}`,
        });
      }

    } catch (error: any) {
      logger.warn({ file: xmlPath, error: error.message }, 'Error parsing compte rendu');
    }

    return interventions;
  }

  /** Extrait le texte brut d'un paragraphe XML, en supprimant le bloc Orateur. */
  private extractParagraphText(html: string): string {
    let texte = html
      // Supprimer le bloc Orateur (nom, qualité, etc.)
      .replace(/<Orateur[\s\S]*?<\/Orateur>/g, '')
      // Supprimer le bloc QualiteMouvement (premier ministre, rapporteur, etc.)
      .replace(/<QualiteMouvement>[^<]*<\/QualiteMouvement>/g, '')
      // Supprimer les tags XML restants
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Supprimer le point initial (artefact du parsing XML)
      .replace(/^\.\s*/, '');

    // Décoder les entités HTML
    texte = texte
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    return texte;
  }
}

export default DILAInterventionsClient;
