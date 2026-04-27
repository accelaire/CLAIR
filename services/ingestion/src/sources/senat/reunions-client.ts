// =============================================================================
// Client Sénat - Scraping des comptes rendus de commissions
// Source: https://www.senat.fr/compte-rendu-commissions/
// =============================================================================
//
// Le Sénat ne publie aucun dataset structuré (JSON/XML/ICS) pour les réunions
// de commissions. La seule source disponible est le scraping des comptes rendus
// HTML hebdomadaires.
//
// Structure URL:
//   https://www.senat.fr/compte-rendu-commissions/{YYYYMMDD}/{commission}.html
//
// Où {YYYYMMDD} est le lundi de la semaine, et {commission} est le slug
// court (ex: finances, lois, social, affeco, culture, etrangeres,
// developpement-durable, europe).
//
// Le site bloque le listing des répertoires (403 Accès restreint) — les dates
// sont donc générées de façon déterministe à partir de la date du jour.
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';
import { TransformedReunion } from '../assemblee-nationale/reunions-client';

// =============================================================================
// CONFIG
// =============================================================================

const BASE_URL = 'https://www.senat.fr/compte-rendu-commissions';

/**
 * Mapping slug HTML court → slug DB commission Sénat.
 * Vérifié en DB locale via:
 *   SELECT slug, nom FROM commissions WHERE chambre='senat' AND type='permanente';
 */
const SENAT_SLUG_TO_DB_SLUG: Record<string, string> = {
  'finances': 'senat-com-finc',
  'social': 'senat-com-soci',
  'lois': 'senat-com-lois',
  'affeco': 'senat-com-cae',
  'culture': 'senat-com-afcl',
  'etrangeres': 'senat-com-etrd',
  'developpement-durable': 'senat-com-cdd',
  'europe': 'senat-comeur-afeu',
};

/** Tous les slugs de fichiers HTML à tester pour chaque semaine */
const COMMISSION_SLUGS = Object.keys(SENAT_SLUG_TO_DB_SLUG);

/** Nombre max de semaines en arrière (2 ans = 104 semaines) */
const MAX_WEEKS_DEFAULT = 104;

/** Délai entre requêtes (en ms) — respectueux du serveur */
const REQUEST_DELAY_MS = 500;

// =============================================================================
// HELPERS
// =============================================================================

/** Pause asynchrone */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse une date française en Date.
 * Supporte: "Mardi 18 mars 2025", "Mercredi 19 mars 2025", etc.
 */
function parseFrenchDate(text: string): Date | null {
  const MONTHS: Record<string, number> = {
    janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11,
    fevrier: 1, aout: 7,
  };

  // Pattern: "Mardi 18 mars 2025" ou "18 mars 2025"
  const match = text.match(/(\d{1,2})\s+([a-zéûèà]+)\s+(\d{4})/i);
  if (!match) return null;

  const day = parseInt(match[1]!, 10);
  const monthStr = match[2]!.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const year = parseInt(match[3]!, 10);
  const month = MONTHS[monthStr];

  if (month === undefined || isNaN(day) || isNaN(year)) return null;

  const d = new Date(Date.UTC(year, month, day, 9, 0, 0)); // 9h par défaut
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Génère la liste des lundis sur les N dernières semaines.
 * Retourne un tableau de dates au format YYYYMMDD.
 */
function generateWeekDates(maxWeeks: number): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Dimanche, 1=Lundi, ...
  // Décaler vers le lundi précédent (ou courant)
  const daysSinceMonday = (dayOfWeek + 6) % 7; // 0 si lundi, 6 si dimanche
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysSinceMonday);

  const weeks: string[] = [];
  for (let i = 0; i < maxWeeks; i++) {
    const weekDate = new Date(lastMonday);
    weekDate.setDate(lastMonday.getDate() - i * 7);
    const yyyy = weekDate.getUTCFullYear().toString();
    const mm = String(weekDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(weekDate.getUTCDate()).padStart(2, '0');
    weeks.push(`${yyyy}${mm}${dd}`);
  }
  return weeks;
}

/**
 * Extrait le texte des éléments d'une liste de noms de sénateurs.
 * Les noms apparaissent sous forme de liens ou texte brut après "Présents :".
 */
function extractSenatorNames($: cheerio.CheerioAPI, container: cheerio.Cheerio<cheerio.Element>): string[] {
  const names: string[] = [];

  // Les noms apparaissent souvent comme des liens <a> vers les pages sénateurs
  // Format: /senateur/nom-prenom-XXXXX.html
  container.find('a[href*="/senateur/"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 2) {
      names.push(text);
    }
  });

  // Fallback: texte brut (noms séparés par des virgules ou des points-virgules)
  if (names.length === 0) {
    const rawText = container.text();
    const cleaned = rawText
      .replace(/présents?\s*:/gi, '')
      .replace(/participaient aussi/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned) {
      const parts = cleaned.split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 2);
      names.push(...parts);
    }
  }

  return [...new Set(names)]; // Dédupliquer
}

