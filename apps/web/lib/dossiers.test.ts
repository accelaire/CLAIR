import { describe, expect, it } from 'vitest';
import { dossierTitreCourtLisible } from './dossiers';

describe('dossierTitreCourtLisible', () => {
  it('garde un titre court rédigé', () => {
    expect(dossierTitreCourtLisible('Projet de loi de finances pour 2027')).toBe('Projet de loi de finances pour 2027');
    expect(dossierTitreCourtLisible('Fin de vie')).toBe('Fin de vie');
  });

  it('écarte les identifiants et codes de la source', () => {
    for (const t of ['PLFSS_2027', 'pjl_approbation_goteborg', 'DLR5L17N53980', 'PLFSS2024', '0000070001']) {
      expect(dossierTitreCourtLisible(t)).toBeNull();
    }
    expect(dossierTitreCourtLisible(null)).toBeNull();
    expect(dossierTitreCourtLisible('')).toBeNull();
  });
});
