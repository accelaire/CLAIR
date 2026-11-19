import { describe, expect, it } from 'vitest';
import {
  heureAParis,
  horaireDeLaReunion,
  joursDeLaReunion,
  momentDeLaReunion,
  natureDeReunion,
  pointsDeLOrdreDuJour,
  rangsDesSeances,
  reunionsParJour,
  titreDeReunion,
  type ReunionAgenda,
} from './agenda';

const AN = { nom: 'Assemblée nationale de la 17ème législature', type: 'hemicycle', chambre: 'assemblee' };
const SENAT = { nom: 'Sénat ( 5ème République )', type: 'hemicycle', chambre: 'senat' };
const OTAN = { nom: "Délégation française à l'Assemblée parlementaire de l'OTAN", type: 'assemblee_internationale', chambre: 'assemblee' };

const r = (id: string, dateDebut: string, dateFin: string | null, extra: Partial<ReunionAgenda> = {}): ReunionAgenda => ({
  id, type: 'commission', dateDebut, dateFin, ...extra,
});

describe('titre et nature', () => {
  it('une séance s’appelle « Séance publique », pas du nom de l’organe hémicycle', () => {
    expect(titreDeReunion({ type: 'seance', commission: SENAT })).toBe('Séance publique');
    expect(titreDeReunion({ type: 'seance', commission: AN })).toBe('Séance publique');
  });

  it('une commission prend son nom complet, jamais son code', () => {
    expect(titreDeReunion({ type: 'commission', commission: OTAN })).toBe(OTAN.nom);
    expect(titreDeReunion({ type: 'commission', commission: null })).toBe('Réunion de commission');
  });

  it('la nature suit le type de l’organe', () => {
    expect(natureDeReunion({ type: 'commission', commission: { type: 'enquete' } })).toBe("Commission d'enquête");
    expect(natureDeReunion({ type: 'commission', commission: { type: 'groupe_amitie' } })).toBe("Groupe d'amitié");
    expect(natureDeReunion({ type: 'initiative_parlementaire', commission: null })).toBe("Groupe d'études");
    expect(natureDeReunion({ type: 'commission', commission: { type: 'autre' } })).toBe('Commission');
  });
});

describe('horaire', () => {
  it('heure de Paris, quel que soit le fuseau du lecteur', () => {
    expect(heureAParis('2026-11-19T13:30:00Z')).toBe('14:30');
    expect(heureAParis('2026-07-01T12:30:00Z')).toBe('14:30');
  });

  it('une mission de plusieurs jours : une plage de dates, et chacun de ses jours', () => {
    const mission = r('otan', '2026-11-19T23:00:00Z', '2026-11-23T22:59:59Z', { commission: OTAN });
    expect(horaireDeLaReunion(mission)).toEqual({ debut: '20 nov.', fin: '23 nov.' });
    expect(joursDeLaReunion(mission)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']);
  });

  it('minuit sans fin : « Journée », pas « 00:00 »', () => {
    expect(horaireDeLaReunion(r('x', '2026-11-19T23:00:00Z', null)).debut).toBe('Journée');
  });

  it('réunion ordinaire', () => {
    expect(horaireDeLaReunion(r('x', '2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z'))).toEqual({ debut: '15:00', fin: '17:00' });
  });

  it('moments de la journée à Paris', () => {
    expect(momentDeLaReunion({ dateDebut: '2026-11-19T10:59:00Z' })).toBe('matin');
    expect(momentDeLaReunion({ dateDebut: '2026-11-19T11:00:00Z' })).toBe('apres-midi');
    expect(momentDeLaReunion({ dateDebut: '2026-11-19T20:30:00Z' })).toBe('soir');
  });
});

describe('ordre du jour', () => {
  it('découpe les points de l’AN (retours chariot, tirets)', () => {
    expect(pointsDeLOrdreDuJour("Séance plénière de l'APFA\r- Suite de l’examen des propositions de texte.")).toEqual([
      "Séance plénière de l'APFA",
      'Suite de l’examen des propositions de texte.',
    ]);
    expect(pointsDeLOrdreDuJour('- audition de M. Grégoire Frèrejacques')).toEqual(['Audition de M. Grégoire Frèrejacques']);
  });

  it('découpe les points du Sénat (« | »)', () => {
    expect(pointsDeLOrdreDuJour('Budget 2027 – Relations avec les collectivités | Budget 2027 - Administration générale')).toEqual([
      'Budget 2027 – Relations avec les collectivités',
      'Budget 2027 - Administration générale',
    ]);
  });

  it('vide', () => {
    expect(pointsDeLOrdreDuJour('')).toEqual([]);
    expect(pointsDeLOrdreDuJour(null)).toEqual([]);
  });
});

describe('journées', () => {
  it('range par jour à Paris : 0 h 30 n’est pas la veille', () => {
    const tard = r('tard', '2026-11-19T23:30:00Z', '2026-11-20T00:30:00Z');
    expect(Object.keys(reunionsParJour([tard]))).toEqual(['2026-11-20']);
  });

  it('numérote les séances de l’AN quand il y en a plusieurs', () => {
    const rangs = rangsDesSeances([
      r('s2', '2026-11-19T13:00:00Z', null, { type: 'seance', commission: AN }),
      r('s1', '2026-11-19T08:00:00Z', null, { type: 'seance', commission: AN }),
      r('s3', '2026-11-19T20:30:00Z', null, { type: 'seance', commission: AN }),
      r('sen', '2026-11-19T09:30:00Z', null, { type: 'seance', commission: SENAT }),
      r('seule', '2026-11-20T08:00:00Z', null, { type: 'seance', commission: AN }),
    ]);
    expect(Object.fromEntries(rangs)).toEqual({ s1: '1re séance', s2: '2e séance', s3: '3e séance' });
  });
});

describe('ce qui n’est pas sur plusieurs jours', () => {
  it('une séance de 21 h 30 qui finit après minuit reste à son heure', () => {
    const seance = r('s', '2026-11-03T20:30:00Z', '2026-11-03T23:05:00Z', { type: 'seance', commission: AN });
    expect(horaireDeLaReunion(seance)).toEqual({ debut: '21:30', fin: '00:05' });
    expect(joursDeLaReunion(seance)).toEqual(['2026-11-03']);
  });

  it('une audition qui reprend le lendemain : date de fin, pas une heure trompeuse', () => {
    const mission = r('m', '2026-11-04T14:00:00Z', '2026-11-05T09:00:00Z');
    expect(horaireDeLaReunion(mission)).toEqual({ debut: '15:00', fin: '5 nov.' });
    expect(joursDeLaReunion(mission)).toEqual(['2026-11-04']);
  });
});
