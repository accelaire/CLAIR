import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { formeDuNom, liensOfficiels, nomsCites, renvoisPersonnes } from './renvois-personnes';

describe('liensOfficiels', () => {
  it('lit le matricule d’un sénateur et le PA d’un député', () => {
    const texte =
      'de Mme [Maryse CARRÈRE](http://www.senat.fr/senateur/carrere_maryse19629c.html) et ' +
      '[M. Husson](https://www.senat.fr/senateur/husson_jean_francois11048n.html), ' +
      'https://www.assemblee-nationale.fr/dyn/deputes/PA794354 et https://www2.assemblee-nationale.fr/deputes/fiche/OMC_PA795466';
    expect(liensOfficiels(texte).map((l) => [l.chambre, l.sourceId])).toEqual([
      ['senat', '19629C'],
      ['senat', '11048N'],
      ['assemblee', 'PA794354'],
      ['assemblee', 'PA795466'],
    ]);
  });
});

describe('nomsCites', () => {
  it('lit le nom après une civilité, du plus long au plus court', () => {
    expect(nomsCites('(Mme Hélène Laporte, rapporteure)')).toEqual([['Hélène Laporte']]);
    expect(nomsCites('par Mmes Sonia de LA PROVÔTÉ, sénatrice')).toEqual([]);
    expect(nomsCites('par Mme Sonia de LA PROVÔTÉ, sénatrice')).toEqual([['Sonia de LA PROVÔTÉ', 'Sonia de LA', 'Sonia de']]);
    expect(nomsCites('M. Patrick CHAIZE fait au nom')).toEqual([['Patrick CHAIZE']]);
  });

  it('ignore une civilité sans nom', () => {
    expect(nomsCites('M. le président de la commission')).toEqual([]);
    expect(nomsCites('Madame, Monsieur,')).toEqual([]);
  });
});

describe('formeDuNom', () => {
  it('compare sans accents, casse ni tirets', () => {
    expect(formeDuNom('Maryse CARRÈRE')).toBe(formeDuNom('Maryse Carrère'));
    expect(formeDuNom('Jean-François Husson')).toBe(formeDuNom('Jean François HUSSON'));
  });
});

describe('renvoisPersonnes', () => {
  const prisma = {
    parlementaire: {
      findMany: vi.fn(async (args: { where?: unknown }) =>
        args.where
          ? [{ chambre: 'senat', sourceId: '19629C', slug: 'maryse-carrere' }]
          : [
              { prenom: 'Hélène', nom: 'Laporte', chambre: 'assemblee', slug: 'helene-laporte' },
              { prenom: 'Éric', nom: 'Husson', chambre: 'assemblee', slug: 'eric-husson' },
              { prenom: 'Éric', nom: 'Husson', chambre: 'senat', slug: 'eric-husson-1' },
            ],
      ),
    },
    parlementaireIdentifiant: { findMany: vi.fn(async () => []) },
    membreGouvernement: { findMany: vi.fn(async () => [{ prenom: 'Gabriel', nom: 'Attal', slug: 'gabriel-attal' }]) },
  } as unknown as PrismaClient;

  it('résout les liens officiels et les noms uniques, jamais les homonymes', async () => {
    const renvois = await renvoisPersonnes(prisma, [
      'Mme [Maryse CARRÈRE](http://www.senat.fr/senateur/carrere_maryse19629c.html), Mme Hélène LAPORTE, M. Éric Husson, M. Gabriel Attal, M. Gérard LESEUR',
    ]);
    expect(renvois).toEqual([
      { type: 'lien', cle: 'http://www.senat.fr/senateur/carrere_maryse19629c.html', chemin: '/senateurs/maryse-carrere' },
      { type: 'nom', cle: 'Hélène LAPORTE', chemin: '/deputes/helene-laporte' },
      { type: 'nom', cle: 'Gabriel Attal', chemin: '/gouvernements/membres/gabriel-attal' },
    ]);
  });

  it('ne lit pas la base sans lien ni civilité', async () => {
    vi.mocked(prisma.parlementaire.findMany).mockClear();
    expect(await renvoisPersonnes(prisma, ['Décision de la commission.'])).toEqual([]);
    expect(prisma.parlementaire.findMany).not.toHaveBeenCalled();
  });
});
