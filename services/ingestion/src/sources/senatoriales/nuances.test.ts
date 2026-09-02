import { describe, it, expect } from 'vitest';

import { codesNuancesConnus, nuanceInconnue, resoudreNuance } from './nuances.js';

/**
 * Les 42 codes relevés dans les fichiers de candidatures des sénatoriales 2020
 * et 2023, extraits des deux fichiers du ministère.
 *
 * Ce test est là pour le jour où la grille 2026 arrivera : si un code manque,
 * il ne doit pas être deviné, il doit apparaître ici.
 */
const CODES_OBSERVES_2020_2023 = [
  // Nuances de liste (scrutin proportionnel)
  'LCOM', 'LDIV', 'LDLF', 'LDVC', 'LDVD', 'LDVG', 'LECO', 'LENS', 'LEXD', 'LFI',
  'LHOR', 'LLR', 'LMDM', 'LREG', 'LREM', 'LREN', 'LRN', 'LSOC', 'LUC', 'LUD',
  'LUDI', 'LUG', 'LVEC',
  // Nuances individuelles (scrutin majoritaire)
  'COM', 'DIV', 'DVC', 'DVD', 'DVG', 'ECO', 'FI', 'HOR', 'LR', 'MDM', 'RDG',
  'REG', 'REM', 'REN', 'RN', 'SOC', 'UDI', 'VEC',
];

describe('grille des nuances', () => {
  it('couvre tous les codes observés en 2020 et 2023', () => {
    const connus = new Set(codesNuancesConnus());
    const manquants = CODES_OBSERVES_2020_2023.filter(code => !connus.has(code));

    expect(manquants).toEqual([]);
  });

  it('couvre les deux éditions malgré le renommage REM → REN', () => {
    // La grille a changé entre 2020 et 2023 : garder les deux est la seule
    // façon de relire un ancien fichier sans perdre la nuance.
    expect(resoudreNuance('LREM')?.famille).toBe('centre');
    expect(resoudreNuance('LREN')?.famille).toBe('centre');
  });
});

describe('resoudreNuance', () => {
  it('résout un code connu', () => {
    expect(resoudreNuance('LDVD')).toEqual({
      code: 'LDVD',
      libelle: 'Liste divers droite',
      famille: 'droite',
    });
  });

  it('tolère la casse et les espaces du fichier', () => {
    expect(resoudreNuance(' ldvd ')?.code).toBe('LDVD');
  });

  it('rend null sur une nuance absente du fichier', () => {
    // 7 lignes de la feuille majoritaire 2023 n'ont pas de nuance.
    expect(resoudreNuance('')).toBeNull();
    expect(resoudreNuance(undefined)).toBeNull();
  });

  it('n’invente aucune famille pour un code inconnu', () => {
    // Le cas de 2026 : un code qui n'existait dans aucune édition précédente.
    // Il doit rester visible tel quel, sans être rangé d'office dans un bloc.
    const nuance = resoudreNuance('LXYZ');

    expect(nuance).toEqual({ code: 'LXYZ', libelle: 'LXYZ', famille: null });
    expect(nuanceInconnue('LXYZ')).toBe(true);
  });

  it('ne tranche pas les placements qui relèvent de l’arbitrage éditorial', () => {
    // Debout la France : son placement entre droite et extrême droite est
    // exactement ce que le débat public sur le nuançage conteste.
    expect(resoudreNuance('LDLF')?.famille).toBeNull();
    expect(resoudreNuance('LDLF')?.libelle).toBe('Liste Debout la France');
    // Mais le code reste connu : ce n'est pas un trou de la grille.
    expect(nuanceInconnue('LDLF')).toBe(false);
  });
});
