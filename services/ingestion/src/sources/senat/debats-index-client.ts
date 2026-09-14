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
import { cleArticleSenat, normaliserNumeroAmendementSenat } from './scrutin-titre';

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

/**
 * Une section de discussion, avec les prises de parole qu'elle contient.
 *
 * `segments` regarde le débat par la parole, ce qui suffit à situer une
 * intervention. Rattacher un scrutin demande l'inverse : partir de ce qui est
 * discuté — un article, des amendements nommés, un texte — pour retrouver les
 * paroles. D'où cette seconde lecture du même dump.
 */
export interface SectionDebatSenat {
  /** Clé de section du Sénat (`secdiscle`). */
  cle: string;
  /** Date de séance, `AAAA-MM-JJ`. */
  date: string;
  /**
   * Lectures dont relève la section (`lecassidt`).
   *
   * Il y en a deux lors d'une discussion générale commune à deux textes, le
   * Sénat les collant alors avec un point-virgule.
   */
  lectures: string[];
  /** Code de section publié par le Sénat (`typseccod`). */
  typeSection: string;
  /**
   * Articles en discussion, normalisés. Plusieurs quand la section les
   * regroupe (« Articles 2 et 3 »).
   */
  articles: string[];
  /** Numéros d'amendements que la désignation de section énumère. */
  amendements: string[];
  /** Objet de la section, tel que rédigé par le Sénat. */
  objet: string | null;
  /** Ordre de la section dans la journée (`secdisordid`). */
  ordre: number;
  /** Ancres du compte rendu des prises de parole de la section. */
  ancres: string[];
}

// =============================================================================
// NORMALISATION
// =============================================================================

/**
 * Entités nommées rencontrées dans le dump, en plus des entités numériques
 * (`&#160;`, `&#232;`, `&#233;`…) traitées génériquement ci-dessous.
 */
const ENTITES_NOMMEES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&nbsp;': ' ',
  '&amp;': '&',
};

/**
 * Windows-1252 0x80-0x9F → caractère correct.
 *
 * Le dump contient des apostrophes et tirets Windows-1252 (octets 0x92, 0x96…)
 * qui ont été relus comme du Latin-1 puis réencodés en UTF-8 : on obtient un
 * caractère de contrôle C1 *valide* (U+0092, U+0096…) plutôt qu'une erreur de
 * décodage, donc rien ne signale l'anomalie en amont. On couvre toute la
 * plage 0x80-0x9F par prudence ; seuls 0x92 (apostrophe) et 0x96 (tiret) sont
 * attestés dans le dump actuel.
 */
const CP1252_C1: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ',
  0x9e: 'ž', 0x9f: 'Ÿ',
};

/** Décode les entités HTML et corrige le mojibake Windows-1252 → Latin-1 → UTF-8 du dump. */
function decoderTexteSenat(brut: string): string {
  return brut
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&\w+;/g, (entite) => ENTITES_NOMMEES[entite] ?? entite)
    .replace(/[\u0080-\u009f]/g, (c) => CP1252_C1[c.codePointAt(0)!] ?? c);
}

/**
 * Au-delà de cette longueur, la valeur n'est plus une désignation d'article
 * mais une énumération (amendements, articles multiples) : sur le dump 2024+,
 * la quasi-totalité des désignations légitimes tient sous 100 caractères
 * (p99 ≈ 64, le plus long intitulé de compte spécial observé fait 99) ; les
 * dépassements viennent d'une énumération d'amendements collée après un
 * séparateur ` - `, déjà retirée par `couperEnumeration`. Ce plafond n'est
 * donc qu'un filet de sécurité contre un format encore plus dégénéré.
 */
const LONGUEUR_MAX_ARTICLE = 120;

/**
 * Retire le détail collé après la désignation d'article par un tiret :
 * `"Après 9 - Amendements n° I-1387, n° I-1168 rectifié, ..."` → `"Après 9"`.
 *
 * Sur le dump 2024+, 3 201 des 3 949 désignations uniques portent une telle
 * énumération, systématiquement introduite par ` - ` : aucune n'existe sans
 * ce séparateur. C'est un artefact de source, pas une variante d'article.
 */
function couperEnumeration(texte: string): string {
  const i = texte.indexOf(' - ');
  return i === -1 ? texte : texte.slice(0, i).trim();
}

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
  const texte = decoderTexteSenat(brut).replace(/\s+/g, ' ').trim();
  if (texte.length === 0) return null;

  // Le Sénat abrège « article » des deux côtés, et de façon indépendante :
  // « Article additionnel avant l'article 3 » comme « Art. additionnel après
  // l'art. 73 nonies ».
  const ART = "art(?:icle)?s?\\.?";
  const additionnel = texte.match(
    new RegExp(`${ART}\\s+additionnels?\\s+(avant|apr[èe]s)\\s+l['’]?\\s*${ART}\\s+(.+)$`, 'i'),
  );

  let resultat: string;
  if (additionnel) {
    const sens = additionnel[1]!.toLowerCase().startsWith('av') ? 'Avant' : 'Après';
    resultat = `${sens} ${couperEnumeration(additionnel[2]!.trim())}`;
  } else {
    // Le pluriel existe quand la section regroupe plusieurs articles
    // (« Articles 2 et 3 ») : sans lui, le préfixe restait collé au numéro.
    const simple = texte.match(/^art(?:icle)?s?\.?\s+(.+)$/i);
    resultat = simple ? couperEnumeration(simple[1]!.trim()) : couperEnumeration(texte);
  }

  // Filet de sécurité : une désignation d'article sert à l'affichage, pas à
  // stocker une énumération. Mieux vaut l'absence que 500 caractères illisibles.
  if (resultat.length === 0) return null;
  if (resultat.length > LONGUEUR_MAX_ARTICLE) {
    logger.warn({ brut, longueur: resultat.length }, 'Désignation d’article Sénat anormalement longue, ignorée');
    return null;
  }
  return resultat;
}

