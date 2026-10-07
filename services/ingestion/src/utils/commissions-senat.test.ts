// =============================================================================
// Tests — Clôture des commissions du Sénat que l'annuaire ne porte plus
// Cas tirés de la prod du 7 octobre 2026, au lendemain du renouvellement.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { commissionsQuittees, type MandatCommissionOuvert } from './commissions-senat.js';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const MAINTENANT = d('2026-10-07');

function mandat(id: string, personne: string, matricule: string | null, organeRef: string, debut: string): MandatCommissionOuvert {
  return { id, parlementaireId: personne, matricule, organeRef, dateDebut: d(debut) };
}

describe('commissionsQuittees', () => {
  it("garde l'appartenance que l'annuaire publie", () => {
    const clos = commissionsQuittees(
      [mandat('m1', 'p1', '21035s', 'COM-FINC', '2026-10-01')],
      [{ matricule: '21035S', organeRef: 'COM-FINC' }],
      new Set(['21035S']),
      new Map(),
      MAINTENANT,
    );
    expect(clos).toEqual([]);
  });

  it('clôt la commission d’un sénateur sorti à la fin de son mandat', () => {
    // Président de la commission des finances, non réélu : restait affiché.
    const clos = commissionsQuittees(
      [mandat('m1', 'p1', '08049N', 'COM-FINC', '2026-04-29')],
      [{ matricule: '21035S', organeRef: 'COM-FINC' }],
      new Set(['21035S']),
      new Map([['p1', d('2026-09-30')]]),
      MAINTENANT,
    );
    expect(clos).toEqual([{ id: 'm1', dateFin: d('2026-09-30') }]);
  });

  it('clôt l’ancienne commission la veille de la nouvelle', () => {
    // Alain Marc : lois (avant), finances depuis le 1er octobre.
    const clos = commissionsQuittees(
      [
        mandat('lois', 'p1', '20032X', 'COM-LOIS', '2026-04-29'),
        mandat('finc', 'p1', '20032X', 'COM-FINC', '2026-10-01'),
      ],
      [{ matricule: '20032X', organeRef: 'COM-FINC' }, { matricule: '21035S', organeRef: 'COM-LOIS' }],
      new Set(['20032X', '21035S']),
      new Map(),
      MAINTENANT,
    );
    expect(clos).toEqual([{ id: 'lois', dateFin: d('2026-09-30') }]);
  });

  it("date à l'observation quand la nouvelle appartenance n'est pas plus récente", () => {
    // Nouvelle ligne ancrée au début de mandature (2023), plus ancienne que l'ancienne.
    const clos = commissionsQuittees(
      [
        mandat('cdd', 'p1', '23001A', 'COM-CDD', '2026-04-29'),
        mandat('finc', 'p1', '23001A', 'COM-FINC', '2023-10-01'),
      ],
      [{ matricule: '23001A', organeRef: 'COM-FINC' }, { matricule: '21035S', organeRef: 'COM-CDD' }],
      new Set(['23001A', '21035S']),
      new Map(),
      MAINTENANT,
    );
    expect(clos).toEqual([{ id: 'cdd', dateFin: MAINTENANT }]);
  });

  it('ne date jamais une fin avant le début', () => {
    const clos = commissionsQuittees(
      [mandat('m1', 'p1', '08049N', 'COM-FINC', '2026-10-02')],
      [],
      new Set(),
      new Map([['p1', d('2026-09-30')]]),
      MAINTENANT,
    );
    expect(clos).toEqual([{ id: 'm1', dateFin: d('2026-10-02') }]);
  });

  it('clôt la ligne d’une personne sans matricule', () => {
    const clos = commissionsQuittees(
      [mandat('m1', 'p1', null, 'COM-SOCI', '2026-04-29')],
      [{ matricule: '21035S', organeRef: 'COM-SOCI' }],
      new Set(['21035S']),
      new Map(),
      MAINTENANT,
    );
    expect(clos).toEqual([{ id: 'm1', dateFin: MAINTENANT }]);
  });

  it('sur un organe absent de l’annuaire, ne clôt que les personnes sorties', () => {
    // Commission des affaires européennes : 11 sortants restaient membres.
    const clos = commissionsQuittees(
      [
        mandat('afeu-sorti', 'p1', '08049N', 'COMEUR-AFEU', '2026-04-29'),
        mandat('afeu-en-poste', 'p2', '21035S', 'COMEUR-AFEU', '2026-04-29'),
        mandat('finc', 'p2', '21035S', 'COM-FINC', '2026-10-01'),
      ],
      [{ matricule: '21035S', organeRef: 'COM-FINC' }],
      new Set(['21035S']),
      new Map([['p1', d('2026-09-30')]]),
      MAINTENANT,
    );
    expect(clos).toEqual([{ id: 'afeu-sorti', dateFin: d('2026-09-30') }]);
  });

  it('ne clôt pas le président du Sénat, en exercice sans commission', () => {
    const clos = commissionsQuittees(
      [mandat('afeu', 'p1', '99001Z', 'COMEUR-AFEU', '2026-04-29')],
      [{ matricule: '21035S', organeRef: 'COM-FINC' }],
      new Set(['21035S', '99001Z']),
      new Map(),
      MAINTENANT,
    );
    expect(clos).toEqual([]);
  });
});
