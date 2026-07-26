// =============================================================================
// Client AN - Ordre du jour des séances publiques (CSV)
// Source: seances_publique_excel.csv (encodage Latin-1, séparateur ';')
// =============================================================================

import { LEGISLATURE_AN_COURANTE } from '../../workers/mandats';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';

// =============================================================================
// TYPES
// =============================================================================

export interface TransformedSeanceODJ {
  date: string;      // "2026-04-28"
  heure: string;     // "15:00"
  dateDebut: Date;   // date + heure combinées en UTC (heure CSV traitée comme Europe/Paris)
  odjItems: string[];
  odjResume: string; // 3 premiers items joints par " | ", max 500 chars
  odjComplet: string; // tous les items joints par "\n", max 5000 chars
}

// =============================================================================
// CLIENT
// =============================================================================

export class SeancesODJClient {
  private readonly csvUrl: string;

  constructor(legislature: number = LEGISLATURE_AN_COURANTE) {
    this.csvUrl = `https://data.assemblee-nationale.fr/static/openData/repository/${legislature}/vp/seances/seances_publique_excel.csv`;
    logger.info({ legislature }, 'SeancesODJClient initialized');
  }

  private async downloadCsv(): Promise<string> {
    logger.debug({ url: this.csvUrl }, 'Downloading séances ODJ CSV...');

    const response = await axios({
      method: 'GET',
      url: this.csvUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
        'Accept': 'text/csv, text/plain, */*',
      },
    });

    // CSV est encodé en Latin-1 — Node's TextDecoder supporte 'latin1' / 'iso-8859-1'
    const decoder = new TextDecoder('latin1');
    return decoder.decode(response.data as ArrayBuffer);
  }

  private parseCsv(raw: string): TransformedSeanceODJ[] {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Ignore header line (starts with "Date" quoted or not)
    const dataLines = lines.filter((l) => !l.startsWith('"Date"') && !l.startsWith('Date'));

    const results: TransformedSeanceODJ[] = [];

    for (const line of dataLines) {
      try {
        // Split by ';' then strip surrounding quotes from each field
        const parts = line.split(';').map((p) => p.replace(/^"|"$/g, '').trim());

        const date = parts[0] ?? '';
        const heure = parts[1] ?? '';
        const odjRaw = parts[2] ?? '';

        if (!date || !heure) continue;

        // Validate date format YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        // Validate time format HH:MM
        if (!/^\d{2}:\d{2}$/.test(heure)) continue;

        // Combine date + heure into a UTC Date, treating the CSV time as Europe/Paris local time.
        // Probe noon UTC on that day to determine the Paris offset (CET = +1, CEST = +2).
        const probe = new Date(`${date}T12:00:00Z`);
        const parisHourStr = new Intl.DateTimeFormat('fr-FR', {
          timeZone: 'Europe/Paris',
          hour: '2-digit',
          hour12: false,
        }).format(probe);
        const parisOffset = parseInt(parisHourStr, 10) - probe.getUTCHours(); // +1 or +2
        const [h, m = 0] = heure.split(':').map(Number);
        if (h === undefined || isNaN(h)) continue;
        const dateDebut = new Date(Date.UTC(
          parseInt(date.slice(0, 4), 10),
          parseInt(date.slice(5, 7), 10) - 1,
          parseInt(date.slice(8, 10), 10),
          h - parisOffset,
          m,
        ));
        if (isNaN(dateDebut.getTime())) continue;

        // Split ODJ by 4+ consecutive spaces (AN uses 6+ but 4 is the safe minimum)
        const odjItems = odjRaw
          .split(/\s{4,}/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        const odjResume = odjItems.slice(0, 3).join(' | ').substring(0, 500);
        const odjComplet = odjItems.join('\n').substring(0, 5000);

        results.push({ date, heure, dateDebut, odjItems, odjResume, odjComplet });
      } catch (err) {
        logger.warn({ line, error: errorMessage(err) }, 'Failed to parse séance ODJ line');
      }
    }

    logger.info({ parsed: results.length, totalLines: dataLines.length }, 'Séances ODJ CSV parsed');
    return results;
  }

  async getSeancesODJ(): Promise<TransformedSeanceODJ[]> {
    const raw = await this.downloadCsv();
    return this.parseCsv(raw);
  }
}

export default SeancesODJClient;
