import { describe, it, expect } from 'vitest';
import { regrouperPrises } from './interventions-syceron';
import type { PriseDeParoleSyceron } from '../sources/assemblee-nationale/syceron-parser';

function prise(p: Partial<PriseDeParoleSyceron> & { ordreAbsolu: number }): PriseDeParoleSyceron {
  return {
    sourceUid: `s${p.ordreAbsolu}`,
    codeGrammaire: 'PAROLE_GENERIQUE',
    orateurRef: 'PA1',
    orateurNom: 'Monnet',
    orateurPrenom: 'Yannick',
    orateurQualite: null,
    contenu: 'Un propos suffisamment long pour être conservé.',
    articleVise: '15',
    amendementsVises: [],
    texteNumero: '1364',
    estPresidence: false,
    ...p,
  };
}

describe('regrouperPrises', () => {
  it("fond les paragraphes consécutifs d'un même orateur en un seul tour", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'Premier paragraphe de mon propos.' }),
      prise({ ordreAbsolu: 2, contenu: 'Second paragraphe de mon propos.' }),
    ]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.contenu).toBe('Premier paragraphe de mon propos.\n\nSecond paragraphe de mon propos.');
    expect(groupes[0]?.sourceUid).toBe('s1');
    expect(groupes[0]?.ordreAbsolu).toBe(1);
  });

  it('sépare deux orateurs différents', () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, orateurRef: 'PA1' }),
      prise({ ordreAbsolu: 2, orateurRef: 'PA2', orateurNom: 'Juvin' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it("ne fond pas deux prises séparées par un changement d'article", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, articleVise: '15' }),
      prise({ ordreAbsolu: 2, articleVise: '16' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it('laisse chaque paragraphe de présidence isolé, car il segmente le débat', () => {
    // Deux annonces consécutives du perchoir : les fondre effacerait la
    // frontière entre deux mises aux voix.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, estPresidence: true, orateurRef: 'PA9', orateurNom: 'présidente',
        codeGrammaire: 'SCRUT_PUB_ADT_1_2', contenu: 'Je mets aux voix l’amendement no 1.' }),
      prise({ ordreAbsolu: 2, estPresidence: true, orateurRef: 'PA9', orateurNom: 'présidente',
        codeGrammaire: 'SCRUT_PUB_ADT_1_4', contenu: 'Voici le résultat du scrutin.' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it('ne fond jamais deux orateurs non identifiés entre eux', () => {
    // Sans `id_acteur`, rien ne prouve que deux paragraphes sont du même orateur.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, orateurRef: null, orateurNom: 'Un député' }),
      prise({ ordreAbsolu: 2, orateurRef: null, orateurNom: 'Un député' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it('écarte les prises trop courtes pour dire quoi que ce soit', () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'Non !' }),
      prise({ ordreAbsolu: 2, orateurRef: 'PA2', contenu: 'Un propos de longueur normale, lui.' }),
    ]);
    expect(groupes.map((g) => g.ordreAbsolu)).toEqual([2]);
  });

  it('conserve une annonce de séance même très courte', () => {
    // Elle ne s'affiche pas, mais elle porte la segmentation.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, estPresidence: true, codeGrammaire: 'SCRUT_ART_PUB_1_7', contenu: 'Scrutin.' }),
    ]);
    expect(groupes).toHaveLength(1);
  });

  it('classe le type sur le code de grammaire, pas sur le texte', () => {
    // L'ancien parseur classait en « question » tout propos contenant ce mot.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'La question posée par cet amendement est délicate.' }),
    ]);
    expect(groupes[0]?.type).toBe('intervention');
  });
});
