import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { ImageCommons } from '../sources/wikidata/commons-client';

vi.mock('../sources/wikidata/client', () => ({ wikidataGet: vi.fn() }));
vi.mock('../sources/wikidata/commons-client', () => ({ lireImagesCommons: vi.fn() }));

import { wikidataGet } from '../sources/wikidata/client';
import { lireImagesCommons } from '../sources/wikidata/commons-client';
import {
  candidatDepuisEntite,
  creditValide,
  fichierDepuisPage,
  imagePrincipale,
  rapprocher,
  syncPhotosGouvernement,
  type Candidat,
  type MembreARapprocher,
  type WbEntite,
} from './photos-gouvernement';

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

function candidat(c: Partial<Candidat> & { qid: string }): Candidat {
  return { humain: true, noms: [], naissances: [], identifiantsAN: [], debutsFonctions: [], ...c };
}

describe('rapprocher', () => {
  const baptiste: MembreARapprocher = {
    acteurUid: 'PA855049',
    prenom: 'Philippe',
    nom: 'Baptiste',
    dateNaissance: date('1972-03-28'),
    debutsPostes: [date('2024-12-23')],
  };

  it("écarte l'homonyme qui porte l'identifiant de l'Assemblée mais une autre naissance", () => {
    // Relevé le 15/11/2026 : l'identifiant du ministre est posé sur un homonyme né en 1973.
    const r = rapprocher(baptiste, [
      candidat({
        qid: 'Q98234202',
        noms: ['philippe baptiste'],
        naissances: [{ iso: '1973-05-13', precision: 11 }],
        identifiantsAN: ['855049'],
      }),
      candidat({
        qid: 'Q106287381',
        noms: ['philippe baptiste'],
        naissances: [{ iso: '1972-03-28', precision: 11 }],
        debutsFonctions: ['2024-12-23'],
      }),
    ]);
    expect(r).toEqual({ qid: 'Q106287381', preuves: ['naissance', 'debut_poste'] });
  });

  it("retient sur l'identifiant de l'Assemblée seul", () => {
    const r = rapprocher({ ...baptiste, dateNaissance: null }, [
      candidat({ qid: 'Q1', noms: ['philippe baptiste'], identifiantsAN: ['855049'] }),
    ]);
    expect(r).toEqual({ qid: 'Q1', preuves: ['identifiant_an'] });
  });

  it("écarte un autre député (autre identifiant de l'Assemblée)", () => {
    const r = rapprocher(baptiste, [
      candidat({ qid: 'Q1', noms: ['philippe baptiste'], identifiantsAN: ['1'], debutsFonctions: ['2024-12-23'] }),
    ]);
    expect(r).toMatchObject({ qid: null, motif: 'aucun' });
  });

  it("retient sans date de naissance sur le début d'un poste, à un mois près", () => {
    const membre = { ...baptiste, dateNaissance: null };
    expect(rapprocher(membre, [candidat({ qid: 'Q1', noms: ['philippe baptiste'], debutsFonctions: ['2025-01-20'] })]))
      .toEqual({ qid: 'Q1', preuves: ['debut_poste'] });
    expect(rapprocher(membre, [candidat({ qid: 'Q1', noms: ['philippe baptiste'], debutsFonctions: ['2025-01-24'] })]))
      .toMatchObject({ qid: null, motif: 'aucun' });
  });

  it('écarte une naissance différente, même de quelques jours, ou une autre année', () => {
    // Alain Griset : 20/05/1953 à l'Assemblée, 30/05/1953 sur Wikidata.
    const r = rapprocher(baptiste, [
      candidat({ qid: 'Q1', noms: ['philippe baptiste'], naissances: [{ iso: '1972-03-18', precision: 11 }], debutsFonctions: ['2024-12-23'] }),
      candidat({ qid: 'Q2', noms: ['philippe baptiste'], naissances: [{ iso: '1971', precision: 9 }], debutsFonctions: ['2024-12-23'] }),
    ]);
    expect(r).toMatchObject({ qid: null, motif: 'aucun' });
  });

  it("ne tient pas une année de naissance pour une preuve, sans la contredire si c'est la bonne", () => {
    const r = rapprocher(baptiste, [
      candidat({ qid: 'Q1', noms: ['philippe baptiste'], naissances: [{ iso: '1972', precision: 9 }] }),
      candidat({ qid: 'Q2', noms: ['philippe baptiste'], naissances: [{ iso: '1972', precision: 9 }], debutsFonctions: ['2024-12-23'] }),
    ]);
    expect(r).toEqual({ qid: 'Q2', preuves: ['debut_poste'] });
  });

  it('exige un humain au nom exact', () => {
    const r = rapprocher(baptiste, [
      candidat({ qid: 'Q1', humain: false, noms: ['philippe baptiste'], debutsFonctions: ['2024-12-23'] }),
      candidat({ qid: 'Q2', noms: ['philippe baptiste junior'], debutsFonctions: ['2024-12-23'] }),
    ]);
    expect(r).toMatchObject({ qid: null, motif: 'aucun' });
  });

  it('ne choisit pas entre deux candidats prouvés', () => {
    const r = rapprocher(baptiste, [
      candidat({ qid: 'Q1', noms: ['philippe baptiste'], debutsFonctions: ['2024-12-23'] }),
      candidat({ qid: 'Q2', noms: ['philippe baptiste'], naissances: [{ iso: '1972-03-28', precision: 11 }] }),
    ]);
    expect(r).toEqual({ qid: null, motif: 'ambigu', candidats: ['Q1', 'Q2'] });
  });
});

