import { describe, it, expect } from 'vitest';
import { sectionsDuScrutin } from './link-debats-scrutins-senat';
import { lireTitreScrutinSenat } from '../sources/senat/scrutin-titre';
import type { SectionDebatSenat } from '../sources/senat/debats-index-client';

function section(partiel: Partial<SectionDebatSenat> & { cle: string }): SectionDebatSenat {
  return {
    date: '2026-06-24',
    lectures: ['108623'],
    typeSection: '1',
    articles: [],
    amendements: [],
    objet: null,
    ordre: 0,
    ancres: ['1'],
    ...partiel,
  };
}

const choix = (titre: string, sections: SectionDebatSenat[]) =>
  sectionsDuScrutin(lireTitreScrutinSenat(titre), sections);

describe('sectionsDuScrutin', () => {
  it('préfère le numéro d’amendement à l’article qui le porte', () => {
    // L'énumération de section est le seul lien nominatif entre un débat du
    // Sénat et un amendement : quand elle le nomme, elle prime.
    const nommee = section({ cle: 'a', amendements: ['86'], articles: ['22'] });
    const article = section({ cle: 'b', articles: ['22'] });
    const resultat = choix(
      "sur l'amendement n° 86 rectifié bis, présenté par M. X, à l'article 22 du projet de loi",
      [nommee, article],
    );
    expect(resultat?.via).toBe('amendement');
    expect(resultat?.sections.map((s) => s.cle)).toEqual(['a']);
  });

  it('retombe sur la discussion de l’article quand l’amendement n’est pas nommé', () => {
    const resultat = choix(
      "sur l'amendement n° 999, présenté par M. X, à l'article 22 du projet de loi",
      [section({ cle: 'b', articles: ['22'] })],
    );
    expect(resultat?.via).toBe('article');
    expect(resultat?.sections.map((s) => s.cle)).toEqual(['b']);
  });

  it('retombe sur le fascicule budgétaire pour un amendement de finances', () => {
    // « II-451 » se discute dans la deuxième partie du projet de loi de
    // finances, qui n'a pas de section d'article.
    const resultat = choix("sur l'amendement n° II-451, présenté par M. Yan Chantrel", [
      section({ cle: 'f', typeSection: 'finances_fascicule' }),
    ]);
    expect(resultat?.via).toBe('finances');
  });

  it('rapproche un article malgré le qualificatif de procédure', () => {
    // La section s'intitule « Article 4 (priorité) », le scrutin « l'article 4 ».
    const resultat = choix("sur l'article 4 de la proposition de loi", [
      section({ cle: 'c', articles: ['4'] }),
    ]);
    expect(resultat?.via).toBe('article');
  });

  it('retient toutes les sections d’un article discuté en plusieurs fois', () => {
    const resultat = choix("sur l'article 2 du projet de loi", [
      section({ cle: 'd1', articles: ['2'] }),
      section({ cle: 'd2', articles: ['2'] }),
      section({ cle: 'e', articles: ['3'] }),
    ]);
    expect(resultat?.sections.map((s) => s.cle)).toEqual(['d1', 'd2']);
  });

  it('rattache un vote sur l’ensemble aux explications de vote', () => {
    const resultat = choix("sur l'ensemble de la proposition de loi visant à améliorer", [
      section({ cle: 'g', typeSection: '2' }),
      section({ cle: 'h', typeSection: '0' }),
    ]);
    expect(resultat?.via).toBe('ensemble');
    expect(resultat?.sections.map((s) => s.cle)).toEqual(['g']);
  });

  it('se rabat sur la discussion générale quand le vote n’a pas été expliqué', () => {
    const resultat = choix("sur l'ensemble de la proposition de loi visant à améliorer", [
      section({ cle: 'h', typeSection: '0' }),
    ]);
    expect(resultat?.via).toBe('ensemble');
    expect(resultat?.sections.map((s) => s.cle)).toEqual(['h']);
  });

  it('reconnaît les quatre genres de motion', () => {
    for (const typeSection of ['motion', 'question', 'excirrec', 'renvcomm']) {
      const resultat = choix('sur la motion n° 57, présentée par Mme Marianne Margaté', [
        section({ cle: typeSection, typeSection }),
      ]);
      expect(resultat?.via).toBe('motion');
    }
  });

  it('ne rattache rien à une déclaration du Gouvernement', () => {
    // Elle n'a pas de texte, donc pas de section propre : mieux vaut renoncer
    // que de lui donner la séance entière.
    expect(
      choix(
        "sur la déclaration du Gouvernement, en application de l'article 50-1 de la Constitution, portant sur la stratégie",
        [section({ cle: 'i', typeSection: '0' })],
      ),
    ).toBeNull();
  });

  it('renonce quand aucune section du texte ne correspond', () => {
    expect(choix("sur l'article 44 du projet de loi", [section({ cle: 'j', articles: ['2'] })])).toBeNull();
  });
});
