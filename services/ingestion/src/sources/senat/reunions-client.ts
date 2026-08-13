// =============================================================================
// Client Sénat - Comptes rendus de commission
// Source: https://www.senat.fr/compte-rendu-commissions/
// =============================================================================
//
// RÔLE. Ce client ne construit plus les réunions : elles viennent de l'API
// agenda (`agenda-client.ts`), qui donne l'heure, la salle et l'ordre du jour,
// pour le passé comme pour le futur. Mais l'agenda ne couvre qu'une fenêtre
// correspondant en gros à la session en cours. Ce client apporte donc :
//
//   1. le lien vers le compte rendu intégral (`compteRenduRef`) ;
//   2. les sénateurs cités au compte rendu ;
//   3. les réunions ANTÉRIEURES à la fenêtre de l'agenda, seule trace
//      disponible pour les sessions passées.
//
// POURQUOI ON NE DEVINE PLUS LES URLS. L'ancienne version générait
// `/{YYYYMMDD}/{slug}.html` pour 104 semaines × 8 slugs codés en dur. Or le
// slug d'URL du Sénat CHANGE d'une semaine à l'autre pour une même commission :
//
//   /compte-rendu-commissions/20251006/etra.html
//   /compte-rendu-commissions/20251020/etrang.html
//   /compte-rendu-commissions/20260202/etran.html
//
// Six slugs sur huit renvoyaient donc 404 en permanence, et seules deux
// commissions sur huit remontaient. Chaque commission publie en réalité une
// page d'index qui liste ses comptes rendus avec leurs vraies URLs : on part
// de là. On passe de 832 requêtes à l'aveugle à 8 index puis ~270 liens
// certains.
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';
import { errorMessage, httpStatus } from '../../utils/errors';

// =============================================================================
// CONFIG
// =============================================================================

const BASE_URL = 'https://www.senat.fr/compte-rendu-commissions';

/**
 * Page d'index des comptes rendus → `commissions.organe_ref`.
 *
 * Ces slugs-là sont les URLs « propres » et stables du site, à ne pas confondre
 * avec les slugs hebdomadaires (`etra`/`etrang`/`etran`) qui, eux, varient.
 * Relevés depuis les liens « Comptes rendus » des pages de commission.
 */
const CR_INDEX_TO_ORGANE_REF: Record<string, string> = {
  finances: 'COM-FINC',
  'affaires-sociales': 'COM-SOCI',
  lois: 'COM-LOIS',
  economie: 'COM-CAE',
  culture: 'COM-AFCL',
  'affaires-etrangeres': 'COM-ETRD',
  'developpement-durable': 'COM-CDD',
  'affaires-europeennes': 'COMEUR-AFEU',
};

const REQUEST_DELAY_MS = 400;

// =============================================================================
// TYPES
// =============================================================================

export interface CompteRenduRef {
  /** Code organisme Sénat (= `commissions.organe_ref`). */
  organeRef: string;
  /** Date de la réunion, `YYYY-MM-DD`. */
  date: string;
  /** URL absolue du compte rendu. */
  url: string;
}

export interface CompteRenduContent extends CompteRenduRef {
  /** Matricules des sénateurs cités (= `parlementaires.source_id`). */
  matricules: string[];
  /** Intitulés des points abordés, si la page en expose. */
  odjItems: string[];
}

// =============================================================================
// HELPERS EXPORTÉS (testables)
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrait les liens de comptes rendus d'une page d'index.
 * Format attendu : `/compte-rendu-commissions/YYYYMMDD/<slug>.html`.
 */
export function extractCompteRenduLinks(html: string, organeRef: string): CompteRenduRef[] {
  const re = /\/compte-rendu-commissions\/(\d{8})\/([a-z0-9_-]+)\.html/g;
  const seen = new Set<string>();
  const out: CompteRenduRef[] = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const yyyymmdd = m[1]!;
    const url = `https://www.senat.fr${m[0]}`;
    if (seen.has(url)) continue;
    seen.add(url);

    const date = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
    out.push({ organeRef, date, url });
  }

  return out;
}

/**
 * Matricules des sénateurs cités dans un compte rendu.
 *
 * Les comptes rendus lient les sénateurs par URL, laquelle porte le matricule
 * (`/senateur/perrin_cedric14193x.html` → `14193X`). On apparie donc sur cet
 * identifiant, jamais sur les noms : l'ancien rapprochement flou testait
 * `nom.includes(...)`, ce qui attribue à un homonyme court tout ce qui contient
 * son nom.
 *
 * Ce sont les sénateurs CITÉS au compte rendu (intervenants, rapporteurs), pas
 * une feuille de présence : le Sénat ne publie pas la présence en commission.
 */
export function extractMatriculesFromCompteRendu(html: string): string[] {
  const re = /\/senateur\/[a-z0-9_'-]*?(\d{5}[a-z])\.html/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.add(m[1]!.toUpperCase());
  }
  return [...out];
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatReunionsClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 30_000,
      headers: {
        'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
      },
    });
    logger.info('SenatReunionsClient initialized');
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const res = await this.http.get(url);
      return res.data as string;
    } catch (err) {
      if (httpStatus(err) === 404) {
        logger.debug({ url }, 'Compte rendu page 404');
        return null;
      }
      logger.warn({ url, error: errorMessage(err) }, 'HTTP error fetching compte rendu');
      return null;
    }
  }

  /**
   * Liste tous les comptes rendus référencés par les 8 pages d'index.
   * Ces index ne couvrent que la session en cours.
   */
  async discoverComptesRendus(): Promise<{ refs: CompteRenduRef[]; indexesErrored: number }> {
    const refs: CompteRenduRef[] = [];
    let indexesErrored = 0;

    for (const [slug, organeRef] of Object.entries(CR_INDEX_TO_ORGANE_REF)) {
      await sleep(REQUEST_DELAY_MS);

      const html = await this.fetchHtml(`${BASE_URL}/${slug}.html`);
      if (!html) {
        logger.warn({ slug }, 'Compte rendu index unreachable');
        indexesErrored++;
        continue;
      }

      const found = extractCompteRenduLinks(html, organeRef);
      refs.push(...found);
      logger.debug({ slug, organeRef, count: found.length }, 'Compte rendu index parsed');
    }

    logger.info(
      { refs: refs.length, indexes: Object.keys(CR_INDEX_TO_ORGANE_REF).length, indexesErrored },
      'Comptes rendus discovered'
    );
    return { refs, indexesErrored };
  }

  /**
   * Récupère et parse un compte rendu (sénateurs cités + points abordés).
   *
   * La temporisation est portée ici plutôt que par l'appelant : ces pages sont
   * récupérées une par une depuis une boucle de sync, et sans elle un premier
   * passage enchaînerait ~270 requêtes sans répit sur senat.fr.
   */
  async fetchCompteRendu(ref: CompteRenduRef): Promise<CompteRenduContent | null> {
    await sleep(REQUEST_DELAY_MS);

    const html = await this.fetchHtml(ref.url);
    if (!html) return null;

    const $ = cheerio.load(html);
    const odjItems: string[] = [];
    $('h3').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length > 5) odjItems.push(text);
    });

    return {
      ...ref,
      matricules: extractMatriculesFromCompteRendu(html),
      odjItems,
    };
  }
}

export default SenatReunionsClient;
