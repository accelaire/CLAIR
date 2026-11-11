import { describe, it, expect } from 'vitest';
import {
  actesDossier,
  alineaMotion,
  calculerMotions,
  calculerProjets,
  calculerReponses,
  clePersonne,
  depotDossierAN,
  engagementsDesMotions,
  gouvernementALaDate,
  natureProjet,
  posteALaDate,
  premierSignataireMotion,
  rolesSignataires,
  signetSenat,
  stadeDossierAN,
  type Acte,
  type PosteRef,
} from './bilan-gouvernement';
import type { DepotSenat } from '../sources/senat/dosleg-depots';

const poste = (p: Partial<PosteRef> & Pick<PosteRef, 'id'>): PosteRef => ({
  uid: `PM-${p.id}`, gouvernementId: 'g1', rangProtocolaire: 10, prenom: 'Jean', nom: 'Dupont',
  dateDebut: '2024-01-01', dateFin: null, ...p,
});
const acte = (code: string, date: string | null, statut: string | null = null): Acte => ({
  code, date, statut, textesAssocies: [], voteRefs: [],
});

describe('clePersonne', () => {
  it('rapproche les noms coupés par le Sénat et les accents', () => {
    expect(clePersonne('Bruno Le', 'Maire')).toBe(clePersonne('Bruno', 'Le Maire'));
    expect(clePersonne('Amélie de', 'Montchalin')).toBe(clePersonne('Amélie', 'de Montchalin'));
    expect(clePersonne('Laurent', 'Nuñez')).toBe(clePersonne('Laurent', 'NUNEZ'));
    expect(clePersonne('Jean-Yves Le', 'Drian')).toBe(clePersonne('Jean-Yves', 'Le Drian'));
  });
});

describe('posteALaDate', () => {
  const postes = [
    poste({ id: 'a', rangProtocolaire: 20, dateDebut: '2024-01-01', dateFin: '2024-06-30' }),
    poste({ id: 'b', rangProtocolaire: 5, dateDebut: '2024-03-01', dateFin: null }),
  ];
  it('prend le poste du jour, le plus haut dans l’ordre protocolaire quand il y en a deux', () => {
    expect(posteALaDate(postes, '2024-02-01')?.id).toBe('a');
    expect(posteALaDate(postes, '2024-04-01')?.id).toBe('b');
    expect(posteALaDate(postes, '2023-12-31')).toBeNull();
  });
  it('compte les bornes', () => {
    expect(posteALaDate(postes, '2024-06-30')?.id).toBe('b');
    expect(posteALaDate([postes[0]!], '2024-06-30')?.id).toBe('a');
  });
});

describe('gouvernementALaDate', () => {
  it('donne le nouveau gouvernement le jour de la passation', () => {
    const g = [
      { id: 'barnier', dateDebut: '2024-09-21', dateFin: '2024-12-23' },
      { id: 'bayrou', dateDebut: '2024-12-23', dateFin: null },
    ];
    expect(gouvernementALaDate(g, '2024-12-04')?.id).toBe('barnier');
    expect(gouvernementALaDate(g, '2024-12-23')?.id).toBe('bayrou');
  });
});

describe('actesDossier, mandats et signet', () => {
  const sourceData = {
    titreDossier: { senatChemin: 'http://www.senat.fr/dossier-legislatif/pjl24-661.html' },
    actesLegislatifs: {
      acteLegislatif: [
        {
          codeActe: 'AN21',
          actesLegislatifs: {
            acteLegislatif: [
              { codeActe: 'AN21-DGVT', dateActe: '2026-01-30T00:00:00.000+01:00', texteAssocie: 'DECLANR5L17B2410-N0' },
              { codeActe: 'AN21-MOTION-VOTE', dateActe: '2026-02-02', voteRefs: { voteRef: ['VTANR5L17V5284', 'VTANR5L17V5285'] } },
              { codeActe: 'AN21-X', texteAssocie: { refTexteAssocie: 'PRJL1' } },
            ],
          },
        },
      ],
    },
  };
  it('aplatit les actes et lit dates de Paris, textes et votes', () => {
    const actes = actesDossier(sourceData);
    expect(actes.map((a) => a.code)).toEqual(['AN21', 'AN21-DGVT', 'AN21-MOTION-VOTE', 'AN21-X']);
    expect(actes[1]).toMatchObject({ date: '2026-01-30', textesAssocies: ['DECLANR5L17B2410-N0'] });
    expect(actes[2]!.voteRefs).toEqual(['VTANR5L17V5284', 'VTANR5L17V5285']);
    expect(actes[3]!.textesAssocies).toEqual(['PRJL1']);
  });
  it('lit le signet Sénat', () => {
    expect(signetSenat(sourceData)).toBe('pjl24-661');
    expect(signetSenat({ titreDossier: { senatChemin: null } })).toBeNull();
  });
});

