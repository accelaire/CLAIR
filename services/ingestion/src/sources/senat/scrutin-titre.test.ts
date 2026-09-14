import { describe, it, expect } from 'vitest';
import {
  lireTitreScrutinSenat,
  normaliserNumeroAmendementSenat,
  cleArticleSenat,
} from './scrutin-titre';

// Tous les libellés de ce fichier sont repris tels quels de la production.

describe('lireTitreScrutinSenat — la cible', () => {
  it('reconnaît un vote sur amendement, au singulier comme au pluriel', () => {
    expect(
      lireTitreScrutinSenat("sur l'amendement n° 8 rectifié, présenté par Mme Monique de Marco").cible,
    ).toBe('amendement');
    expect(
      lireTitreScrutinSenat('sur les amendements identiques n° 1342 rectifié, présenté par Mme Raymonde Poncet Monge').cible,
    ).toBe('amendement');
  });

  it('lit un amendement même sans le signe n°', () => {
    const objet = lireTitreScrutinSenat(
      "sur l'amendement 72 rectifié quater, présenté par Mme Anne Chain-Larché",
    );
    expect(objet.cible).toBe('amendement');
    expect(objet.numeros).toEqual(['72']);
  });

  it('distingue le sous-amendement de l’amendement qu’il vise', () => {
    const objet = lireTitreScrutinSenat(
      "sur le sous-amendement n° 9, présenté par M. Laurent Somon, à l'amendement n° 884 du Gouvernement",
    );
    expect(objet.cible).toBe('sous-amendement');
    expect(objet.numeros).toEqual(['9', '884']);
  });

  it('reconnaît une motion, y compris quand son genre est nommé', () => {
    expect(lireTitreScrutinSenat('sur la motion n° 57, présentée par Mme Marianne Margaté').cible).toBe('motion');
    expect(
      lireTitreScrutinSenat('sur la motion préjudicielle n° 42, présentée par Mme Anne Souyris').cible,
    ).toBe('motion');
  });

  it('reconnaît un vote sur article et un vote sur l’ensemble', () => {
    expect(
      lireTitreScrutinSenat("sur l'article 4 de la proposition de loi tendant à rétablir le lien de confiance").cible,
    ).toBe('article');
    expect(
      lireTitreScrutinSenat("sur l'ensemble du projet de loi autorisant la ratification de l'accord").cible,
    ).toBe('ensemble');
  });

  it('classe en article le vote sur l’article unique valant ensemble', () => {
    // Le libellé parle d'ensemble, mais le Sénat vote bien un article : c'est
    // dans la discussion de cet article que le débat se trouve.
    const objet = lireTitreScrutinSenat(
      "sur l'article unique constituant l'ensemble de la proposition de loi constitutionnelle visant à protéger",
    );
    expect(objet.cible).toBe('article');
    expect(objet.article).toBe('UNIQUE');
  });

  it('reconnaît un vote budgétaire sur les crédits d’une mission', () => {
    expect(
      lireTitreScrutinSenat(
        'sur les crédits de la mission « Sport, jeunesse et vie associative » figurant à l\'état B du projet de loi de finances',
      ).cible,
    ).toBe('credits');
  });

  it('reconnaît le débat sur une déclaration du Gouvernement', () => {
    expect(
      lireTitreScrutinSenat(
        "sur la déclaration du Gouvernement, en application de l'article 50-1 de la Constitution, portant sur les négociations",
      ).cible,
    ).toBe('declaration');
  });

  it('classe une seconde délibération comme un vote sur l’article rouvert', () => {
    const objet = lireTitreScrutinSenat(
      "sur la demande de seconde délibération, présentée par le Gouvernement, de l'article 1er de la proposition de loi",
    );
    expect(objet.cible).toBe('article');
    expect(objet.article).toBe('1');
  });
});

