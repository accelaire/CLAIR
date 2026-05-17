import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseHour, generateISOWeeks, filterAndGroupEvents } from './agenda-client';
import type { SenatAgendaEvent } from './agenda-client';

describe('parseHour', () => {
  it('parses "15h00"', () => {
    expect(parseHour('15h00')).toEqual({ hours: 15, minutes: 0 });
  });

  it('parses "9h30"', () => {
    expect(parseHour('9h30')).toEqual({ hours: 9, minutes: 30 });
  });

  it('returns null for empty string', () => {
    expect(parseHour('')).toBeNull();
  });

  it('parses "14h" without minutes', () => {
    expect(parseHour('14h')).toEqual({ hours: 14, minutes: 0 });
  });
});

describe('generateISOWeeks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 4 weeks by default', () => {
    const weeks = generateISOWeeks();
    expect(weeks).toHaveLength(4);
  });

  it('returns the requested number of weeks', () => {
    const weeks = generateISOWeeks(6);
    expect(weeks).toHaveLength(6);
  });

  it('uses YYYY-WNN format', () => {
    const weeks = generateISOWeeks(3);
    for (const w of weeks) {
      expect(w).toMatch(/^\d{4}-W\d{2}$/);
    }
  });

  it('starts with the current ISO week', () => {
    const weeks = generateISOWeeks(1);
    expect(weeks[0]).toBe('2025-W18');
  });

  it('zero-pads week numbers', () => {
    // 2026-01-01 is in ISO week 2026-W01
    vi.setSystemTime(new Date('2026-01-02T12:00:00Z'));
    const weeks = generateISOWeeks(1);
    expect(weeks[0]).toBe('2026-W01');
  });
});

describe('filterAndGroupEvents', () => {
  const baseEvents: SenatAgendaEvent[] = [
    {
      id: 556134,
      date: '2026-05-11',
      hour: '15h00',
      title: 'CMP PJL Lutte contre les fraudes sociales et fiscales',
      place: 'Hémicycle',
      instances: ['Séance publique'],
      forecast: false,
      public: true,
    },
    {
      id: 556136,
      date: '2026-05-11',
      hour: '15h00',
      title: 'PPL Égal accès de tous à l accompagnement et aux soins palliatifs et PPL 2L Droit à l aide à mourir',
      place: 'Hémicycle',
      instances: ['Séance publique'],
      forecast: false,
      public: true,
    },
    {
      id: 556395,
      date: '2026-05-11',
      hour: '13h30',
      title: 'Commission affaires sociales',
      place: 'Salle A213',
      instances: ['Commission des affaires sociales'],
      forecast: false,
      public: false,
    },
  ];

  it('filters out non-public events', () => {
    const result = filterAndGroupEvents(baseEvents);
    expect(result).toHaveLength(1);
    expect(result[0]!.eventIds).toEqual(expect.arrayContaining([556134, 556136]));
  });

  it('excludes events with empty hour', () => {
    const events = [{ ...baseEvents[0]!, hour: '' }];
    expect(filterAndGroupEvents(events)).toHaveLength(0);
  });

  it('includes public events with place Hémicycle', () => {
    const event = { ...baseEvents[0]!, public: true, place: 'Hémicycle', instances: [] };
    expect(filterAndGroupEvents([event])).toHaveLength(1);
  });

  it('includes public events with Séance publique instance', () => {
    const event = { ...baseEvents[0]!, public: true, place: 'Salle Clemenceau', instances: ['Séance publique'] };
    expect(filterAndGroupEvents([event])).toHaveLength(1);
  });

  it('excludes public events outside Hémicycle without Séance publique', () => {
    const event = { ...baseEvents[0]!, public: true, place: 'Salle A213', instances: ['Commission'] };
    expect(filterAndGroupEvents([event])).toHaveLength(0);
  });

  it('groups events sharing date and hour', () => {
    const result = filterAndGroupEvents([baseEvents[0]!, baseEvents[1]!]);
    expect(result).toHaveLength(1);
    expect(result[0]!.odjItems).toHaveLength(2);
  });

  it('keeps events with different hours separate', () => {
    const early = { ...baseEvents[0]!, hour: '10h00', id: 1 };
    const late = { ...baseEvents[0]!, hour: '15h00', id: 2, public: true, place: 'Hémicycle', instances: ['Séance publique'] };
    const result = filterAndGroupEvents([early, late]);
    expect(result).toHaveLength(2);
  });

  it('generates deterministic uid', () => {
    const result = filterAndGroupEvents([baseEvents[0]!]);
    expect(result[0]!.uid).toBe('SENAT_AGENDA_20260511_1500');
  });

  it('zero-pads hour in uid', () => {
    const event = { ...baseEvents[0]!, hour: '9h30' };
    const result = filterAndGroupEvents([event]);
    expect(result[0]!.uid).toBe('SENAT_AGENDA_20260511_0930');
  });

  it('builds odjResume from titles joined by " | "', () => {
    const result = filterAndGroupEvents([baseEvents[0]!, baseEvents[1]!]);
    expect(result[0]!.odjResume).toBe(
      'CMP PJL Lutte contre les fraudes sociales et fiscales | PPL Égal accès de tous à l accompagnement et aux soins palliatifs et PPL 2L Droit à l aide à mourir'
    );
  });

  it('sets etat to "confirme" when any event has forecast=false', () => {
    const events = [
      { ...baseEvents[0]!, forecast: true },
      { ...baseEvents[1]!, forecast: false, public: true, place: 'Hémicycle', instances: ['Séance publique'] },
    ];
    const result = filterAndGroupEvents(events);
    expect(result[0]!.etat).toBe('confirme');
  });

  it('sets etat to "eventuel" when all events have forecast=true', () => {
    const events = baseEvents
      .filter(e => e.public)
      .map(e => ({ ...e, forecast: true }));
    const result = filterAndGroupEvents(events);
    expect(result[0]!.etat).toBe('eventuel');
  });

  it('assigns date correctly', () => {
    const result = filterAndGroupEvents([baseEvents[0]!]);
    expect(result[0]!.date).toBe('2026-05-11');
  });

  it('assigns dateDebut as parsed Date', () => {
    const result = filterAndGroupEvents([baseEvents[0]!]);
    expect(result[0]!.dateDebut).toBeInstanceOf(Date);
    expect(result[0]!.dateDebut.toISOString()).toContain('2026-05-11');
  });

  it('sets dateFin to null', () => {
    const result = filterAndGroupEvents([baseEvents[0]!]);
    expect(result[0]!.dateFin).toBeNull();
  });
});