describe('stadeDossierAN', () => {
  it('promulgué par l’AN ou par DOSLEG', () => {
    expect(stadeDossierAN([acte('AN1-DEPOT', '2024-01-01'), acte('PROM-PUB', '2024-05-01')], false)).toBe('promulgue');
    expect(stadeDossierAN([acte('SN1-DEPOT', '2018-01-01')], true)).toBe('promulgue');
  });
  it('déposé, jamais examiné : un renvoi en commission n’est pas un examen', () => {
    expect(stadeDossierAN([acte('AN1-DEPOT', '2018-01-01'), acte('AN1-COM-FOND-SAISIE', '2018-01-02')], false)).toBe('depose');
  });
  it('examiné : une décision de séance, sans adoption définitive', () => {
    expect(stadeDossierAN([acte('AN1-DEPOT', '2018-01-01'), acte('AN1-DEBATS-DEC', '2018-03-01', 'adopté')], false)).toBe('examine');
    // Un rejet en première lecture ne clôt rien.
    expect(stadeDossierAN([acte('AN1-DEPOT', '2018-01-01'), acte('AN1-DEBATS-DEC', '2018-03-01', 'rejeté')], false)).toBe('examine');
  });
  it('adopté définitivement : CMP votée par les deux chambres, saisine du CC, conforme', () => {
    expect(stadeDossierAN([
      acte('CMP-DEBATS-AN-DEC', '2024-01-01', 'adopté, dans les conditions prévues à l’article 45'),
      acte('CMP-DEBATS-SN-DEC', '2024-01-02', 'adopté'),
    ], false)).toBe('adopte');
    expect(stadeDossierAN([acte('AN1-DEBATS-DEC', '2024-01-01', 'adopté'), acte('CC-SAISIE-SN', '2024-01-10')], false)).toBe('adopte');
    expect(stadeDossierAN([
      acte('SN1-DEBATS-DEC', '2024-01-01', 'adopté'),
      acte('AN1-DEBATS-DEC', '2024-02-01', 'adopté sans modification'),
    ], false)).toBe('adopte');
  });
  it('« sans modification » sans décision préalable de l’autre chambre n’est pas définitif', () => {
    expect(stadeDossierAN([acte('AN1-DEBATS-DEC', '2024-02-01', 'adopté sans modification')], false)).toBe('examine');
  });
  it('un texte de CMP rejeté par une chambre n’est pas adopté', () => {
    expect(stadeDossierAN([
      acte('CMP-DEBATS-AN-DEC', '2024-01-01', 'considéré comme rejeté par l’Assemblée nationale en application de l’article 49, alinéa 3'),
      acte('CMP-DEBATS-SN-DEC', '2024-01-02', 'adopté'),
    ], false)).toBe('examine');
  });
});

describe('depotDossierAN', () => {
  it('prend le premier dépôt, à l’Assemblée ou au Sénat', () => {
    expect(depotDossierAN([acte('AN1-DEPOT', '2024-03-01'), acte('SN1-DEPOT', '2024-01-15')])).toEqual({ chambre: 'senat', date: '2024-01-15' });
    expect(depotDossierAN([acte('AN1-DEPOT', '2024-03-01')])).toEqual({ chambre: 'assemblee', date: '2024-03-01' });
    expect(depotDossierAN([acte('AN1-COM', '2024-03-01')])).toBeNull();
  });
});