// =============================================================================
// TYPES EXPORTÉS
// =============================================================================

export interface ParsedReunion extends TransformedReunion {
  commissionSlugCourt: string; // ex: "lois", "finances"
  compteRenduUrl: string;      // URL source du CR
  participantNames: string[];  // Noms bruts extraits (à matcher ensuite)
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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
      },
    });
    logger.info('SenatReunionsClient initialized');
  }

  /**
   * Retourne les YYYYMMDD des 104 dernières semaines (lundi).
   * Note: Le Sénat bloque le listing des répertoires — on génère les dates.
   */
  async getWeekIndices(maxWeeks: number = MAX_WEEKS_DEFAULT): Promise<string[]> {
    const weeks = generateWeekDates(Math.min(maxWeeks, MAX_WEEKS_DEFAULT));
    logger.info({ count: weeks.length }, 'Generated week dates for Sénat scraping');
    return weeks;
  }

  /**
   * Teste si un fichier HTML de commission existe pour une semaine donnée.
   * Retourne true si HTTP 200.
   */
  private async checkPage(yyyymmdd: string, slug: string): Promise<boolean> {
    try {
      const url = `${BASE_URL}/${yyyymmdd}/${slug}.html`;
      const res = await this.http.head(url, { timeout: 10_000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Scrape une page HTML de commission et retourne les réunions de la semaine.
   * Une page peut contenir plusieurs réunions (plusieurs jours/séances).
   */
  async parseCommissionPage(
    yyyymmdd: string,
    commissionSlug: string
  ): Promise<ParsedReunion[]> {
    const url = `${BASE_URL}/${yyyymmdd}/${commissionSlug}.html`;

    let html: string;
    try {
      const res = await this.http.get(url, { timeout: 20_000 });
      html = res.data as string;
    } catch (err: any) {
      if (err.response?.status === 404) {
        logger.debug({ url }, 'Page 404 - commission not active this week');
        return [];
      }
      logger.warn({ url, error: err.message }, 'HTTP error fetching commission page');
      return [];
    }

    const $ = cheerio.load(html);

    // Vérifier que la page n'est pas une 404 applicative (titre "introuvable")
    const pageTitle = $('title').text();
    if (pageTitle.toLowerCase().includes('introuvable') || pageTitle.toLowerCase().includes('forbidden')) {
      return [];
    }

    // =========================================================================
    // Extraire les sections par jour (balises h2)
    // Chaque h2 contient une date française (ex: "Mardi 18 mars 2025")
    // =========================================================================

    const dbSlug = SENAT_SLUG_TO_DB_SLUG[commissionSlug];
    if (!dbSlug) {
      logger.warn({ commissionSlug }, 'Unknown commission slug — no DB mapping');
      return [];
    }

    const reunions: ParsedReunion[] = [];

    // Index global des UIDs générés pour gérer les doublons (même jour, même commission)
    const uidCounters = new Map<string, number>();

    // Trouver les sections de jours via les h2
    const h2Elements = $('h2');

    if (h2Elements.length === 0) {
      // Pas de structure h2 — toute la page est une seule réunion
      // Tenter d'extraire la date du titre de la page
      const titleText = pageTitle || '';
      const weekDate = parseFrenchDate(`${yyyymmdd.slice(6, 8)} ${getMonthName(parseInt(yyyymmdd.slice(4, 6)) - 1)} ${yyyymmdd.slice(0, 4)}`);

      if (weekDate) {
        const reunion = this.buildReunion($, $.root(), weekDate, commissionSlug, dbSlug, url, uidCounters);
        if (reunion) reunions.push(reunion);
      }
      return reunions;
    }

    h2Elements.each((_, h2El) => {
      const h2 = $(h2El);
      const h2Text = h2.text().trim();

      const dateDebut = parseFrenchDate(h2Text);
      if (!dateDebut) {
        // Ce h2 ne contient pas une date — skip
        return;
      }

      // Collecter tout le contenu entre ce h2 et le suivant
      const sectionContent = cheerio.load('<div></div>');
      const container = sectionContent('div');

      let next = h2El.nextSibling;
      while (next) {
        const nextEl = next as cheerio.Element;
        if (nextEl.type === 'tag' && nextEl.tagName === 'h2') break;
        container.append(sectionContent(nextEl as any).clone());
        next = next.nextSibling;
      }

      const reunion = this.buildReunion(sectionContent, container, dateDebut, commissionSlug, dbSlug, url, uidCounters);
      if (reunion) reunions.push(reunion);
    });

    logger.debug(
      { yyyymmdd, commissionSlug, reunionsFound: reunions.length },
      'Commission page parsed'
    );

    return reunions;
  }

  /**
   * Construit une TransformedReunion à partir d'un bloc de contenu HTML.
   */
  private buildReunion(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<cheerio.Element>,
    dateDebut: Date,
    commissionSlugCourt: string,
    dbSlug: string,
    sourceUrl: string,
    uidCounters: Map<string, number>
  ): ParsedReunion | null {
    // --- UID déterministe ---
    const yyyymmdd = [
      dateDebut.getUTCFullYear(),
      String(dateDebut.getUTCMonth() + 1).padStart(2, '0'),
      String(dateDebut.getUTCDate()).padStart(2, '0'),
    ].join('');

    const baseUid = `SENAT_${yyyymmdd}_${commissionSlugCourt}`;
    const count = (uidCounters.get(baseUid) || 0) + 1;
    uidCounters.set(baseUid, count);
    const uid = count === 1 ? baseUid : `${baseUid}_${count}`;

    // --- ODJ ---
    // Les h3 contiennent les points de l'ordre du jour
    const odjItems: string[] = [];
    container.find('h3').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text && text.length > 5) {
        odjItems.push(text);
      }
    });

    const odjCompletRaw = container.text().replace(/\s+/g, ' ').trim();
    const odjResume = odjItems.slice(0, 3).join(' | ').substring(0, 500) || null;
    const odjComplet = odjItems.join('\n').substring(0, 5000) || odjCompletRaw.substring(0, 5000) || null;

    // --- Participants ---
    // Chercher les liens vers /senateur/ dans le contenu
    const participantNames: string[] = [];
    container.find('a[href*="/senateur/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && !text.toLowerCase().includes('président')) {
        participantNames.push(text);
      }
    });

    // Déduplication
    const uniqueParticipants = [...new Set(participantNames)];

    return {
      uid,
      type: 'commission',
      organeReuniRef: dbSlug,
      dateDebut,
      dateFin: null,
      lieu: 'Sénat',
      etat: 'confirme',
      odjResume,
      odjComplet,
      captationVideo: false,
      ouvertePresse: false,
      compteRenduRef: sourceUrl,
      participants: [],       // Les vrais participants seront matchés dans syncSenatReunions()
      auditionnes: [],
      commissionSlugCourt,
      compteRenduUrl: sourceUrl,
      participantNames: uniqueParticipants,
    };
  }

  /**
   * Récupère toutes les réunions pour une semaine (toutes commissions confondues).
   */
  async getReunionsForWeek(yyyymmdd: string): Promise<{ reunions: ParsedReunion[]; pagesErrored: number }> {
    const reunions: ParsedReunion[] = [];
    let pagesErrored = 0;

    for (const slug of COMMISSION_SLUGS) {
      await sleep(REQUEST_DELAY_MS);

      try {
        const pageReunions = await this.parseCommissionPage(yyyymmdd, slug);
        reunions.push(...pageReunions);
      } catch (err: any) {
        logger.warn({ yyyymmdd, slug, error: err.message }, 'Failed to parse commission page');
        pagesErrored++;
      }
    }

    return { reunions, pagesErrored };
  }

  /**
   * Récupère toutes les réunions sur les N dernières semaines.
   */
  async getAllReunions(options: { maxWeeks?: number } = {}): Promise<{
    reunions: ParsedReunion[];
    weeksFetched: number;
    pagesParsed: number;
    pagesErrored: number;
  }> {
    const maxWeeks = options.maxWeeks || MAX_WEEKS_DEFAULT;
    const weeks = await this.getWeekIndices(maxWeeks);

    const allReunions: ParsedReunion[] = [];
    let pagesParsed = 0;
    let pagesErrored = 0;
    let weeksFetched = 0;

    logger.info({ maxWeeks, weeks: weeks.length }, 'Starting Sénat reunions scraping...');

    for (const yyyymmdd of weeks) {
      const { reunions, pagesErrored: weekErrors } = await this.getReunionsForWeek(yyyymmdd);

      pagesErrored += weekErrors;
      pagesParsed += COMMISSION_SLUGS.length;
      weeksFetched++;

      if (reunions.length > 0) {
        allReunions.push(...reunions);
        logger.debug({ yyyymmdd, reunionsFound: reunions.length }, 'Week processed');
      }

      if (weeksFetched % 10 === 0) {
        logger.info(
          { weeksFetched, totalWeeks: weeks.length, reunionsSoFar: allReunions.length },
          'Scraping progress'
        );
      }
    }

    logger.info(
      { total: allReunions.length, weeksFetched, pagesParsed, pagesErrored },
      'Sénat reunions scraping completed'
    );

    return { reunions: allReunions, weeksFetched, pagesParsed, pagesErrored };
  }
}

// =============================================================================
// HELPERS INTERNES
// =============================================================================

function getMonthName(monthIndex: number): string {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return months[monthIndex] || 'janvier';
}

export default SenatReunionsClient;
