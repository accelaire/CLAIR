import { describe, it, expect } from 'vitest';
import {
  dateDuDossier,
  dateEnLettres,
  jourParis,
  decouperOdj,
  derniereEtape,
  estSuivie,
  lireOdj,
  lireReponseOfficielle,
  numeroDuDossier,
} from './parcours';

// Ordres du jour réels des commissions de l'AN (table `reunions`, 22/11/2026).
const ODJ = {
  eco20250908:
    '– Nomination d’un rapporteur, en application de l’article 148 alinéa 2 du Règlement, sur une pétition renvoyée à la Commission (pétitition « Non à la Loi Duplomb — Pour la santé, la sécurité, l’intelligence collective »), en vue de sa présentation à la commission.',
  eco20250917:
    '– Présentation, en application de l’article 148 alinéa 3 du Règlement, de deux pétitions renvoyées à la commission, intitulées « Non à la Loi Duplomb - Pour la santé, la sécurité, l’intelligence collective » (n° 3014) et « Pétition contre la loi Duplomb » (n° 3092) (Mme Hélène Laporte, rapporteure), et vote en vue de leur classement ou de leur examen par la commission.',
  eco20251008:
    '- Nomination d’un rapporteur sur le projet de nomination, en application de l’article 13 de la Constitution, de Mme Marie-Ange Debon, au poste de président du conseil d’administration du groupe La Poste; -- Nomination d’un rapporteur de la mission flash sur l’incidence économique de l’utilisation d’hydrocarbures dans la production d’huiles alimentaires et leur mise sur le marché ;\n- Nomination d’un rapporteur sur la proposition de loi visant à rendre systématique l’information du consommateur sur l’origine des denrées alimentaires par le moyen de l’étiquetage (n° 1837) ;\n- Nomination de rapporteurs sur la pétition n° 3014 « Non à la loi Duplomb – Pour la santé, la sécurité, l’intelligence collective » en vue de son examen par la commission en application de l’article 148 du Règlement ;\n- Audition de M. Benoît Bazin, président-directeur général de Saint-Gobain.',
  eco20251105:
    "- Examen, en application de l’article 148 du Règlement, de la pétition intitulée « Non à la Loi Duplomb - Pour la santé, la sécurité, l’intelligence collective » (n° 3014) (Mmes Hélène Laporte et Aurélie Trouvé, rapporteures).\n- Nomination d'un rapporteur sur la proposition de loi visant à interdire l’importation en France de produits agricoles et denrées alimentaires contenant de l’acétamipride (n° 1959) ;",
  eco20260107:
    '- Nomination d’un rapporteur, en application de l’article 148 alinéa 2 du Règlement, sur les pétitions renvoyées à la commission, en vue de leur présentation ;\n- Audition de M. Clément Beaune, Haut-commissaire à la Stratégie et au Plan.',
  dvp20260325:
    'Désignation d’un rapporteur sur la proposition de loi visant à accélérer le développement du transport maritime à propulsion vélique (n° 1502) ;\nDésignation d’un rapporteur, en application de l’article 148 alinéa 2 du Règlement, sur quatre pétitions renvoyées à la commission (pétitions n° 2760 pour l’abrogation des ZFE, n° 3021 pour une sortie des pesticides de synthèse, n° 3070 pour l’abrogation du contrôle technique des motos, et n° 4583 pour stopper le massacre injustifié des renards) ;\nTable ronde « Démographie et aménagement du territoire »',
  dvp20260408:
    '– Décision, en application de l’article 148, alinéa 3 du Règlement, sur quatre pétitions (pétitions n° 2760 pour l’abrogation des ZFE, n° 3021 pour une sortie des pesticides de synthèse, n° 3070 pour l’abrogation du contrôle technique des motos et n° 4583 pour stopper le massacre injustifié des renards) (Mme Ersilia Soudais, rapporteure) ;\r– Audition de M. Sylvain Waserman, président-directeur général de l’Agence de la transition écologique (ADEME).',
  lois20260410:
    'Examen, en application de l’article 88 du Règlement, des amendements à la proposition de loi visant à instaurer une procédure simplifiée de recouvrement des créances commerciales incontestées (n° 2578) (M. Charles Sitzenstuhl, rapporteur) ;\nNomination d’un rapporteur sur la décision de classement ou d’examen, en application de l’article 148 alinéa 3 du Règlement, de la pétition n°5158 « Non à la loi Yadan ».',
  lois20260415:
    'Décision de classement ou d’examen, en application de l’article 148 alinéa 3 du Règlement, de la pétition n°5158 « Non à la loi Yadan » (M. Pierre Cazeneuve, rapporteur) ;\nNomination de rapporteurs :\n- sur la proposition de loi visant à moderniser et à simplifier la protection juridique des majeurs (n° 1943) ;',
  eco20260916:
    "- Nomination d’un rapporteur en vue de l’examen, en application de l'article 148 du Règlement, de la pétition n° 5174 (« Facturation électronique obligatoire, c’est non ! ») ;\n- Nomination d’un rapporteur sur la proposition de loi renforçant la responsabilité des locataires et des bailleurs dans le logement social (n° 3109) ;",
  // Les deux faux positifs d'une lecture trop large : le « n° » appartient à un autre texte.
  cedu20250604:
    '-- Désignation de rapporteurs :\r•chargé des pétitions renvoyées à la commission, en application à l’article 148 du règlement à l’Assemblée nationale\r•sur la proposition de résolution européenne visant à soutenir une politique ambitieuse et ouverte de la recherche scientifique de l’Union européenne (n° 1430)',
  soc20261007:
    '-- Nomination de rapporteurs sur les propositions de loi :\r -visant l’augmentation des salaires et des pensions (n° 3176) ;\r-- Examen de la proposition de loi visant à moderniser et rééquilibrer le fonctionnement du titre-restaurant (n° 2892)\r-- Décision, en application de l’article 148, alinéa 3, du Règlement, sur la pétition n° 4753 du 20 novembre 2025 « Pour rendre obligatoire l’affichage du Nutri-Score sur les emballages des aliments en France »',
  cedu20261104:
    '- Désignation d’un rapporteur chargé de proposer le classement ou l’examen de la pétition « Supprimer CNews de l’audiovisuel français »',
  cedu20261110:
    '- Présentation de la pétition « Supprimer CNews de l’audiovisuel français » et vote sur son classement ou son examen, en application du 3e alinéa de l’article 148 du Règlement de l’Assemblée nationale (M. Alexandre Portier, rapporteur)',
  table20250506:
    '- Table ronde, ouverte à la presse, réunissant :\r•\tMme Charlyne Buigues, infirmière et auteure de la pétition « #StopSkinnyTok »',
};