/**
 * Numéros d'amendements énumérés par une désignation de section.
 *
 * `couperEnumeration` retire ce détail de la désignation d'article, où il n'a
 * rien à faire. Il porte pourtant le seul lien nominatif entre un débat du
 * Sénat et un amendement : le compte rendu, lui, ne numérote jamais les
 * amendements dans le texte des orateurs (5 lignes sur 91 017). Sur la période
 * couverte, 3 275 sections énumèrent ainsi 5 635 amendements distincts.
 */
export function amendementsDeLaDesignation(brut: string | null | undefined): string[] {
  if (!brut) return [];
  const texte = decoderTexteSenat(brut);
  const numeros: string[] = [];
  const vus = new Set<string>();
  for (const m of texte.matchAll(/n°\s*((?:[IVX]+-|[A-Z]-)?\d+(?:\s+rectifi[ée]e?)?(?:\s+(?:bis|ter|quater|quinquies))?)/gi)) {
    const numero = normaliserNumeroAmendementSenat(m[1]!);
    if (numero.length === 0 || vus.has(numero)) continue;
    vus.add(numero);
    numeros.push(numero);
  }
  return numeros;
}

/**
 * Articles d'une désignation de section, en clés de comparaison.
 *
 * Une section peut en regrouper plusieurs — « Articles 2 et 3 » — auquel cas un
 * scrutin sur l'un ou l'autre relève bien de cette discussion. On ne découpe
 * que sur « et » et la virgule, jamais sur l'espace : « 1er A » et « 3 bis »
 * sont un seul article.
 */
export function articlesDeLaDesignation(brut: string | null | undefined): string[] {
  const designation = cleArticleSenat(normaliserArticleSenat(brut));
  if (!designation) return [];

  const prefixe = designation.match(/^(AVANT|APRÈS)\s+(.*)$/);
  const corps = prefixe ? prefixe[2]! : designation;
  const morceaux = corps.split(/\s*(?:,|\bET\b)\s*/).filter((x) => x.trim().length > 0);
  const articles = morceaux.map((x) => (prefixe ? `${prefixe[1]} ${x.trim()}` : x.trim()));
  return [...new Set(articles)];
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
   * Les sections de discussion de la période, avec leurs prises de parole.
   *
   * Même dump et mêmes deux passes que `segments`, lues dans l'autre sens :
   * on garde ici la section comme unité, avec ce qu'elle discute et les ancres
   * qu'elle contient.
   */
  async sections(
    options: { depuisAnnee: number; cheminLocal?: string } = { depuisAnnee: 2024 },
  ): Promise<SectionDebatSenat[]> {
    const { chemin, nettoyage } = await this.preparer(options.cheminLocal);

    try {
      const annees = new Set<string>();
      for (let a = options.depuisAnnee; a <= new Date().getUTCFullYear() + 1; a++) annees.add(String(a));

      const sections = new Map<string, SectionDebatSenat>();
      await this.parcourirTable(chemin, 'secdis', (champs) => {
        const [cle, lecassidt, type, datsea, num, objet, , ordre] = champs;
        if (!cle || !type || !datsea) return;
        if (!annees.has(datsea.slice(0, 4))) return;
        sections.set(cle, {
          cle,
          date: datsea.slice(0, 10),
          // Une discussion générale commune à deux textes porte les deux
          // lectures, collées par un point-virgule.
          lectures: (lecassidt ?? '').split(';').map((x) => x.trim()).filter((x) => x.length > 0),
          typeSection: type,
          articles: type === '1' ? articlesDeLaDesignation(num) : [],
          amendements: amendementsDeLaDesignation(num),
          objet: objet ?? null,
          ordre: ordre && /^\d+$/.test(ordre) ? Number(ordre) : 0,
          ancres: [],
        });
      });

      let parolesRetenues = 0;
      await this.parcourirTable(chemin, 'intpjl', (champs) => {
        const section = champs[2] ? sections.get(champs[2]) : undefined;
        if (!section) return;
        const ancre = ancreDepuisUrl(champs[5]);
        if (!ancre) return;
        section.ancres.push(ancre);
        parolesRetenues++;
      });

      const resultat = [...sections.values()];
      logger.info(
        {
          sections: resultat.length,
          paroles: parolesRetenues,
          avecAmendements: resultat.filter((s) => s.amendements.length > 0).length,
          depuisAnnee: options.depuisAnnee,
        },
        'Sections de discussion Sénat construites',
      );
      return resultat;
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
