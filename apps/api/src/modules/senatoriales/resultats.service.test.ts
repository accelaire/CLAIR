import { describe, expect, it } from 'vitest';
import { horairesCirconscription, statutCirconscription, tableauPlusForteMoyenne } from './resultats.service';

const a = (iso: string) => new Date(iso);

describe('horairesCirconscription', () => {
  it('applique les horaires du décret en heure locale', () => {
    expect(horairesCirconscription('13', 'proportionnel')).toEqual({
      ouverture: '2026-09-27T06:30:00.000Z',
      cloture: '2026-09-27T15:30:00.000Z',
      ouvertureT2: null,
      clotureT2: null,
    });
    // Polynésie : UTC−10, le 2nd tour se clôt à 5h30 le lundi, heure de Paris.
    expect(horairesCirconscription('987', 'majoritaire').clotureT2).toBe('2026-09-28T03:30:00.000Z');
    // Wallis-et-Futuna : UTC+12, le 1er tour se clôt dans la nuit de samedi.
    expect(horairesCirconscription('986', 'majoritaire').cloture).toBe('2026-09-26T23:00:00.000Z');
  });
});

describe('statutCirconscription', () => {
  it('suit la journée d\'une circonscription au proportionnel', () => {
    const statut = (heure: string, tours: { tour: number; elus: number }[] = []) =>
      statutCirconscription('13', 'proportionnel', 8, tours, a(heure)).statut;
    expect(statut('2026-09-27T08:00:00+02:00')).toBe('pas_ouvert');
    expect(statut('2026-09-27T12:00:00+02:00')).toBe('vote_en_cours');
    expect(statut('2026-09-27T18:00:00+02:00')).toBe('resultats_attendus');
    expect(statut('2026-09-27T18:00:00+02:00', [{ tour: 1, elus: 0 }])).toBe('pourvue');
  });

  it('distingue un siège pourvu sur deux, un 2nd tour à venir et une circonscription pourvue', () => {
    const midi = a('2026-09-27T14:00:00+02:00');
    expect(statutCirconscription('03', 'majoritaire', 2, [{ tour: 1, elus: 1 }], midi)).toEqual({
      statut: 'partielle',
      secondTour: 'a_venir',
    });
    expect(statutCirconscription('03', 'majoritaire', 2, [{ tour: 1, elus: 0 }], a('2026-09-27T16:00:00+02:00'))).toEqual({
      statut: 'second_tour',
      secondTour: 'en_cours',
    });
    expect(statutCirconscription('03', 'majoritaire', 2, [{ tour: 1, elus: 2 }], midi).statut).toBe('pourvue');
    expect(
      statutCirconscription('03', 'majoritaire', 2, [{ tour: 1, elus: 1 }, { tour: 2, elus: 1 }], midi).statut,
    ).toBe('pourvue');
  });

  it('ne déclare jamais un résultat qui n\'est pas publié', () => {
    // Scrutin clos depuis des heures, rien de publié : « attendus », pas « pourvue ».
    expect(statutCirconscription('03', 'majoritaire', 2, [], a('2026-09-27T23:00:00+02:00')).statut).toBe(
      'resultats_attendus',
    );
  });
});

describe('tableauPlusForteMoyenne', () => {
  it('retrouve la répartition publiée de l\'Isère en 2023', () => {
    // Voix publiées par le ministère ; sièges publiés : 3, 1, 1, 0…
    const { attribues, rangs } = tableauPlusForteMoyenne([1215, 714, 377, 323, 145, 133, 117, 19, 7], 5);
    expect(attribues).toEqual([3, 1, 1, 0, 0, 0, 0, 0, 0]);
    expect(rangs.map((r) => [r.liste, r.diviseur])).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [0, 3],
      [2, 1],
    ]);
  });
});