describe('natureProjet', () => {
  it('lit la ratification d’ordonnance dans le titre long ou le chemin AN, pas dans le titre court', () => {
    expect(natureProjet({ typloicod: 'pjl', titres: ["Projet de loi ratifiant l'ordonnance n° 2022-1336 relative au code de la commande publique"] }))
      .toBe('ratification_ordonnance');
    expect(natureProjet({ procedureCode: '1', titres: ["Publication d'informations non financières", 'ratification_ordonnance_2017-1180'] }))
      .toBe('ratification_ordonnance');
    expect(natureProjet({ procedureCode: '1', titres: ['Code de la commande publique'] })).toBe('ordinaire');
  });
  it('une habilitation à légiférer par ordonnance reste un texte ordinaire', () => {
    expect(natureProjet({ procedureCode: '1', titres: ['Projet de loi habilitant le Gouvernement à prendre par ordonnances des mesures'] }))
      .toBe('ordinaire');
  });
  it('procédures et types', () => {
    expect(natureProjet({ procedureCode: '6', titres: [] })).toBe('convention');
    expect(natureProjet({ typloicod: 'cvn', titres: [] })).toBe('convention');
    expect(natureProjet({ procedureCode: '21', titres: [] })).toBe('finances');
    expect(natureProjet({ procedureCode: '7', titres: [] })).toBe('constitutionnelle');
    expect(natureProjet({ typloicod: 'pjlo', titres: [] })).toBe('organique');
    // Loi de règlement étiquetée « Proposition de loi ordinaire » par l'AN.
    expect(natureProjet({ procedureCode: '2', titres: ['Règlement du budget 2017'] })).toBe('finances');
  });
});

describe('rolesSignataires', () => {
  it('PM, puis chef de file, puis cosignataires ; un poste cité deux fois compte une fois', () => {
    const pm = poste({ id: 'pm', rangProtocolaire: 1 });
    const a = poste({ id: 'a' });
    const b = poste({ id: 'b' });
    expect(rolesSignataires([
      { poste: pm, source: 'assemblee' }, { poste: a, source: 'assemblee' }, { poste: b, source: 'senat' }, { poste: a, source: 'senat' },
    ])).toEqual([
      { posteId: 'pm', rang: 1, role: 'premier_ministre', source: 'assemblee' },
      { posteId: 'a', rang: 2, role: 'chef_de_file', source: 'assemblee' },
      { posteId: 'b', rang: 3, role: 'cosignataire', source: 'senat' },
    ]);
  });
});

describe('motions', () => {
  it('lit l’alinéa et le premier signataire', () => {
    const t3 = "la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par M. Stéphane Peu, Mme Mathilde Panot, Mme Cyrielle Chatelain et 110 députés.";
    const t2 = "la motion de censure, déposée en application de l'article 49, alinéa 2, de la Constitution, par Mme Mathilde Panot et 57 députés.";
    expect(alineaMotion(t3)).toBe(3);
    expect(alineaMotion(t2)).toBe(2);
    expect(premierSignataireMotion(t3)).toBe('Stéphane Peu');
    expect(premierSignataireMotion(t2)).toBe('Mathilde Panot');
    expect(premierSignataireMotion('la motion de censure par Mmes Cyrielle Chatelain, Nadège Abomangoli et 56 députés.')).toBe('Cyrielle Chatelain');
    expect(premierSignataireMotion('… de la Constitution par Mmes Cyrielle Chatelain et Mathilde Panot, MM. André Chassaigne et 146 membres')).toBe('Cyrielle Chatelain');
    expect(premierSignataireMotion('… de la Constitution par Mme Marine Le Pen et 89 membres de l’Assemblée.')).toBe('Marine Le Pen');
  });

  it('rattache l’alinéa 3 à son engagement par voteRefs, pas par la date', () => {
    const g = [{ id: 'g', dateDebut: '2025-10-12', dateFin: null }];
    const { motions } = calculerMotions(
      [
        { id: 's1', uid: 'VTANR5L17V5284', date: '2026-02-02', titre: 'motion de censure … article 49, alinéa 3, …' },
        { id: 's2', uid: 'VTANR5L17V5300', date: '2026-02-02', titre: 'motion de censure … article 49, alinéa 3, …' },
        { id: 's3', uid: 'VTANR5L17V5301', date: '2026-02-02', titre: 'motion de censure … article 49, alinéa 2, …' },
      ],
      [
        { dossierId: 'e1', posteId: 'pm', date: '2026-01-30', texteRef: null, voteRefs: ['VTANR5L17V5284'], datesSeance: [] },
        { dossierId: 'e2', posteId: 'pm', date: '2026-01-30', texteRef: null, voteRefs: ['VTANR5L17V5300'], datesSeance: [] },
      ],
      g,
    );
    expect(motions.map((m) => [m.scrutinId, m.alinea, m.engagementDossierId])).toEqual([
      ['s1', 3, 'e1'], ['s2', 3, 'e2'], ['s3', 2, null],
    ]);
  });
});