const resume = (odj: string) => lireOdj(odj).map(({ type, numeros, titres }) => ({ type, numeros, titres }));

describe('decouperOdj', () => {
  it('sépare les points par ligne et par « ; » suivi d’un tiret', () => {
    const points = decouperOdj(ODJ.eco20251008);
    expect(points).toHaveLength(5);
    expect(points[1]).toMatch(/^Nomination d’un rapporteur de la mission flash/);
  });
});

describe('lireOdj : numéros', () => {
  it('lit le numéro collé ou espacé après « pétition »', () => {
    expect(resume(ODJ.lois20260410)).toEqual([{ type: 'rapporteur', numeros: [5158], titres: [] }]);
    expect(resume(ODJ.lois20260415)).toEqual([{ type: 'decision', numeros: [5158], titres: [] }]);
    expect(resume(ODJ.eco20260916)).toEqual([{ type: 'rapporteur', numeros: [5174], titres: [] }]);
  });

  it('lit la liste des numéros d’un pluriel, jusqu’à la parenthèse', () => {
    expect(resume(ODJ.dvp20260325)).toEqual([{ type: 'rapporteur', numeros: [2760, 3021, 3070, 4583], titres: [] }]);
    expect(resume(ODJ.dvp20260408)).toEqual([{ type: 'decision', numeros: [2760, 3021, 3070, 4583], titres: [] }]);
  });

  it('lit « « titre » (n° X) » après « pétitions intitulées »', () => {
    expect(resume(ODJ.eco20250917)).toEqual([{ type: 'decision', numeros: [3014, 3092], titres: [] }]);
    expect(resume(ODJ.eco20251105)).toEqual([{ type: 'examen', numeros: [3014], titres: [] }]);
  });

  it('ne prend que le point qui parle de la pétition', () => {
    expect(resume(ODJ.eco20251008)).toEqual([{ type: 'rapporteur', numeros: [3014], titres: [] }]);
    expect(resume(ODJ.soc20261007)).toEqual([{ type: 'decision', numeros: [4753], titres: [] }]);
  });

  it('ne rattache aucun numéro d’un autre texte (faux positifs 1430 et 3176)', () => {
    expect(resume(ODJ.cedu20250604)).toEqual([]);
    expect(resume(ODJ.soc20261007).flatMap((p) => p.numeros)).not.toContain(3176);
  });

  it('ignore les points sans pétition nommée et ceux qui ne sont pas une étape', () => {
    expect(resume(ODJ.eco20260107)).toEqual([]);
    expect(resume(ODJ.table20250506)).toEqual([]);
  });
});

