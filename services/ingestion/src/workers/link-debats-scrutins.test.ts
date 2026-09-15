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
  return { articleVise: '15', amendementsVises: [], texteNumero: '1364', ...p };
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

  it("ne rattache par l'article que ce qui porte sur le bon article", () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'bon-article', ordreAbsolu: 150, articleVise: '15' }),
      intervention({ id: 'autre-article', ordreAbsolu: 160, articleVise: '4' }),
    ]);
    expect(retenues.map((r) => r.intervention.id)).toEqual(['bon-article']);
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

describe('interventionsDuVote — second recours par la fenêtre', () => {
  const fenetre = { vote: vote({ ordreAbsolu: 200 }), debut: 100, fin: 200 };

  it("rattache le débat d'un vote sur l'ensemble, qui n'a pas d'article", () => {
    const surEnsemble = {
      vote: vote({ ordreAbsolu: 200, cible: 'ensemble' as const, numeros: [], articleVise: null }),
      debut: 100,
      fin: 200,
    };
    const retenues = interventionsDuVote(surEnsemble, [
      intervention({ id: 'i1', ordreAbsolu: 150, articleVise: '4' }),
      intervention({ id: 'i2', ordreAbsolu: 160, articleVise: null }),
    ]);
    expect(retenues.map((r) => [r.intervention.id, r.via])).toEqual([
      ['i1', 'fenetre'],
      ['i2', 'fenetre'],
    ]);
  });

  it("rattache le débat d'une motion de la même façon", () => {
    const surMotion = {
      vote: vote({ ordreAbsolu: 200, cible: 'motion' as const, numeros: [], articleVise: null }),
      debut: 100,
      fin: 200,
    };
    const retenues = interventionsDuVote(surMotion, [
      intervention({ id: 'i1', ordreAbsolu: 150, articleVise: null }),
    ]);
    expect(retenues[0]?.via).toBe('fenetre');
  });

  it("reprend par la fenêtre un amendement que le compte rendu ne nomme jamais", () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'i1', ordreAbsolu: 150, articleVise: null, amendementsVises: [] }),
    ]);
    expect(retenues.map((r) => [r.intervention.id, r.via])).toEqual([['i1', 'fenetre']]);
  });

  it('ne descend pas à la fenêtre quand le sujet a déjà répondu', () => {
    // Un rattachement fin ne doit pas être noyé sous le reste de la fenêtre.
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'sur-l-amendement', ordreAbsolu: 150, amendementsVises: ['2407'] }),
      intervention({ id: 'hors-sujet', ordreAbsolu: 160, articleVise: '4' }),
    ]);
    expect(retenues.map((r) => r.intervention.id)).toEqual(['sur-l-amendement']);
  });

  it('borne la fenêtre au texte en discussion', () => {
    // Sans cette borne, le premier vote d'une séance absorberait l'affaire
    // précédente, débattue dans le même intervalle.
    const surEnsemble = {
      vote: vote({ ordreAbsolu: 200, cible: 'ensemble' as const, numeros: [], articleVise: null }),
      debut: 0,
      fin: 200,
    };
    const retenues = interventionsDuVote(surEnsemble, [
      intervention({ id: 'meme-texte', ordreAbsolu: 150, texteNumero: '1364' }),
      intervention({ id: 'autre-texte', ordreAbsolu: 50, texteNumero: '900' }),
    ]);
    expect(retenues.map((r) => r.intervention.id)).toEqual(['meme-texte']);
  });

  it("ne rattache aucun débat à une demande de suspension", () => {
    // Ce qui précède une demande de suspension de séance ne la concerne pas.
    const suspension = {
      vote: vote({ ordreAbsolu: 200, cible: 'autre' as const, numeros: [], articleVise: null }),
      debut: 100,
      fin: 200,
    };
    const retenues = interventionsDuVote(suspension, [
      intervention({ id: 'i1', ordreAbsolu: 150, articleVise: null }),
    ]);
    expect(retenues).toHaveLength(0);
  });
});

