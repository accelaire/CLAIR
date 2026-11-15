import { afterEach, describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  completerPhotosSenateurs,
  nomTechniqueSenat,
  urlPhotoSenat,
  verifierPhoto,
  type VerdictPhoto,
} from './photos-senat';

describe('nomTechniqueSenat', () => {
  // Formes relevées dans les adresses des photos déjà publiées par senat.fr.
  it.each([
    ['Lecornu', 'lecornu'],
    ['Apourceau-Poly', 'apourceau_poly'],
    ['Robert Wienie', 'robert_wienie'],
    ["d'Aigremont", 'd_aigremont'],
    ['de La Provôté', 'de_la_provote'],
    ['de Nicolaÿ', 'de_nicolay'],
    ['Cerisier-ben Guiga', 'cerisier_ben_guiga'],
    ['Marie-Hélène', 'marie_helene'],
    ['Gérard', 'gerard'],
  ])('%s → %s', (nom, attendu) => {
    expect(nomTechniqueSenat(nom)).toBe(attendu);
  });
});

describe('urlPhotoSenat', () => {
  it('nom, prénom puis matricule en minuscules', () => {
    expect(urlPhotoSenat('Lecornu', 'Sébastien', '19265T')).toBe(
      'https://www.senat.fr/senimg/lecornu_sebastien19265t_carre.jpg',
    );
    expect(urlPhotoSenat('Des Esgaulx', 'Marie-Hélène', '08022Q')).toBe(
      'https://www.senat.fr/senimg/des_esgaulx_marie_helene08022q_carre.jpg',
    );
  });
});

describe('verifierPhoto', () => {
  function repondre(status: number, type: string | null) {
    const headers = new Headers(type ? { 'content-type': type } : {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status, headers })));
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('image seulement pour un 200 de type image', async () => {
    repondre(200, 'image/jpeg');
    expect(await verifierPhoto('u')).toBe('image');
  });

  it('absente sur un 404', async () => {
    repondre(404, 'text/html');
    expect(await verifierPhoto('u')).toBe('absente');
  });

  it.each([
    [200, 'text/html'],
    [301, null],
    [503, 'text/html'],
  ])('erreur, donc rien d\'écrit, sur un %i %s', async (status, type) => {
    repondre(status, type);
    expect(await verifierPhoto('u')).toBe('erreur');
  });

  it('erreur si le réseau échoue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    expect(await verifierPhoto('u')).toBe('erreur');
  });
});

describe('completerPhotosSenateurs', () => {
  const fiches = [
    { id: 'a', nom: 'Lecornu', prenom: 'Sébastien', sourceId: '19265T' },
    { id: 'b', nom: 'Grosdidier', prenom: 'François', sourceId: '11049P' },
    { id: 'c', nom: 'Panne', prenom: 'Réseau', sourceId: '00000X' },
  ];

  function base(ecrites = 1) {
    const findMany = vi.fn().mockResolvedValue(fiches);
    const updateMany = vi.fn().mockResolvedValue({ count: ecrites });
    return { db: { parlementaire: { findMany, updateMany } } as unknown as PrismaClient, findMany, updateMany };
  }

  const verdicts: Record<string, VerdictPhoto> = {
    'https://www.senat.fr/senimg/lecornu_sebastien19265t_carre.jpg': 'image',
    'https://www.senat.fr/senimg/grosdidier_francois11049p_carre.jpg': 'absente',
    'https://www.senat.fr/senimg/panne_reseau00000x_carre.jpg': 'erreur',
  };
  const verifier = async (url: string) => verdicts[url]!;

  it("vise seulement les fiches du Sénat sans photo et n'écrit que les images vérifiées", async () => {
    const { db, findMany, updateMany } = base();
    const resultat = await completerPhotosSenateurs(db, { verifier });

    expect(findMany.mock.calls[0]![0].where).toEqual({ chambre: 'senat', photoUrl: null, sourceId: { not: null } });
    expect(resultat).toEqual({ candidates: 3, renseignees: 1, absentes: 1, erreurs: 1 });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'a', photoUrl: null },
      data: { photoUrl: 'https://www.senat.fr/senimg/lecornu_sebastien19265t_carre.jpg' },
    });
  });

  it("ne compte pas une photo écrite entre-temps par l'annuaire", async () => {
    const { db } = base(0);
    const resultat = await completerPhotosSenateurs(db, { verifier });
    expect(resultat.renseignees).toBe(0);
  });

  it("compte en erreur une écriture refusée, sans interrompre les autres", async () => {
    const { db, updateMany } = base();
    updateMany.mockRejectedValueOnce(new Error('connexion perdue'));
    const resultat = await completerPhotosSenateurs(db, { verifier: async () => 'image' });
    expect(resultat).toEqual({ candidates: 3, renseignees: 2, absentes: 0, erreurs: 1 });
  });
});