describe('candidatDepuisEntite', () => {
  it('lit libellés (fr, mul) et alias, ignore les déclarations dépréciées', () => {
    const e: WbEntite = {
      id: 'Q1',
      labels: { mul: { value: 'Chrysoúla Zacharopoúlou' } },
      aliases: { fr: [{ value: 'Chrysoula Zacharopoulou' }] },
      claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
        P569: [
          { rank: 'deprecated', mainsnak: { datavalue: { value: { time: '+1970-01-01T00:00:00Z', precision: 11 } } } },
          { mainsnak: { datavalue: { value: { time: '+1976-05-07T00:00:00Z', precision: 11 } } } },
          { mainsnak: { datavalue: { value: { time: '+1976-00-00T00:00:00Z', precision: 9 } } } },
        ],
        P4123: [{ mainsnak: { datavalue: { value: '791658' } } }],
        P39: [
          { mainsnak: {}, qualifiers: { P580: [{ datavalue: { value: { time: '+2022-07-04T00:00:00Z', precision: 11 } } }] } },
          { mainsnak: {}, qualifiers: { P580: [{ datavalue: { value: { time: '+2019-00-00T00:00:00Z', precision: 9 } } }] } },
        ],
      },
    };
    expect(candidatDepuisEntite(e)).toEqual({
      qid: 'Q1',
      humain: true,
      noms: ['chrysoula zacharopoulou'],
      naissances: [{ iso: '1976-05-07', precision: 11 }, { iso: '1976', precision: 9 }],
      identifiantsAN: ['791658'],
      debutsFonctions: ['2022-07-04'],
    });
  });
});

describe('imagePrincipale', () => {
  const p18 = (valeur: string, rank?: 'preferred' | 'deprecated') => ({ rank, mainsnak: { datavalue: { value: valeur } } });
  it('prend la déclaration privilégiée, sinon la première non dépréciée', () => {
    expect(imagePrincipale({ claims: { P18: [p18('a.jpg'), p18('b.jpg', 'preferred')] } })).toBe('b.jpg');
    expect(imagePrincipale({ claims: { P18: [p18('a.jpg', 'deprecated'), p18('c.jpg')] } })).toBe('c.jpg');
    expect(imagePrincipale({ claims: {} })).toBeNull();
  });
});