describe('interventionsDuVote — le numéro d’amendement ne dépend pas de la fenêtre', () => {
  const fenetre = { vote: vote({ ordreAbsolu: 200 }), debut: 190, fin: 200 };

  it("retient la défense d'un amendement tenue avant le vote précédent", () => {
    // Une série de sous-amendements votés en rafale laisse aux suivants une
    // fenêtre vide : la défense a eu lieu avant le premier vote.
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'defense', ordreAbsolu: 100, amendementsVises: ['2407'] }),
    ]);
    expect(retenues.map((r) => [r.intervention.id, r.via])).toEqual([['defense', 'amendement']]);
  });

  it('ne remonte pas au-delà du vote lui-même', () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'apres', ordreAbsolu: 300, amendementsVises: ['2407'] }),
    ]);
    expect(retenues).toHaveLength(0);
  });

  it("ne franchit pas la frontière d'un autre texte", () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'autre-texte', ordreAbsolu: 100, amendementsVises: ['2407'], texteNumero: '900' }),
    ]);
    expect(retenues).toHaveLength(0);
  });

  it("garde la fenêtre pour le rattachement par l'article, discuté sur toute une série", () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'hors-fenetre', ordreAbsolu: 100, articleVise: '15' }),
    ]);
    expect(retenues).toHaveLength(0);
  });
});

describe('interventionsDuVote — les deux lectures s’additionnent', () => {
  const fenetre = { vote: vote({ ordreAbsolu: 200 }), debut: 190, fin: 200 };

  it("garde l'avis du gouvernement avec la défense de l'amendement", () => {
    // La défense porte le numéro, l'avis ne porte que l'article : les deux
    // font le même débat, et n'en retenir qu'un l'ampute.
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'defense', ordreAbsolu: 100, amendementsVises: ['2407'] }),
      intervention({ id: 'avis', ordreAbsolu: 195, articleVise: '15' }),
    ]);
    expect(retenues.map((r) => [r.intervention.id, r.via]).sort()).toEqual([
      ['avis', 'amendement'],
      ['defense', 'amendement'],
    ]);
  });

  it('ne compte qu’une fois une intervention que les deux lectures retiennent', () => {
    const retenues = interventionsDuVote(fenetre, [
      intervention({ id: 'i1', ordreAbsolu: 195, articleVise: '15', amendementsVises: ['2407'] }),
    ]);
    expect(retenues).toHaveLength(1);
  });
});

describe('fenetresDeDebat — les votes enchaînés partagent leur débat', () => {
  it("ne referme pas la fenêtre quand personne n'a parlé entre deux votes", () => {
    // Le président enchaîne : « je mets aux voix l'amendement no 219… le
    // sous-amendement no 222… ». C'est la discussion d'avant qui les porte.
    const fenetres = fenetresDeDebat(
      [vote({ ordreAbsolu: 100 }), vote({ ordreAbsolu: 101 }), vote({ ordreAbsolu: 102 })],
      [intervention({ id: 'debat', ordreAbsolu: 50 })],
    );
    expect(fenetres.map((f) => [f.debut, f.fin])).toEqual([
      [0, 100],
      [0, 101],
      [0, 102],
    ]);
  });

  it('referme la fenêtre dès que le débat reprend', () => {
    const fenetres = fenetresDeDebat(
      [vote({ ordreAbsolu: 100 }), vote({ ordreAbsolu: 200 })],
      [intervention({ id: 'avant', ordreAbsolu: 50 }), intervention({ id: 'entre', ordreAbsolu: 150 })],
    );
    expect(fenetres.map((f) => [f.debut, f.fin])).toEqual([
      [0, 100],
      [100, 200],
    ]);
  });

  it('garde le découpage simple quand on ne lui donne pas les prises de parole', () => {
    const fenetres = fenetresDeDebat([vote({ ordreAbsolu: 100 }), vote({ ordreAbsolu: 200 })]);
    expect(fenetres.map((f) => [f.debut, f.fin])).toEqual([
      [0, 100],
      [100, 200],
    ]);
  });
});