describe('engagementsDesMotions (16e législature, sans voteRefs)', () => {
  const e = (dossierId: string, date: string, datesSeance: string[] = []) =>
    ({ dossierId, posteId: 'pm', date, texteRef: null, voteRefs: [], datesSeance });

  it('rattache par la séance de vote, ou par le premier vote qui suit l’engagement', () => {
    const r = engagementsDesMotions(
      [{ uid: 'v1', date: '2022-11-04' }, { uid: 'v2', date: '2022-12-02' }],
      [e('a', '2022-11-02', ['2022-11-04']), e('b', '2022-11-30')],
    );
    expect([...r]).toEqual([['v1', 'a'], ['v2', 'b']]);
  });

  it('ne choisit pas quand deux engagements votent le même jour (24/10/2022)', () => {
    const r = engagementsDesMotions(
      [{ uid: 'v358', date: '2022-10-24' }, { uid: 'v359', date: '2022-10-24' }, { uid: 'v360', date: '2022-10-24' }, { uid: 'v485', date: '2022-10-31' }],
      [e('plf', '2022-10-19', ['2022-10-24']), e('plfss', '2022-10-20'), e('plf2', '2022-10-26', ['2022-10-31'])],
    );
    expect([...r]).toEqual([['v485', 'plf2']]);
  });

  it('un engagement sans séance publiée ne prend pas un vote au-delà de 10 jours', () => {
    expect(engagementsDesMotions([{ uid: 'v', date: '2022-12-20' }], [e('x', '2022-11-30')]).size).toBe(0);
  });
});

describe('calculerReponses', () => {
  it('rattache au poste du jour, compte les autres', () => {
    const postes = [poste({ id: 'p', prenom: 'Bruno', nom: 'Le Maire', dateDebut: '2017-05-17', dateFin: '2024-09-21' })];
    const r = calculerReponses([
      { id: 'i1', date: '2020-01-01', prenom: 'Bruno Le', nom: 'Maire' },
      { id: 'i2', date: '2025-01-01', prenom: 'Bruno', nom: 'Le Maire' },
      { id: 'i3', date: '2020-01-01', prenom: 'Inconnu', nom: 'X' },
    ], postes);
    expect(r.reponses).toEqual([{ interventionId: 'i1', posteId: 'p' }]);
    expect(r.nonRattachees).toBe(2);
  });

  it('rattache un nom composé publié en partie (« Agresti-Roubache » / « Roubache »), jamais un autre prénom', () => {
    const postes = [
      poste({ id: 's', prenom: 'Sabrina', nom: 'Roubache', dateDebut: '2024-02-09', dateFin: '2024-09-05' }),
      poste({ id: 'x', prenom: 'Marc', nom: 'Roubache', dateDebut: '2024-02-09', dateFin: '2024-09-05' }),
    ];
    const r = calculerReponses([
      { id: 'i1', date: '2024-04-09', prenom: 'Sabrina', nom: 'Agresti-Roubache' },
      { id: 'i2', date: '2024-04-09', prenom: 'Julie', nom: 'Agresti-Roubache' },
      { id: 'i3', date: '2024-12-18', prenom: 'Sabrina', nom: 'Agresti-Roubache' },
    ], postes);
    expect(r.reponses).toEqual([{ interventionId: 'i1', posteId: 's' }]);
  });
});

