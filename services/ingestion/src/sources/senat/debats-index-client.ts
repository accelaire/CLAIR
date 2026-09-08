// =============================================================================
// Client index des débats du Sénat
// Source: https://data.senat.fr/data/debats/debats.zip
// =============================================================================
//
// Ce jeu n'est PAS le compte rendu : `intana` n'y est qu'une table analytique,
// un résumé éditorial renseigné dans un quart des cas. C'est un index, et c'est
// précisément ce qui manquait à nos interventions : la section de discussion
// dont chacune relève.
//
//   secdis  sections typées et arborescentes — « Art. 11 bis », discussion
//           générale, explications de vote sur l'ensemble, rappel au règlement
//   intpjl  une ligne par prise de parole, avec l'ancre du compte rendu
//
// Le texte, lui, continue de venir de `cri.zip`. On joint les deux sur la date
// de séance et l'ancre `par_N`, qui est continue sur toute la journée.
//
// Deux pièges relevés sur les données réelles :
//   - `intpjl` précède `secdis` dans le dump : une passe unique ne peut pas
//     résoudre les sections, il en faut deux.
//   - `autcod` n'est pas le matricule dans les années récentes (des
//     identifiants numériques). On ne s'en sert pas : l'orateur est déjà
//     identifié par le compte rendu lui-même.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';
import { downloadWithRetry } from '../../utils/download';

const URL_DEBATS = 'https://data.senat.fr/data/debats/debats.zip';

/** Une prise de parole située dans la structure du débat. */
export interface SegmentDebatSenat {
  /** Date de séance, `AAAA-MM-JJ`. */
  date: string;
  /** Numéro d'ancre du compte rendu (`par_1424` → `1424`). */
  ancre: string;
  /** Code de section publié par le Sénat (`typseccod`). */
  typeSection: string;
  /** Article en discussion, normalisé : `11 bis`, `Avant 3`. */
  articleVise: string | null;
  /** Objet de la section, tel que rédigé par le Sénat. */
  objet: string | null;
}

// =============================================================================
// NORMALISATION
// =============================================================================

/**
 * `secdisnum` → désignation d'article comparable à celle de l'AN.
 *
 * `"Art. 11 bis"` → `"11 bis"`
 * `"Article additionnel avant l'article 3"` → `"Avant 3"`
 * `"Article additionnel après l'article 7 bis"` → `"Après 7 bis"`
 *
 * Le Sénat écrit tantôt « Art. », tantôt « Article », et rédige les articles
 * additionnels en toutes lettres là où l'AN écrit `Avant_ 3`. On ramène les
 * deux chambres à la même forme pour que l'affichage et les rapprochements
 * n'aient pas à connaître la provenance.
 */
