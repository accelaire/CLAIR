import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  anomaliesBloquantes,
  construireDonnees,
  normaliserNom,
  personneDuLibellePresidence,
  reduireActeur,
  type DonneesGouvernements,
} from './gouvernements-client';

// Extraits réels de l'AMO30 (17e législature, archive du 21/10/2026) : tous les
// organes GOUVERNEMENT et PRESREP, et neuf acteurs choisis pour les anomalies
// de la source (SPEC-GOUVERNEMENT.md, §2). Leurs mandats sont réduits aux
// types MINISTERE, PRESREP, SENAT et GOUVERNEMENT. Deux acteurs de l'archive
// du 25/10/2026 s'y ajoutent, réduits à leurs mandats BUREAU : Yaël
// Braun-Pivet (deux présidences de l'Assemblée) et Guillaume Gonzalez
// (président d'âge, qui n'est pas une présidence).
const fixture = JSON.parse(
  readFileSync(path.join(__dirname, '__fixtures__', 'amo30-gouvernements.json'), 'utf-8'),
) as { organes: unknown[]; acteurs: unknown[] };

const d = construireDonnees(fixture.organes, fixture.acteurs);
const postesDe = (acteurUid: string) => d.postes.filter((p) => p.acteurUid === acteurUid);
const poste = (uid: string) => d.postes.find((p) => p.uid === uid)!;

describe('construireDonnees — gouvernements', () => {
  it('lit les 17 gouvernements depuis 2007, dans l’ordre, avec leurs dates telles que publiées', () => {
    expect(d.gouvernements).toHaveLength(17);
    expect(d.gouvernements[0]).toEqual({ uid: 'PO382939', libelleSource: 'FILLON 1', dateDebut: '2007-05-17', dateFin: '2007-06-18' });
    // A1 : Fillon 2 commence le jour où Fillon 1 finit.
    expect(d.gouvernements[1]!.dateDebut).toBe('2007-06-18');
    expect(d.gouvernements.at(-1)).toEqual({ uid: 'PO873634', libelleSource: 'LECORNU II', dateDebut: '2025-10-11', dateFin: null });
  });
});

describe('construireDonnees — postes', () => {
  it('lit un poste avec son portefeuille et son gouvernement', () => {
    expect(poste('PM873637')).toEqual({
      uid: 'PM873637',
      gouvernementUid: 'PO873634',
      acteurUid: 'PA643210',
      organeUid: 'PO873635',
      qualite: 'Premier ministre',
      qualiteAccordee: 'Premier ministre',
      rangProtocolaire: 1,
      intitule: 'Premier ministre',
      intituleCourt: 'Premier ministre',
      intituleComplement: null,
      dateDebut: '2025-10-11',
      dateFin: null,
      datePublication: '2025-10-11',
    });
  });

  it('garde la fin d’un poste en affaires courantes, au lendemain de la fin du gouvernement (A2)', () => {
    // Valls 1 finit le 25/08/2014 ; Harlem Désir reste en fonction jusqu'au 26.
    // Le complément est gardé tel que publié, virgule de tête comprise.
    expect(poste('PM700881')).toEqual({
      uid: 'PM700881',
      gouvernementUid: 'PO700706',
      acteurUid: 'PA700879',
      organeUid: 'PO700838',
      qualite: "Secrétaire d'État",
      qualiteAccordee: "Secrétaire d'État",
      rangProtocolaire: 50,
      intitule:
        "Secrétariat d'État, auprès du ministre des affaires étrangères et du développement international, chargé des affaires européennes",
      intituleCourt: 'Affaires européennes',
      intituleComplement: ', auprès du ministre des affaires étrangères et du développement international, chargé des affaires européennes',
      dateDebut: '2014-04-10',
      dateFin: '2014-08-26',
      datePublication: '2014-04-10',
    });
  });

  it('date un poste par son mandat quand le portefeuille n’a pas de date (A5, PO653320)', () => {
    expect(poste('PM653322')).toMatchObject({
      acteurUid: 'PA267622',
      organeUid: 'PO653320',
      gouvernementUid: 'PO653199',
      intituleCourt: 'Intérieur',
      dateDebut: '2012-06-22',
      dateFin: '2014-03-31',
    });
  });

  it('garde deux portefeuilles tenus en même temps dans le même gouvernement', () => {
    // François Fillon, Premier ministre et ministre de l'Écologie par intérim en 2012.
    const fillon3 = postesDe('PA1310').filter((p) => p.gouvernementUid === 'PO425695');
    expect(fillon3.map((p) => p.uid).sort()).toEqual(['PM425758', 'PM514485']);
    expect(fillon3.map((p) => p.rangProtocolaire).sort((a, b) => a - b)[0]).toBe(1);
  });

  it('garde deux postes successifs dans le même gouvernement, passation le même jour', () => {
    expect(postesDe('PA388160').map((p) => [p.uid, p.gouvernementUid, p.dateDebut, p.dateFin])).toEqual([
      ['PM388291', 'PO384206', '2007-06-19', '2009-06-23'],
      ['PM419580', 'PO384206', '2009-06-23', '2010-11-13'],
    ]);
  });

  it('ignore les appartenances GOUVERNEMENT, dont des fantômes jamais clos (A3, Bayrou)', () => {
    // Deux mandats « membre » de Bayrou pour François Bayrou, dont un sans fin ;
    // seuls ses postes comptent, et ils sont clos.
    expect(postesDe('PA410').map((p) => [p.uid, p.dateFin])).toEqual([
      ['PM717249', '2017-06-19'],
      ['PM855580', '2025-09-09'],
    ]);
    expect(d.postes.some((p) => p.uid.startsWith('PM15'))).toBe(false);
  });
});

