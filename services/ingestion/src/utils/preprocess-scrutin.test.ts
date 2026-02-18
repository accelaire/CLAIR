import { describe, it, expect } from 'vitest';
import { extractSubject, tokenize, preprocessTitle, jaccardSimilarity, FRENCH_STOPWORDS, DOMAIN_STOPWORDS } from './preprocess-scrutin';

describe('extractSubject', () => {
  it('should extract subject from proposition de loi', () => {
    const titre = "l'ensemble de la proposition de loi visant à la nationalisation d'ArcelorMittal France";
    const result = extractSubject(titre);
    // Should strip amendment/article prefix, law type, connecting phrase
    expect(result).not.toContain("l'ensemble de");
    expect(result).not.toContain('proposition de loi');
    expect(result.toLowerCase()).toContain('nationalisation');
    expect(result.toLowerCase()).toContain('arcelormittal');
  });

  it('should extract subject from projet de loi', () => {
    const titre = "l'article 3 de la projet de loi relatif à l'immigration et à l'intégration";
    const result = extractSubject(titre);
    expect(result).not.toContain('projet de loi');
    expect(result.toLowerCase()).toContain('immigration');
  });

  it('should strip amendment references', () => {
    const titre = "l'amendement n° 344 de Mme Roy à l'article premier de la proposition de loi visant à la nationalisation d'ArcelorMittal France (première lecture).";
    const result = extractSubject(titre);
    expect(result).not.toContain('amendement');
    expect(result).not.toContain('344');
    expect(result).not.toContain('Mme Roy');
    expect(result).not.toContain('première lecture');
    expect(result.toLowerCase()).toContain('nationalisation');
  });

  it('should handle motion de censure', () => {
    const result = extractSubject("la motion de censure déposée par le groupe LFI");
    expect(result).toBe('motion de censure');
  });

  it('should handle déclaration de politique générale', () => {
    const result = extractSubject("la déclaration de politique générale du Premier ministre");
    expect(result).toBe('declaration de politique generale');
  });

  it('should extract bill subject from motion de rejet préalable when anchor exists', () => {
    const result = extractSubject("la motion de rejet préalable au projet de loi finances");
    // Should fall through to normal pipeline and extract the bill subject, not "motion de rejet prealable"
    expect(result).not.toBe('motion de rejet prealable');
    expect(result.toLowerCase()).toContain('finances');
  });

  it('should extract bill subject from MRP with "déposée par" clause', () => {
    const result = extractSubject("la motion de rejet préalable, déposée par M. Dupont, du projet de loi relatif à la simplification de la vie économique");
    expect(result).not.toBe('motion de rejet prealable');
    expect(result.toLowerCase()).toContain('simplification');
    // extractSubject preserves accents; accent stripping happens in tokenize
    expect(result.toLowerCase()).toMatch(/[eé]conomique/);
  });

  it('should fallback to "motion de rejet prealable" when no bill anchor', () => {
    const result = extractSubject("la motion de rejet préalable déposée par le groupe LFI");
    expect(result).toBe('motion de rejet prealable');
  });

  it('should strip (première lecture) suffix', () => {
    const titre = "la proposition de loi relative au droit de grève (première lecture)";
    const result = extractSubject(titre);
    expect(result).not.toContain('première lecture');
    // extractSubject preserves accents; accent stripping happens in tokenize
    expect(result.toLowerCase()).toMatch(/gr[eè]ve/);
  });

  it('should strip (CMP) suffix', () => {
    const titre = "la proposition de loi relative au logement (CMP)";
    const result = extractSubject(titre);
    expect(result).not.toContain('CMP');
  });

  it('should strip "adoptée par le Sénat"', () => {
    const titre = "le projet de loi adoptée par le Sénat relatif à l'énergie";
    const result = extractSubject(titre);
    expect(result).not.toContain('adoptée par le Sénat');
    expect(result.toLowerCase()).toMatch(/[eé]nergie/);
  });

  it('should handle proposition de résolution', () => {
    const titre = "l'article unique de la proposition de résolution tendant à la création d'une commission d'enquête sur les effets psychologiques de TikTok sur les mineurs";
    const result = extractSubject(titre);
    expect(result).not.toContain("l'article unique");
    expect(result.toLowerCase()).toContain('tiktok');
  });

  it('should fallback to original when result too short', () => {
    const titre = "vote";
    const result = extractSubject(titre);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return empty string for empty input', () => {
    expect(extractSubject('')).toBe('');
  });

  it('should normalize unicode artifacts', () => {
    const titre = "proposition de loi relative \u00e0 l\u2019\u00e9conomie";
    const result = extractSubject(titre);
    expect(result).not.toContain('\u2019');
  });

  // --- Sénat format tests ---

  it('should strip Sénat "présenté par" blocks with multiple amendment numbers', () => {
    const titre = "sur les amendements identiques n° I-77 rectifié, présenté par M. Antoine Lefèvre et plusieurs de ses collègues, n° I-388 rectifié, présenté par M. Thierry Cozic et les membres du groupe Socialiste, Écologiste et Républicain, et n° I-1102 rectifié, présenté par Mme Ghislaine Senée et les membres du groupe Écologiste - Solidarité et Territoires, tendant à insérer un article additionnel après l'article 3 undecies du projet de loi de finances pour 2025";
    const result = extractSubject(titre);
    expect(result).not.toContain('Lefèvre');
    expect(result).not.toContain('Cozic');
    expect(result).not.toContain('Senée');
    expect(result.toLowerCase()).toContain('finances');
  });

  it('should strip Sénat motion with presenter', () => {
    const titre = "sur la motion n° 1, présentée par Mme Marianne Margaté et les membres du groupe Communiste Républicain Citoyen et Écologiste - Kanaky, tendant à opposer la question préalable au projet de loi finances pour 2025";
    const result = extractSubject(titre);
    expect(result).not.toContain('Margaté');
    expect(result.toLowerCase()).toContain('finances');
  });

  it('should handle Sénat "article X constituant l\'ensemble"', () => {
    const titre = "sur l'article 12 constituant l'ensemble de la proposition de loi constitutionnelle visant à accélérer le redressement des finances publiques";
    const result = extractSubject(titre);
    expect(result).not.toContain("l'article 12");
    expect(result.toLowerCase()).toContain('finances publiques');
  });

  it('should handle Sénat CMP format', () => {
    const titre = "sur l'ensemble du texte élaboré par la commission mixte paritaire sur la proposition de loi visant à aménager le code de la justice pénale des mineurs";
    const result = extractSubject(titre);
    expect(result).not.toContain('commission mixte');
    expect(result.toLowerCase()).toContain('justice');
    expect(result.toLowerCase()).toContain('mineurs');
  });
});

