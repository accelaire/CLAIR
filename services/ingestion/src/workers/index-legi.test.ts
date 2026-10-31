import { describe, it, expect } from 'vitest';
import { articleRetenu, texteRetenu, FIN_DE_VIGUEUR_MIN } from './index-legi';
import type { ArticleLegi, VersionTexteLegi } from '../sources/dila/legi-client';

const article = (a: Partial<ArticleLegi>): ArticleLegi => ({
  id: 'LEGIARTI000006417695',
  cid: 'LEGITEXT000006070719',
  natureTexte: 'CODE',
  num: '222-33',
  etat: 'VIGUEUR',
  dateDebut: '2018-08-06',
  dateFin: '2999-01-01',
  ...a,
});

describe('articles gardés dans l’index', () => {
  it('garde un article de code, de loi ou de la Déclaration de 1789 en vigueur depuis 2017', () => {
    expect(articleRetenu(article({}))).toBe(true);
    expect(articleRetenu(article({ natureTexte: 'LOI', cid: 'JORFTEXT000033418805' }))).toBe(true);
    expect(articleRetenu(article({ natureTexte: 'DECLARATION' }))).toBe(true);
  });

  it('écarte les arrêtés et les circulaires, cités au texte et non à l’article', () => {
    expect(articleRetenu(article({ natureTexte: 'ARRETE' }))).toBe(false);
    expect(articleRetenu(article({ natureTexte: 'CIRCULAIRE' }))).toBe(false);
  });

  it('écarte une version sortie de vigueur avant le premier amendement en base', () => {
    expect(articleRetenu(article({ dateFin: '2016-12-31' }))).toBe(false);
    expect(articleRetenu(article({ dateFin: FIN_DE_VIGUEUR_MIN }))).toBe(true);
    // Fin inconnue, ou nature que l'article ne donne pas : gardé.
    expect(articleRetenu(article({ dateFin: null }))).toBe(true);
    expect(articleRetenu(article({ natureTexte: null }))).toBe(true);
  });
});

describe('titres gardés dans l’index', () => {
  const texte = (nature: string): VersionTexteLegi => ({
    id: 'LEGITEXT000006060968', cid: 'JORFTEXT000000521765', nature, num: null,
    dateTexte: null, dateDebut: null, dateFin: null, etat: null, titre: 'Titre',
  });

  it('garde les textes que l’on cite comme du droit, arrêtés compris', () => {
    for (const n of ['CODE', 'LOI', 'ORDONNANCE', 'DECRET', 'ARRETE', 'CONSTITUTION', 'DECLARATION']) {
      expect(texteRetenu(texte(n))).toBe(true);
    }
    expect(texteRetenu(texte('AVIS'))).toBe(false);
    expect(texteRetenu(texte('DELIBERATION'))).toBe(false);
  });
});