describe('construireDonnees — membres', () => {
  it('écarte les missions : un parlementaire en mission n’est pas membre du gouvernement', () => {
    expect(d.membres.some((m) => m.acteurUid === 'PA497')).toBe(false);
    expect(d.postes.some((p) => p.acteurUid === 'PA497')).toBe(false);
  });

  it('ne fait pas d’un président sans poste ministériel un membre', () => {
    expect(d.membres.some((m) => m.acteurUid === 'PA1654')).toBe(false);
  });

  it('lit l’état civil et repère un mandat de sénateur dans l’AMO30', () => {
    expect(d.membres.find((m) => m.acteurUid === 'PA643210')).toEqual({
      acteurUid: 'PA643210',
      civilite: 'M.',
      prenom: 'Sébastien',
      nom: 'Lecornu',
      dateNaissance: '1986-06-11',
      senateur: true,
    });
    expect(d.membres.find((m) => m.acteurUid === 'PA267622')!.senateur).toBe(false);
  });
});

describe('construireDonnees — présidences', () => {
  it('lit les trois présidences, la personne venant du libellé de l’organe', () => {
    expect(d.presidences.map((p) => [p.uid, p.prenom, p.nom, p.dateDebut, p.dateFin])).toEqual([
      ['PO382940', 'Nicolas', 'Sarkozy', '2007-05-16', '2012-05-15'],
      ['PO696251', 'François', 'Hollande', '2012-05-15', '2017-05-14'],
      ['PO717136', 'Emmanuel', 'Macron', '2017-05-14', null],
    ]);
  });

  it('ne rattache un acteur qu’à l’organe qui le nomme (A4)', () => {
    // Hollande a aussi un mandat PRESREP ouvert sur l'organe de Sarkozy.
    expect(d.presidences.map((p) => p.acteurUid)).toEqual([null, 'PA1654', 'PA702992']);
  });
});

describe('construireDonnees — présidences de l’Assemblée', () => {
  it('lit les présidences au bureau, une par législature, et écarte le président d’âge', () => {
    expect(d.presidencesAssemblee).toEqual([
      { uid: 'PM800479', acteurUid: 'PA721908', prenom: 'Yaël', nom: 'Braun-Pivet', dateDebut: '2022-06-28', dateFin: '2024-06-09' },
      expect.objectContaining({ acteurUid: 'PA721908', dateDebut: '2024-07-18', dateFin: null }),
    ]);
  });

  it('garde un acteur qui n’a qu’une présidence de l’Assemblée, et lui seul', () => {
    const avecBureau = (uid: string) =>
      (fixture.acteurs as { acteur: { uid: { '#text': string } } }[]).find((a) => a.acteur.uid['#text'] === uid);
    expect(reduireActeur(avecBureau('PA721908'))).not.toBeNull();
    expect(reduireActeur(avecBureau('PA793362'))).toBeNull();
  });
});

