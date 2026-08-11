import { describe, it, expect } from 'vitest';
import { buildDossierResumePrompt } from './prompts';

// =============================================================================
// Tendance et divergences dans le prompt dossier
// =============================================================================
//
// Ces deux règles décident de ce que le modèle écrira noir sur blanc à propos
// du vote d'un groupe. Une erreur ici ne produit pas un plantage mais une
// affirmation fausse publiée sur le site, d'où ces tests sur les cas limites.
//
// Les helpers testés (`formatGroupePosition`, `positionDominante`) sont privés :
// on les exerce par le prompt qui les utilise plutôt que d'élargir la surface
// exportée pour les besoins du test.

const groupe = (over: Partial<Parameters<typeof buildDossierResumePrompt>[0]['positionsEnsemble'][0]> = {}) => ({
  nom: 'GRP',
  slug: 'grp',
  pour: 0,
  contre: 0,
  abstention: 0,
  ...over,
});

function promptFor(
  positionsEnsemble: ReturnType<typeof groupe>[],
  votesArticles: { article: string; sort: string; groupes: ReturnType<typeof groupe>[] }[] = [],
): string {
  return buildDossierResumePrompt({
    titre: 'Dossier test',
    scrutinsResumes: [],
    positionsEnsemble,
    votesArticles,
    amendementsClefs: [],
  });
}

describe('formatGroupePosition — tendance annoncée au modèle', () => {
  it("n'annonce pas l'abstention majoritaire quand elle égale les voix exprimées", () => {
    // 15 pour / 0 contre / 15 abstentions : l'abstention ne domine pas, et
    // 100 % des voix exprimées sont favorables.
    const prompt = promptFor([groupe({ pour: 15, contre: 0, abstention: 15 })]);

    expect(prompt).not.toContain('Abstention majoritaire');
    expect(prompt).toContain('Très favorable');
  });

  it("annonce l'abstention majoritaire quand elle dépasse strictement les exprimés", () => {
    const prompt = promptFor([groupe({ pour: 1, contre: 0, abstention: 12 })]);

    expect(prompt).toContain('Abstention majoritaire');
  });

  it("annonce l'abstention totale quand aucune voix n'est exprimée", () => {
    const prompt = promptFor([groupe({ pour: 0, contre: 0, abstention: 9 })]);

    expect(prompt).toContain('Abstention totale');
  });

  it('ne conclut pas « Très opposé » sur un groupe qui s’abstient en bloc', () => {
    // Régression historique : 0 pour / 1 contre / 12 abstentions était annoncé
    // « Très opposé » à partir des seules voix exprimées.
    const prompt = promptFor([groupe({ pour: 0, contre: 1, abstention: 12 })]);

    expect(prompt).not.toContain('Très opposé');
  });
});

describe('positionDominante — divergences ensemble / articles', () => {
  it('ne publie aucune divergence pour un groupe parfaitement partagé', () => {
    // 5 pour / 5 contre n'est pas une position « POUR ». Départager
    // arbitrairement fabriquerait une divergence que le prompt impose ensuite
    // au modèle comme un fait à ne pas contredire.
    const prompt = promptFor(
      [groupe({ pour: 5, contre: 5, abstention: 0 })],
      [{ article: 'Article 1', sort: 'adopte', groupes: [groupe({ pour: 0, contre: 0, abstention: 6 })] }],
    );

    expect(prompt).not.toContain("sur l'ensemble, MAIS");
  });

  it('publie la divergence quand les deux positions sont franches', () => {
    const prompt = promptFor(
      [groupe({ pour: 10, contre: 1, abstention: 0 })],
      [{ article: 'Article 1', sort: 'adopte', groupes: [groupe({ pour: 0, contre: 0, abstention: 11 })] }],
    );

    expect(prompt).toContain("sur l'ensemble, MAIS");
    expect(prompt).toContain('ABSTENTION');
  });

  it("ignore l'article dont la position est elle-même à égalité", () => {
    const prompt = promptFor(
      [groupe({ pour: 10, contre: 1, abstention: 0 })],
      [{ article: 'Article 1', sort: 'adopte', groupes: [groupe({ pour: 4, contre: 4, abstention: 0 })] }],
    );

    expect(prompt).not.toContain("sur l'ensemble, MAIS");
  });
});
