import { describe, expect, it } from 'vitest';
import { slugSepare } from './identite-fiches';

describe('slugSepare', () => {
  it('garde le slug de la personne quand il est libre', () => {
    expect(slugSepare('jean-louis-masson', '01060R', false)).toBe('jean-louis-masson');
  });

  it('suffixe le matricule quand le slug est pris, comme les anciens sénateurs (senat-histo)', () => {
    expect(slugSepare('jean-louis-masson', '01060R', true)).toBe('jean-louis-masson-01060r');
  });
});