describe('creditValide', () => {
  const image = (licence: string | null, auteur: string | null): ImageCommons => ({
    fichier: 'f.jpg', vignette: 'v', page: 'p', auteur, licence, licenceUrl: null,
  });
  it.each([
    ['CC BY-SA 4.0', 'Auteur', true],
    ['CC BY-SA 3.0 fr', 'Auteur', true],
    ['CC BY 2.0', 'Auteur', true],
    ['Licence Ouverte', 'Ministère', true],
    ['CC0', null, true],
    ['Public domain', null, true],
    ['CC BY-SA 3.0', null, false], // l'auteur est exigé par la licence
    ['European Parliament', '© European Union', false],
    [null, 'Auteur', false],
    ['CC BY 3.0', 'x'.repeat(151), false], // des consignes, pas un crédit
  ])('%s, auteur %s → %s', (licence, auteur, attendu) => {
    expect(creditValide(image(licence, auteur))).toBe(attendu);
  });
});

describe('fichierDepuisPage', () => {
  it('rend le nom du fichier de Commons, espaces et accents compris', () => {
    expect(fichierDepuisPage('https://commons.wikimedia.org/wiki/File:Mich%C3%A8le_Alliot-Marie.JPG')).toBe('Michèle Alliot-Marie.JPG');
    expect(fichierDepuisPage(null)).toBeNull();
    expect(fichierDepuisPage('https://example.org/x.jpg')).toBeNull();
  });
});