export function normaliserArticleSenat(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const texte = brut.replace(/&#8217;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();
  if (texte.length === 0) return null;

  // Le Sénat abrège « article » des deux côtés, et de façon indépendante :
  // « Article additionnel avant l'article 3 » comme « Art. additionnel après
  // l'art. 73 nonies ».
  const ART = "art(?:icle)?s?\\.?";
  const additionnel = texte.match(
    new RegExp(`${ART}\\s+additionnels?\\s+(avant|apr[èe]s)\\s+l['’]?\\s*${ART}\\s+(.+)$`, 'i'),
  );
  if (additionnel) {
    const sens = additionnel[1]!.toLowerCase().startsWith('av') ? 'Avant' : 'Après';
    return `${sens} ${additionnel[2]!.trim()}`;
  }

  const simple = texte.match(/^art(?:icle)?\.?\s+(.+)$/i);
  if (simple) return simple[1]!.trim();

  return texte;
}

/**
 * Type d'intervention déduit de la section, et non deviné dans le texte.
 *
 * L'ancienne heuristique classait en « question » tout propos contenant ce
 * mot : 143 explications de vote sur 243 254 lignes, alors que le Sénat en
 * publie 2 107 pour ses seules sections « explications de vote sur l'ensemble ».
 */
export function typeDInterventionSenat(typeSection: string): string {
  if (typeSection === '2') return 'explication_vote';
  if (typeSection === 'question' || typeSection === 'question_orale') return 'question';
  return 'intervention';
}

/** `s202602/s20260224/s20260224011.html#int1424` → `1424`. */
export function ancreDepuisUrl(url: string | null | undefined): string | null {
  const m = url?.match(/#int(\d+)\s*$/);
  return m ? m[1]! : null;
}

/** Une ligne `COPY` du dump, découpée. `\N` devient `null`. */
export function champsDeLigne(ligne: string): (string | null)[] {
  return ligne.split('\t').map((c) => (c === '\\N' ? null : c));
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatDebatsIndexClient {
  /**
   * Construit l'index des prises de parole à partir de l'année donnée.
   *
   * @param depuisAnnee borne basse, pour ne pas charger vingt ans de débats
   *        quand on n'a besoin que des séances récentes.
   */
  async segments(options: { depuisAnnee: number; cheminLocal?: string } = { depuisAnnee: 2024 }): Promise<SegmentDebatSenat[]> {
    const { chemin, nettoyage } = await this.preparer(options.cheminLocal);

    try {
      const annees = new Set<string>();
      for (let a = options.depuisAnnee; a <= new Date().getUTCFullYear() + 1; a++) annees.add(String(a));

      // Passe 1 — les sections de la période, indexées par leur clé.
      const sections = new Map<string, { date: string; type: string; article: string | null; objet: string | null }>();
      await this.parcourirTable(chemin, 'secdis', (champs) => {
        const [cle, , type, datsea, num, objet] = champs;
        if (!cle || !type || !datsea) return;
        if (!annees.has(datsea.slice(0, 4))) return;
        sections.set(cle, {
          date: datsea.slice(0, 10),
          type,
          article: type === '1' ? normaliserArticleSenat(num) : null,
          objet: objet ?? null,
        });
      });
      logger.info({ sections: sections.size, depuisAnnee: options.depuisAnnee }, 'Sections de discussion retenues');

      // Passe 2 — les prises de parole rattachées à ces sections.
      const segments: SegmentDebatSenat[] = [];
      await this.parcourirTable(chemin, 'intpjl', (champs) => {
        const cle = champs[2];
        if (!cle) return;
        const section = sections.get(cle);
        if (!section) return;
        const ancre = ancreDepuisUrl(champs[5]);
        if (!ancre) return;
        segments.push({
          date: section.date,
          ancre,
          typeSection: section.type,
          articleVise: section.article,
          objet: section.objet,
        });
      });

      logger.info({ segments: segments.length }, 'Index des débats Sénat construit');
      return segments;
    } finally {
      await nettoyage();
    }
  }

  /**
   * Lit une table du dump ligne à ligne.
   *
   * Le fichier pèse 317 Mo et `intpjl` compte 1,6 million de lignes : on ne le
   * charge jamais en mémoire, et on s'arrête dès la fin du bloc demandé.
   */
  private async parcourirTable(
    chemin: string,
    table: string,
    surLigne: (champs: (string | null)[]) => void,
  ): Promise<void> {
    const flux = readline.createInterface({
      input: fs.createReadStream(chemin, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    const entete = `COPY ${table} (`;
    let dedans = false;

    for await (const ligne of flux) {
      if (!dedans) {
        if (ligne.startsWith(entete)) dedans = true;
        continue;
      }
      if (ligne === '\\.') break;
      surLigne(champsDeLigne(ligne));
    }

    flux.close();
  }

  private async preparer(cheminLocal?: string): Promise<{ chemin: string; nettoyage: () => Promise<void> }> {
    if (cheminLocal) {
      logger.info({ chemin: cheminLocal }, 'Dump des débats réutilisé');
      return { chemin: cheminLocal, nettoyage: async () => {} };
    }

    const temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clair-senat-debats-'));
    const nettoyage = async (): Promise<void> => {
      await fs.promises.rm(temp, { recursive: true, force: true }).catch(() => {});
    };

    try {
      const zip = path.join(temp, 'debats.zip');
      logger.info({ url: URL_DEBATS }, 'Téléchargement de l’index des débats Sénat...');
      await downloadWithRetry(URL_DEBATS, zip);

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`unzip -q -o "${zip}" -d "${temp}"`, { maxBuffer: 1024 * 1024 * 50 });
      await fs.promises.rm(zip, { force: true }).catch(() => {});

      return { chemin: path.join(temp, 'debats.sql'), nettoyage };
    } catch (error) {
      await nettoyage();
      throw new Error(`Index des débats Sénat indisponible : ${errorMessage(error)}`);
    }
  }
}

export default SenatDebatsIndexClient;