describe('tokenize', () => {
  it('should lowercase and split on non-alpha', () => {
    const tokens = tokenize("Hello World 123 test");
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('123');
    expect(tokens).toContain('test');
  });

  it('should filter stopwords', () => {
    const tokens = tokenize("la proposition de loi relative");
    // la, de, are french stopwords; proposition, loi, relative are domain stopwords
    expect(tokens.length).toBe(0);
  });

  it('should keep meaningful tokens', () => {
    const tokens = tokenize("nationalisation ArcelorMittal France souveraineté industrielle");
    expect(tokens).toContain('nationalisation');
    expect(tokens).toContain('arcelormittal');
    expect(tokens).toContain('souverainete');
    expect(tokens).toContain('industrielle');
  });

  it('should strip accents', () => {
    const tokens = tokenize("économie énergie sécurité");
    expect(tokens).toContain('economie');
    expect(tokens).toContain('energie');
    expect(tokens).toContain('securite');
  });

  it('should filter tokens of length 1', () => {
    const tokens = tokenize("a b c de test");
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).not.toContain('c');
  });
});

describe('preprocessTitle', () => {
  it('should produce a space-separated token string', () => {
    const result = preprocessTitle("la proposition de loi visant à la nationalisation d'ArcelorMittal France afin de préserver la souveraineté industrielle de la France");
    expect(result).toContain('nationalisation');
    expect(result).toContain('arcelormittal');
    // Should not contain stopwords
    expect(result.split(' ').every(t => !FRENCH_STOPWORDS.has(t))).toBe(true);
    expect(result.split(' ').every(t => !DOMAIN_STOPWORDS.has(t))).toBe(true);
  });

  it('should produce matching tokens for scrutin and dossier about same subject', () => {
    const scrutin = preprocessTitle("l'amendement n° 42 à l'article 3 du projet de loi relatif à l'immigration et à l'intégration (première lecture)");
    const dossier = preprocessTitle("Immigration et intégration");
    // Both should share key tokens
    const scrutinTokens = new Set(scrutin.split(' '));
    const dossierTokens = new Set(dossier.split(' '));
    const intersection = [...dossierTokens].filter(t => scrutinTokens.has(t));
    expect(intersection.length).toBeGreaterThan(0);
    expect(intersection).toContain('immigration');
  });
});

describe('jaccardSimilarity', () => {
  it('should return 1 for identical sets', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('should return 0 for disjoint sets', () => {
    expect(jaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('should return correct value for partial overlap', () => {
    // {a, b, c} ∩ {b, c, d} = {b, c}, union = {a, b, c, d} → 2/4 = 0.5
    expect(jaccardSimilarity(['a', 'b', 'c'], ['b', 'c', 'd'])).toBe(0.5);
  });

  it('should return 0 for two empty sets', () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  it('should return 0 when one set is empty', () => {
    expect(jaccardSimilarity(['a', 'b'], [])).toBe(0);
    expect(jaccardSimilarity([], ['a', 'b'])).toBe(0);
  });

  it('should handle duplicate tokens (treated as set)', () => {
    // Duplicates in input are collapsed: {a, b} ∩ {a, b} = {a, b} → 1.0
    expect(jaccardSimilarity(['a', 'a', 'b'], ['a', 'b', 'b'])).toBe(1);
  });

  it('should reject false positive: "simplification vie économique" vs "énergie" dossier', () => {
    const scrutinTokens = tokenize(extractSubject(
      "la motion de rejet préalable, déposée par M. Dupont, du projet de loi relatif à la simplification de la vie économique"
    ));
    const dossierTokens = tokenize(extractSubject(
      "Projet de loi relatif à la souveraineté énergétique"
    ));
    const jaccard = jaccardSimilarity(scrutinTokens, dossierTokens);
    expect(jaccard).toBeLessThan(0.30);
  });
});

describe('stopwords', () => {
  it('should have FRENCH_STOPWORDS loaded', () => {
    expect(FRENCH_STOPWORDS.size).toBeGreaterThan(100);
    expect(FRENCH_STOPWORDS.has('le')).toBe(true);
    expect(FRENCH_STOPWORDS.has('de')).toBe(true);
  });

  it('should have DOMAIN_STOPWORDS loaded', () => {
    expect(DOMAIN_STOPWORDS.size).toBeGreaterThan(20);
    expect(DOMAIN_STOPWORDS.has('amendement')).toBe(true);
    expect(DOMAIN_STOPWORDS.has('scrutin')).toBe(true);
  });
});