describe('calculerProjets', () => {
  const pm = poste({ id: 'pm', uid: 'PM1', rangProtocolaire: 1, prenom: 'Élisabeth', nom: 'Borne', dateDebut: '2022-05-16' });
  const ministre = poste({ id: 'min', uid: 'PM2', prenom: 'Bruno', nom: 'Le Maire', dateDebut: '2022-05-20' });
  const gouvernements = [{ id: 'g1', dateDebut: '2022-05-16', dateFin: null }];
  const depot = (signet: string, extra: Partial<DepotSenat> = {}): DepotSenat => ({
    signet, typloicod: 'pjl', titreLong: 'Projet de loi relatif à X', dateDepot: '2022-06-15',
    promulgue: false, examine: false, adopteDefinitivement: false,
    ministres: [{ rang: 1, prenom: 'Bruno', nom: 'LE MAIRE', fonction: 'ministre de l’économie' }], ...extra,
  });
  const dossierAN = (uid: string, mandats: string[], actes: unknown[], senat?: string, procedureCode = '1') => ({
    id: `id-${uid}`, uid, procedureCode, titre: 'Titre', titreChemin: null,
    sourceData: {
      initiateur: { acteurs: { acteur: mandats.map((m) => ({ acteurRef: 'PA', mandatRef: m })) } },
      titreDossier: { senatChemin: senat ? `http://www.senat.fr/dossier-legislatif/${senat}.html` : null },
      actesLegislatifs: { acteLegislatif: actes },
    },
  });

  it('complète un projet « PM seul » par les ministres du dépôt au Sénat', () => {
    const { projets } = calculerProjets({
      dossiersAN: [dossierAN('DL1', ['PM1'], [{ codeActe: 'SN1-DEPOT', dateActe: '2022-06-15' }], 'pjl21-700')],
      depotsSenat: [depot('pjl21-700')],
      dossiersSenat: new Map([['pjl21-700', 'senat-700']]),
      postes: [pm, ministre],
      gouvernements,
    });
    expect(projets).toHaveLength(1);
    expect(projets[0]).toMatchObject({ dossierId: 'id-DL1', chambreDepot: 'senat', dateDepot: '2022-06-15', stade: 'depose' });
    expect(projets[0]!.signataires.map((s) => [s.posteId, s.role, s.source])).toEqual([
      ['pm', 'premier_ministre', 'assemblee'], ['min', 'chef_de_file', 'senat'],
    ]);
  });

  it('prend le dossier du Sénat pour un dépôt que l’Assemblée n’a pas reçu', () => {
    const { projets } = calculerProjets({
      dossiersAN: [],
      depotsSenat: [depot('pjl21-701', { titreLong: "Projet de loi ratifiant l'ordonnance n° 2022-1336" })],
      dossiersSenat: new Map([['pjl21-701', 'senat-701']]),
      postes: [pm, ministre],
      gouvernements,
    });
    expect(projets[0]).toMatchObject({ dossierId: 'senat-701', nature: 'ratification_ordonnance', chambreDepot: 'senat' });
  });

  it('ignore une proposition (aucun signataire ministre) et un dépôt d’avant juin 2017', () => {
    const { projets } = calculerProjets({
      dossiersAN: [
        dossierAN('DL2', ['PM-depute'], [{ codeActe: 'AN1-DEPOT', dateActe: '2022-07-01' }], undefined, '2'),
        dossierAN('DL3', ['PM1'], [{ codeActe: 'AN1-DEPOT', dateActe: '2017-06-01' }]),
      ],
      depotsSenat: [],
      dossiersSenat: new Map(),
      postes: [pm, ministre],
      gouvernements,
    });
    expect(projets).toEqual([]);
  });

  it('un dossier de procédure « projet » sans signataire à l’AN prend les ministres du Sénat, sur le dossier AN', () => {
    const { projets } = calculerProjets({
      dossiersAN: [dossierAN('DL4', [], [{ codeActe: 'SN1-DEPOT', dateActe: '2022-06-15' }], 'pjl21-703', '6')],
      depotsSenat: [depot('pjl21-703', { typloicod: 'cvn' })],
      dossiersSenat: new Map([['pjl21-703', 'senat-703']]),
      postes: [pm, ministre],
      gouvernements,
    });
    expect(projets.map((p) => [p.dossierId, p.nature, p.signataires.map((s) => s.posteId)])).toEqual([['id-DL4', 'convention', ['min']]]);
  });

  it('signale un auteur du Sénat sans poste à la date du dépôt', () => {
    const { anomalies } = calculerProjets({
      dossiersAN: [],
      depotsSenat: [depot('pjl21-702', { ministres: [{ rang: 1, prenom: 'Inconnu', nom: 'X', fonction: null }] })],
      dossiersSenat: new Map([['pjl21-702', 'senat-702']]),
      postes: [pm, ministre],
      gouvernements,
    });
    expect(anomalies.auteursSenatNonRattaches).toEqual(['pjl21-702 : Inconnu X (2022-06-15)']);
  });
});
