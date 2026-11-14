import { describe, it, expect } from 'vitest';
import { champCopy, lireTablesDump } from './sens-client';

async function* lignes(texte: string) {
  for (const l of texte.split('\n')) yield l;
}

describe('champCopy', () => {
  it('lit \\N comme NULL', () => {
    expect(champCopy('\\N')).toBeNull();
  });

  it('déséchappe tabulation, saut de ligne et antislash', () => {
    expect(champCopy('a\\tb\\nc\\\\d')).toBe('a\tb\nc\\d');
  });

  it('laisse un champ ordinaire intact', () => {
    expect(champCopy('Président du Sénat')).toBe('Président du Sénat');
  });
});

describe('lireTablesDump', () => {
  const dump = [
    'CREATE TABLE bur (burcod text);',
    'COPY bur (burcod, burlib, burlibfem) FROM stdin;',
    'PDTSEN\tPrésident du Sénat\tPrésidente du Sénat',
    'AUCUNSEN\t\\N\tSénatrice',
    '\\.',
    'COPY autre (a, b) FROM stdin;',
    'x\ty',
    '\\.',
    'COPY senbur (senburid, burcod, senmat) FROM stdin;',
    '3122\tPDTSEN\t86034E',
    '\\.',
  ].join('\n');

  it('lit les tables demandées, colonnes nommées', async () => {
    const tables = await lireTablesDump(lignes(dump), ['bur', 'senbur']);
    expect(tables.get('bur')).toEqual([
      { burcod: 'PDTSEN', burlib: 'Président du Sénat', burlibfem: 'Présidente du Sénat' },
      { burcod: 'AUCUNSEN', burlib: null, burlibfem: 'Sénatrice' },
    ]);
    expect(tables.get('senbur')).toEqual([{ senburid: '3122', burcod: 'PDTSEN', senmat: '86034E' }]);
  });

  it('saute les tables non demandées', async () => {
    const tables = await lireTablesDump(lignes(dump), ['senbur']);
    expect([...tables.keys()]).toEqual(['senbur']);
  });

  it('rend une liste vide pour une table absente', async () => {
    const tables = await lireTablesDump(lignes(dump), ['memcom']);
    expect(tables.get('memcom')).toEqual([]);
  });
});
