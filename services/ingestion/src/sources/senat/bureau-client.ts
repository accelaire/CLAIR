// =============================================================================
// Client Sénat - Composition des bureaux de commission
// Source: https://www.senat.fr/travaux-parlementaires/commissions/...
// =============================================================================
//
// L'API `senateurs.json` expose l'appartenance d'un sénateur à une commission
// (`organismes[].code`), mais PAS sa fonction au sein de celle-ci : un organisme
// n'a que { code, type, libelle, ordre }. L'open data ODSEN n'expose rien non
// plus (ODSEN_COMMISSIONS / ODSEN_FONCTIONS n'existent pas, testés en 404).
//
// La seule source publique du bureau (président, vice-présidents, secrétaires,
// rapporteur général) est la page HTML « Le bureau de la commission … ».
//
// Deux choix de conception pour tenir dans la durée :
//
//  1. AUCUNE URL de commission n'est codée en dur au-delà d'une page d'amorce.
//     Les 8 commissions se découvrent depuis la navigation inter-commissions,
//     puis chaque page pointe vers son propre « le-bureau-… ». Les slugs sont
//     irréguliers (`le-bureau-de-la-commission-de-lamenagement-du-territoire`
//     est tronqué par rapport au nom de la commission) : les deviner échouerait.
//
//  2. Le rattachement à une commission NE dépend PAS de l'URL. Il est déduit du
//     code d'organisme partagé par les membres du bureau eux-mêmes. Une page
//     dont les 17 membres ont tous `COM-FINC` est la commission des finances,
//     quel que soit son chemin. Le site du Sénat ayant été refondu récemment,
//     s'appuyer sur les chemins serait fragile.
//
// Le matricule est extrait de l'URL du sénateur (`/senateur/perrin_cedric14193x`
// → `14193X`) : il correspond exactement à `parlementaires.source_id`. Vérifié
// sur les 348 sénateurs — format `NNNNNA` sans exception, et 100 % des URLs se
// terminent par le matricule en minuscules.
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
// cheerio 1.x ne réexporte plus les types de nœuds : ils viennent de domhandler.
import type { AnyNode } from 'domhandler';
import { logger } from '../../utils/logger';
import { errorMessage, httpStatus } from '../../utils/errors';

// =============================================================================
// CONFIG
// =============================================================================

const BASE_URL = 'https://www.senat.fr';

/**
 * Page d'amorce pour la découverte. N'importe quelle page de commission
 * convient : toutes portent la navigation vers les 7 autres. On part des
 * affaires étrangères, mais le résultat est identique depuis n'importe laquelle.
 */
const SEED_COMMISSION_PATH =
  '/travaux-parlementaires/commissions/commission-des-affaires-etrangeres-de-la-defense-et-des-forces-armees.html';

const REQUEST_DELAY_MS = 400;

/**
 * Marge minimale entre le code d'organisme majoritaire et le suivant pour
 * accepter le rattachement d'une page à une commission. Mesuré en production :
 * la marge observée est d'au moins 15 contre 4 sur les 8 pages.
 */
const MIN_MODAL_MARGIN = 3;

// =============================================================================
// TYPES
// =============================================================================

/** Qualités normalisées, alignées sur les libellés Assemblée nationale. */
export type BureauQualite =
  | 'Président'
  | 'Vice-Président'
  | 'Secrétaire'
  | 'Rapporteur général';

export interface BureauMembre {
  /** Matricule Sénat, majuscules (= `parlementaires.source_id`). */
  matricule: string;
  qualite: BureauQualite;
}

export interface BureauCommission {
  /** Code organisme Sénat (= `commissions.organe_ref`), ex. `COM-ETRD`. */
  organeRef: string;
  sourceUrl: string;
  membres: BureauMembre[];
}

