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
  checkInversions,
  type Chambre,
  type GroupeVote,
} from './ia-quality.js';

function groupeVote(
  nom: string,
  nomComplet: string | null,
  pour: number,
  contre: number,
  abstention: number,
  chambre?: Chambre,
): GroupeVote {
  return {
    groupe: nom,
    nomComplet,
    orientation: null,
    pour,
    contre,
    abstention,
    matcher: buildGroupMatcher(nom, nomComplet),
    chambre,
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
    // LAREM (AN) et LREM (Sénat, devenu RDPI) : le modèle écrit « LREM » pour l'AN.
    expect(familyOf('LREM')).toBe(familyOf('LAREM'));
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

  it('ne compte pas l’égalité comme une abstention majoritaire, comme le prompt', () => {
    // UC sur `enseignement-superieur-et-recherche` : 31 pour, 31 abstentions.
    // Le prompt annonce « Très favorable », le modèle écrit « a voté pour ».
    expect(computeTendency(31, 0, 31)).toBe('FAV');
    expect(computeTendency(0, 9, 9)).toBe('OPP');
    expect(computeTendency(31, 0, 32)).toBe('ABSTENTION_MAJ');
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

  it('ne signale pas « LREM » écrit pour le groupe LAREM de l’Assemblée', () => {
    const groupes = [...knownGroups, ...['LREM', 'LAREM'].map(nom => ({
      nom, nomComplet: null, orientation: null, matcher: buildGroupMatcher(nom, null),
    }))];
    const votes = [groupeVote('LAREM', 'La République en Marche', 369, 1, 1)];
    const issues = checkGrounding(
      'Le groupe LREM [centre] a massivement soutenu le texte, avec 369 voix pour.',
      votes,
      groupes,
      new Set([familyOf('LAREM')]),
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

describe('checkInversions — bornage aux charnières adversatives', () => {
  // SOC a voté contre : 0 pour, 93 contre.
  const soc = groupeVote('SOC', 'Socialiste, Écologiste et Républicain', 0, 93, 0);
  // UMP a voté pour : 206 pour, 0 contre.
  const ump = groupeVote('UMP', 'Les Républicains', 206, 0, 0);

  it('ne signale rien quand le « voté pour » appartient à la proposition précédente', () => {
    const texte =
      "Le groupe UMP et l'Union Centriste ont voté massivement en faveur du texte, " +
      "tandis que le groupe Socialiste, Écologiste et Républicain et le groupe CRC s'y sont opposés.";
    expect(checkInversions(texte, [soc])).toHaveLength(0);
  });

  it('ne signale rien après « à l’inverse »', () => {
    const texte =
      "La majorité a systématiquement voté pour l'ensemble du texte. " +
      "À l'inverse, le groupe Socialiste, Écologiste et Républicain a voté contre.";
    expect(checkInversions(texte, [soc])).toHaveLength(0);
  });

  it('ne signale rien quand la charnière suit la mention', () => {
    const texte =
      "Au Sénat, le groupe UMP a voté à l'unanimité pour le texte, " +
      "mais d'autres groupes s'y sont fermement opposés.";
    expect(checkInversions(texte, [ump])).toHaveLength(0);
  });

  it('signale toujours une vraie inversion, sans charnière', () => {
    const texte = "Le groupe Socialiste, Écologiste et Républicain a voté pour le texte.";
    const issues = checkInversions(texte, [soc]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.describedAs).toBe('FAVORABLE');
  });

  it('signale une vraie inversion située après une charnière', () => {
    const texte =
      "La droite s'est opposée au texte. " +
      "À l'inverse, le groupe Socialiste, Écologiste et Républicain a voté pour.";
    const issues = checkInversions(texte, [soc]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.describedAs).toBe('FAVORABLE');
  });

  it('signale une vraie inversion sur un groupe décrit comme opposé alors qu’il a voté pour', () => {
    const texte = "Le groupe UMP s'est fermement opposé au texte.";
    const issues = checkInversions(texte, [ump]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.describedAs).toBe('OPPOSED');
  });
});

describe('checkInversions — bornage aux phrases et négations', () => {
  const soc = groupeVote('SOC', 'Socialiste, Écologiste et Républicain', 91, 0, 0);
  const lr = groupeVote('LR', 'Les Républicains', 67, 0, 0);

  it('ne reprend pas la polarité de la phrase précédente', () => {
    const texte =
      "Le groupe UMP s'est montré très opposé au texte, votant contre à l'unanimité. " +
      "Le groupe Socialiste, Écologiste et Républicain et le groupe CRC ont voté pour.";
    expect(checkInversions(texte, [soc])).toHaveLength(0);
  });

  it('ne lit pas « aucun groupe n’a voté contre » comme une opposition', () => {
    const texte =
      "L'article a été adopté à l'unanimité par les groupes LAREM, DEM et LR. " +
      "Aucun groupe n'a voté contre ou s'est abstenu sur cet article.";
    expect(checkInversions(texte, [lr])).toHaveLength(0);
  });

  it('signale toujours une inversion réelle dans une phrase isolée', () => {
    const texte =
      "Le débat a été vif. Le groupe Socialiste, Écologiste et Républicain s'est fermement opposé au texte. " +
      "La suite de l'examen est reportée.";
    const issues = checkInversions(texte, [soc]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.describedAs).toBe('OPPOSED');
  });
});

describe('groupe cité comme exception', () => {
  const knownGroups = ['CRC', 'LFI-NFP'].map(nom => ({
    nom, nomComplet: null, orientation: null, matcher: buildGroupMatcher(nom, null),
  }));

  it('ne prête pas à l’exception la position des autres groupes', () => {
    const crc = groupeVote('CRC', 'Communiste Républicain Citoyen et Écologiste - Kanaky', 0, 0, 18);
    const issues = checkGrounding(
      "Tous les groupes politiques représentés au Sénat, à l'exception du groupe CRC, ont voté en faveur de cette résolution.",
      [crc], knownGroups, new Set([familyOf('CRC')]),
    );
    expect(issues.filter(i => i.kind === 'abstention_described_as_vote')).toHaveLength(0);
  });

  it('reconnaît « sauf » devant l’intitulé complet', () => {
    const lfi = groupeVote('LFI-NFP', 'La France insoumise - Nouveau Front Populaire', 0, 128, 0);
    const texte = "À l'Assemblée nationale, tous les groupes sauf La France insoumise - Nouveau Front Populaire [gauche] ont voté pour.";
    expect(checkInversions(texte, [lfi])).toHaveLength(0);
  });

  it('signale toujours le groupe quand il n’est pas l’exception', () => {
    const lfi = groupeVote('LFI-NFP', 'La France insoumise - Nouveau Front Populaire', 0, 128, 0);
    expect(checkInversions('La France insoumise - Nouveau Front Populaire a voté pour le texte.', [lfi])).toHaveLength(1);
  });
});

describe('votes comparés chambre par chambre', () => {
  // PLFSS 2026 : les socialistes de l'Assemblée ont voté pour, ceux du Sénat contre.
  const socAN = groupeVote('SOC', 'Socialistes et apparentés', 125, 0, 11, 'assemblee');
  const socSenat = groupeVote('SOC', 'Groupe Socialiste, Écologiste et Républicain', 0, 127, 0, 'senat');

  it('ne signale pas une phrase vraie dans une chambre et muette sur laquelle', () => {
    expect(checkInversions('Les socialistes [SOC] ont voté pour le texte.', [socAN, socSenat])).toHaveLength(0);
  });

  it('compare à la chambre que la phrase nomme', () => {
    const issues = checkInversions('Au Sénat, les socialistes [SOC] ont voté pour le texte.', [socAN, socSenat]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.contre).toBe(127);
  });

  it('trouve la chambre dans la phrase quand une charnière la coupe de la mention', () => {
    const texte = "Au Sénat, l'Union centriste a voté pour, tandis que le groupe SOC a voté pour lui aussi.";
    expect(checkInversions(texte, [socAN, socSenat])).toHaveLength(1);
  });

  it('ne tient pas pour ambigu l’intitulé d’un seul des deux groupes', () => {
    // `batir-la-societe-du-bien-vieillir` à l'envers : l'intitulé « Socialistes
    // et apparentés » ne désigne que le groupe de l'Assemblée.
    const anAbstient = groupeVote('SOC', 'Socialistes et apparentés', 0, 0, 60, 'assemblee');
    const senatPour = groupeVote('SOC', 'Groupe Socialiste, Écologiste et Républicain', 62, 0, 0, 'senat');
    const issues = checkGrounding(
      "Les Socialistes et apparentés ont voté pour l'ensemble du texte.",
      [anAbstient, senatPour], [], new Set([familyOf('SOC')]),
    );
    expect(issues.filter(i => i.kind === 'abstention_described_as_vote')).toHaveLength(1);
  });

  it('tient pour ambigu « Les Républicains », nom des groupes LR et UMP', () => {
    // `immigration-droit-d-asile-et-integration`.
    const lr = groupeVote('LR', 'Les Républicains', 0, 82, 0, 'assemblee');
    const ump = groupeVote('UMP', 'Groupe Les Républicains', 140, 2, 3, 'senat');
    expect(checkInversions('Les Républicains [droite] ont voté pour le texte dans son ensemble.', [lr, ump])).toHaveLength(0);
  });

  it('contrôle les deux chambres quand la proposition les nomme toutes deux', () => {
    const lr = groupeVote('LR', 'Les Républicains', 4, 0, 19, 'assemblee');
    const ump = groupeVote('UMP', 'Groupe Les Républicains', 200, 0, 0, 'senat');
    const issues = checkGrounding(
      "Les Républicains (UMP au Sénat, LR à l'Assemblée) ont globalement soutenu la loi.",
      [lr, ump], [], new Set([familyOf('LR')]),
    );
    expect(issues.filter(i => i.kind === 'abstention_described_as_vote').map(i => i.groupe)).toEqual(['LR']);
  });

  it('ne lit pas le sigle SOC-A comme le groupe SOC de l’autre chambre', () => {
    const socA = groupeVote('SOC-A', 'Socialistes et apparentés', 0, 0, 24, 'assemblee');
    const soc = groupeVote('SOC', 'Groupe Socialiste, Écologiste et Républicain', 62, 0, 0, 'senat');
    const issues = checkGrounding('Le groupe SOC-A a voté pour le texte.', [socA, soc], [], new Set([familyOf('SOC')]));
    expect(issues.filter(i => i.kind === 'abstention_described_as_vote')).toHaveLength(1);
  });
});

describe('checkInversions — passif', () => {
  const soc = groupeVote('SOC', 'Socialiste, Écologiste et Républicain', 94, 0, 0);

  it('ne lit pas le rejet d’un amendement du groupe comme son vote', () => {
    const texte = 'Un amendement du groupe Socialiste, Écologiste et Républicain a été rejeté en commission.';
    expect(checkInversions(texte, [soc])).toHaveLength(0);
  });

  it('signale toujours le groupe qui a lui-même rejeté le texte', () => {
    const issues = checkInversions('Le groupe Socialiste, Écologiste et Républicain a rejeté le texte.', [soc]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.describedAs).toBe('OPPOSED');
  });
});
