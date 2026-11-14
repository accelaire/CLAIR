import { describe, expect, it } from 'vitest';
import { nettoyerTexteAmendement, segmenterTexteAmendement, type RenvoiDispositif } from './texte-amendement';

const renvoi = (debut: number, fin: number): RenvoiDispositif => ({
  debut, fin, type: 'article', article: 'LEGIARTI000051218352', texte: 'LEGITEXT000006073189', nature: 'CODE',
  url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051218352',
});

describe('nettoyerTexteAmendement', () => {
  it('retire les balises, échappées ou non, et décode les entités publiées', () => {
    expect(nettoyerTexteAmendement('du titre&nbsp;I< sup>er< /sup> du livre')).toBe('du titre Ier du livre');
    expect(nettoyerTexteAmendement('<p>a &amp; b</p>\r\nc')).toBe('a & b\nc');
  });

  it('ne prend pas une comparaison pour une balise', () => {
    expect(nettoyerTexteAmendement('si x < 3 et y > 2')).toBe('si x < 3 et y > 2');
  });

  it('ne laisse passer aucun HTML exécutable : le rendu est du texte', () => {
    expect(nettoyerTexteAmendement('<img src=x onerror=alert(1)>texte')).toBe('texte');
  });
});

describe('segmenterTexteAmendement', () => {
  const texte = '  L’article L. 242‑1 du code de la sécurité sociale est modifié.\n';

  it('sans renvoi : un seul passage, nettoyé et sans blancs aux bords', () => {
    expect(segmenterTexteAmendement(texte)).toEqual([{ texte: texte.trim() }]);
  });

  it('découpe aux positions du texte brut', () => {
    const segments = segmenterTexteAmendement(texte, [renvoi(2, 51)]);
    expect(segments.map((s) => [s.texte, !!s.renvoi])).toEqual([
      ['L’article L. 242‑1 du code de la sécurité sociale', true],
      [' est modifié.', false],
    ]);
  });

  it('positions prises avant le nettoyage, qui change les longueurs', () => {
    const brut = 'Au titre&nbsp;I< sup>er< /sup>, l’article 4 de la loi';
    const debut = brut.indexOf('l’article');
    const segments = segmenterTexteAmendement(brut, [renvoi(debut, debut + 'l’article 4'.length)]);
    expect(segments.map((s) => s.texte)).toEqual(['Au titre Ier, ', 'l’article 4', ' de la loi']);
  });

  it('ignore un renvoi hors du texte ou qui en chevauche un autre', () => {
    const segments = segmenterTexteAmendement(texte, [renvoi(2, 20), renvoi(10, 30), renvoi(60, 500)]);
    expect(segments.filter((s) => s.renvoi)).toHaveLength(1);
    expect(segments.map((s) => s.texte).join('')).toBe(texte.trim());
  });
});
