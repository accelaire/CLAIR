// =============================================================================
// Client Sénat - Commissions saisies d'un dossier législatif
// Source: pages de dossiers législatifs sur senat.fr
// =============================================================================
//
// Chaque dossier expose, dans une section latérale ou de fond, les commissions
// saisies sous deux rôles exacts : « saisie au fond » et « saisie pour avis ».
// Seules les 8 commissions permanentes nous intéressent ; les commissions
// spéciales, mixtes paritaires ou d'enquête n'ont pas d'organe_ref stable
// dans notre référentiel et sont donc ignorées.
//
// Le libellé de commission oscille entre forme courte et forme longue selon
// les pages (ex. « Commission des lois » vs « Commission des lois
// constitutionnelles, de législation... »). On ne peut donc pas mapper par
// égalité stricte : la détection se fait par mots-clés discriminants après
// normalisation. De plus, la forme longue contient des virgules : on découpe
// la chaîne sur la DERNIÈRE occurrence de « , saisie » pour isoler le rôle.
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';
import { errorMessage, httpStatus } from '../../utils/errors';

// =============================================================================
// CONFIG
// =============================================================================

const REQUEST_DELAY_MS = 400;

// =============================================================================
// TYPES
// =============================================================================

export interface Saisine {
  libelle: string;
  role: 'fond' | 'avis';
}

export interface SaisineMapped {
  organeRef: string;
  role: 'fond' | 'avis';
  libelle: string;
}

// =============================================================================
// HELPERS EXPORTÉS (testables)
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeForMapping(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrait les saisines d'un fragment HTML de dossier législatif.
 *
 * On cible les `h4.h6` portant le motif « Commission …, saisie au fond / pour avis ».
 * La découpe s'effectue sur la dernière occurrence de `, saisie ` car la forme
 * longue d'une commission contient elle-même des virgules.
 */
export function extractSaisines(html: string): Saisine[] {
  const $ = cheerio.load(html);
  const out: Saisine[] = [];

  // Volontairement `h4` et non `h4.h6` : le motif « , saisie au fond / pour
  // avis » est déjà discriminant à lui seul. Dépendre en plus d'une classe de
  // présentation rendrait le parsing sensible à une refonte CSS du site, ce qui
  // est précisément ce qui avait mis les réunions de commission hors service.
  $('h4').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    const idx = text.lastIndexOf(', saisie ');
    if (idx === -1) return;

    const libelle = text.slice(0, idx).trim();
    const roleText = text.slice(idx + ', saisie '.length).trim();

    if (roleText === 'au fond') {
      out.push({ libelle, role: 'fond' });
    } else if (roleText === 'pour avis') {
      out.push({ libelle, role: 'avis' });
    }
  });

  return out;
}

/**
 * Mappe un libellé de commission (court ou long) vers son code organisme CLAIR.
 *
 * La reconnaissance repose sur des mots-clés discriminants après normalisation
 * (accents, ponctuation et espaces multiples retirés). Les commissions
 * spéciales, mixtes paritaires ou d'enquête ne renvoient pas d'organe_ref.
 */
export function mapLibelleToOrganeRef(libelle: string): string | null {
  const n = normalizeForMapping(libelle);

  if (n.includes('speciale') || n.includes('mixte paritaire') || n.includes('enquete')) {
    return null;
  }

  // L'ordre est significatif, deux règles peuvent matcher le même libellé.
  // « Commission des finances, du contrôle budgétaire et des comptes
  // ÉCONOMIQUES de la Nation » doit tomber sur les finances, pas sur les
  // affaires économiques : `finances` passe donc en premier.
  if (n.includes('finances')) return 'COM-FINC';
  if (n.includes('europeennes')) return 'COMEUR-AFEU';
  if (n.includes('etrangeres') || n.includes('forces armees')) return 'COM-ETRD';
  if (n.includes('amenagement') || n.includes('developpement durable')) return 'COM-CDD';
  // Volontairement limité à `culture` et `education` : les deux formes du
  // libellé les contiennent. On évite `sport`, sous-chaîne de « transport »,
  // et `communication`, trop générique pour discriminer.
  if (n.includes('culture') || n.includes('education')) return 'COM-AFCL';
  if (n.includes('economi')) return 'COM-CAE';
  if (n.includes('sociales')) return 'COM-SOCI';
  if (n.includes('lois')) return 'COM-LOIS';

  return null;
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatDossierCommissionsClient {
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
    logger.info('SenatDossierCommissionsClient initialized');
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const res = await this.http.get(url);
      return res.data as string;
    } catch (err) {
      if (httpStatus(err) === 404) {
        logger.debug({ url }, 'Dossier page 404');
        return null;
      }
      logger.warn({ url, error: errorMessage(err) }, 'HTTP error fetching dossier');
      return null;
    }
  }

  /**
   * Récupère et mappe les commissions saisies pour un dossier donné.
   *
   * La temporisation est interne car cette méthode est enchaînée sur des
   * milliers de dossiers : sans elle, le flux de requêtes serait trop violent.
   */
  async fetchSaisines(url: string): Promise<SaisineMapped[] | null> {
    await sleep(REQUEST_DELAY_MS);

    const html = await this.fetchHtml(url);
    if (!html) {
      return null;
    }

    const raw = extractSaisines(html);
    const out: SaisineMapped[] = [];

    for (const { libelle, role } of raw) {
      const organeRef = mapLibelleToOrganeRef(libelle);
      if (organeRef) {
        out.push({ organeRef, role, libelle });
      } else {
        logger.debug({ libelle, url }, 'Commission non mappée, saisine ignorée');
      }
    }

    return out;
  }
}

export default SenatDossierCommissionsClient;