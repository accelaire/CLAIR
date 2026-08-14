import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseHour,
  generateDateRange,
  filterAndGroupEvents,
  groupCommissionReunions,
} from './agenda-client';
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

describe('generateDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('couvre le passé et le futur, bornes incluses', () => {
    expect(generateDateRange(2, 2)).toEqual([
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
    ]);
  });

  it('inclut aujourd\'hui même avec une fenêtre nulle', () => {
    expect(generateDateRange(0, 0)).toEqual(['2026-05-14']);
  });

  it('franchit les limites de mois', () => {
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    expect(generateDateRange(1, 0)).toEqual(['2026-02-28', '2026-03-01']);
  });

  it('utilise le format YYYY-MM-DD', () => {
    for (const d of generateDateRange(3, 3)) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
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

// =============================================================================
// groupCommissionReunions
// =============================================================================

describe('groupCommissionReunions', () => {
  // Calqué sur les événements réels de l'agenda Sénat du 2026-07-08.
  const ev = (over: Partial<SenatAgendaEvent>): SenatAgendaEvent => ({
    id: 1,
    date: '2026-07-08',
    hour: '8h30',
    title: 'Audition',
    place: 'Salle A213 - 2ème étage Est',
    instances: ['Commission des affaires sociales'],
    forecast: false,
    public: false,
    ...over,
  });

  it('rattache le libellé abrégé au bon organe_ref', () => {
    const r = groupCommissionReunions([ev({})]);
    expect(r).toHaveLength(1);
    expect(r[0]!.organeRef).toBe('COM-SOCI');
  });

  it('ne filtre pas sur `public` (le huis clos est la règle en commission)', () => {
    expect(groupCommissionReunions([ev({ public: false })])).toHaveLength(1);
  });

  it("regroupe les points d'ordre du jour d'un même créneau", () => {
    const r = groupCommissionReunions([
      ev({ id: 1, title: "Désignation d'un rapporteur" }),
      ev({ id: 2, title: 'Audition de la Cour des comptes' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.odjItems).toEqual([
      "Désignation d'un rapporteur",
      'Audition de la Cour des comptes',
    ]);
    expect(r[0]!.eventIds).toEqual([1, 2]);
  });

  it('sépare deux réunions de la même commission le même jour', () => {
    const r = groupCommissionReunions([ev({ id: 1, hour: '8h30' }), ev({ id: 2, hour: '14h00' })]);
    expect(r).toHaveLength(2);
    expect(new Set(r.map((x) => x.uid)).size).toBe(2);
  });

  it('sépare deux commissions siégeant à la même heure', () => {
    const r = groupCommissionReunions([
      ev({ id: 1, instances: ['Commission des finances'] }),
      ev({ id: 2, instances: ['Commission des lois'] }),
    ]);
    expect(r.map((x) => x.organeRef).sort()).toEqual(['COM-FINC', 'COM-LOIS']);
  });

  it('construit un uid distinct de celui des séances publiques', () => {
    expect(groupCommissionReunions([ev({})])[0]!.uid).toBe('SENAT_AGENDA_COM-SOCI_20260708_0830');
  });

  it('ignore les instances non rattachables', () => {
    expect(groupCommissionReunions([ev({ instances: ['CE Universités'] })])).toEqual([]);
    expect(groupCommissionReunions([ev({ instances: ['Séance publique'] })])).toEqual([]);
    expect(groupCommissionReunions([ev({ instances: ['Présidence'] })])).toEqual([]);
  });

  it('ignore les événements sans instance ou à instances multiples', () => {
    expect(groupCommissionReunions([ev({ instances: [] })])).toEqual([]);
    expect(
      groupCommissionReunions([ev({ instances: ['Commission des finances', 'Commission des lois'] })])
    ).toEqual([]);
  });

  it('ignore un événement sans heure exploitable', () => {
    expect(groupCommissionReunions([ev({ hour: '' })])).toEqual([]);
    expect(groupCommissionReunions([ev({ hour: 'matin' })])).toEqual([]);
  });

  it('marque « eventuel » seulement si tout le créneau est prévisionnel', () => {
    expect(groupCommissionReunions([ev({ forecast: true })])[0]!.etat).toBe('eventuel');
    expect(
      groupCommissionReunions([ev({ id: 1, forecast: true }), ev({ id: 2, forecast: false })])[0]!
        .etat
    ).toBe('confirme');
  });

  it('conserve la salle annoncée', () => {
    expect(groupCommissionReunions([ev({})])[0]!.lieu).toBe('Salle A213 - 2ème étage Est');
    expect(groupCommissionReunions([ev({ place: '' })])[0]!.lieu).toBeNull();
  });

  it('couvre les 8 commissions permanentes', () => {
    const labels = [
      'Commission des finances',
      'Commission des affaires sociales',
      'Commission des lois',
      'Commission des affaires économiques',
      'Commission de la culture',
      'Commission des affaires étrangères',
      'Commission aménagement du territoire / développement durable',
      'Commission des affaires européennes',
    ];
    const r = groupCommissionReunions(labels.map((l, i) => ev({ id: i, instances: [l] })));
    expect(r).toHaveLength(8);
    expect(new Set(r.map((x) => x.organeRef)).size).toBe(8);
  });
});