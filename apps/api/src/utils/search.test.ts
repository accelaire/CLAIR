// =============================================================================
// Tests unitaires - Utilitaires de recherche
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  buildParlementaireSearchCondition,
  buildTextSearchCondition,
  buildMultiFieldSearchCondition,
} from './search';

describe('buildParlementaireSearchCondition', () => {
  describe('Recherche simple (un mot)', () => {
    it('devrait créer une condition OR pour un seul mot', () => {
      const result = buildParlementaireSearchCondition('dupont');

      expect(result).toHaveProperty('OR');
      expect(result.OR).toBeInstanceOf(Array);
      expect(result.OR.length).toBeGreaterThan(0);
    });

    it('devrait chercher dans nom, prénom, slug et circonscription', () => {
      const result = buildParlementaireSearchCondition('dupont');

      const hasNomCondition = result.OR.some(
        (c: any) => c.nom?.contains === 'dupont'
      );
      const hasPrenomCondition = result.OR.some(
        (c: any) => c.prenom?.contains === 'dupont'
      );
      const hasSlugCondition = result.OR.some(
        (c: any) => c.slug?.contains === 'dupont'
      );
      const hasCirconscriptionCondition = result.OR.some(
        (c: any) => c.circonscription?.nom?.contains === 'dupont'
      );

      expect(hasNomCondition).toBe(true);
      expect(hasPrenomCondition).toBe(true);
      expect(hasSlugCondition).toBe(true);
      expect(hasCirconscriptionCondition).toBe(true);
    });

    it('devrait être insensible à la casse', () => {
      const result = buildParlementaireSearchCondition('Dupont');

      const nomCondition = result.OR.find((c: any) => c.nom?.contains);
      expect(nomCondition.nom.mode).toBe('insensitive');
    });

    it('devrait trimmer les espaces', () => {
      const result = buildParlementaireSearchCondition('  dupont  ');

      const nomCondition = result.OR.find((c: any) => c.nom?.contains);
      expect(nomCondition.nom.contains).toBe('dupont');
    });
  });

  describe('Recherche multi-mots', () => {
    it('devrait créer des combinaisons prénom/nom pour deux mots', () => {
      const result = buildParlementaireSearchCondition('jean dupont');

      // Devrait avoir des combinaisons AND pour prénom + nom
      const hasAndConditions = result.OR.some(
        (c: any) => c.AND && Array.isArray(c.AND)
      );
      expect(hasAndConditions).toBe(true);
    });

    it('devrait gérer "Marine Le Pen" correctement', () => {
      const result = buildParlementaireSearchCondition('Marine Le Pen');

      // Devrait avoir plusieurs combinaisons possibles
      expect(result.OR.length).toBeGreaterThan(3);

      // Devrait inclure la recherche dans le slug
      const hasSlugSearch = result.OR.some(
        (c: any) => c.slug?.contains === 'marine-le-pen'
      );
      expect(hasSlugSearch).toBe(true);
    });

    it('devrait inclure la recherche inversée (nom prénom)', () => {
      const result = buildParlementaireSearchCondition('dupont jean');

      // Chercher une condition où nom=dupont et prenom=jean
      const hasInverseCondition = result.OR.some(
        (c: any) =>
          c.AND &&
          c.AND.some((a: any) => a.nom?.contains === 'dupont') &&
          c.AND.some((a: any) => a.prenom?.contains === 'jean')
      );
      expect(hasInverseCondition).toBe(true);
    });

    it('devrait inclure un fallback avec tous les mots', () => {
      const result = buildParlementaireSearchCondition('jean claude dupont');

      // Devrait avoir une condition qui vérifie chaque mot individuellement
      const hasFallback = result.OR.some(
        (c: any) =>
          c.AND &&
          c.AND.every((a: any) => a.OR) // Chaque mot cherché dans nom OU prénom
      );
      expect(hasFallback).toBe(true);
    });
  });

  describe('Recherche géographique', () => {
    it('devrait ajouter une condition géographique pour Paris', () => {
      const result = buildParlementaireSearchCondition('paris');

      const hasGeoCondition = result.OR.some(
        (c: any) =>
          c.circonscription?.departement?.in &&
          c.circonscription.departement.in.includes('75')
      );
      expect(hasGeoCondition).toBe(true);
    });

    it('devrait ajouter les départements de Bretagne', () => {
      const result = buildParlementaireSearchCondition('bretagne');

      const geoCondition = result.OR.find(
        (c: any) => c.circonscription?.departement?.in
      );
      expect(geoCondition).toBeDefined();
      expect(geoCondition.circonscription.departement.in).toContain('22');
      expect(geoCondition.circonscription.departement.in).toContain('29');
      expect(geoCondition.circonscription.departement.in).toContain('35');
      expect(geoCondition.circonscription.departement.in).toContain('56');
    });

    it('devrait ne pas ajouter de condition géo pour un nom propre', () => {
      const result = buildParlementaireSearchCondition('melenchon');

      const hasGeoCondition = result.OR.some(
        (c: any) => c.circonscription?.departement?.in
      );
      expect(hasGeoCondition).toBe(false);
    });
  });
});

