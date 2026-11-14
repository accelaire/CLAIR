import { describe, expect, it } from 'vitest';
import { cleIntitule, domaineDuPortefeuille, indexDomaines, DOMAINES } from './domaines-ministeriels';

describe('domaineDuPortefeuille', () => {
  it('range un portefeuille selon le premier thème nommé', () => {
    expect(domaineDuPortefeuille('Travail, santé et solidarités', '')).toBe('travail');
    expect(domaineDuPortefeuille('Ville, jeunesse et sports', '')).toBe('territoires');
    expect(domaineDuPortefeuille('Économie, finances et commerce extérieur', '')).toBe('economie');
    expect(domaineDuPortefeuille('Commerce extérieur et attractivité', '')).toBe('international');
  });

  it('fait des deux ministères « sociaux » de la Santé une exception à cette règle', () => {
    expect(domaineDuPortefeuille('Affaires sociales et santé', '')).toBe('sante');
    expect(domaineDuPortefeuille('Solidarités et santé', '')).toBe('sante');
  });

  it('compare les intitulés normalisés, sans la précision finale de la source', () => {
    // Variantes réelles de l'AMO30 : casse, accent, apostrophe, tiret, précision.
    expect(domaineDuPortefeuille('éducation nationale', '')).toBe('education');
    expect(domaineDuPortefeuille("Réforme de l'Etat et simplification", '')).toBe('institutions');
    expect(domaineDuPortefeuille('Égalité femmes hommes et lutte contre les discriminations', '')).toBe('solidarites');
    expect(domaineDuPortefeuille('Commerce, artisanat, pme,tourisme, services et consommation', '')).toBe('economie');
    expect(domaineDuPortefeuille('Solidarités et santé (M. Taquet)', '')).toBe('sante');
    expect(domaineDuPortefeuille('Fonction publique (II)', '')).toBe('institutions');
    expect(cleIntitule('affaires étrangères (et européennes)')).toBe(cleIntitule('Affaires étrangères'));
  });

  it('se rabat sur l’intitulé long sans intitulé court, et rend null pour un intitulé inconnu', () => {
    expect(domaineDuPortefeuille(null, 'Outre-mer')).toBe('outre-mer');
    expect(domaineDuPortefeuille('Ministère du temps libre', '')).toBeNull();
  });
});

describe('indexDomaines', () => {
  it('refuse un intitulé rangé dans deux domaines', () => {
    expect(() => indexDomaines({ economie: ['Industrie'], ecologie: ['industrie (II)'] })).toThrow(/industrie \(II\) » rangé en economie et en ecologie/);
  });

  it('donne à chaque domaine une clé unique', () => {
    expect(new Set(DOMAINES.map((d) => d.cle)).size).toBe(DOMAINES.length);
  });
});
