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
import { errorMessage } from '../../utils/errors';
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

function generateSeanceUrl(date: Date): string {
  // Format URL Sénat pour les comptes rendus analytiques
  // Ex: https://www.senat.fr/cra/s20250217/s20250217.html
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  return `https://www.senat.fr/cra/s${dateStr}/s${dateStr}_mono.html`;
}

/**
 * Date de la séance, lue dans le nom du fichier `dAAAAMMJJ.xml`.
 *
 * Construite en UTC, et non dans le fuseau local. `new Date(2026, 1, 25)` donne
 * minuit à Paris, que PostgreSQL enregistre en `2026-02-24T23:00:00Z` : la
 * séance du 25 février se retrouvait datée du 24. Les 91 017 interventions du
 * Sénat étaient toutes décalées d'un jour — 23h00 en hiver, 22h00 en été.
 *
 * Le décalage cassait aussi tout rapprochement par la date : scrutins du jour,
 * regroupement par séance sur la fiche, et la segmentation publiée par le Sénat,
 * qui ne retrouvait que 13,6 % de nos interventions au lieu de 75,9 %.
 */
export function dateDeSeanceSenat(nomFichier: string): Date | null {
  const m = nomFichier.match(/^d(\d{4})(\d{2})(\d{2})\.xml$/i);
  if (!m) return null;
  const [, yyyy = '', mm = '', dd = ''] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Matricule du sénateur, extrait du lien vers sa fiche.
 *
 * Le compte rendu renvoie vers `/senateur/narassiguin_corinne18231d.html`, dont
 * le suffixe est le matricule — la clé sur laquelle `parlementaires.source_id`
 * est indexé. On renvoyait jusqu'ici le slug entier (`narassiguin_corinne18231d`),
 * qui ne pouvait correspondre à aucun matricule : la résolution par identifiant
 * échouait systématiquement et tout le Sénat retombait sur le rapprochement par
 * le nom, avec ses homonymes et ses accents.
 *
 * Renvoie `undefined` plutôt qu'une valeur approchée : mieux vaut laisser le
 * repli par le nom opérer que d'attribuer une prise de parole au mauvais élu.
 */
export function matriculeDepuisLien(html: string): string | undefined {
  const lien = html.match(/href="\/senateur\/([^"]+)\.html"/);
  if (!lien?.[1]) return undefined;
  const matricule = lien[1].match(/(\d{4,6}[a-z])$/i);
  return matricule?.[1] ? matricule[1].toUpperCase() : undefined;
}

/**
 * Identité stable d'une prise de parole du Sénat.
 *
 * Le compte rendu analytique ne numérote pas les interventions : il n'offre que
 * l'ancre `par_N` du paragraphe, qui se décale à chaque republication. Le Sénat
 * republie ses journées révisées pendant plusieurs jours, si bien qu'un simple
 * changement de formulation faisait glisser toutes les ancres et réinsérait la
 * journée entière.
 *
 * Le rang de la prise dans la séance est ce que la source a de plus stable : une
 * révision de style ne le touche pas. On le fige donc dans `sourceUid`, où
 * l'index unique le fait respecter, et une relecture met la prise à jour au lieu
 * de la dupliquer. Le préfixe évite toute collision avec les schémas de l'AN
 * (numérique pour la DILA, `CRCANR…` pour le portail).
 */
