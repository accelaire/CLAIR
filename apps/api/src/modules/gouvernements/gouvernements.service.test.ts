import { describe, expect, it } from 'vitest';
import { nommerGouvernements, presidenceAuDebut } from './gouvernements.service';

const pm = (acteurUid: string, nom: string) => ({ acteurUid, nom });

describe('nommerGouvernements', () => {
  it('nomme par le Premier ministre, chiffre romain seulement s’il en a dirigé plusieurs', () => {
    const noms = nommerGouvernements([
      { numero: 1, premierMinistre: pm('PA1', 'Valls') },
      { numero: 2, premierMinistre: pm('PA1', 'Valls') },
      { numero: 1, premierMinistre: pm('PA2', 'Cazeneuve') },
      { numero: 3, premierMinistre: pm('PA3', 'Fillon') },
      { numero: 1, premierMinistre: pm('PA3', 'Fillon') },
    ]).map((g) => g.nom);
    expect(noms).toEqual(['Valls I', 'Valls II', 'Cazeneuve', 'Fillon III', 'Fillon I']);
  });
});

describe('presidenceAuDebut', () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const presidences = [
    { uid: 'PO382940', dateDebut: d('2007-05-16'), dateFin: d('2012-05-15') },
    { uid: 'PO696251', dateDebut: d('2012-05-15'), dateFin: d('2017-05-14') },
    { uid: 'PO717136', dateDebut: d('2017-05-14'), dateFin: null },
  ];

  it('retient la présidence en cours au début du gouvernement', () => {
    expect(presidenceAuDebut(presidences, d('2016-12-07'))!.uid).toBe('PO696251'); // Cazeneuve
    expect(presidenceAuDebut(presidences, d('2025-10-11'))!.uid).toBe('PO717136'); // Lecornu II
  });

  it('retient le nouveau président le jour de la passation', () => {
    expect(presidenceAuDebut(presidences, d('2012-05-15'))!.uid).toBe('PO696251');
  });

  it('ne retient rien avant 2007', () => {
    expect(presidenceAuDebut(presidences, d('2005-06-02'))).toBeNull();
  });
});
