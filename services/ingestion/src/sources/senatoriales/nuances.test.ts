import { describe, it, expect } from 'vitest';

import { codesNuancesConnus, nuanceInconnue, resoudreNuance } from './nuances.js';

/**
 * Les codes relevés dans les fichiers de candidatures des sénatoriales 2020,
 * 2023 et 2026, extraits des fichiers du ministère.
 *
 * Il vaut pour la prochaine édition : si un code manque,
 * il ne doit pas être deviné, il doit apparaître ici.
 */
const CODES_OBSERVES = [
  // Nuances de liste (scrutin proportionnel)
  'LCOM', 'LDIV', 'LDLF', 'LDVC', 'LDVD', 'LDVG', 'LECO', 'LENS', 'LEXD', 'LFI',
  'LHOR', 'LLR', 'LMDM', 'LREG', 'LREM', 'LREN', 'LRN', 'LSOC', 'LUC', 'LUD',
  'LUDI', 'LUG', 'LVEC',
  // Nuances individuelles (scrutin majoritaire)
  'COM', 'DIV', 'DVC', 'DVD', 'DVG', 'ECO', 'FI', 'HOR', 'LR', 'MDM', 'RDG',
  'REG', 'REM', 'REN', 'RN', 'SOC', 'UDI', 'VEC',
  // Apparues en 2026
  'LREC', 'LUDR', 'LUXD', 'REC', 'UDR', 'DSV', 'GEN', 'PR',
];

describe('grille des nuances', () => {
  it('couvre tous les codes observés en 2020, 2023 et 2026', () => {
    const connus = new Set(codesNuancesConnus());
    const manquants = CODES_OBSERVES.filter(code => !connus.has(code));

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

  it('nomme l’hésitation plutôt que de trancher ou de laisser un blanc', () => {
    // Debout la France, Droite souverainiste et l'Union des droites : leur
    // placement entre droite et extrême droite est exactement ce que le débat
    // public sur le nuançage conteste. Une famille qui le dit vaut mieux qu'un
    // vide que le lecteur ne peut pas interpréter.
    for (const code of ['LDLF', 'DLF', 'DSV', 'UDR', 'LUDR']) {
      expect(resoudreNuance(code)?.famille).toBe('droite_ou_extreme_droite');
      expect(nuanceInconnue(code)).toBe(false);
    }
  });

  it('classe en revanche les nuances que le ministère place lui-même', () => {
    // « Liste d'union à l'extrême-droite » : le libellé de la source tranche,
    // il n'y a rien à arbitrer.
    expect(resoudreNuance('LUXD')?.famille).toBe('extreme_droite');
    expect(resoudreNuance('LREC')?.famille).toBe('extreme_droite');
  });
});
