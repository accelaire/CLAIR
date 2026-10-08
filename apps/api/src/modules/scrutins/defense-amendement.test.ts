import { describe, it, expect } from 'vitest';
import { defensesDesAmendements, numeroCite } from './defense-amendement';

// Les prises reprennent le scrutin n° 8447 de la 17e législature (amendement
// no 1218 de Mme Rousseau, discuté en commun avec le no 895), tel qu'il est
// rattaché en prod.

const DEBAT_8447 = [
  { id: 'thiebault-895', ordre: 188, amendementsVises: ['895'] },
  { id: 'rousseau-sous-amdt', ordre: 190, amendementsVises: ['895'] },
  { id: 'avis-commission', ordre: 192, amendementsVises: [] },
  { id: 'rousseau-1218', ordre: 194, amendementsVises: ['1218'] },
  { id: 'avis-commission-1218', ordre: 198, amendementsVises: [] },
  { id: 'rousseau-replique', ordre: 230, amendementsVises: [] },
];

describe('numeroCite', () => {
  it('retire la mention de rectification, que le compte rendu ne cite pas', () => {
    expect(numeroCite('731 (Rect)')).toBe('731');
    expect(numeroCite('1218')).toBe('1218');
    expect(numeroCite('II-36')).toBe('II-36');
  });
});

describe('defensesDesAmendements', () => {
  it('retient la prise qui nomme l’amendement, pas celle de la discussion commune', () => {
    const defenses = defensesDesAmendements([{ id: 'a1218', numero: '1218' }], DEBAT_8447);
    expect(defenses.get('a1218')?.id).toBe('rousseau-1218');
  });

  it('retient la première prise dans l’ordre de la séance, quel que soit l’ordre reçu', () => {
    const defenses = defensesDesAmendements(
      [{ id: 'a895', numero: '895' }],
      [...DEBAT_8447].reverse(),
    );
    expect(defenses.get('a895')?.id).toBe('thiebault-895');
  });

  it('reconnaît un amendement rectifié sous son numéro cité', () => {
    const defenses = defensesDesAmendements(
      [{ id: 'a731', numero: '731 (Rect)' }],
      [{ id: 'defense', ordre: 4, amendementsVises: ['731'] }],
    );
    expect(defenses.get('a731')?.id).toBe('defense');
  });

  it('ne met rien en avant quand aucune prise ne nomme l’amendement', () => {
    // Un numéro qui en contient un autre ne compte pas : « 21 » n'est pas « 218 ».
    const defenses = defensesDesAmendements([{ id: 'a21', numero: '21' }], [
      { id: 'autre', ordre: 1, amendementsVises: ['218'] },
      { id: 'sans', ordre: 2, amendementsVises: null },
    ]);
    expect(defenses.size).toBe(0);
  });
});
