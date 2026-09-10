import { describe, it, expect } from 'vitest';
import {
  scrutinDeLaMiseAuxVoix,
  fenetresDeDebat,
  interventionsDuVote,
  type ScrutinAApparier,
  type InterventionARattacher,
} from './link-debats-scrutins';
import type { VoteAnnonceSyceron } from '../sources/assemblee-nationale/syceron-parser';

function vote(p: Partial<VoteAnnonceSyceron> & { ordreAbsolu: number }): VoteAnnonceSyceron {
  return {
    cible: 'amendement',
    numeros: ['2407'],
    articleVise: '15',
    texteNumero: '1364',
    resultat: { votants: 125, exprimes: 125, pour: 37, contre: 88 },
    ...p,
  };
}

function scrutin(p: Partial<ScrutinAApparier> & { id: string }): ScrutinAApparier {
  return { votants: 125, pour: 37, contre: 88, amendements: [], ...p };
}

function intervention(
  p: Partial<InterventionARattacher> & { id: string; ordreAbsolu: number },
): InterventionARattacher {
  return { articleVise: '15', amendementsVises: [], ...p };
}

describe('scrutinDeLaMiseAuxVoix', () => {
  it('reconnaît le scrutin aux chiffres proclamés au perchoir', () => {
    const trouve = scrutinDeLaMiseAuxVoix(vote({ ordreAbsolu: 10 }), [
      scrutin({ id: 'autre', votants: 400, pour: 200, contre: 200 }),
      scrutin({ id: 'attendu' }),
    ]);
    expect(trouve?.id).toBe('attendu');
  });

  it('départage deux scrutins au même décompte par le numéro d’amendement', () => {
    const trouve = scrutinDeLaMiseAuxVoix(vote({ ordreAbsolu: 10, numeros: ['2407'] }), [
      scrutin({ id: 'sur-un-autre-amendement', amendements: ['1200'] }),
      scrutin({ id: 'attendu', amendements: ['2407'] }),
    ]);
    expect(trouve?.id).toBe('attendu');
  });

  it('renonce quand deux scrutins restent indiscernables', () => {
    // Un débat rattaché au mauvais scrutin est pire qu'un débat non rattaché.
    const trouve = scrutinDeLaMiseAuxVoix(vote({ ordreAbsolu: 10 }), [
      scrutin({ id: 'a' }),
      scrutin({ id: 'b' }),
    ]);
    expect(trouve).toBeNull();
  });

  it("ne rattache rien quand aucun scrutin ne porte ces chiffres", () => {
    const trouve = scrutinDeLaMiseAuxVoix(vote({ ordreAbsolu: 10 }), [
      scrutin({ id: 'a', votants: 300 }),
    ]);
    expect(trouve).toBeNull();
  });
});

describe('fenetresDeDebat', () => {
  it('fait courir le débat de chaque vote depuis la fin du précédent', () => {
    const fenetres = fenetresDeDebat([
      vote({ ordreAbsolu: 300 }),
      vote({ ordreAbsolu: 100 }),
      vote({ ordreAbsolu: 200 }),
    ]);
    expect(fenetres.map((f) => [f.debut, f.fin])).toEqual([
      [0, 100],
      [100, 200],
      [200, 300],
    ]);
  });
});

describe('interventionsDuVote', () => {
  const fenetre = { vote: vote({ ordreAbsolu: 200 }), debut: 100, fin: 200 };

  it("retient l'intervention qui nomme l'amendement mis aux voix", () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'i1', ordreAbsolu: 150, amendementsVises: ['2407'] }),
    ]);
    expect(retenues).toEqual([{ intervention: expect.objectContaining({ id: 'i1' }), via: 'amendement' }]);
  });

  it("retient l'intervention qui porte sur l'article en discussion", () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'i1', ordreAbsolu: 150, articleVise: '15' }),
    ]);
    expect(retenues).toHaveLength(1);
  });

  it("écarte ce qui précède le vote précédent", () => {
    // C'est ce critère qui empêche le premier vote d'une séance d'absorber
    // toute la discussion générale qui l'a précédé.
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'avant', ordreAbsolu: 50 }),
      intervention({ id: 'apres', ordreAbsolu: 250 }),
    ]);
    expect(retenues).toHaveLength(0);
  });

  it("écarte ce qui, dans la fenêtre, parle d'un autre article", () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'autre-article', ordreAbsolu: 150, articleVise: '4' }),
      intervention({ id: 'sans-article', ordreAbsolu: 160, articleVise: null }),
    ]);
    expect(retenues).toHaveLength(0);
  });

  it("n'attribue pas un amendement à un vote portant sur l'article", () => {
    const surArticle = {
      vote: vote({ ordreAbsolu: 200, cible: 'article' as const, numeros: ['15'] }),
      debut: 100,
      fin: 200,
    };
    const retenues = interventionsDuVote(surArticle, [
      intervention({ id: 'i1', ordreAbsolu: 150, articleVise: '15' }),
    ]);
    expect(retenues[0]?.via).toBe('article');
  });
});
