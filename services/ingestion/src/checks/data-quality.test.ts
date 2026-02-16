// =============================================================================
// Tests — Data Quality Checks
// =============================================================================

import { describe, it, expect } from 'vitest';
import { THRESHOLDS, extractAmendmentNumbers, normalizeNumero, runDataQualityChecks } from './data-quality';

// =============================================================================
// Layer A — Unit tests (toujours, sans DB)
// =============================================================================

describe('THRESHOLDS Configuration', () => {
  const entries = Object.entries(THRESHOLDS);

  it('devrait avoir au moins 15 checks définis', () => {
    expect(entries.length).toBeGreaterThanOrEqual(15);
  });

  it('chaque check devrait avoir un type valide', () => {
    for (const [key, config] of entries) {
      expect(['invariant', 'threshold']).toContain(config.type);
    }
  });

  it('chaque check devrait avoir un label non-vide', () => {
    for (const [key, config] of entries) {
      expect(config.label).toBeTruthy();
      expect(config.label.length).toBeGreaterThan(0);
    }
  });

  it('chaque check devrait avoir une query non-vide', () => {
    for (const [key, config] of entries) {
      expect(config.query).toBeTruthy();
      expect(config.query.length).toBeGreaterThan(0);
    }
  });

  it('toutes les queries devraient commencer par SELECT', () => {
    for (const [key, config] of entries) {
      expect(config.query.trimStart().toUpperCase()).toMatch(/^SELECT/);
    }
  });

  it('les invariants devraient avoir min=0 et max=0', () => {
    const invariants = entries.filter(([, c]) => c.type === 'invariant');
    expect(invariants.length).toBeGreaterThan(0);

    for (const [key, config] of invariants) {
      expect(config.min).toBe(0);
      expect(config.max).toBe(0);
    }
  });

  it('les thresholds devraient avoir min > 0', () => {
    const thresholds = entries.filter(([, c]) => c.type === 'threshold');
    expect(thresholds.length).toBeGreaterThan(0);

    for (const [key, config] of thresholds) {
      expect(config.min).toBeGreaterThan(0);
    }
  });

  it('devrait couvrir les invariants critiques', () => {
    const keys = Object.keys(THRESHOLDS);
    expect(keys).toContain('orphan_votes');
    expect(keys).toContain('scrutins_without_votes');
    expect(keys).toContain('duplicate_scrutins');
    expect(keys).toContain('duplicate_amendements');
    expect(keys).toContain('parlementaires_without_groupe');
  });

  it('devrait couvrir les seuils quantitatifs principaux', () => {
    const keys = Object.keys(THRESHOLDS);
    expect(keys).toContain('parlementaires_count');
    expect(keys).toContain('scrutins_count');
    expect(keys).toContain('votes_count');
    expect(keys).toContain('amendements_count');
    expect(keys).toContain('lobbyistes_count');
    expect(keys).toContain('dossiers_count');
  });

  it('toutes les queries devraient retourner un champ "value"', () => {
    for (const [key, config] of entries) {
      expect(config.query.toLowerCase()).toContain('as value');
    }
  });
});