describe('lireOdj : titres sans numéro', () => {
  it('lit le titre entre guillemets, coquille « pétitition » comprise', () => {
    expect(resume(ODJ.eco20250908)).toEqual([
      { type: 'rapporteur', numeros: [], titres: ['Non à la Loi Duplomb — Pour la santé, la sécurité, l’intelligence collective'] },
    ]);
  });

  it('distingue la nomination du rapporteur et la décision (n° 5820, CNews)', () => {
    expect(resume(ODJ.cedu20261104)).toEqual([
      { type: 'rapporteur', numeros: [], titres: ['Supprimer CNews de l’audiovisuel français'] },
    ]);
    expect(resume(ODJ.cedu20261110)).toEqual([
      { type: 'decision', numeros: [], titres: ['Supprimer CNews de l’audiovisuel français'] },
    ]);
  });

  it('ne prend pas pour titre sans numéro celui qui est suivi de son numéro', () => {
    expect(lireOdj(ODJ.eco20250917)[0]?.titres).toEqual([]);
  });
});

describe('dossiers de la procédure « Pétitions »', () => {
  it('lit le numéro des quatre titres en base', () => {
    expect(numeroDuDossier('Pétition n°1067 du 20 octobre 2022 « Allongement de la durée du congé maternité »')).toBe(1067);
    expect(numeroDuDossier('Pétition n° 1999 du 7 novembre 2023 « Abandon du projet d’autoroute Toulouse-Castres A69/A680 »')).toBe(1999);
    expect(numeroDuDossier('Rapport sur la pétition n° 3014 du 10 juillet 2025 « Non à la loi Duplomb »')).toBe(3014);
    expect(numeroDuDossier('DOSSIER : rapport déposé en application de l’article 148 du règlement, par la commission des affaires sociales, en conclusion des travaux sur la pétition n°4753 « Pour rendre obligatoire l’affichage du Nutri-Score »')).toBe(4753);
    expect(numeroDuDossier('Proposition de loi visant à interdire les compétitions de gifles')).toBeNull();
  });

  it('date le dossier par le dépôt du rapport', () => {
    const source = {
      actesLegislatifs: {
        acteLegislatif: {
          codeActe: 'AN20',
          dateActe: null,
          actesLegislatifs: {
            acteLegislatif: [
              { codeActe: 'AN20-COM', dateActe: '2026-09-30T00:00:00.000+02:00' },
              { codeActe: 'AN20-RAPPORT', dateActe: '2026-10-07T00:00:00.000+02:00' },
            ],
          },
        },
      },
    };
    expect(dateDuDossier(source)?.toISOString().slice(0, 10)).toBe('2026-10-07');
    expect(dateDuDossier({})).toBeNull();
  });
});

describe('jourParis', () => {
  it('donne la date à Paris d’une réunion stockée en UTC', () => {
    expect(jourParis(new Date('2026-04-15T07:00:00Z')).toISOString().slice(0, 10)).toBe('2026-04-15');
    // 0 h 13 à Paris l'été = 22 h 13 UTC la veille.
    expect(jourParis(new Date('2026-07-21T22:13:00Z')).toISOString().slice(0, 10)).toBe('2026-07-22');
    // Hiver : UTC+1.
    expect(jourParis(new Date('2026-01-14T23:30:00Z')).toISOString().slice(0, 10)).toBe('2026-01-15');
  });
});

describe('dateEnLettres', () => {
  it('lit la première date en toutes lettres', () => {
    expect(dateEnLettres('Lors de sa réunion du mardi 23 novembre 2021, la Conférence…')?.toISOString().slice(0, 10)).toBe('2021-11-23');
    expect(dateEnLettres('le 1er juin 2023')?.toISOString().slice(0, 10)).toBe('2023-06-01');
    expect(dateEnLettres('sans date')).toBeNull();
  });
});