describe('lireTitreScrutinSenat — les numéros', () => {
  it('relève tous les numéros d’amendements identiques', () => {
    expect(
      lireTitreScrutinSenat(
        'sur les amendements identiques n° 3, présenté par Mme Silvana Silvani, et n° 12 rectifié bis, présenté par M. Victorin Lurel',
      ).numeros,
    ).toEqual(['3', '12']);
  });

  it('garde le préfixe de partie des amendements budgétaires', () => {
    expect(
      lireTitreScrutinSenat("sur l'amendement n° II-455 rectifié portant sur les crédits").numeros,
    ).toEqual(['II-455']);
    expect(lireTitreScrutinSenat("sur l'amendement n° A-5, présenté par le Gouvernement").numeros).toEqual(['A-5']);
    expect(
      lireTitreScrutinSenat("sur les amendements identiques n° I-2, présenté par M. Jean-François Husson").numeros,
    ).toEqual(['I-2']);
  });

  it('ne répète pas un numéro cité deux fois', () => {
    expect(
      lireTitreScrutinSenat("sur l'amendement n° 12 rectifié, identique à l'amendement n° 12").numeros,
    ).toEqual(['12']);
  });
});

describe('lireTitreScrutinSenat — l’article', () => {
  it('lit l’article visé par un amendement', () => {
    expect(
      lireTitreScrutinSenat(
        "sur l'amendement n° A-5, présenté par le Gouvernement, tendant à supprimer l'article 3 ter du projet de loi",
      ).article,
    ).toBe('3 TER');
  });

  it('écarte l’article de la Constitution qui fonde le vote', () => {
    // La résolution est fondée sur l'article 34-1 ; elle ne porte pas dessus.
    expect(
      lireTitreScrutinSenat(
        "sur l'ensemble de la proposition de résolution en application de l'article 34-1 de la Constitution, visant à condamner l'offensive",
      ).article,
    ).toBeNull();
  });
});

describe('normaliserNumeroAmendementSenat', () => {
  it('ramène une rectification à l’amendement qu’elle corrige', () => {
    expect(normaliserNumeroAmendementSenat('8 rectifié')).toBe('8');
    expect(normaliserNumeroAmendementSenat('1342 rectifié bis')).toBe('1342');
    expect(normaliserNumeroAmendementSenat('1 rectifié ter')).toBe('1');
  });

  it('conserve le préfixe de partie', () => {
    expect(normaliserNumeroAmendementSenat('II-455 rectifié')).toBe('II-455');
  });
});

describe('cleArticleSenat', () => {
  it('retire le qualificatif de procédure, qui ne change pas l’article', () => {
    expect(cleArticleSenat('4 (priorité)')).toBe('4');
    expect(cleArticleSenat('3 (texte supprimé par la commission)')).toBe('3');
    expect(cleArticleSenat('1er (Texte non modifié par la commission)')).toBe('1ER');
    expect(cleArticleSenat('6 bis (précédemment réservé)')).toBe('6 BIS');
    expect(cleArticleSenat('5 (suite)')).toBe('5');
  });

  it('laisse intacte une désignation sans qualificatif', () => {
    expect(cleArticleSenat('11 bis')).toBe('11 BIS');
    expect(cleArticleSenat('Après 9')).toBe('APRÈS 9');
  });

  it('rend null sur une valeur vide', () => {
    expect(cleArticleSenat(null)).toBeNull();
    expect(cleArticleSenat('  ')).toBeNull();
    expect(cleArticleSenat('(priorité)')).toBeNull();
  });
});

describe('lireTitreScrutinSenat — le vote bloqué', () => {
  it('classe en ensemble le vote de l’article 44, alinéa 3, de la Constitution', () => {
    // « En ne retenant que les amendements … » : le Sénat vote le texte entier,
    // le mot « amendements » ne désigne pas l'objet du vote.
    const objet = lireTitreScrutinSenat(
      "sur l'ensemble du texte, en ne retenant que les amendements proposés ou acceptés par le Gouvernement",
    );
    expect(objet.cible).toBe('ensemble');
  });
});
