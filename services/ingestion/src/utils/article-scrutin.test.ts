import { describe, it, expect } from 'vitest';
import {
  articleNumeroFromTitre,
  articleLookupKeys,
  porteSurArticleEntier,
  normalizeArticleNumero,
} from './article-scrutin';

describe('articleNumeroFromTitre', () => {
  it("lit l'article d'un vote sur article", () => {
    expect(
      articleNumeroFromTitre(
        "l'article 15 de la proposition de loi relative au droit à l'aide à mourir (première lecture)."
      )
    ).toBe('15');
  });

  it("lit l'article visé par un vote sur amendement", () => {
    expect(
      articleNumeroFromTitre(
        "l'amendement n° 1204 de M. Bentz à l'article 15 de la proposition de loi relative au droit à l'aide à mourir (première lecture)."
      )
    ).toBe('15');
  });

  it('lit « article premier »', () => {
    expect(articleNumeroFromTitre("l'article premier de la proposition de loi.")).toBe('PREMIER');
  });

  it('lit « article unique »', () => {
    expect(articleNumeroFromTitre("l'article unique de la proposition de loi.")).toBe('UNIQUE');
  });

  it('conserve les suffixes d’ordre, qui désignent un autre article', () => {
    expect(articleNumeroFromTitre("l'article 15 bis de la proposition de loi.")).toBe('15 BIS');
    expect(articleNumeroFromTitre("l'article 4 quater de la proposition de loi.")).toBe('4 QUATER');
    expect(articleNumeroFromTitre("l'article premier bis A du projet de loi.")).toBe('PREMIER BIS A');
  });

  it('accepte l’apostrophe typographique', () => {
    expect(articleNumeroFromTitre('l’article 12 du projet de loi.')).toBe('12');
  });

  it("ne confond pas une référence à un article d'un code avec l'objet du vote", () => {
    // Ici le vote porte sur l'article 3, la mention de L. 122-1 ne doit rien changer.
    expect(
      articleNumeroFromTitre("l'article 3 de la proposition de loi modifiant l'article L. 122-1 du code du travail.")
    ).toBe('3');
  });

  it("écarte l'article d'une norme extérieure invoquée comme fondement du vote", () => {
    // Le Sénat fonde ses résolutions et les déclarations du Gouvernement sur un
    // article de la Constitution : il dit sous quel régime on vote, jamais ce
    // sur quoi on vote. Le numéro y est écrit avec un tiret (« 34-1 »), qu'il
    // faut lire d'un bloc — sinon on en retient un « article 34 » inexistant.
    expect(
      articleNumeroFromTitre(
        "l'ensemble de la proposition de résolution en application de l'article 34-1 de la Constitution, visant à condamner l'offensive militaire de l'Azerbaïdjan.",
      ),
    ).toBeNull();
    expect(
      articleNumeroFromTitre(
        "la déclaration du Gouvernement, en application de l'article 50-1 de la Constitution, portant sur la stratégie énergétique.",
      ),
    ).toBeNull();
    expect(
      articleNumeroFromTitre(
        "l'ensemble du projet de loi spéciale prévue par l'article 45 de la loi organique n° 2001-692 du 1er août 2001.",
      ),
    ).toBeNull();
    expect(
      articleNumeroFromTitre("la motion, en application de l'article 44, alinéa 3, du Règlement."),
    ).toBeNull();
  });

  it("retient l'article du texte même quand une norme extérieure est citée avant", () => {
    expect(
      articleNumeroFromTitre(
        "l'amendement n° 12, présenté en application de l'article 44 du Règlement, à l'article 7 du projet de loi.",
      ),
    ).toBe('7');
  });

  it("lit l'article liminaire des lois de finances", () => {
    expect(
      articleNumeroFromTitre("l'article liminaire du projet de loi de finances pour 2026."),
    ).toBe('LIMINAIRE');
  });

  it('rend null quand le libellé ne vise aucun article', () => {
    expect(articleNumeroFromTitre("l'ensemble de la proposition de loi.")).toBeNull();
    expect(articleNumeroFromTitre('la motion de censure.')).toBeNull();
    expect(articleNumeroFromTitre(null)).toBeNull();
    expect(articleNumeroFromTitre('')).toBeNull();
  });
});

describe('articleLookupKeys', () => {
  it('tente les deux graphies du premier article', () => {
    expect(articleLookupKeys('PREMIER')).toEqual(['PREMIER', '1']);
    expect(articleLookupKeys('1')).toEqual(['1', 'PREMIER']);
  });

  it('propage la double graphie aux articles suffixés', () => {
    expect(articleLookupKeys('1 BIS')).toEqual(['1 BIS', 'PREMIER BIS']);
    expect(articleLookupKeys('PREMIER BIS')).toEqual(['PREMIER BIS', '1 BIS']);
  });

  it("ne fabrique pas d'alternative pour les autres articles", () => {
    expect(articleLookupKeys('15')).toEqual(['15']);
    expect(articleLookupKeys('UNIQUE')).toEqual(['UNIQUE']);
  });

  it('ne confond pas 1 avec 10 ou 12', () => {
    expect(articleLookupKeys('10')).toEqual(['10']);
    expect(articleLookupKeys('12 BIS')).toEqual(['12 BIS']);
  });
});

describe('porteSurArticleEntier', () => {
  it('reconnaît un vote sur l’article lui-même', () => {
    expect(porteSurArticleEntier("l'article 15 de la proposition de loi.")).toBe(true);
  });

  it('écarte un vote sur un amendement à cet article', () => {
    expect(
      porteSurArticleEntier("l'amendement n° 1204 de M. Bentz à l'article 15 de la proposition de loi.")
    ).toBe(false);
  });

  it('écarte un vote sur l’ensemble', () => {
    expect(porteSurArticleEntier("l'ensemble de la proposition de loi.")).toBe(false);
  });
});

describe('normalizeArticleNumero', () => {
  it('compacte et met en majuscules', () => {
    expect(normalizeArticleNumero('  15   bis ')).toBe('15 BIS');
  });
});
