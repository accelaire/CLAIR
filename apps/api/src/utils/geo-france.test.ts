// =============================================================================
// Tests unitaires - Données géographiques françaises
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  REGIONS,
  DEPARTEMENTS,
  findDepartementCodesBySearchTerm,
  isGeographicSearch,
} from './geo-france';

describe('Données géographiques', () => {
  describe('REGIONS', () => {
    it('devrait contenir toutes les régions métropolitaines', () => {
      const regionsMetro = REGIONS.filter(
        (r) => !['GUA', 'MTQ', 'GUF', 'REU', 'MAY', 'COM', 'ETR'].includes(r.code)
      );
      expect(regionsMetro.length).toBe(13);
    });

    it('devrait contenir les régions outre-mer', () => {
      const regionsOM = REGIONS.filter((r) =>
        ['GUA', 'MTQ', 'GUF', 'REU', 'MAY'].includes(r.code)
      );
      expect(regionsOM.length).toBe(5);
    });

    it("chaque région devrait avoir des départements valides", () => {
      const allDeptCodes = DEPARTEMENTS.map((d) => d.code);

      for (const region of REGIONS) {
        for (const deptCode of region.departements) {
          expect(allDeptCodes).toContain(deptCode);
        }
      }
    });
  });

  describe('DEPARTEMENTS', () => {
    it('devrait contenir les 101 départements + collectivités', () => {
      // 96 métropole + 5 DROM + 6 COM + 2 Français étranger = 109
      expect(DEPARTEMENTS.length).toBeGreaterThanOrEqual(101);
    });

    it('devrait avoir Paris avec le code 75', () => {
      const paris = DEPARTEMENTS.find((d) => d.code === '75');
      expect(paris).toBeDefined();
      expect(paris?.nom).toBe('Paris');
      expect(paris?.region).toBe('IDF');
    });

    it('devrait avoir la Corse avec 2A et 2B', () => {
      const corseSud = DEPARTEMENTS.find((d) => d.code === '2A');
      const hauteCorse = DEPARTEMENTS.find((d) => d.code === '2B');

      expect(corseSud).toBeDefined();
      expect(corseSud?.nom).toBe('Corse-du-Sud');
      expect(hauteCorse).toBeDefined();
      expect(hauteCorse?.nom).toBe('Haute-Corse');
    });

    it('devrait avoir les départements outre-mer', () => {
      const domCodes = ['971', '972', '973', '974', '976'];

      for (const code of domCodes) {
        const dept = DEPARTEMENTS.find((d) => d.code === code);
        expect(dept).toBeDefined();
      }
    });
  });
});

describe('findDepartementCodesBySearchTerm', () => {
  describe('Recherche par nom de département', () => {
    it('devrait trouver Paris', () => {
      const results = findDepartementCodesBySearchTerm('paris');
      expect(results).toContain('75');
    });

    it('devrait trouver le Rhône', () => {
      const results = findDepartementCodesBySearchTerm('rhone');
      expect(results).toContain('69');
    });

    it('devrait trouver avec accents', () => {
      const results = findDepartementCodesBySearchTerm('Rhône');
      expect(results).toContain('69');
    });

    it('devrait trouver les Bouches-du-Rhône', () => {
      const results = findDepartementCodesBySearchTerm('bouches');
      expect(results).toContain('13');
    });

    it('devrait trouver la Haute-Garonne', () => {
      const results = findDepartementCodesBySearchTerm('haute-garonne');
      expect(results).toContain('31');
    });
  });

  describe('Recherche par code département', () => {
    it('devrait trouver par code exact', () => {
      const results = findDepartementCodesBySearchTerm('75');
      expect(results).toContain('75');
    });

    it('devrait trouver par code sans zéro initial', () => {
      const results = findDepartementCodesBySearchTerm('1');
      expect(results).toContain('01');
    });

    it('devrait trouver par code avec zéro initial', () => {
      const results = findDepartementCodesBySearchTerm('01');
      expect(results).toContain('01');
    });

    it('devrait trouver les codes corses', () => {
      expect(findDepartementCodesBySearchTerm('2A')).toContain('2A');
      expect(findDepartementCodesBySearchTerm('2B')).toContain('2B');
    });
  });

  describe('Recherche par région', () => {
    it('devrait trouver tous les départements de Bretagne', () => {
      const results = findDepartementCodesBySearchTerm('bretagne');

      expect(results).toContain('22'); // Côtes-d'Armor
      expect(results).toContain('29'); // Finistère
      expect(results).toContain('35'); // Ille-et-Vilaine
      expect(results).toContain('56'); // Morbihan
      expect(results.length).toBe(4);
    });

    it("devrait trouver tous les départements d'Île-de-France", () => {
      const results = findDepartementCodesBySearchTerm('ile-de-france');

      expect(results).toContain('75'); // Paris
      expect(results).toContain('92'); // Hauts-de-Seine
      expect(results).toContain('93'); // Seine-Saint-Denis
      expect(results.length).toBe(8);
    });

    it('devrait trouver Provence-Alpes-Côte d\'Azur', () => {
      const results = findDepartementCodesBySearchTerm('provence');

      expect(results).toContain('13'); // Bouches-du-Rhône
      expect(results).toContain('06'); // Alpes-Maritimes
      expect(results).toContain('83'); // Var
    });

    it('devrait trouver avec recherche partielle de région', () => {
      const results = findDepartementCodesBySearchTerm('auvergne');

      expect(results).toContain('63'); // Puy-de-Dôme
      expect(results).toContain('69'); // Rhône
      expect(results.length).toBe(12); // Tous les départements ARA
    });
  });

  describe('Cas limites', () => {
    it('devrait retourner un tableau vide pour une recherche invalide', () => {
      const results = findDepartementCodesBySearchTerm('xyz123');
      expect(results).toEqual([]);
    });

    it('devrait être insensible à la casse', () => {
      const lower = findDepartementCodesBySearchTerm('paris');
      const upper = findDepartementCodesBySearchTerm('PARIS');
      const mixed = findDepartementCodesBySearchTerm('PaRiS');

      expect(lower).toEqual(upper);
      expect(upper).toEqual(mixed);
    });

    it('devrait être insensible aux accents', () => {
      const withAccent = findDepartementCodesBySearchTerm('Réunion');
      const withoutAccent = findDepartementCodesBySearchTerm('Reunion');

      expect(withAccent).toEqual(withoutAccent);
      expect(withAccent).toContain('974');
    });
  });
});

describe('isGeographicSearch', () => {
  it('devrait retourner true pour un nom de département', () => {
    expect(isGeographicSearch('paris')).toBe(true);
    expect(isGeographicSearch('gironde')).toBe(true);
  });

  it('devrait retourner true pour un code département', () => {
    expect(isGeographicSearch('75')).toBe(true);
    expect(isGeographicSearch('33')).toBe(true);
  });

  it('devrait retourner true pour une région', () => {
    expect(isGeographicSearch('bretagne')).toBe(true);
    expect(isGeographicSearch('occitanie')).toBe(true);
  });

  it('devrait retourner false pour un terme non géographique', () => {
    expect(isGeographicSearch('dupont')).toBe(false);
    expect(isGeographicSearch('macron')).toBe(false);
    expect(isGeographicSearch('renaissance')).toBe(false);
  });
});