describe('syncPhotosGouvernement', () => {
  const get = vi.mocked(wikidataGet);
  const commons = vi.mocked(lireImagesCommons);
  const MAINTENANT = new Date('2026-11-15T12:00:00Z');

  const IMAGE: ImageCommons = {
    fichier: 'Pap Ndiaye.jpg',
    vignette: 'https://upload.wikimedia.org/x/500px-Pap_Ndiaye.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Pap_Ndiaye.jpg',
    auteur: 'LurKin',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  };
  const AUTRE: ImageCommons = {
    ...IMAGE,
    fichier: 'Autre.jpg',
    vignette: 'https://upload.wikimedia.org/x/500px-Autre.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Autre.jpg',
  };
  const valeurs = (i: ImageCommons) => ({
    photoUrl: i.vignette, photoAuteur: i.auteur, photoLicence: i.licence, photoLicenceUrl: i.licenceUrl, photoSource: i.page,
  });
  const AVEC_PHOTO = valeurs(IMAGE);
  const SANS_PHOTO = { photoUrl: null, photoAuteur: null, photoLicence: null, photoLicenceUrl: null, photoSource: null };

  function membre(m: Record<string, unknown> = {}) {
    return {
      id: 'm1', acteurUid: 'PA791646', prenom: 'Pap', nom: 'Ndiaye', dateNaissance: null,
      wikidataId: 'Q3362697', ...SANS_PHOTO, postes: [{ dateDebut: date('2022-05-20') }], ...m,
    };
  }
  function base(membres: unknown[]) {
    const update = vi.fn().mockResolvedValue({});
    const db = { membreGouvernement: { findMany: vi.fn().mockResolvedValue(membres), update } } as unknown as PrismaClient;
    return { db, update };
  }
  const entite = (fichier: string | null, id = 'Q3362697'): WbEntite => ({
    id,
    claims: fichier ? { P18: [{ mainsnak: { datavalue: { value: fichier } } }] } : {},
  });
  /** Réponse de l'API pour la révision d'il y a 7 jours */
  const revision = (fichier: string | null) => ({
    query: { pages: [{ revisions: [{ slots: { main: { content: JSON.stringify(entite(fichier)) } } }] }] },
  });
  const reponse = (e: WbEntite, cle = 'Q3362697') => ({ entities: { [cle]: e } });
  const sync = (db: PrismaClient, o: Parameters<typeof syncPhotosGouvernement>[1] = {}) =>
    syncPhotosGouvernement(db, { maintenant: MAINTENANT, ...o });

  beforeEach(() => {
    get.mockReset();
    commons.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adopte la photo et son crédit d'une personne déjà retenue, sans la rechercher", async () => {
    const { db, update } = base([membre()]);
    get.mockResolvedValueOnce(reponse(entite('Pap Ndiaye.jpg'))).mockResolvedValueOnce(revision('Pap Ndiaye.jpg'));
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', IMAGE]]));

    const r = await sync(db);

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0]![0]).toMatchObject({ action: 'wbgetentities', ids: 'Q3362697', props: 'claims' });
    // La révision en vigueur il y a 7 jours.
    expect(get.mock.calls[1]![0]).toMatchObject({ action: 'query', prop: 'revisions', titles: 'Q3362697', rvstart: '2026-11-08T12:00:00.000Z' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { wikidataId: 'Q3362697', ...AVEC_PHOTO } });
    expect(r).toMatchObject({ membres: 1, avecPhoto: 1, modifies: 1, erreurs: 0 });
  });

  it("diffère une image qui n'était pas l'image principale il y a 7 jours (vandalisme récent)", async () => {
    const { db, update } = base([membre()]);
    get.mockResolvedValueOnce(reponse(entite('Pap Ndiaye.jpg'))).mockResolvedValueOnce(revision('Autre.jpg'));
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', IMAGE]]));
    const r = await sync(db);
    expect(update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ adoptionsDifferees: 1, avecPhoto: 0 });
  });

  it("diffère aussi quand la personne n'avait pas d'image ou n'existait pas il y a 7 jours", async () => {
    const sansImage = base([membre()]);
    get.mockResolvedValueOnce(reponse(entite('Pap Ndiaye.jpg'))).mockResolvedValueOnce(revision(null));
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', IMAGE]]));
    await sync(sansImage.db);
    expect(sansImage.update).not.toHaveBeenCalled();

    const inexistante = base([membre()]);
    get.mockResolvedValueOnce(reponse(entite('Pap Ndiaye.jpg'))).mockResolvedValueOnce({ query: { pages: [{}] } });
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', IMAGE]]));
    const r = await sync(inexistante.db);
    expect(inexistante.update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ adoptionsDifferees: 1 });
  });

  it("n'adopte rien si la révision d'il y a 7 jours n'a pas pu être lue", async () => {
    const { db, update } = base([membre()]);
    get.mockResolvedValueOnce(reponse(entite('Pap Ndiaye.jpg'))).mockResolvedValueOnce(null);
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', IMAGE]]));
    const r = await sync(db);
    expect(update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ erreurs: 1, adoptionsDifferees: 0 });
  });

  it('ne relit jamais sur Wikidata une photo figée, quoi qu’il y ait changé', async () => {
    const { db, update } = base([membre(AVEC_PHOTO)]);
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', { ...IMAGE, auteur: 'Crédit modifié' }]]));
    const r = await sync(db);
    expect(get).not.toHaveBeenCalled();
    // Seule l'existence du fichier est vérifiée.
    expect(commons).toHaveBeenCalledWith(['Pap Ndiaye.jpg']);
    expect(update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ figees: 1, avecPhoto: 1, modifies: 0 });
  });

  it('retire une photo figée dont le fichier a été supprimé de Commons', async () => {
    const { db, update } = base([membre(AVEC_PHOTO)]);
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', null]]));
    const r = await sync(db);
    expect(update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { wikidataId: 'Q3362697', ...SANS_PHOTO } });
    expect(r).toMatchObject({ fichiersSupprimes: 1, avecPhoto: 0 });
  });

  it("n'efface rien sur une lecture ratée de Wikidata ou de Commons", async () => {
    const sansPhoto = base([membre()]);
    get.mockResolvedValueOnce(null);
    let r = await sync(sansPhoto.db);
    expect(sansPhoto.update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ erreurs: 1 });

    const figee = base([membre(AVEC_PHOTO)]);
    commons.mockRejectedValueOnce(new Error('Commons : HTTP 503'));
    r = await sync(figee.db);
    expect(figee.update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ avecPhoto: 1, erreurs: 1 });
  });

  it('avec --actualiser, remplace une photo figée par la nouvelle image, hors période de calme', async () => {
    const { db, update } = base([membre(AVEC_PHOTO)]);
    get.mockResolvedValueOnce(reponse(entite('Autre.jpg'))).mockResolvedValueOnce(revision('Autre.jpg'));
    commons.mockResolvedValueOnce(new Map([['Autre.jpg', AUTRE]]));
    await sync(db, { actualiser: true });
    expect(update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { wikidataId: 'Q3362697', ...valeurs(AUTRE) } });
  });

  it('avec --actualiser, garde la photo en place si la nouvelle image est trop récente', async () => {
    const { db, update } = base([membre(AVEC_PHOTO)]);
    get.mockResolvedValueOnce(reponse(entite('Autre.jpg'))).mockResolvedValueOnce(revision('Pap Ndiaye.jpg'));
    commons.mockResolvedValueOnce(new Map([['Autre.jpg', AUTRE]]));
    const r = await sync(db, { actualiser: true });
    expect(update).not.toHaveBeenCalled();
    expect(r).toMatchObject({ adoptionsDifferees: 1, avecPhoto: 1 });
  });

  it("avec --actualiser, efface la photo quand Wikidata n'a plus d'image", async () => {
    const { db, update } = base([membre(AVEC_PHOTO)]);
    get.mockResolvedValueOnce(reponse(entite(null)));
    const r = await sync(db, { actualiser: true });
    expect(update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { wikidataId: 'Q3362697', ...SANS_PHOTO } });
    expect(r).toMatchObject({ sansImage: 1, avecPhoto: 0 });
  });

  it('suit une entité fusionnée et oublie une entité supprimée', async () => {
    const { db, update } = base([membre(), membre({ id: 'm2', wikidataId: 'Q9' })]);
    get
      .mockResolvedValueOnce({ entities: { Q3362697: entite('Pap Ndiaye.jpg', 'Q1000'), Q9: { id: 'Q9', missing: '' } } })
      .mockResolvedValueOnce(revision('Pap Ndiaye.jpg'));
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', IMAGE]]));
    await sync(db);
    expect(update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { wikidataId: 'Q1000', ...AVEC_PHOTO } });
    expect(update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { wikidataId: null, ...SANS_PHOTO } });
  });

  it("recherche la personne d'un membre non rapproché et n'écrit rien en essai", async () => {
    const { db, update } = base([membre({ wikidataId: null })]);
    get
      .mockResolvedValueOnce({ search: [{ id: 'Q3362697' }] })
      .mockResolvedValueOnce(reponse({
        id: 'Q3362697',
        labels: { fr: { value: 'Pap Ndiaye' } },
        claims: {
          P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
          P39: [{ mainsnak: {}, qualifiers: { P580: [{ datavalue: { value: { time: '+2022-05-20T00:00:00Z', precision: 11 } } }] } }],
        },
      }))
      .mockResolvedValueOnce(reponse(entite('Pap Ndiaye.jpg')))
      .mockResolvedValueOnce(revision('Pap Ndiaye.jpg'));
    commons.mockResolvedValueOnce(new Map([['Pap Ndiaye.jpg', IMAGE]]));

    const r = await sync(db, { dryRun: true });

    expect(get.mock.calls[0]![0]).toMatchObject({ action: 'wbsearchentities', search: 'Pap Ndiaye' });
    expect(r).toMatchObject({ rapproches: 1, avecPhoto: 1, modifies: 1 });
    expect(update).not.toHaveBeenCalled();
  });

  it("avec --rapprocher-de-nouveau, efface la photo d'un membre sans personne sûre", async () => {
    const { db, update } = base([membre({ wikidataId: null, ...AVEC_PHOTO })]);
    get.mockResolvedValueOnce({ search: [] });
    const r = await sync(db, { rapprocherDeNouveau: true });
    expect(update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { wikidataId: null, ...SANS_PHOTO } });
    expect(r).toMatchObject({ sansRapprochement: 1 });
  });
});
