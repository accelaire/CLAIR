import { describe, it, expect } from 'vitest';
import {
  buildDossierResumePrompt,
  buildScrutinResumePrompt,
  buildSujetResumePrompt,
} from './prompts';

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

// =============================================================================
// Injection du texte de l'article dans le prompt scrutin
// =============================================================================
//
// C'est la pièce dont l'absence faisait inventer au modèle le contenu des
// articles : un vote « l'article 15 de la PPL … » ne lui offrait que le numéro.
// Ce qui se joue ici n'est pas un format mais la véracité de ce qui sera publié,
// d'où des tests sur la consigne elle-même autant que sur le contenu injecté.

describe('buildScrutinResumePrompt — texte de l’article', () => {
  const base = {
    titre: "l'article 15 de la proposition de loi relative au droit à l'aide à mourir (première lecture).",
    sort: 'adopte',
    typeVote: 'ordinaire',
  };
  const article = {
    numero: '15',
    libelle: 'Article 15',
    contenu: 'Une commission de contrôle et d’évaluation assure le contrôle a posteriori.',
  };

  it("injecte le texte de l'article pour un vote sur article", () => {
    const prompt = buildScrutinResumePrompt({ ...base, article, porteSurArticleEntier: true });
    expect(prompt).toContain('Une commission de contrôle et d’évaluation');
    expect(prompt).toContain("Texte de l'article 15, tel que soumis au vote");
  });

  it("demande d'expliquer l'article, en s'en tenant au texte fourni", () => {
    const prompt = buildScrutinResumePrompt({ ...base, article, porteSurArticleEntier: true });
    expect(prompt).toContain('ce que dit cet article');
    expect(prompt).toContain('sans extrapoler');
  });

  it("pour un amendement, demande ce que le changement implique", () => {
    const prompt = buildScrutinResumePrompt({
      titre: "l'amendement n° 74 de M. Hetzel à l'article 15 de la proposition de loi.",
      sort: 'adopte',
      typeVote: 'ordinaire',
      amendements: [{ numero: '74', dispositif: 'À l’alinéa 8, substituer « saisit » à « peut saisir ».' }],
      article,
      porteSurArticleEntier: false,
    });
    expect(prompt).toContain('substituer');
    expect(prompt).toContain('Une commission de contrôle');
    expect(prompt).toContain("cet amendement change dans l'article");
  });

  it("place l'amendement avant l'article qu'il modifie", () => {
    const prompt = buildScrutinResumePrompt({
      titre: "l'amendement n° 74 à l'article 15.",
      sort: 'adopte',
      typeVote: 'ordinaire',
      amendements: [{ numero: '74', dispositif: 'DISPOSITIF_AMENDEMENT' }],
      article,
      porteSurArticleEntier: false,
    });
    expect(prompt.indexOf('DISPOSITIF_AMENDEMENT')).toBeLessThan(
      prompt.indexOf('Une commission de contrôle')
    );
  });

  it("sans article, cadre la consigne sans parler de ce qui manque", () => {
    const prompt = buildScrutinResumePrompt({ ...base, porteSurArticleEntier: true });
    expect(prompt).toContain("Tiens-toi à ce qu'établissent le libellé");
    // La consigne ne doit pas décrire le contexte comme lacunaire : le modèle
    // recopie ces tournures et le lecteur y lit « le site ne sait pas ».
    expect(prompt).not.toMatch(/n'est pas fourni|non fourni|absence/i);
    expect(prompt).not.toContain('sans extrapoler');
  });

  it('tronque les articles-fleuves plutôt que de les envoyer entiers', () => {
    const long = 'A'.repeat(9000);
    const prompt = buildScrutinResumePrompt({
      ...base,
      article: { ...article, contenu: long },
      porteSurArticleEntier: true,
    });
    expect(prompt).toContain('…');
    expect(prompt.length).toBeLessThan(7000);
  });
});

describe('buildSujetResumePrompt — chambres réellement pourvues en votes', () => {
  const base = {
    label: 'Lutte contre les installations illicites',
    description: null,
    category: null,
    status: 'en_cours',
    dossiersResumes: [
      { titre: 'Proposition de loi (AN)', chambre: 'assemblee', etat: 'adopte', resumeIA: null },
      { titre: 'Proposition de loi (Sénat)', chambre: 'senat', etat: 'en_cours', resumeIA: null },
    ],
    positionsEnsemble: [
      { nom: 'UMP', nomComplet: 'Les Républicains', slug: 'ump', pour: 129, contre: 0, abstention: 0, orientation: 'droite' },
    ],
    votesArticles: [],
  };

  it('interdit de parler de l’Assemblée quand seuls des votes du Sénat existent', () => {
    const prompt = buildSujetResumePrompt({ ...base, chambresAvecVotes: ['senat'] });
    expect(prompt).toContain('ne concernent QUE le Sénat');
    expect(prompt).toContain("N'écris rien sur un vote, une position ou un groupe de l'Assemblée nationale");
    expect(prompt).toContain("qu'est-ce qui a été voté au Sénat");
    expect(prompt).not.toContain("qu'est-ce qui a été voté à l'Assemblée et au Sénat");
  });

  it('interdit de parler du Sénat quand seuls des votes de l’Assemblée existent', () => {
    const prompt = buildSujetResumePrompt({ ...base, chambresAvecVotes: ['assemblee'] });
    expect(prompt).toContain("ne concernent QUE l'Assemblée nationale");
    expect(prompt).toContain("N'écris rien sur un vote, une position ou un groupe du Sénat");
  });

  it('laisse les deux chambres ouvertes quand les deux ont voté', () => {
    const prompt = buildSujetResumePrompt({ ...base, chambresAvecVotes: ['assemblee', 'senat'] });
    expect(prompt).toContain('couvrent les deux chambres');
    expect(prompt).toContain("qu'est-ce qui a été voté à l'Assemblée et au Sénat");
  });

  it('interdit toute position quand aucune chambre n’a voté', () => {
    // Sans vote, la consigne « ENJEUX » bascule sur sa variante sans positions :
    // la contrainte de chambre n'a pas à s'y ajouter, elle serait redondante.
    const prompt = buildSujetResumePrompt({ ...base, positionsEnsemble: [], chambresAvecVotes: [] });
    expect(prompt).toContain('Ne décris AUCUNE position de groupe politique');
    expect(prompt).toContain("qu'est-ce qui a été voté sur ce sujet");
    expect(prompt).not.toContain("qu'est-ce qui a été voté à l'Assemblée et au Sénat");
  });
});
