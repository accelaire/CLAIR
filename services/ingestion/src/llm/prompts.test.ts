import { describe, it, expect } from 'vitest';
import {
  buildDossierResumePrompt,
  buildScrutinResumePrompt,
  porteeMotionDeCensure,
  positionsAvecMotions,
  separerResumePositions,
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

describe('buildSujetResumePrompt — procédure close', () => {
  const base = {
    label: 'Aide à mourir',
    description: null,
    category: null,
    status: 'en_cours',
    dossiersResumes: [{ titre: 'PPL', chambre: 'assemblee', etat: 'adopte', resumeIA: null }],
    positionsEnsemble: [],
    votesArticles: [],
    chambresAvecVotes: ['assemblee'] as ('assemblee' | 'senat')[],
  };

  it('interdit d’annoncer une étape à venir sur une loi promulguée', () => {
    const prompt = buildSujetResumePrompt({ ...base, status: 'promulgue' });
    expect(prompt).toContain('La procédure est CLOSE (loi promulguée)');
    expect(prompt).toContain("N'annonce aucune étape à venir");
  });

  it('le dit aussi pour un texte rejeté', () => {
    const prompt = buildSujetResumePrompt({ ...base, status: 'rejete' });
    expect(prompt).toContain('La procédure est CLOSE (texte rejeté)');
  });

  it('reste muet quand la procédure court toujours', () => {
    for (const status of ['en_cours', 'adopte', 'caduc', 'retire']) {
      expect(buildSujetResumePrompt({ ...base, status })).not.toContain('La procédure est CLOSE');
    }
  });
});

describe('buildScrutinResumePrompt — chambre', () => {
  const base = { titre: "sur l'ensemble du projet de loi relative aux résultats de la gestion", sort: 'adopte', typeVote: 'ordinaire' };

  it('dit au modèle que les sénateurs ont voté', () => {
    // 1 664 résumés du Sénat commençaient par « Les députés ont… ».
    const prompt = buildScrutinResumePrompt({ ...base, chambre: 'senat' });
    expect(prompt).toContain('Chambre : Sénat');
    expect(prompt).toMatch(/ne parle jamais des députés/);
  });

  it("ne demande plus d'annoncer la suite du parcours", () => {
    const prompt = buildScrutinResumePrompt({ ...base, chambre: 'assemblee' });
    expect(prompt).not.toMatch(/implique pour la suite du parcours/);
    expect(prompt).toMatch(/N'annonce aucune étape à venir/);
  });
});

describe('buildDossierResumePrompt — parcours et votes datés', () => {
  it('transmet la navette datée et la chambre de chaque vote', () => {
    const prompt = buildDossierResumePrompt({
      titre: 'Projet de loi relative aux résultats de la gestion 2025',
      chambre: 'assemblee',
      etat: 'en_cours',
      parcours: ['09/06/2026 — Assemblée nationale, 1re lecture : rejeté', '22/06/2026 — Sénat, 1re lecture : modifié'],
      scrutinsResumes: [{ titre: 'la motion de rejet préalable', sort: 'adopte', typeVote: 'ordinaire', date: new Date('2026-06-09T12:00:00Z'), chambre: 'assemblee' }],
      positionsEnsemble: [],
      votesArticles: [],
      amendementsClefs: [],
    });
    expect(prompt).toContain('Parcours officiel');
    expect(prompt).toContain('22/06/2026 — Sénat, 1re lecture : modifié');
    expect(prompt).toContain('[ordinaire, Adopté, 09/06/2026, Assemblée nationale] la motion de rejet préalable');
    expect(prompt).toMatch(/N'annonce aucune étape/);
  });
});

describe('porteeMotionDeCensure', () => {
  it('dit que le rejet d’une motion sur un 49.3 vaut adoption du texte', () => {
    const p = porteeMotionDeCensure("la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par Mme Mathilde Panot et 90 députés.");
    expect(p).toMatch(/rejetée, le texte est considéré comme adopté/);
    expect(p).toMatch(/Seules les voix POUR/);
  });

  it('distingue la motion spontanée (49.2)', () => {
    expect(porteeMotionDeCensure("la motion de censure déposée en application de l'article 49, alinéa 2, de la Constitution par M. Boris Vallaud")).toMatch(/alinéa 2/);
  });

  it("ne s'applique pas aux autres scrutins", () => {
    expect(porteeMotionDeCensure('la motion de rejet préalable du projet de loi')).toBeNull();
  });
});

describe('buildDossierResumePrompt — motions de censure', () => {
  it('liste les seules voix POUR par groupe et interdit de prêter un vote contre', () => {
    const prompt = buildDossierResumePrompt({
      titre: 'Projet de loi de finances pour 2025',
      scrutinsResumes: [],
      positionsEnsemble: [],
      votesArticles: [],
      amendementsClefs: [],
      motionsCensure: [{
        date: new Date('2025-02-05T12:00:00Z'),
        titre: "la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par Mme Mathilde Panot",
        sort: 'rejete',
        pourParGroupe: [{ nom: 'LFI-NFP', pour: 71 }, { nom: 'ECOS', pour: 37 }],
      }],
    });
    expect(prompt).toContain('Motion du 05/02/2025, REJETÉE faute de majorité absolue.');
    expect(prompt).toContain("Ont voté POUR la motion, donc l'ont SOUTENUE : LFI-NFP (71), ECOS (37).");
    expect(prompt).toMatch(/Ne parle PAS des motions de censure dans POSITIONS/);
  });
});

describe('buildDossierResumePrompt — groupes qui n’ont pas voté la motion', () => {
  it('les nomme pour que le modèle n’écrive pas « opposé »', () => {
    const prompt = buildDossierResumePrompt({
      titre: 'Projet de loi de finances pour 2025',
      scrutinsResumes: [],
      positionsEnsemble: [],
      votesArticles: [{ article: "l'article liminaire", sort: 'adopte', groupes: [
        { nom: 'RN', slug: 'rn', pour: 120, contre: 0, abstention: 0 },
        { nom: 'LFI-NFP', slug: 'lfi-nfp', pour: 0, contre: 70, abstention: 0 },
      ] }],
      amendementsClefs: [],
      motionsCensure: [{ date: new Date('2025-02-05T12:00:00Z'), titre: "la motion de censure … article 49, alinéa 3 …", sort: 'rejete', pourParGroupe: [{ nom: 'LFI-NFP', pour: 71 }] }],
    });
    expect(prompt).toContain("N'ont pas voté la motion (aucune voix pour, ce qui ne veut PAS dire contre) : RN.");
  });

  it('demande les seules voix pour quand le dossier n’a que la motion', () => {
    const prompt = buildDossierResumePrompt({
      titre: 'Motion de censure', scrutinsResumes: [], positionsEnsemble: [], votesArticles: [], amendementsClefs: [],
      motionsCensure: [{ date: new Date('2025-10-16T12:00:00Z'), titre: 'la motion de censure … alinéa 2 …', sort: 'rejete', pourParGroupe: [{ nom: 'RN', pour: 122 }] }],
    });
    expect(prompt).toMatch(/Voix sur la motion : voir ci-dessous/);
    expect(prompt).not.toMatch(/ne portent que sur des amendements/);
  });
});

describe('positionsAvecMotions', () => {
  const motions = [{
    date: new Date('2025-02-05T12:00:00Z'), titre: 'la motion de censure … alinéa 3 …', sort: 'rejete',
    pourParGroupe: [{ nom: 'LFI-NFP', pour: 71 }, { nom: 'ECOS', pour: 38 }],
  }];

  it('retire les phrases du modèle sur la motion et ajoute la phrase calculée', () => {
    const sortie = positionsAvecMotions(
      "Le RN a soutenu l'article liminaire. Il s'est opposé à la motion de censure. LFI a voté contre l'article 40.",
      motions,
    );
    expect(sortie).not.toMatch(/opposé à la motion/);
    expect(sortie).toContain("Le RN a soutenu l'article liminaire. LFI a voté contre l'article 40.");
    expect(sortie).toContain('Motion de censure du 05/02/2025, rejetée : ont voté pour LFI-NFP (71), ECOS (38).');
  });

  it('laisse les positions intactes sans motion', () => {
    expect(positionsAvecMotions('Texte.', [])).toBe('Texte.');
  });
});

describe('separerResumePositions', () => {
  it('reconnaît les variantes de séparateur observées', () => {
    for (const r of ['Résumé.\n---POSITIONS---\nPos.', 'Résumé.\n\n---\nPOSITIONS\n\nPos.', 'Résumé.\n\nPOSITIONS ---\nPos.']) {
      expect(separerResumePositions(r)).toEqual({ resume: 'Résumé.', positions: 'Pos.' });
    }
  });

  it('sans séparateur, prend le premier paragraphe comme résumé', () => {
    expect(separerResumePositions('Résumé.\n\nPos 1.\n\nPos 2.')).toEqual({ resume: 'Résumé.', positions: 'Pos 1.\n\nPos 2.' });
  });
});
