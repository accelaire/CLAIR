import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { createMockPrismaClient, createMockRedisClient } from '../../test/mocks';
import { GouvernementsService, gouvernementsRecherches, nommerGouvernements, presidenceAuDebut } from './gouvernements.service';

const pm = (acteurUid: string, nom: string) => ({ acteurUid, nom });

describe('nommerGouvernements', () => {
  it('nomme par le Premier ministre, chiffre romain seulement s’il en a dirigé plusieurs', () => {
    const noms = nommerGouvernements([
      { numero: 1, premierMinistre: pm('PA1', 'Valls') },
      { numero: 2, premierMinistre: pm('PA1', 'Valls') },
      { numero: 1, premierMinistre: pm('PA2', 'Cazeneuve') },
      { numero: 3, premierMinistre: pm('PA3', 'Fillon') },
      { numero: 1, premierMinistre: pm('PA3', 'Fillon') },
    ]).map((g) => g.nom);
    expect(noms).toEqual(['Valls I', 'Valls II', 'Cazeneuve', 'Fillon III', 'Fillon I']);
  });
});

describe('presidenceAuDebut', () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const presidences = [
    { uid: 'PO382940', dateDebut: d('2007-05-16'), dateFin: d('2012-05-15') },
    { uid: 'PO696251', dateDebut: d('2012-05-15'), dateFin: d('2017-05-14') },
    { uid: 'PO717136', dateDebut: d('2017-05-14'), dateFin: null },
  ];

  it('retient la présidence en cours au début du gouvernement', () => {
    expect(presidenceAuDebut(presidences, d('2016-12-07'))!.uid).toBe('PO696251'); // Cazeneuve
    expect(presidenceAuDebut(presidences, d('2025-10-11'))!.uid).toBe('PO717136'); // Lecornu II
  });

  it('retient le nouveau président le jour de la passation', () => {
    expect(presidenceAuDebut(presidences, d('2012-05-15'))!.uid).toBe('PO696251');
  });

  it('ne retient rien avant 2007', () => {
    expect(presidenceAuDebut(presidences, d('2005-06-02'))).toBeNull();
  });
});

describe('gouvernementsRecherches', () => {
  const g = (nom: string, slug: string, prenom: string, nomPm: string) => ({ nom, slug, premierMinistre: { prenom, nom: nomPm } });
  const gouvernements = [
    g('Borne', 'borne', 'Élisabeth', 'Borne'),
    g('Attal', 'attal', 'Gabriel', 'Attal'),
    g('Lecornu I', 'lecornu', 'Sébastien', 'Lecornu'),
    g('Lecornu II', 'lecornu-2', 'Sébastien', 'Lecornu'),
  ];
  const slugs = (terme: string) => gouvernementsRecherches(gouvernements, terme).map((x) => x.slug);

  it('trouve par le nom du Premier ministre, sans accents ni casse, en préfixe', () => {
    expect(slugs('borne')).toEqual(['borne']);
    expect(slugs('ELISABETH')).toEqual(['borne']);
    expect(slugs('lec')).toEqual(['lecornu', 'lecornu-2']);
  });

  it('ignore le mot « gouvernement »', () => {
    expect(slugs('gouvernement Attal')).toEqual(['attal']);
    expect(slugs('gouvernement')).toEqual([]);
  });

  it('lit le numéro en chiffres ou en romains, et exige le numéro exact', () => {
    expect(slugs('lecornu 2')).toEqual(['lecornu-2']);
    expect(slugs('lecornu ii')).toEqual(['lecornu-2']);
    // « i » ne doit pas trouver « II » par préfixe.
    expect(slugs('lecornu i')).toEqual(['lecornu']);
  });
});

