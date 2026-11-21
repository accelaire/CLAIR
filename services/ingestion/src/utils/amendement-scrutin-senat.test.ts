import { describe, it, expect } from 'vitest';
import {
  anneeDeSessionSenat,
  choisirAmendementSenat,
  cleTexteSenat,
  extraireLiensAmendementsSenat,
  libelleSessionSenat,
  memeNumeroAmendement,
  numeroTexteDeBase,
} from './amendement-scrutin-senat';
import {
  CTE_DOSSIER_DU_TEXTE_SENAT_SQL,
  sessionDeLaDateSql,
  sessionDuSignetSql,
  texteSenatCouvertSql,
} from './textes-senat-sql';

describe('sessions du Sénat', () => {
  it('écrit et relit le libellé des adresses senat.fr', () => {
    expect(libelleSessionSenat(2026)).toBe('2026-2027');
    expect(anneeDeSessionSenat('2013-2014')).toBe(2013);
  });

  it('refuse les libellés de session extraordinaire et les années incohérentes', () => {
    // AMELI nomme ainsi les sessions de juillet : `parseInt` y lisait NaN et le
    // CSV de ces textes n'était jamais téléchargé.
    expect(anneeDeSessionSenat('Première session extraordinaire de 2025-2026')).toBeNull();
    expect(anneeDeSessionSenat('2013-2015')).toBeNull();
  });
});

describe('cleTexteSenat', () => {
  it('distingue le n° 155 de 2013-2014 (PLF 2014) de celui de 2026-2027 (PLF 2027)', () => {
    expect(cleTexteSenat(2013, '155')).not.toBe(cleTexteSenat(2026, '155'));
    expect(cleTexteSenat(2026, '155')).toBe('2026-2027/155');
  });

  it('retire la rectification du numéro de texte, absente des adresses', () => {
    expect(numeroTexteDeBase('636 rect. bis')).toBe('636');
    expect(cleTexteSenat(2024, '636 rect. bis')).toBe('2024-2025/636');
  });
});

describe('extraireLiensAmendementsSenat', () => {
  const page = `
    <a href="https://www.senat.fr/amendements/2013-2014/155/Amdt_I-361.html">n° I-361 rect.</a>
    <a href="/amendements/2013-2014/155/Amdt_I-361.html">doublon</a>
    <a href="https://www.senat.fr/amendements/2026-2027/87/Amdt_A-1.html">A-1</a>
    <a href="https://www.senat.fr/amendements/commissions/2025-2026/911/Amdt_COM-1.html">commission</a>`;

  it('garde la session, le texte et le numéro, une fois chacun', () => {
    expect(extraireLiensAmendementsSenat(page)).toEqual([
      { session: '2013-2014', texteNumero: '155', numero: 'I-361' },
      { session: '2026-2027', texteNumero: '87', numero: 'A-1' },
    ]);
  });
});

describe('memeNumeroAmendement', () => {
  it('reconnaît un amendement rectifié sous son numéro de base', () => {
    // Les lignes CSV gardent « rect. » dans `numero` : l'égalité stricte de
    // l'ancien code ne trouvait jamais un amendement rectifié.
    expect(memeNumeroAmendement('I-361 rect. bis', 'I-361')).toBe(true);
    expect(memeNumeroAmendement('12', '12')).toBe(true);
  });

  it("ne confond pas un numéro avec un autre qui le prolonge", () => {
    expect(memeNumeroAmendement('I-3610', 'I-361')).toBe(false);
    expect(memeNumeroAmendement('II-361', 'I-361')).toBe(false);
  });
});

describe('choisirAmendementSenat', () => {
  const vote = { date: new Date('2013-11-25T00:00:00Z'), dossierId: 'pjlf2014' };

  it('refuse un amendement déposé après le jour du vote', () => {
    const plf2027 = { id: 'b', dateDepot: new Date('2026-11-12T10:00:00Z'), dossierId: null };
    expect(choisirAmendementSenat([plf2027], vote)).toBeNull();
  });

  it('accepte un amendement déposé le jour même du vote', () => {
    const memeJour = { id: 'a', dateDepot: new Date('2013-11-25T18:00:00Z'), dossierId: null };
    expect(choisirAmendementSenat([memeJour], vote)).toBe(memeJour);
  });

  it("refuse un amendement d'un autre dossier connu", () => {
    const autre = { id: 'a', dateDepot: new Date('2013-11-20T00:00:00Z'), dossierId: 'ppl08-394' };
    expect(choisirAmendementSenat([autre], vote)).toBeNull();
  });

  it('prend le dépôt le plus récent avant le vote, puis le plus petit identifiant', () => {
    const ancien = { id: 'a', dateDepot: new Date('2013-11-18T00:00:00Z'), dossierId: 'pjlf2014' };
    const recent1 = { id: 'c', dateDepot: new Date('2013-11-21T00:00:00Z'), dossierId: null };
    const recent2 = { id: 'b', dateDepot: new Date('2013-11-21T00:00:00Z'), dossierId: 'pjlf2014' };
    expect(choisirAmendementSenat([ancien, recent1, recent2], vote)).toBe(recent2);
    expect(choisirAmendementSenat([recent2, recent1, ancien], vote)).toBe(recent2);
  });
});

describe('textes-senat-sql', () => {
  it("rattache par le signet du texte, ou celui, unique, de ses homonymes de même session de dépôt", () => {
    expect(CTE_DOSSIER_DU_TEXTE_SENAT_SQL).toContain('GROUP BY session_depot, numero');
    expect(CTE_DOSSIER_DU_TEXTE_SENAT_SQL).toContain('HAVING count(DISTINCT signet) = 1');
    expect(CTE_DOSSIER_DU_TEXTE_SENAT_SQL).toContain("d.uid = 'SENAT-' || s.signet");
  });

  it('dit quels amendements la source couvre', () => {
    expect(texteSenatCouvertSql('a')).toBe(
      'EXISTS (SELECT 1 FROM dossier_du_texte_senat dts WHERE dts.texte_ref = a.texte_ref)',
    );
  });

  it('lit la session des deux formats de signet', () => {
    const sql = sessionDuSignetSql('x');
    expect(sql).toContain("'^[a-z]+[0-9]{2}-[0-9]+'");
    expect(sql).toContain("'^(pjlf|plfss)[0-9]{4}$'");
    expect(sql).toContain('- 1');
    expect(sessionDeLaDateSql('a.date_depot')).toContain('extract(month from a.date_depot) >= 10');
  });
});
