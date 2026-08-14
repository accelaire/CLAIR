// =============================================================================
// Client Agenda Sénat - API JSON de l'agenda (séances publiques + commissions)
// Source: https://www.senat.fr/api/v1/agenda/events?date=YYYY-MM-DD
// =============================================================================
//
// ATTENTION sur le paramètre de requête : l'API **ignore silencieusement**
// `?week=YYYY-WNN` et renvoie toujours la semaine courante, quel que soit le
// numéro demandé. Le client bouclait sur 4 semaines ISO, recevait donc 4 fois
// la même charge utile, que le dédoublonnage par `id` écrasait : la couverture
// réelle n'a jamais dépassé la semaine en cours.
//
// `?date=YYYY-MM-DD` fonctionne, lui, et donne accès au passé comme au futur.
// On interroge donc jour par jour.
//
// L'agenda couvre TOUTES les instances, pas seulement l'hémicycle :
// commissions permanentes, délégations, commissions d'enquête, missions
// d'information. C'est la seule source qui expose les réunions de commission
// À VENIR — les comptes rendus, eux, sont par nature rétrospectifs.
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';

// =============================================================================
// CONFIG
// =============================================================================

const BASE_URL = 'https://www.senat.fr/api/v1/agenda/events';
const REQUEST_DELAY_MS = 300;

// =============================================================================
// TYPES
// =============================================================================

export interface SenatAgendaEvent {
  id: number;
  date: string;
  hour: string;
  title: string;
  place: string;
  instances: string[];
  forecast: boolean;
  public: boolean;
}

export interface SenatAgendaSeance {
  uid: string;
  date: string;
  dateDebut: Date;
  dateFin: null;
  odjResume: string;
  odjItems: string[];
  eventIds: number[];
  etat: 'confirme' | 'eventuel';
}

export interface SenatCommissionReunion extends SenatAgendaSeance {
  /** Code organisme Sénat (= `commissions.organe_ref`), ex. `COM-FINC`. */
  organeRef: string;
  /** Salle telle qu'annoncée par l'agenda, ex. « Salle A213 - 2ème étage Est ». */
  lieu: string | null;
}

/**
 * Libellé `instances` de l'agenda → `commissions.organe_ref`.
 *
 * L'agenda expose un libellé court et abrégé (« Commission de la culture »),
 * pas le nom complet de la commission (« Commission de la culture, de
 * l'éducation, de la communication et du sport ») ni son code. Un
 * rapprochement flou sur le nom serait hasardeux — d'où cette table explicite.
 *
 * Les instances absentes de cette table (commissions d'enquête, missions
 * d'information, OPECST…) sont conservées telles quelles dans `organeRef` mais
 * ne seront pas rattachées à une commission : elles n'ont pas toutes une ligne
 * en base, et une correspondance approximative vaut moins que pas de lien.
 */
export const AGENDA_INSTANCE_TO_ORGANE_REF: Record<string, string> = {
  // Commissions permanentes
  'Commission des finances': 'COM-FINC',
  'Commission des affaires sociales': 'COM-SOCI',
  'Commission des lois': 'COM-LOIS',
  'Commission des affaires économiques': 'COM-CAE',
  'Commission de la culture': 'COM-AFCL',
  'Commission des affaires étrangères': 'COM-ETRD',
  'Commission aménagement du territoire / développement durable': 'COM-CDD',
  'Commission des affaires européennes': 'COMEUR-AFEU',
  // Délégations (lignes existantes en base, rattachement sûr)
  'Délégation aux droits des femmes': 'PO310693',
  'Délégation aux collectivités territoriales': 'PO420387',
  'Délégation sénatoriale aux outre-mer': 'PO436945',
  'Délégation à la prospective': 'PO420388',
  'Délégation aux entreprises': 'PO704856',
};

// =============================================================================
// HELPERS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDaylightSavingTime(year: number, month: number, day: number): boolean {
  // month 0‑based
  const getLastSundayOfMonth = (y: number, m: number): number => {
    const lastDay = new Date(Date.UTC(y, m + 1, 0));
    const dayOfWeek = lastDay.getUTCDay();
    return lastDay.getUTCDate() - dayOfWeek;
  };
  const lastSundayMarch = getLastSundayOfMonth(year, 2);
  const lastSundayOct = getLastSundayOfMonth(year, 9);

  const dateNum = year * 10000 + (month + 1) * 100 + day;
  const dstStartNum = year * 10000 + 3 * 100 + lastSundayMarch;
  const dstEndNum = year * 10000 + 10 * 100 + lastSundayOct;
  return dateNum >= dstStartNum && dateNum < dstEndNum;
}