describe('buildTextSearchCondition', () => {
  describe('Recherche simple', () => {
    it('devrait créer une condition contains pour un mot', () => {
      const result = buildTextSearchCondition('titre', 'budget');

      expect(result).toEqual({
        titre: { contains: 'budget', mode: 'insensitive' },
      });
    });

    it('devrait être insensible à la casse', () => {
      const result = buildTextSearchCondition('titre', 'Budget');

      expect(result.titre.contains).toBe('budget');
      expect(result.titre.mode).toBe('insensitive');
    });
  });

  describe('Recherche multi-mots', () => {
    it('devrait créer une condition AND pour plusieurs mots', () => {
      const result = buildTextSearchCondition('titre', 'loi finances');

      expect(result).toHaveProperty('AND');
      expect(result.AND).toHaveLength(2);
    });

    it('devrait vérifier que chaque mot est présent', () => {
      const result = buildTextSearchCondition('description', 'projet loi budget');

      expect(result.AND).toHaveLength(3);
      expect(result.AND[0]).toEqual({
        description: { contains: 'projet', mode: 'insensitive' },
      });
      expect(result.AND[1]).toEqual({
        description: { contains: 'loi', mode: 'insensitive' },
      });
      expect(result.AND[2]).toEqual({
        description: { contains: 'budget', mode: 'insensitive' },
      });
    });
  });
});

describe('buildMultiFieldSearchCondition', () => {
  describe('Recherche simple multi-champs', () => {
    it('devrait créer une condition OR sur tous les champs', () => {
      const result = buildMultiFieldSearchCondition(['titre', 'description'], 'budget');

      expect(result).toHaveProperty('OR');
      expect(result.OR).toHaveLength(2);
      expect(result.OR[0]).toEqual({
        titre: { contains: 'budget', mode: 'insensitive' },
      });
      expect(result.OR[1]).toEqual({
        description: { contains: 'budget', mode: 'insensitive' },
      });
    });
  });

  describe('Recherche multi-mots multi-champs', () => {
    it('devrait créer des combinaisons complexes', () => {
      const result = buildMultiFieldSearchCondition(
        ['titre', 'description'],
        'loi finances'
      );

      expect(result).toHaveProperty('OR');
      // Option 1: tous les mots dans 'titre' (AND)
      // Option 2: tous les mots dans 'description' (AND)
      // Option 3: chaque mot dans au moins un champ
      expect(result.OR.length).toBe(3);
    });

    it("devrait permettre que chaque mot soit dans n'importe quel champ", () => {
      const result = buildMultiFieldSearchCondition(
        ['titre', 'description'],
        'loi finances'
      );

      // La dernière condition devrait être le fallback flexible
      const flexibleCondition = result.OR[2];
      expect(flexibleCondition).toHaveProperty('AND');

      // Chaque mot peut être dans titre OU description
      flexibleCondition.AND.forEach((wordCondition: any) => {
        expect(wordCondition).toHaveProperty('OR');
        expect(wordCondition.OR).toHaveLength(2);
      });
    });
  });

  describe('Avec trois champs ou plus', () => {
    it('devrait fonctionner avec plusieurs champs', () => {
      const result = buildMultiFieldSearchCondition(
        ['titre', 'description', 'resume'],
        'test'
      );

      expect(result.OR).toHaveLength(3);
    });
  });
});
