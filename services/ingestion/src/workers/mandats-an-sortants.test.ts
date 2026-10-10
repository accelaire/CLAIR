import { describe, it, expect } from 'vitest';
import { decisionsSortants, ORGANES_AN_HORS_MANDAT, type CandidatSortant } from './mandats-an-sortants';

const maintenant = new Date('2026-10-08T03:00:00Z');
const source = new Set(['PA100', 'PA200']);

const candidat = (c: Partial<CandidatSortant>): CandidatSortant => ({
  personneId: 'P',
  identifiantAN: 'PA999',
  debutSenat: null,
  ...c,
});

describe('decisionsSortants', () => {
  it('ignore les députés encore listés par la source, quelle que soit la casse', () => {
    expect(decisionsSortants([candidat({ identifiantAN: 'pa100' })], source, maintenant, null)).toEqual([]);
  });

  it("clôt à la date d'observation et désactive un député parti", () => {
    expect(decisionsSortants([candidat({})], source, maintenant, null)).toEqual([
      { personneId: 'P', dateFin: maintenant, desactiver: true },
    ]);
  });

  it("borne la date d'observation à la fin de la législature", () => {
    const fin = new Date('2026-06-30T00:00:00Z');
    expect(decisionsSortants([candidat({})], source, maintenant, fin)[0]!.dateFin).toEqual(fin);
  });

  it("un député élu sénateur : fin à la veille de l'entrée au Sénat, fiche gardée active", () => {
    // Gabriel Amard : fiche passée au Sénat le 1er octobre 2026, identifiant PA conservé.
    const [d] = decisionsSortants(
      [candidat({ personneId: 'amard', identifiantAN: 'PA794906', debutSenat: new Date('2026-10-01T00:00:00Z') })],
      source,
      maintenant,
      null,
    );
    expect(d).toEqual({ personneId: 'amard', dateFin: new Date('2026-09-30T00:00:00Z'), desactiver: false });
  });

  it("ne décide rien sans identifiant de l'Assemblée", () => {
    expect(decisionsSortants([candidat({ identifiantAN: null })], source, maintenant, null)).toEqual([]);
  });
});

describe('ORGANES_AN_HORS_MANDAT', () => {
  it("ne touche qu'aux personnes sans mandat de député ouvert", () => {
    expect(ORGANES_AN_HORS_MANDAT).toContain("o.source_uid LIKE 'PM%'");
    expect(ORGANES_AN_HORS_MANDAT).toContain('o.date_fin IS NULL');
    expect(ORGANES_AN_HORS_MANDAT).toMatch(/NOT EXISTS[\s\S]*mp\.date_fin IS NULL/);
  });

  it("date la fin par le mandat qui courait, jamais par le mandat « commencé avant »", () => {
    // Un organe commence le jour de l'élection, le mandat le lendemain : 437
    // organes de députés en exercice clos à tort le 8 octobre 2026.
    expect(ORGANES_AN_HORS_MANDAT).toContain('mp.date_fin >= o.date_debut');
    expect(ORGANES_AN_HORS_MANDAT).not.toContain('mp.date_debut <= o.date_debut');
  });
});