export function uidInterventionSenat(seanceId: string, ordre: number): string {
  return `senat-cri-${seanceId}-${ordre}`;
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

    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Extraction failed');
      throw new Error(`ZIP extraction failed: ${errorMessage(error)}`);
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

  /**
   * Rend les prises de parole JOURNÉE PAR JOURNÉE.
   *
   * Le corpus complet ne tient pas en mémoire : vingt ans de comptes rendus
   * font plusieurs centaines de milliers de prises portant chacune son texte
   * intégral. Les accumuler dans un tableau avant la première écriture est la
   * forme d'OOM que ce dépôt combat déjà sur Railway. On rend donc une journée
   * à la fois, et l'appelant l'écrit avant qu'on parse la suivante.
   *
   * `journeesDejaLues` est filtré AVANT le plafond `maxSeances`. Sans cela, un
   * rattrapage demandé sur vingt ans retenait les cent journées les plus
   * récentes — précisément celles déjà en base — puis les sautait toutes, et
   * annonçait un succès à zéro ligne.
   */
  async *fluxParJournee(
    options: { maxSeances?: number; minYear?: number; journeesDejaLues?: ReadonlySet<string> } = {},
  ): AsyncGenerator<{ seanceId: string; date: Date; interventions: TransformedInterventionSenat[] }> {
    const maxSeances = options.maxSeances || 100;
    const minYear = options.minYear || new Date().getFullYear() - 2; // 2 dernières années par défaut
    const dejaLues = options.journeesDejaLues;

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
      const maintenant = new Date();
      const candidats = xmlFiles
        .map(f => {
          const nom = path.basename(f);
          const date = dateDeSeanceSenat(nom);
          return date ? { path: f, date, year: date.getUTCFullYear(), seanceId: path.basename(f, '.xml') } : null;
        })
        .filter((f): f is { path: string; date: Date; year: number; seanceId: string } =>
          f !== null && f.year >= minYear && f.date <= maintenant)
        .filter(f => !dejaLues?.has(f.seanceId))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      const retenus = candidats.slice(0, maxSeances);

      logger.info(
        { total: xmlFiles.length, candidats: candidats.length, retenus: retenus.length, minYear, maxSeances },
        'Files filtered',
      );
      // Seulement en rattrapage : là, le plafond laisse du travail non fait et
      // il faut le dire. Sur la synchro quotidienne, ne retenir que les cent
      // journées les plus récentes est l'intention même de la commande.
      if (dejaLues && candidats.length > retenus.length) {
        logger.warn(
          { restantes: candidats.length - retenus.length, maxSeances },
          'Journées absentes non lues : rappeler la commande, ou monter `--limit`',
        );
      }

      let processed = 0;
      let total = 0;

      for (const { path: xmlFile, date, seanceId } of retenus) {
        try {
          const interventions = await this.parseCompteRendu(xmlFile, date);
          processed++;
          total += interventions.length;

          if (processed % 10 === 0) {
            logger.debug({ processed, interventions: total }, 'Progress...');
          }

          if (interventions.length > 0) yield { seanceId, date, interventions };

        } catch (error) {
          logger.warn({ file: xmlFile, error: errorMessage(error) }, 'Error parsing compte rendu');
        }
      }

      logger.info({ seances: processed, interventions: total }, 'Interventions Sénat extraction completed');

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
      const baseUrl = generateSeanceUrl(seanceDate);

      // Structure du CRI Sénat :
      // - <p id="par_N"> avec <cri:orateurnom> = début d'une prise de parole
      // - <p id="par_N"> sans <cri:orateurnom> = suite de la même prise de parole
      // On agrège les paragraphes consécutifs d'un même orateur.

      // 1. Collecter TOUS les paragraphes dans l'ordre
      const paragraphRegex = /<p\s+id="(par_\d+)"[^>]*>([\s\S]*?)<\/p>/g;
      const allParagraphs: { parId: string; content: string; hasOrateur: boolean }[] = [];

      let match;
      while ((match = paragraphRegex.exec(content)) !== null) {
        const parId = match[1];
        const paraContent = match[2];
        if (!parId || paraContent === undefined) continue;
        allParagraphs.push({
          parId,
          content: paraContent,
          hasOrateur: paraContent.includes('cri:orateurnom'),
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
          const orateurRef = matriculeDepuisLien(para.content);

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
            qualiteParts.push(qualiteMatch[1] ?? '');
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
            nom = parts[parts.length - 1] ?? '';
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

    } catch (error) {
      logger.warn({ file: xmlPath, error: errorMessage(error) }, 'Error parsing XML');
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