function buildDateDebut(dateStr: string, hours: number, minutes: number): Date | null {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts as [number, number, number];
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const isDST = isDaylightSavingTime(year, month - 1, day);
  const offsetMinutes = isDST ? 120 : 60;
  const utcTs = Date.UTC(year, month - 1, day, hours, minutes) - offsetMinutes * 60 * 1000;
  const d = new Date(utcTs);
  return isNaN(d.getTime()) ? null : d;
}

// =============================================================================
// FONCTIONS EXPORTÉES (testables)
// =============================================================================

export function parseHour(hour: string): { hours: number; minutes: number } | null {
  if (!hour) return null;
  const match = hour.match(/^(\d{1,2})h(\d{2})?$/);
  if (!match) return null;
  const hours = parseInt(match[1]!, 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  if (isNaN(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Dates `YYYY-MM-DD` de `daysBack` jours en arrière à `daysAhead` en avant.
 * L'API s'interroge jour par jour (`?week=` est ignoré, cf. en-tête).
 */
export function generateDateRange(daysBack: number, daysAhead: number): string[] {
  const today = new Date();
  const dates: string[] = [];
  for (let offset = -daysBack; offset <= daysAhead; offset++) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset)
    );
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Regroupe les événements d'agenda en réunions de commission.
 *
 * Une réunion = (instance, date, heure). Deux commissions peuvent siéger à la
 * même heure, et une même commission peut se réunir deux fois dans la journée :
 * l'instance ET l'heure sont donc nécessaires pour identifier la réunion.
 *
 * Contrairement aux séances publiques, on ne filtre pas sur `public` : la
 * quasi-totalité des réunions de commission sont annoncées `public: false`
 * (le huis clos est la règle), les exclure viderait le résultat.
 */
export function groupCommissionReunions(events: SenatAgendaEvent[]): SenatCommissionReunion[] {
  const groups = new Map<string, SenatAgendaEvent[]>();

  for (const event of events) {
    if (!event.hour || !event.date) continue;

    // Les événements sans instance, ou rattachés à plusieurs, ne sont pas
    // attribuables de façon sûre à une commission.
    if (!event.instances || event.instances.length !== 1) continue;

    const label = event.instances[0]!;
    const organeRef = AGENDA_INSTANCE_TO_ORGANE_REF[label];
    if (!organeRef) continue;

    const key = `${organeRef}_${event.date}_${event.hour}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  const reunions: SenatCommissionReunion[] = [];

  for (const [, group] of groups) {
    const first = group[0]!;
    const parsed = parseHour(first.hour);
    if (!parsed) continue;

    const dateDebut = buildDateDebut(first.date, parsed.hours, parsed.minutes);
    if (!dateDebut) continue;

    const organeRef = AGENDA_INSTANCE_TO_ORGANE_REF[first.instances[0]!]!;
    const yyyymmdd = first.date.replace(/-/g, '');
    const hhmm = `${String(parsed.hours).padStart(2, '0')}${String(parsed.minutes).padStart(2, '0')}`;

    const odjItems = group.map((e) => e.title).filter(Boolean);

    reunions.push({
      // Espace de noms distinct des séances (`SENAT_AGENDA_<date>_<hhmm>`) et
      // de l'ancien scraping de comptes rendus (`SENAT_<date>_<slug>`).
      uid: `SENAT_AGENDA_${organeRef}_${yyyymmdd}_${hhmm}`,
      organeRef,
      date: first.date,
      dateDebut,
      dateFin: null,
      lieu: first.place || null,
      odjResume: odjItems.join(' | ').substring(0, 500),
      odjItems,
      eventIds: group.map((e) => e.id),
      etat: group.every((e) => e.forecast) ? 'eventuel' : 'confirme',
    });
  }

  return reunions;
}

export function filterAndGroupEvents(events: SenatAgendaEvent[]): SenatAgendaSeance[] {
  const filtered = events.filter(
    (e) => e.public && (e.place === 'Hémicycle' || e.instances.includes('Séance publique'))
  );

  const groups = new Map<string, SenatAgendaEvent[]>();
  for (const event of filtered) {
    if (!event.hour) continue;
    const key = `${event.date}_${event.hour}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  const seances: SenatAgendaSeance[] = [];
  for (const [key, group] of groups) {
    const [date, hour] = key.split('_');
    const parsed = parseHour(hour!);
    if (!parsed) continue;

    const dateDebut = buildDateDebut(date!, parsed.hours, parsed.minutes);
    if (!dateDebut) continue;

    const yyyymmdd = date!.replace(/-/g, '');
    const hhmm = `${String(parsed.hours).padStart(2, '0')}${String(parsed.minutes).padStart(2, '0')}`;
    const uid = `SENAT_AGENDA_${yyyymmdd}_${hhmm}`;

    const odjItems = group.map((e) => e.title).filter(Boolean);
    const odjResume = odjItems.join(' | ').substring(0, 500);
    const allForecast = group.every((e) => e.forecast);
    const etat: 'confirme' | 'eventuel' = allForecast ? 'eventuel' : 'confirme';
    const eventIds = group.map((e) => e.id);

    seances.push({
      uid,
      date: date!,
      dateDebut,
      dateFin: null,
      odjResume,
      odjItems,
      eventIds,
      etat,
    });
  }
  return seances;
}

// =============================================================================
// CLIENT
// =============================================================================

export class SenatAgendaClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 15_000,
      headers: {
        'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
        'Accept': 'application/json',
      },
    });
    logger.info('SenatAgendaClient initialized');
  }

  /**
   * Récupère les événements bruts de l'agenda sur une plage de dates.
   * Une requête par jour : c'est la seule granularité que l'API honore.
   */
  async getEvents(dates: string[]): Promise<SenatAgendaEvent[]> {
    const allEvents: SenatAgendaEvent[] = [];
    let daysErrored = 0;

    for (const date of dates) {
      try {
        const res = await this.http.get(`${BASE_URL}?date=${date}`);
        const data = res.data as Record<string, { day: string; events: SenatAgendaEvent[] }>;
        const events = Object.values(data).flatMap((day) => day.events || []);
        allEvents.push(...events);
      } catch (err) {
        daysErrored++;
        logger.warn({ date, error: errorMessage(err) }, 'Failed to fetch agenda day');
      }
      await sleep(REQUEST_DELAY_MS);
    }

    // Une même occurrence peut revenir sur plusieurs jours interrogés.
    const unique = [...new Map(allEvents.map((e) => [e.id, e])).values()];
    logger.info(
      { days: dates.length, daysErrored, events: allEvents.length, uniqueEvents: unique.length },
      'Agenda events fetched'
    );
    return unique;
  }

  /**
   * Séances publiques. La fenêtre déborde sur le passé : l'ordre du jour d'une
   * séance est régulièrement amendé après coup, et les séances passées doivent
   * rester à jour dans l'historique.
   */
  async getSeances(daysBack = 30, daysAhead = 30): Promise<SenatAgendaSeance[]> {
    const events = await this.getEvents(generateDateRange(daysBack, daysAhead));
    const seances = filterAndGroupEvents(events);
    logger.info({ seances: seances.length }, 'Séances publiques grouped');
    return seances;
  }

  /** Réunions de commission (permanentes + délégations rattachables). */
  async getCommissionReunions(daysBack = 30, daysAhead = 30): Promise<SenatCommissionReunion[]> {
    const events = await this.getEvents(generateDateRange(daysBack, daysAhead));
    const reunions = groupCommissionReunions(events);
    logger.info({ reunions: reunions.length }, 'Commission reunions grouped');
    return reunions;
  }

  /**
   * Séances ET réunions de commission en un seul passage réseau.
   * À privilégier : évite de télécharger deux fois la même plage de dates.
   */
  async getAgenda(
    daysBack = 30,
    daysAhead = 30
  ): Promise<{ seances: SenatAgendaSeance[]; reunions: SenatCommissionReunion[] }> {
    const events = await this.getEvents(generateDateRange(daysBack, daysAhead));
    const seances = filterAndGroupEvents(events);
    const reunions = groupCommissionReunions(events);
    logger.info({ seances: seances.length, reunions: reunions.length }, 'Agenda processing complete');
    return { seances, reunions };
  }
}

export default SenatAgendaClient;