// =============================================================================
// Client Agenda Sénat - API JSON des séances à venir
// Source: https://www.senat.fr/api/v1/agenda/events?week=YYYY-WNN
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

function getISOWeekString(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day); // Thursday of the week
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
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

export function generateISOWeeks(weeksAhead: number = 4): string[] {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);

  const weeks: string[] = [];
  for (let i = 0; i < weeksAhead; i++) {
    const weekDate = new Date(monday);
    weekDate.setDate(monday.getDate() + i * 7);
    weeks.push(getISOWeekString(weekDate));
  }
  return weeks;
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

  async getUpcomingSeances(weeksAhead = 4): Promise<SenatAgendaSeance[]> {
    const weeks = generateISOWeeks(weeksAhead);
    const allEvents: SenatAgendaEvent[] = [];

    for (const week of weeks) {
      try {
        const url = `${BASE_URL}?week=${week}`;
        logger.debug({ url, week }, 'Fetching agenda week');
        const res = await this.http.get(url);
        const data = res.data as Record<string, { day: string; events: SenatAgendaEvent[] }>;
        const events = Object.values(data).flatMap((day) => day.events || []);
        allEvents.push(...events);
        logger.debug({ week, eventsCount: events.length }, 'Week fetched');
      } catch (err) {
        logger.warn({ week, error: errorMessage(err) }, 'Failed to fetch agenda week');
      }
      await sleep(REQUEST_DELAY_MS);
    }

    const uniqueEvents = [...new Map(allEvents.map((e) => [e.id, e])).values()];
    const seances = filterAndGroupEvents(uniqueEvents);
    logger.info({ totalEvents: allEvents.length, uniqueEvents: uniqueEvents.length, seances: seances.length }, 'Agenda processing complete');
    return seances;
  }
}

export default SenatAgendaClient;