describe('GouvernementsService, membres', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let service: GouvernementsService;
  const d = (j: string) => new Date(`${j}T00:00:00Z`);
  const identite = (slug: string, prenom: string, nom: string, fiche: string | null) => ({
    slug,
    acteurUid: `PA-${slug}`,
    civilite: 'M.',
    prenom,
    nom,
    parlementaire: fiche ? { slug: fiche, chambre: 'senat', photoUrl: null } : null,
  });

  beforeEach(() => {
    prisma = createMockPrismaClient();
    const redis = createMockRedisClient();
    redis._clear();
    service = new GouvernementsService(prisma as unknown as PrismaClient, redis as unknown as Redis);
  });

  it('liste chaque membre avec son slug, sa fiche, son premier poste et la fin du dernier', async () => {
    prisma.membreGouvernement.findMany.mockResolvedValueOnce([
      {
        ...identite('sebastien-lecornu', 'Sébastien', 'Lecornu', 'sebastien-lecornu'),
        postes: [
          { dateDebut: d('2022-05-20'), dateFin: d('2025-09-09') },
          { dateDebut: d('2025-10-12'), dateFin: null },
        ],
      },
      {
        ...identite('jean-dupont', 'Jean', 'Dupont', null),
        postes: [
          { dateDebut: d('2017-05-17'), dateFin: d('2018-10-16') },
          { dateDebut: d('2012-05-16'), dateFin: d('2014-03-31') },
        ],
      },
    ]);
    const { data } = await service.getMembres();
    expect(data[0]).toMatchObject({
      slug: 'sebastien-lecornu',
      parlementaire: { slug: 'sebastien-lecornu', chambre: 'senat' },
      nbPostes: 2,
      enFonction: true,
      dateDebut: '2022-05-20',
      dateFin: null,
    });
    expect(data[1]).toMatchObject({ slug: 'jean-dupont', parlementaire: null, enFonction: false, dateDebut: '2012-05-16', dateFin: '2018-10-16' });
    // Ordre alphabétique total : le slug départage les homonymes.
    expect(prisma.membreGouvernement.findMany.mock.calls[0]![0].orderBy).toEqual([{ nom: 'asc' }, { prenom: 'asc' }, { slug: 'asc' }]);
  });

  it('lie la présidence à la fiche du président, sinon à sa page de membre, sinon à rien', async () => {
    const gouvernement = (uid: string, debut: string, fin: string | null) => ({
      id: uid,
      uid,
      slug: uid.toLowerCase(),
      numero: 1,
      dateDebut: d(debut),
      dateFin: fin ? d(fin) : null,
      postes: [],
    });
    prisma.gouvernement.findMany.mockResolvedValueOnce([
      gouvernement('PO1', '2007-05-18', '2012-05-10'),
      gouvernement('PO2', '2012-05-16', '2017-05-10'),
      gouvernement('PO3', '2017-05-15', null),
    ]);
    const presidence = (uid: string, nom: string, debut: string, fin: string | null, acteurUid: string | null, fiche: string | null) => ({
      uid,
      civilite: 'M.',
      prenom: 'P',
      nom,
      dateDebut: d(debut),
      dateFin: fin ? d(fin) : null,
      acteurUid,
      parlementaire: fiche ? { slug: fiche, chambre: 'assemblee', photoUrl: null } : null,
    });
    prisma.presidence.findMany.mockResolvedValueOnce([
      presidence('PR1', 'Sarkozy', '2007-05-16', '2012-05-15', null, null),
      presidence('PR2', 'Hollande', '2012-05-15', '2017-05-14', 'PA1654', 'francois-hollande'),
      presidence('PR3', 'Macron', '2017-05-14', null, 'PA702992', null),
    ]);
    prisma.membreGouvernement.findMany.mockResolvedValueOnce([{ acteurUid: 'PA702992', slug: 'emmanuel-macron' }]);
    const { data } = await service.getGouvernements();
    const parNom = Object.fromEntries(data.map((g: { presidence: { nom: string } }) => [g.presidence.nom, g.presidence]));
    expect(parNom.Sarkozy).toMatchObject({ slug: null, parlementaire: null });
    expect(parNom.Hollande).toMatchObject({ slug: null, parlementaire: { slug: 'francois-hollande', chambre: 'assemblee' } });
    expect(parNom.Macron).toMatchObject({ slug: 'emmanuel-macron', parlementaire: null });
    expect(prisma.membreGouvernement.findMany.mock.calls[0]![0].where).toEqual({ acteurUid: { in: ['PA1654', 'PA702992'] } });
  });

  it('donne au membre son slug et ses présidences de la République, rattachées par l’acteur', async () => {
    prisma.membreGouvernement.findUnique.mockResolvedValueOnce({
      ...identite('emmanuel-macron', 'Emmanuel', 'Macron', null),
      dateNaissance: d('1977-12-21'),
      postes: [],
    });
    prisma.presidence.findMany.mockImplementation(async (args: { where?: { acteurUid?: string } }) =>
      args.where?.acteurUid === 'PA-emmanuel-macron' ? [{ uid: 'PO717136', dateDebut: d('2017-05-14'), dateFin: null }] : [],
    );
    const reponse = await service.getMembreBySlug('emmanuel-macron');
    expect(reponse.data).toMatchObject({
      slug: 'emmanuel-macron',
      parlementaire: null,
      dateNaissance: '1977-12-21',
      presidences: [{ uid: 'PO717136', dateDebut: '2017-05-14', dateFin: null }],
      postes: [],
    });
  });
});
