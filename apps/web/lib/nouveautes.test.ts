import { describe, expect, it } from 'vitest';
import { estNouveau, sectionNouvelleDe } from './nouveautes';

describe('estNouveau', () => {
  it('marque une section listée jusqu’à son dernier jour inclus', () => {
    expect(estNouveau('/petitions', '2026-11-25')).toBe(true);
    expect(estNouveau('/petitions', '2027-01-31')).toBe(true);
    expect(estNouveau('/petitions', '2027-02-01')).toBe(false);
  });

  it('ne marque pas une section absente de la liste', () => {
    expect(estNouveau('/deputes', '2026-11-25')).toBe(false);
    expect(estNouveau('/petitions/assemblee/3014', '2026-11-25')).toBe(false);
  });
});

describe('sectionNouvelleDe', () => {
  it('rattache une page à sa section signalée', () => {
    expect(sectionNouvelleDe('/petitions')).toBe('/petitions');
    expect(sectionNouvelleDe('/petitions/senat/742')).toBe('/petitions');
    expect(sectionNouvelleDe('/gouvernements/membres/gabriel-attal')).toBe('/gouvernements');
  });

  it('ne confond pas un chemin qui commence pareil', () => {
    expect(sectionNouvelleDe('/petitionsx')).toBeNull();
    expect(sectionNouvelleDe('/deputes')).toBeNull();
  });
});
