import { describe, it, expect } from 'vitest';
import {
  parseArticles,
  articleKeyFromLibelle,
  articleKeyFromArticleVise,
  texteUrl,
} from './textes-client';

// Reproduit les pièges réels de la page AN : feuille de style qui déclare la
// classe des articles, libellé réparti sur plusieurs lignes, image base64 dans
// le corps, et références légales découpées par des <span>.
const HTML = `
<html><head><style>
  .assnat9ArticleNum0 { font-weight:bold }
  .assnat9ArticleNum { font-weight:bold }
</style></head><body>
<p class="assnat9ArticleNum">
    Article 1er
</p>
<p class="assnatLoiTexte">Le code est ainsi modifi&eacute;&nbsp;:</p>
<p class="assnat9ArticleNum">
    Article 15
</p>
<p class="assnatLoiTexte">
  <span style="z-index:78"><img src="data:image/png;base64,iVBORw0KGgoAAAAN"></span>
  <span>Art.</span><span> L.</span><span> 1111</span><span>&#8209;</span><span>12</span><span>&#8209;</span><span>13.</span>
  &#8211; Une commission de contr&ocirc;le et d&rsquo;&eacute;valuation assure&nbsp;:
</p>
<p class="assnatLoiTexte">&laquo;&#160;1&deg; Le contr&ocirc;le a posteriori.&#160;&raquo;</p>
<p class="assnat9ArticleNum" style="page-break-after:avoid">
    Article 4 bis (nouveau)
</p>
<p class="assnatLoiTexte">Dispositions transitoires.</p>
</body></html>`;

describe('parseArticles', () => {
  const articles = parseArticles(HTML);

  it("ignore la feuille de style et n'extrait que les vrais articles", () => {
    expect(articles.map((a) => a.libelle)).toEqual([
      'Article 1er',
      'Article 15',
      'Article 4 bis (nouveau)',
    ]);
  });

  it('normalise le numéro sur la forme utilisée par article_vise', () => {
    expect(articles.map((a) => a.numero)).toEqual(['PREMIER', '15', '4 BIS']);
  });

  it('numérote les articles dans leur ordre d’apparition', () => {
    expect(articles.map((a) => a.ordre)).toEqual([1, 2, 3]);
  });

  it('retire les images base64 du contenu', () => {
    expect(articles.some((a) => a.contenu.includes('base64'))).toBe(false);
  });

  it('ne coupe pas les références légales enrobées de <span>', () => {
    const art15 = articles.find((a) => a.numero === '15')!;
    expect(art15.contenu).toContain('Art. L. 1111‑12‑13.');
  });

  it('décode les entités nommées et numériques', () => {
    const art15 = articles.find((a) => a.numero === '15')!;
    expect(art15.contenu).toContain('contrôle et d’évaluation');
    expect(art15.contenu).toContain('« 1° Le contrôle a posteriori. »');
  });

  it("borne le contenu d'un article au libellé suivant", () => {
    const art1 = articles.find((a) => a.numero === 'PREMIER')!;
    expect(art1.contenu).toBe('Le code est ainsi modifié :');
  });

  it('ne rend aucun article sur une page sans marqueur', () => {
    expect(parseArticles('<html><body><p>rien</p></body></html>')).toEqual([]);
  });
});

describe('articleKeyFromLibelle', () => {
  it.each([
    ['Article 1er', 'PREMIER'],
    ['Article premier', 'PREMIER'],
    ['Article 15', '15'],
    ['Article unique', 'UNIQUE'],
    ['Article 4 bis', '4 BIS'],
    ['Article 1er A (nouveau)', 'PREMIER A'],
  ])('%s → %s', (libelle, attendu) => {
    expect(articleKeyFromLibelle(libelle)).toBe(attendu);
  });
});

describe('articleKeyFromArticleVise', () => {
  it('lit un article visé simple', () => {
    expect(articleKeyFromArticleVise('ART. 15')).toEqual({ key: '15', apres: false });
  });

  it('lit « ART. PREMIER », la forme la plus fréquente en base', () => {
    expect(articleKeyFromArticleVise('ART. PREMIER')).toEqual({ key: 'PREMIER', apres: false });
  });

  it('distingue un amendement portant article additionnel', () => {
    expect(articleKeyFromArticleVise('APRÈS ART. 3')).toEqual({ key: '3', apres: true });
  });

  it('rejette ce qui ne vise pas un article', () => {
    expect(articleKeyFromArticleVise('TITRE')).toBeNull();
  });

  it('se raccorde à la clé issue du libellé', () => {
    expect(articleKeyFromArticleVise('ART. PREMIER')!.key).toBe(articleKeyFromLibelle('Article 1er'));
  });
});

describe('texteUrl', () => {
  it('indexe la page par le texteRef stocké sur les amendements', () => {
    expect(texteUrl('PIONANR5L17BTC1364')).toBe(
      'https://www.assemblee-nationale.fr/dyn/opendata/PIONANR5L17BTC1364.html'
    );
  });
});
