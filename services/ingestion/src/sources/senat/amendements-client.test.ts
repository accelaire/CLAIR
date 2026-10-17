import { describe, it, expect } from 'vitest';
import {
  enTeteCopyConforme,
  libelleArticleVise,
  lirePositionAmd,
  lireSubdivisionAmeli,
  type SubdivisionAmeli,
} from './amendements-client';

// Les lignes et libellés sont repris du dump AMELI du 17/10/2026 ; les valeurs
// attendues sont celles que la colonne « Subdivision » du CSV écrit pour les
// mêmes amendements.

const subdivisions = new Map<number, SubdivisionAmeli>([
  [1, { lib: 'Article 1er', typid: 4, merid: null }],
  [2, { lib: 'Article 12', typid: 4, merid: null }],
  [3, { lib: 'Article 49 (crédits de la mission)', typid: 4, merid: null }],
  [4, { lib: 'État B', typid: 7, merid: 3 }],
  [5, { lib: 'Article 2', typid: 4, merid: null }],
  [6, { lib: "Art. L. 245-1 du code de l'action sociale et des familles", typid: 5, merid: 5 }],
  [7, { lib: 'Art. 43-13 de la loi n° 86-1067 du 30 septembre 1986', typid: 6, merid: 5 }],
  [8, { lib: 'TITRE II : LUTTE CONTRE LE NARCOTRAFIC', typid: 2, merid: null }],
  [9, { lib: 'Intitulé de la proposition de loi', typid: 1, merid: null }],
  [10, { lib: 'Rapport annexé', typid: 7, merid: 99 }],
]);

describe('libelleArticleVise', () => {
  it("écrit l'article tel que le CSV", () => {
    expect(libelleArticleVise(1, '0', subdivisions)).toBe('Article 1er');
    expect(libelleArticleVise(8, '0', subdivisions)).toBe('TITRE II : LUTTE CONTRE LE NARCOTRAFIC');
    expect(libelleArticleVise(9, '0', subdivisions)).toBe('Intitulé de la proposition de loi');
  });

  it('préfixe les articles et divisions additionnels selon subpos', () => {
    expect(libelleArticleVise(2, '20', subdivisions)).toBe('art. add. après Article 12');
    expect(libelleArticleVise(2, '-10', subdivisions)).toBe('art. add. avant Article 12');
    expect(libelleArticleVise(2, '10', subdivisions)).toBe('div. add. après Article 12');
    expect(libelleArticleVise(8, '-20', subdivisions)).toBe('div. add. avant TITRE II : LUTTE CONTRE LE NARCOTRAFIC');
  });

  it("nomme l'annexe, l'article de code et l'article de loi dans leur article", () => {
    expect(libelleArticleVise(4, '0', subdivisions)).toBe('Article 49 (crédits de la mission) (État B)');
    expect(libelleArticleVise(4, '20', subdivisions)).toBe('art. add. après Article 49 (crédits de la mission) (État B)');
    expect(libelleArticleVise(6, '0', subdivisions))
      .toBe("Article 2 (Art. L. 245-1 du code de l'action sociale et des familles)");
    expect(libelleArticleVise(7, '20', subdivisions))
      .toBe('art. add. après Article 2 (Art. 43-13 de la loi n° 86-1067 du 30 septembre 1986)');
  });

  it("garde le libellé seul quand le parent manque au dump", () => {
    expect(libelleArticleVise(10, '0', subdivisions)).toBe('Rapport annexé');
  });

  it("rend null plutôt qu'un libellé deviné", () => {
    expect(libelleArticleVise(null, '0', subdivisions)).toBeNull();
    expect(libelleArticleVise(404, '0', subdivisions)).toBeNull();
    // 64 amendements du dump ont un subpos nul, 5 un subpos vide.
    expect(libelleArticleVise(1, null, subdivisions)).toBeNull();
    expect(libelleArticleVise(1, '', subdivisions)).toBeNull();
    expect(libelleArticleVise(1, '30', subdivisions)).toBeNull();
  });
});

describe('lireSubdivisionAmeli', () => {
  it('lit une ligne COPY de la table sub', () => {
    const ligne = '2777\t96\t\\N\t4\tArticle 12\tArticle 12\t0\ttlg000844ARTICLE_12\t844\t\\N\tN\tO\t\\N\t96\tAUCUN\tN\t\\N';
    expect(lireSubdivisionAmeli(ligne.split('\t'))).toEqual([2777, { lib: 'Article 12', typid: 4, merid: null }]);
  });

  it('garde le parent et retire les espaces de bord, insécables compris', () => {
    const ligne = '1801\t48\t1760\t7\tEtat B\tEtat B \t0\ttlg001014ETAT_B\t1014';
    expect(lireSubdivisionAmeli(ligne.split('\t'))).toEqual([1801, { lib: 'Etat B', typid: 7, merid: 1760 }]);
  });

  it("redécode l'apostrophe windows-1252 que la lecture latin1 laisse en U+0092", () => {
    const ligne = "10\t1\t\\N\t2\tx\tTitre II (avant l\u0092article 2)\t0";
    expect(lireSubdivisionAmeli(ligne.split('\t'))?.[1].lib).toBe('Titre II (avant l’article 2)');
  });

  it('ignore une subdivision sans libellé', () => {
    expect(lireSubdivisionAmeli('11\t1\t\\N\t4\t\\N\t\\N\t0'.split('\t'))).toBeNull();
    expect(lireSubdivisionAmeli(['12', '1'])).toBeNull();
  });
});

describe('lirePositionAmd', () => {
  const amd = (subid: string, subpos: string) => {
    const fields = Array.from({ length: 36 }, () => '\\N');
    fields[0] = '1000244';
    fields[1] = subid;
    fields[24] = subpos;
    return fields;
  };

  it('lit subid et subpos', () => {
    expect(lirePositionAmd(amd('100133', '20'))).toEqual({ subid: 100133, subpos: '20' });
    expect(lirePositionAmd(amd('100133', '-10'))).toEqual({ subid: 100133, subpos: '-10' });
  });

  it('rend null pour les valeurs absentes', () => {
    expect(lirePositionAmd(amd('\\N', '\\N'))).toEqual({ subid: null, subpos: null });
  });
});

describe('enTeteCopyConforme', () => {
  it("accepte l'en-tête actuel des tables amd et sub", () => {
    expect(enTeteCopyConforme(
      'COPY amd (id, subid, amdperid, motid, etaid, nomentid, sorid, avcid, avgid, irrid, txtid, opmid, ocmid, ideid, discomid, num, rev, typ, dis, obj, datdep, obs, ord, autext, subpos, mot, numabs, subidder, libgrp, alinea, accgou, colleg, typrectid, motposexa, irrlo1113valid, irrsaisiepar) FROM stdin;',
    )).toBe(true);
    expect(enTeteCopyConforme(
      'COPY sub (id, txtid, merid, typid, lic, lib, pos, sig, posder, prires, dupl, subamd, sorid, txtidder, style, islec, comdelid) FROM stdin;',
    )).toBe(true);
  });

  it('refuse une colonne déplacée', () => {
    expect(enTeteCopyConforme('COPY sub (id, txtid, merid, typid, lib, lic, pos) FROM stdin;')).toBe(false);
  });

  it('ne juge pas les tables qu’il ne lit pas par position', () => {
    expect(enTeteCopyConforme('COPY typsub (id, lib) FROM stdin;')).toBe(true);
  });
});
