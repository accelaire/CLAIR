import { describe, it, expect } from 'vitest';
import {
  normaliserArticleSenat,
  typeDInterventionSenat,
  ancreDepuisUrl,
  champsDeLigne,
} from './debats-index-client';

describe('normaliserArticleSenat', () => {
  it('retire le préfixe, abrégé comme développé', () => {
    // Le Sénat écrit tantôt « Art. », tantôt « Article ».
    expect(normaliserArticleSenat('Art. 11 bis')).toBe('11 bis');
    expect(normaliserArticleSenat('Article 7')).toBe('7');
    expect(normaliserArticleSenat('Article 7 ter (nouveau)')).toBe('7 ter (nouveau)');
  });

  it('ramène les articles additionnels à la forme de l’Assemblée', () => {
    expect(normaliserArticleSenat("Article additionnel avant l'article 3")).toBe('Avant 3');
    expect(normaliserArticleSenat("Art. additionnel après l'art. 73 nonies")).toBe('Après 73 nonies');
  });

  it('gère l’apostrophe typographique encodée du dump', () => {
    expect(normaliserArticleSenat('Article additionnel avant l&#8217;article 12')).toBe('Avant 12');
  });

  it('laisse tel quel ce qui ne ressemble pas à un article', () => {
    expect(normaliserArticleSenat('Intitulé du projet de loi')).toBe('Intitulé du projet de loi');
  });

  it('ne renvoie rien pour une valeur absente', () => {
    expect(normaliserArticleSenat(null)).toBeNull();
    expect(normaliserArticleSenat('   ')).toBeNull();
  });
});

describe('typeDInterventionSenat', () => {
  it('reconnaît les explications de vote publiées comme telles', () => {
    // 2 107 sections dans le dump, contre 143 explications de vote en base
    // toutes chambres confondues avec l'ancienne heuristique textuelle.
    expect(typeDInterventionSenat('2')).toBe('explication_vote');
  });

  it('reconnaît les questions', () => {
    expect(typeDInterventionSenat('question')).toBe('question');
    expect(typeDInterventionSenat('question_orale')).toBe('question');
  });

  it('classe le reste en intervention', () => {
    expect(typeDInterventionSenat('1')).toBe('intervention');
    expect(typeDInterventionSenat('rappel_reglement')).toBe('intervention');
  });
});

describe('ancreDepuisUrl', () => {
  it('extrait le numéro d’ancre du compte rendu', () => {
    expect(ancreDepuisUrl('s202602/s20260224/s20260224011.html#int1424')).toBe('1424');
  });

  it('ne renvoie rien sans ancre', () => {
    expect(ancreDepuisUrl('s202602/s20260224/s20260224011.html')).toBeNull();
    expect(ancreDepuisUrl(null)).toBeNull();
  });
});

describe('champsDeLigne', () => {
  it('découpe une ligne COPY et rend les NULL', () => {
    expect(champsDeLigne('8634542\t95032D\t546774\t\\N\tministre')).toEqual([
      '8634542', '95032D', '546774', null, 'ministre',
    ]);
  });

  it('conserve les champs vides, qui ne sont pas des NULL', () => {
    expect(champsDeLigne('a\t\tb')).toEqual(['a', '', 'b']);
  });
});
