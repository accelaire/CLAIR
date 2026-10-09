import { describe, it, expect } from 'vitest';
import { CTE_LEGISLATURES_DOSSIER_SQL as CTE_LEGISLATURES, CTE_TEXTE_DU_DOSSIER_SQL as CTE_TEXTES, dossierValantPourSql } from './legislatures-dossier-sql';
import { derniereLegislatureCitee } from '../workers/sync';

describe('dossierValantPour', () => {
  const sql = dossierValantPourSql('d', 'a.legislature');

  it("laisse passer les dossiers hors Assemblée et ceux qui valent pour la législature", () => {
    expect(sql).toContain("d.uid NOT LIKE 'DLR5L%'");
    expect(sql).toMatch(/ld\.dossier_id = d\.id AND ld\.legislature = a\.legislature/);
  });

  it("compare la législature telle qu'écrite par l'appelant", () => {
    expect(dossierValantPourSql('x', "substring(i.seance_uid from 'CRSANR5L([0-9]+)')::int")).toContain(
      "ld.dossier_id = x.id AND ld.legislature = substring(i.seance_uid from 'CRSANR5L([0-9]+)')::int",
    );
  });
});

describe('CTE_LEGISLATURES_DOSSIER_SQL', () => {
  it("compte la législature de l'identifiant et celles des textes et votes cités", () => {
    expect(CTE_LEGISLATURES).toContain("substring(d.uid from 'DLR5L([0-9]+)N')");
    expect(CTE_LEGISLATURES).toContain("'ANR5L([0-9]+)[BV]'");
  });
});

describe('CTE_TEXTE_DU_DOSSIER_SQL', () => {
  it('ne retient un texte que s’il appartient à un seul dossier', () => {
    expect(CTE_TEXTES).toMatch(/HAVING count\(\*\) = 1/);
  });

  it('lit les textes associés et adoptés de la source, au format jsonb', () => {
    const motif = /"\(\?:refTexteAssocie\|texteAssocie\|texteAdopte\)": "\(\[A-Z\]\+ANR5L\[0-9\]\+B\(\?:TC\)\?\[0-9\]\+\)"/;
    expect(CTE_TEXTES).toMatch(motif);
    // Le même motif, appliqué à un extrait réel de `source_data::text`.
    const extrait = '{"texteAdopte": "PRJLANR5L17BTC1191", "texteAssocie": "PRJLANR5L17B0481"}';
    const re = /"(?:refTexteAssocie|texteAssocie|texteAdopte)": "([A-Z]+ANR5L[0-9]+B(?:TC)?[0-9]+)"/g;
    expect([...extrait.matchAll(re)].map((m) => m[1])).toEqual(['PRJLANR5L17BTC1191', 'PRJLANR5L17B0481']);
  });
});

describe('derniereLegislatureCitee', () => {
  it('lit la législature la plus récente des textes et votes cités', () => {
    // « Simplification de la vie économique » : ouvert en 16e, examiné en 17e.
    const source = {
      uid: 'DLR5L16N49868',
      actes: [{ texteAssocie: 'PRJLSNR5S379B0550' }, { texteAssocie: 'PRJLANR5L17B0481' }, { voteRefs: { voteRef: 'VTANR5L17V1340' } }],
    };
    expect(derniereLegislatureCitee(source)).toBe(17);
  });

  it("ignore l'identifiant du dossier et les références sans texte ni vote", () => {
    expect(derniereLegislatureCitee({ uid: 'DLR5L16N49868', organeRef: 'PO838901', seanceRef: 'RUANR5L17S2027IDS30931' })).toBe(0);
    expect(derniereLegislatureCitee(null)).toBe(0);
  });
});