describe('anomaliesBloquantes', () => {
  const complet: DonneesGouvernements = {
    ...d,
    // Les planchers sont ceux de l'archive entière ; on complète les postes
    // pour ne tester que les règles de cohérence.
    postes: [...d.postes, ...Array.from({ length: 766 }, (_, i) => ({ ...d.postes[0]!, uid: `PMX${i}` }))],
    presidencesAssemblee: [
      ...d.presidencesAssemblee,
      ...Array.from({ length: 5 }, (_, i) => ({ ...d.presidencesAssemblee[0]!, uid: `PMP${i}` })),
    ],
  };

  it('accepte les extraits complétés aux planchers… sauf les gouvernements sans Premier ministre', () => {
    const erreurs = anomaliesBloquantes(complet);
    // Seuls les gouvernements dont le Premier ministre manque aux extraits.
    expect(erreurs.every((e) => /sans Premier ministre/.test(e))).toBe(true);
    expect(erreurs.some((e) => e.includes('PO873634'))).toBe(false);
  });

  it('refuse une archive tronquée', () => {
    const erreurs = anomaliesBloquantes({ ...complet, gouvernements: complet.gouvernements.slice(0, 10) });
    expect(erreurs).toContain('10 gouvernements (au moins 17 attendus)');
    // Les extraits n'ont que deux présidences de l'Assemblée sur sept.
    expect(anomaliesBloquantes(d)).toContain("2 présidences de l'Assemblée (au moins 7 attendues)");
  });

  it('refuse un poste dont le portefeuille n’est pas dans un gouvernement de l’archive', () => {
    const orphelin = { ...d.postes[0]!, uid: 'PM0', organeUid: 'PO268781', gouvernementUid: 'PO268150' };
    const erreurs = anomaliesBloquantes({ ...complet, postes: [...complet.postes, orphelin] });
    expect(erreurs.some((e) => e.startsWith('poste PM0') && e.includes('PO268781'))).toBe(true);
  });

  it('refuse un poste sans rang protocolaire ou sans date', () => {
    const casse = { ...d.postes[0]!, uid: 'PM1', rangProtocolaire: NaN, dateDebut: '' };
    const erreurs = anomaliesBloquantes({ ...complet, postes: [...complet.postes, casse] });
    expect(erreurs).toEqual(expect.arrayContaining([expect.stringContaining('PM1'), expect.stringMatching(/PM1.*rang protocolaire/)]));
  });
});

describe('outils', () => {
  it('normalise casse, accents et tirets', () => {
    expect(normaliserNom('Jean-Yves Le Drian')).toBe(normaliserNom('JEAN YVES LE DRIAN'));
    expect(normaliserNom('Élisabeth Borne')).toBe('elisabeth borne');
  });

  it('lit la personne d’un libellé de présidence', () => {
    expect(personneDuLibellePresidence('Présidence de la République : M. Nicolas Sarkozy')).toEqual({
      civilite: 'M.',
      prenom: 'Nicolas',
      nom: 'Sarkozy',
    });
    expect(personneDuLibellePresidence('Présidence de la République')).toBeNull();
  });

  it('réduit un acteur à ses mandats utiles, et écarte celui qui n’a ni poste ni présidence', () => {
    type Acteur = { acteur: { uid: { '#text': string }; mandats: { mandat: { typeOrgane: string }[] } } };
    const lecornu = (fixture.acteurs as Acteur[]).find((a) => a.acteur.uid['#text'] === 'PA643210');
    const types = (reduireActeur(lecornu) as Acteur).acteur.mandats.mandat.map((m) => m.typeOrgane);
    expect(types).not.toContain('GOUVERNEMENT');
    expect(types).toContain('SENAT');
    const senateurSeul = { acteur: { uid: { '#text': 'PA1' }, mandats: { mandat: { typeOrgane: 'SENAT' } } } };
    expect(reduireActeur(senateurSeul)).toBeNull();
  });
});
