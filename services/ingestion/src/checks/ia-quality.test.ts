// =============================================================================
// Tests des primitives d'audit des résumés IA.
// Chaque cas encode une erreur réellement observée en prod (cf. le sujet
// « mobilisation-habitant-existant-crise-logement-17e », août 2026).
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  buildGroupMatcher,
  matchGroup,
  familyOf,
  computeTendency,
  checkGrounding,
  type GroupeVote,
} from './ia-quality.js';

function groupeVote(
  nom: string,
  nomComplet: string | null,
  pour: number,
  contre: number,
  abstention: number,
): GroupeVote {
  return {
    groupe: nom,
    nomComplet,
    orientation: null,
    pour,
    contre,
    abstention,
    matcher: buildGroupMatcher(nom, nomComplet),
  };
}

describe('buildGroupMatcher / matchGroup', () => {
  it('ne confond pas le sigle NI avec la conjonction « ni »', () => {
    const ni = buildGroupMatcher('NI', 'Non inscrit');
    expect(matchGroup("le texte n'est ni pour ni contre", ni)).toBeNull();
    expect(matchGroup('le groupe NI est divisé', ni)?.mention).toBe('NI');
  });

  it('ne confond pas les sigles courts avec des mots français', () => {
    expect(matchGroup('une mesure de droite', buildGroupMatcher('DR', 'Droite Républicaine'))).toBeNull();
    expect(matchGroup('re-examiner le texte', buildGroupMatcher('RE', 'Renaissance'))).toBeNull();
    expect(matchGroup('le lt du texte', buildGroupMatcher('LT', 'Libertés et Territoires'))).toBeNull();
  });

  it('ne matche pas un sigle noyé dans un mot', () => {
    const rn = buildGroupMatcher('RN', 'Rassemblement National');
    expect(matchGroup('le gouvernement a tranché', rn)).toBeNull();
    expect(matchGroup('le RN a voté pour', rn)?.mention).toBe('RN');
  });

  it('reconnaît un groupe par son intitulé long et ses alias, sans égard à la casse', () => {
    const lfi = buildGroupMatcher('LFI-NFP', 'La France insoumise - Nouveau Front Populaire');
    expect(matchGroup('La France insoumise s’y oppose', lfi)).not.toBeNull();
    expect(matchGroup('les insoumis s’y opposent', lfi)).not.toBeNull();
  });

  it('respecte les frontières de mot sur les alias', () => {
    const ecos = buildGroupMatcher('ECOS', 'Écologiste et Social');
    // « écologiste » est un alias : il ne doit pas matcher au milieu d'un mot.
    expect(matchGroup('une transition écologiste', ecos)).not.toBeNull();
    expect(matchGroup('un virage écologisme', ecos)).toBeNull();
  });
});

describe('familyOf', () => {
  it('rattache les sigles successifs d’une même famille', () => {
    expect(familyOf('FI')).toBe(familyOf('LFI-NFP'));
    expect(familyOf('LFI-NUPES')).toBe(familyOf('LFI-NFP'));
    expect(familyOf('SOC-A')).toBe(familyOf('SOC'));
    expect(familyOf('GDR-NUPES')).toBe(familyOf('GDR'));
  });

  it('ne fusionne pas des familles distinctes', () => {
    expect(familyOf('RN')).not.toBe(familyOf('LFI-NFP'));
    expect(familyOf('LIOT')).not.toBe(familyOf('HOR'));
  });

  it('laisse passer un sigle inconnu', () => {
    expect(familyOf('XYZ')).toBe('XYZ');
  });
});

describe('computeTendency', () => {
  it('traite l’abstention majoritaire comme une position à part entière', () => {
    // Cas GDR sur le vote d'ensemble : 1 contre pour 2 abstentions n'est pas
    // un groupe « opposé ».
    expect(computeTendency(0, 1, 2)).toBe('ABSTENTION_MAJ');
    expect(computeTendency(0, 0, 29)).toBe('ABSTENTION');
    expect(computeTendency(4, 16, 44)).toBe('ABSTENTION_MAJ');
  });

  it('conserve les tendances classiques quand les voix exprimées dominent', () => {
    expect(computeTendency(35, 0, 0)).toBe('FAV');
    expect(computeTendency(0, 28, 0)).toBe('OPP');
    expect(computeTendency(10, 9, 1)).toBe('DIV');
  });
});