describe('lireReponseOfficielle', () => {
  // Blocs réels des pages i-5158 (AN) et i-742 (Sénat), réduits à la réponse.
  const AN_5158 = `<div class="row column"><div class="columns small-12 callout alert initiative-answer"><div class="row"><div class="columns small-12 "><h5> Cette pétition a été classée par la commission : </h5></div><div class="columns small-12"><span>15/04/2026</span></div></div><p><p>La commission des Lois a décidé de classer cette pétition lors de sa réunion du 15 avril 2026 à 12h30.</p></p></div></div>`;
  const SENAT_742 = `<div class="columns small-12 callout success initiative-answer"><div class="row"><div class="columns small-12 medium-12"><h5> Cette pétition a atteint le seuil de signatures requis: </h5></div></div><p><p><strong><u>Décision de la Conférence des Présidents</u> :</strong></p><p>Lors de sa réunion du mardi 23 novembre 2021, la Conférence des Présidents a décidé de renvoyer cette pétition à la commission des affaires économiques et à la commission des lois en vue de la création d'une mission conjointe de contrôle.</p><p><img src="data:image/jpeg;base64,AAAA" alt=""></p><p>*******************</p><ul><li><a href="http://www.senat.fr/notice-rapport/2021/r21-882-notice.html">Rapport d'information n° 882</a> de Mme Maryse CARRÈRE</li></ul></p></div>`;

  it('lit la décision de classement de l’AN et sa date', () => {
    const r = lireReponseOfficielle(AN_5158);
    expect(r?.titre).toBe('Cette pétition a été classée par la commission :');
    expect(r?.texte).toBe('La commission des Lois a décidé de classer cette pétition lors de sa réunion du 15 avril 2026 à 12h30.');
    expect(r?.date?.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('lit la décision de la Conférence des Présidents, datée dans le texte', () => {
    const r = lireReponseOfficielle(SENAT_742);
    // Blocs séparés par une ligne vide, image et séparateur retirés, lien gardé.
    expect(r?.texte?.split('\n\n')).toEqual([
      'Décision de la Conférence des Présidents :',
      "Lors de sa réunion du mardi 23 novembre 2021, la Conférence des Présidents a décidé de renvoyer cette pétition à la commission des affaires économiques et à la commission des lois en vue de la création d'une mission conjointe de contrôle.",
      "– [Rapport d'information n° 882](http://www.senat.fr/notice-rapport/2021/r21-882-notice.html) de Mme Maryse CARRÈRE",
    ]);
    expect(r?.date?.toISOString().slice(0, 10)).toBe('2021-11-23');
  });

  it('garde les liens, relatifs compris, et les éléments de liste sur des lignes voisines', () => {
    const html = `<div class="initiative-answer"><h5>Réponse</h5><p><a href="/presse/cp.html" target="_blank">Lire le communiqué de presse</a></p><ul><li><a href="javascript:void(0)">Synthèse</a></li><li>Vidéo : https://videos.assemblee-nationale.fr/v.1</li></ul></div>`;
    expect(lireReponseOfficielle(html, 'https://www.senat.fr/petitions/')?.texte).toBe(
      '[Lire le communiqué de presse](https://www.senat.fr/presse/cp.html)\n\n– Synthèse\n– Vidéo : https://videos.assemblee-nationale.fr/v.1',
    );
  });

  it('rend null sans bloc de réponse', () => {
    expect(lireReponseOfficielle('<div class="initiative"><p>Texte</p></div>')).toBeNull();
  });
});

describe('derniereEtape et estSuivie', () => {
  const e = (type: Parameters<typeof estSuivie>[1][number]['type'], date: string | null) => ({ type, date: date ? new Date(`${date}T00:00:00Z`) : null });

  it('prend la plus récente, la plus avancée dans une même journée', () => {
    expect(derniereEtape([e('rapporteur', '2026-04-10'), e('decision', '2026-04-15'), e('classement', '2026-04-15')])?.type).toBe('classement');
    expect(derniereEtape([e('seuil_atteint', null), e('decision_conference', '2021-11-23')])?.type).toBe('decision_conference');
    expect(derniereEtape([])).toBeNull();
  });

  it('suit au-delà du seuil ou avec une étape institutionnelle, pas pour un classement seul', () => {
    expect(estSuivie(10_000, [], 10_000)).toBe(true);
    expect(estSuivie(157, [e('rapporteur', '2026-10-07')], 10_000)).toBe(true);
    expect(estSuivie(9_999, [e('classement', '2024-07-20')], 10_000)).toBe(false);
    expect(estSuivie(null, [], 10_000)).toBe(false);
  });
});