describe('extractAmendmentNumbers', () => {
  it('devrait extraire un numéro simple', () => {
    expect(extractAmendmentNumbers("sur l'amendement n° 198, présenté par M. X"))
      .toEqual(['198']);
  });

  it('devrait extraire un numéro avec préfixe', () => {
    expect(extractAmendmentNumbers('n° I-77 rectifié'))
      .toEqual(['I-77']);
  });

  it('devrait extraire plusieurs numéros identiques', () => {
    const titre = 'sur les amendements identiques n° I-77 rectifié, présenté par M. X, n° I-444 rectifié bis, présenté par M. Y, et n° I-935, présenté par M. Z';
    const result = extractAmendmentNumbers(titre);
    expect(result).toEqual(['I-77', 'I-444', 'I-935']);
  });

  it('devrait gérer les numéros sans préfixe', () => {
    const titre = 'sur les amendements identiques n° 198, présenté par M. X, n° 215 rectifié bis, présenté par M. Y';
    expect(extractAmendmentNumbers(titre)).toEqual(['198', '215']);
  });

  it('devrait retourner un tableau vide si aucun numéro', () => {
    expect(extractAmendmentNumbers('un titre sans numéro')).toEqual([]);
  });

  it('devrait gérer un titre réel complet du Sénat', () => {
    const titre = 'sur les amendements identiques n° I-77 rectifié, présenté par M. Antoine Lefèvre et plusieurs de ses collègues, n° I-444 rectifié bis, présenté par M. Philippe Grosvalet et plusieurs de ses collègues, n° I-593 rectifié, présenté par MM. Pierre-Jean Verzelen et Vincent Louault, n° I-626 rectifié bis, présenté par Mme Brigitte Devésa et plusieurs de ses collègues, n° I-717 rectifié bis, présenté par M. Pascal Savoldelli, n° I-935, présenté par M. Thierry Cozic, n° I-1188 rectifié, présenté par Mme Ghislaine Senée, n° I-1216 rectifié ter, présenté par Mme Annick Jacquemet, et n° I-1586 rectifié, présenté par M. Arnaud Bazin';
    const result = extractAmendmentNumbers(titre);
    expect(result).toEqual(['I-77', 'I-444', 'I-593', 'I-626', 'I-717', 'I-935', 'I-1188', 'I-1216', 'I-1586']);
  });
});

describe('normalizeNumero', () => {
  it('devrait strip le suffixe (Rect)', () => {
    expect(normalizeNumero('2816 (Rect)')).toBe('2816');
  });

  it('devrait strip le suffixe (2ème Rect)', () => {
    expect(normalizeNumero('10 (2ème Rect)')).toBe('10');
  });

  it('devrait laisser intact un numero simple', () => {
    expect(normalizeNumero('198')).toBe('198');
  });

  it('devrait laisser intact un numero avec préfixe Sénat', () => {
    expect(normalizeNumero('I-77')).toBe('I-77');
  });
});

// =============================================================================
// Layer B — Tests d'intégration (conditionnels, nécessitent DB)
// =============================================================================

describe('Data Quality Checks (intégration)', () => {
  const canConnect = !!process.env.DATABASE_URL;

  it.skipIf(!canConnect)('devrait retourner un QualityReport valide', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const report = await runDataQualityChecks(prisma);

      expect(report).toBeDefined();
      expect(report.results).toBeInstanceOf(Array);
      expect(report.results.length).toBeGreaterThanOrEqual(15);
      expect(typeof report.passed).toBe('boolean');
      expect(typeof report.invariantsPassed).toBe('boolean');
      expect(typeof report.thresholdsPassed).toBe('boolean');
      expect(typeof report.duration).toBe('string');

      // Multi-amendment report
      expect(report.multiAmendment).toBeDefined();
      expect(typeof report.multiAmendment.total).toBe('number');
      expect(typeof report.multiAmendment.correct).toBe('number');
      expect(typeof report.multiAmendment.incorrect).toBe('number');
      expect(report.multiAmendment.mismatches).toBeInstanceOf(Array);
      expect(typeof report.multiAmendment.byChambre).toBe('object');

      for (const r of report.results) {
        expect(r.key).toBeTruthy();
        expect(r.label).toBeTruthy();
        expect(['invariant', 'threshold']).toContain(r.type);
        expect(typeof r.actual).toBe('number');
        expect(typeof r.passed).toBe('boolean');
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);

  it.skipIf(!canConnect)('les invariants devraient passer sur la DB locale', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const report = await runDataQualityChecks(prisma);
      const failedInvariants = report.results.filter(
        (r) => r.type === 'invariant' && !r.passed,
      );

      if (failedInvariants.length > 0) {
        console.warn(
          'Invariants en échec:',
          failedInvariants.map((r) => `${r.key}: ${r.actual}`),
        );
      }

      expect(report.invariantsPassed).toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);
});