describe('checkGrounding', () => {
  const knownGroups = ['RN', 'LFI-NFP', 'ECOS', 'SOC', 'GEST'].map(nom => ({
    nom,
    nomComplet: null,
    orientation: null,
    matcher: buildGroupMatcher(nom, null),
  }));

  it('signale une abstention de bloc décrite comme un vote', () => {
    const votes = [groupeVote('RN', 'Rassemblement National', 0, 0, 29)];
    const issues = checkGrounding(
      'Le Rassemblement National a voté pour tous les articles clés du texte.',
      votes,
      knownGroups,
      new Set([familyOf('RN')]),
    );
    expect(issues.filter(i => i.kind === 'abstention_described_as_vote')).toHaveLength(1);
  });

  it('accepte une abstention correctement décrite', () => {
    const votes = [groupeVote('RN', 'Rassemblement National', 0, 0, 29)];
    const issues = checkGrounding(
      'Le Rassemblement National s’est abstenu en bloc sur l’article 2.',
      votes,
      knownGroups,
      new Set([familyOf('RN')]),
    );
    expect(issues.filter(i => i.kind === 'abstention_described_as_vote')).toHaveLength(0);
  });

  it('ignore une abstention trop faible pour être une consigne de groupe', () => {
    const votes = [groupeVote('ECOS', 'Écologiste et Social', 0, 0, 2)];
    const issues = checkGrounding(
      'Le groupe ECOS a voté pour le texte.',
      votes,
      knownGroups,
      new Set([familyOf('ECOS')]),
    );
    expect(issues.filter(i => i.kind === 'abstention_described_as_vote')).toHaveLength(0);
  });

  it('signale une position prêtée à un groupe absent des données', () => {
    const votes = [groupeVote('RN', 'Rassemblement National', 30, 0, 0)];
    const issues = checkGrounding(
      'Le groupe GEST s’est fermement opposé au texte.',
      votes,
      knownGroups,
      new Set([familyOf('RN')]),
    );
    expect(issues.filter(i => i.kind === 'group_not_in_data')).toHaveLength(1);
  });

  it('ne signale pas un groupe présent uniquement via les votes par article', () => {
    // `votes` n'agrège que le scrutin sur l'ensemble ; ECOS n'y figure pas mais
    // a voté sur les articles, donc le LLM disposait bien de ses positions.
    const votes = [groupeVote('RN', 'Rassemblement National', 30, 0, 0)];
    const issues = checkGrounding(
      'Le groupe ECOS s’est opposé à l’article premier.',
      votes,
      knownGroups,
      new Set([familyOf('RN'), familyOf('ECOS')]),
    );
    expect(issues.filter(i => i.kind === 'group_not_in_data')).toHaveLength(0);
  });

  it('ne signale pas un sigle d’une autre législature pour la même famille', () => {
    const votes = [groupeVote('LFI-NFP', 'La France insoumise - Nouveau Front Populaire', 0, 28, 0)];
    const issues = checkGrounding(
      'La France insoumise s’est opposée au texte.',
      votes,
      knownGroups,
      new Set([familyOf('LFI-NFP')]),
    );
    expect(issues.filter(i => i.kind === 'group_not_in_data')).toHaveLength(0);
  });

  it('signale un groupe pesant jamais mentionné', () => {
    const votes = [groupeVote('SOC', 'Socialistes et apparentés', 0, 0, 12)];
    const issues = checkGrounding(
      'Le texte a été adopté sans difficulté.',
      votes,
      knownGroups,
      new Set([familyOf('SOC')]),
    );
    expect(issues.filter(i => i.kind === 'group_missing_from_text')).toHaveLength(1);
  });
});