export interface BureauScrapeResult {
  bureaux: BureauCommission[];
  pagesDiscovered: number;
  pagesErrored: number;
  /** Pages parsées mais non rattachées à une commission (modal ambigu). */
  pagesUnresolved: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalise un intitulé de section en qualité.
 *
 * Les intitulés varient en genre et en nombre selon la composition réelle :
 * « Le Président » / « La Présidente », « Le Rapporteur général » /
 * « La rapporteure générale », « Les Vice-Présidentes et Vice-Présidents ».
 *
 * L'ordre des tests importe : « vice-président » contient « président ».
 */
export function normalizeQualite(heading: string): BureauQualite | null {
  const h = stripAccents(heading).toLowerCase();

  if (h.includes('rapporteur')) return 'Rapporteur général';
  if (h.includes('vice-president') || h.includes('vice president')) return 'Vice-Président';
  if (h.includes('secretaire')) return 'Secrétaire';
  if (h.includes('president')) return 'Président';

  return null;
}

/**
 * Extrait les matricules des liens `/senateur/…` d'un fragment HTML.
 * Format garanti : 5 chiffres + 1 lettre, en minuscules dans l'URL.
 */
export function extractMatricules(html: string): string[] {
  const re = /\/senateur\/[a-z0-9_'-]*?(\d{5}[a-z])\.html/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]!.toUpperCase());
  }
  return [...new Set(out)];
}

/**
 * Détermine la commission d'une page de bureau à partir des organismes de ses
 * membres : le code présent chez le plus grand nombre d'entre eux.
 *
 * L'intersection stricte ne convient pas — sur la commission des affaires
 * sociales, un membre du bureau n'a pas `COM-SOCI` dans ses organismes (donnée
 * amont incomplète), ce qui viderait l'intersection. Le mode reste net (16
 * contre 4) et résiste à ce genre de trou.
 */
export function resolveOrganeRef(
  matricules: string[],
  codesByMatricule: Map<string, Set<string>>
): { organeRef: string | null; top: number; runnerUp: number } {
  const counts = new Map<string, number>();
  for (const mat of matricules) {
    for (const code of codesByMatricule.get(mat) ?? []) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const runnerUp = ranked[1];

  if (!top) return { organeRef: null, top: 0, runnerUp: 0 };

  const topCount = top[1];
  const runnerUpCount = runnerUp?.[1] ?? 0;

  if (topCount - runnerUpCount < MIN_MODAL_MARGIN) {
    return { organeRef: null, top: topCount, runnerUp: runnerUpCount };
  }

  return { organeRef: top[0], top: topCount, runnerUp: runnerUpCount };
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatBureauClient {
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
    logger.info('SenatBureauClient initialized');
  }

  private async fetchHtml(path: string): Promise<string | null> {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    try {
      const res = await this.http.get(url);
      return res.data as string;
    } catch (err) {
      logger.warn(
        { url, status: httpStatus(err), error: errorMessage(err) },
        'Failed to fetch Sénat page'
      );
      return null;
    }
  }

  /**
   * Découvre les pages « bureau » des commissions permanentes.
   * Amorce → liens inter-commissions → lien « le-bureau-… » de chaque page.
   */
  async discoverBureauUrls(): Promise<string[]> {
    const seed = await this.fetchHtml(SEED_COMMISSION_PATH);
    if (!seed) {
      logger.error('Cannot fetch seed commission page — bureau discovery aborted');
      return [];
    }

    const $seed = cheerio.load(seed);
    const commissionPaths = new Set<string>([SEED_COMMISSION_PATH]);

    $seed('a[href]').each((_, el) => {
      const href = $seed(el).attr('href') ?? '';
      // Uniquement les pages racine de commission (un seul segment après /commissions/)
      if (/^\/travaux-parlementaires\/commissions\/[a-z0-9-]+\.html$/.test(href)) {
        commissionPaths.add(href);
      }
    });

    logger.info({ count: commissionPaths.size }, 'Commission pages discovered');

    const bureauUrls: string[] = [];
    for (const path of commissionPaths) {
      await sleep(REQUEST_DELAY_MS);

      const html = path === SEED_COMMISSION_PATH ? seed : await this.fetchHtml(path);
      if (!html) continue;

      const $ = cheerio.load(html);
      let found: string | null = null;

      $('a[href]').each((_, el) => {
        if (found) return;
        const href = $(el).attr('href') ?? '';
        if (href.includes('/le-bureau-') && href.endsWith('.html')) {
          found = href;
        }
      });

      if (found) {
        bureauUrls.push(found);
      } else {
        logger.warn({ path }, 'No bureau link found on commission page');
      }
    }

    return bureauUrls;
  }

  /**
   * Parse une page « bureau » : chaque `<section>` porte un `<h2>` de rôle et
   * les cartes sénateur correspondantes.
   *
   * On se rattache à la `<section>` englobante plutôt qu'à un parcours de
   * voisins : les rôles sont dans des sections distinctes, un parcours de
   * `nextSibling` ne franchirait pas la frontière.
   */
  parseBureauPage(html: string): Array<{ qualite: BureauQualite; matricules: string[] }> {
    const $ = cheerio.load(html);
    const out: Array<{ qualite: BureauQualite; matricules: string[] }> = [];
    const seenSections = new Set<AnyNode>();

    $('h2').each((_, h2El) => {
      const heading = $(h2El).text().trim();
      const qualite = normalizeQualite(heading);
      if (!qualite) return; // h2 de navigation ou de contenu éditorial

      const section = $(h2El).closest('section');
      if (section.length === 0) return;

      const node = section.get(0);
      if (!node) return;

      // Deux rôles dans une même section rendraient l'attribution ambiguë.
      if (seenSections.has(node)) {
        logger.warn({ heading }, 'Two role headings share one section — skipping');
        return;
      }
      seenSections.add(node);

      const matricules = extractMatricules($.html(section));
      if (matricules.length > 0) {
        out.push({ qualite, matricules });
      }
    });

    return out;
  }

  /**
   * Récupère la composition des bureaux de toutes les commissions permanentes.
   *
   * @param codesByMatricule matricule → codes d'organismes (depuis `senateurs.json`),
   *                         utilisé pour rattacher chaque page à sa commission.
   */
  async getBureaux(codesByMatricule: Map<string, Set<string>>): Promise<BureauScrapeResult> {
    const urls = await this.discoverBureauUrls();
    const bureaux: BureauCommission[] = [];
    let pagesErrored = 0;
    let pagesUnresolved = 0;

    for (const url of urls) {
      await sleep(REQUEST_DELAY_MS);

      const html = await this.fetchHtml(url);
      if (!html) {
        pagesErrored++;
        continue;
      }

      const sections = this.parseBureauPage(html);
      if (sections.length === 0) {
        logger.warn({ url }, 'No bureau section parsed');
        pagesErrored++;
        continue;
      }

      const allMatricules = sections.flatMap((s) => s.matricules);
      const { organeRef, top, runnerUp } = resolveOrganeRef(allMatricules, codesByMatricule);

      if (!organeRef) {
        logger.warn(
          { url, membres: allMatricules.length, top, runnerUp },
          'Cannot resolve commission for bureau page — ambiguous organisme code'
        );
        pagesUnresolved++;
        continue;
      }

      // Un sénateur peut figurer sous deux rôles (rare) : le premier gagne,
      // les sections sont dans l'ordre hiérarchique de la page.
      const seen = new Set<string>();
      const membres: BureauMembre[] = [];
      for (const section of sections) {
        for (const matricule of section.matricules) {
          if (seen.has(matricule)) continue;
          seen.add(matricule);
          membres.push({ matricule, qualite: section.qualite });
        }
      }

      bureaux.push({ organeRef, sourceUrl: url, membres });
      logger.debug({ url, organeRef, membres: membres.length }, 'Bureau parsed');
    }

    logger.info(
      {
        bureaux: bureaux.length,
        pagesDiscovered: urls.length,
        pagesErrored,
        pagesUnresolved,
        membresTotal: bureaux.reduce((n, b) => n + b.membres.length, 0),
      },
      'Sénat bureaux scraping completed'
    );

    return { bureaux, pagesDiscovered: urls.length, pagesErrored, pagesUnresolved };
  }
}

export default SenatBureauClient;
