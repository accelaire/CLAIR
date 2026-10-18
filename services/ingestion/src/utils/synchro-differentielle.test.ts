import { describe, it, expect } from 'vitest';
import { alignerLiens, differencier, tranches } from './synchro-differentielle';

type Vote = { parlementaireId: string; position: string; parDelegation: boolean };
type VoteEnBase = Vote & { id: string; miseAuPoint: string | null };

const cle = {
  existant: (e: VoteEnBase) => e.parlementaireId,
  voulu: (v: Vote) => v.parlementaireId,
};
const champs = ['position', 'parDelegation'] as const;

describe('differencier', () => {
  it("ne touche à rien quand la source n'a pas changé", () => {
    const enBase = [{ id: 'v1', parlementaireId: 'p1', position: 'pour', parDelegation: false, miseAuPoint: null }];
    const d = differencier(enBase, [{ parlementaireId: 'p1', position: 'pour', parDelegation: false }], cle, champs);
    expect(d).toEqual({ aCreer: [], aModifier: [], aSupprimer: [], inchanges: 1 });
  });

  it("garde l'identifiant de la ligne modifiée", () => {
    const enBase = [{ id: 'v1', parlementaireId: 'p1', position: 'pour', parDelegation: false, miseAuPoint: null }];
    const d = differencier(enBase, [{ parlementaireId: 'p1', position: 'contre', parDelegation: false }], cle, champs);
    expect(d.aModifier).toHaveLength(1);
    expect(d.aModifier[0]!.existant.id).toBe('v1');
    expect(d.aModifier[0]!.voulu.position).toBe('contre');
    expect(d.aCreer).toEqual([]);
    expect(d.aSupprimer).toEqual([]);
  });

  it('crée ce qui manque et supprime ce que la source a retiré', () => {
    const enBase = [{ id: 'v1', parlementaireId: 'p1', position: 'pour', parDelegation: false, miseAuPoint: null }];
    const d = differencier(enBase, [{ parlementaireId: 'p2', position: 'pour', parDelegation: false }], cle, champs);
    expect(d.aCreer.map((v) => v.parlementaireId)).toEqual(['p2']);
    expect(d.aSupprimer.map((e) => e.id)).toEqual(['v1']);
  });

  it("ignore les colonnes qu'il n'écrit pas", () => {
    const enBase = [{ id: 'v1', parlementaireId: 'p1', position: 'pour', parDelegation: false, miseAuPoint: 'rectifié' }];
    const d = differencier(enBase, [{ parlementaireId: 'p1', position: 'pour', parDelegation: false }], cle, champs);
    expect(d.inchanges).toBe(1);
  });

  it('lit une date et un JSON par leur valeur, pas par leur identité', () => {
    type L = { k: string; d: Date | null; j: unknown };
    const enBase: L[] = [{ k: 'a', d: new Date('2026-10-18T00:00:00Z'), j: { x: 1, y: [1, 2] } }];
    const voulu: L[] = [{ k: 'a', d: new Date(Date.UTC(2026, 9, 18)), j: { y: [1, 2], x: 1 } }];
    const d = differencier(enBase, voulu, { existant: (e) => e.k, voulu: (v) => v.k }, ['d', 'j']);
    expect(d.inchanges).toBe(1);
  });

  it('confond undefined et null, comme la base', () => {
    type L = { k: string; n?: string | null };
    const d = differencier<L, L>([{ k: 'a', n: null }], [{ k: 'a' }], { existant: (e) => e.k, voulu: (v) => v.k }, ['n']);
    expect(d.inchanges).toBe(1);
  });

  it('garde la première de deux lignes voulues sur la même clé', () => {
    const d = differencier<Vote, VoteEnBase>(
      [],
      [
        { parlementaireId: 'p1', position: 'pour', parDelegation: false },
        { parlementaireId: 'p1', position: 'contre', parDelegation: false },
      ],
      cle,
      champs,
    );
    expect(d.aCreer).toEqual([{ parlementaireId: 'p1', position: 'pour', parDelegation: false }]);
  });
});

describe('tranches', () => {
  it('découpe sans perdre ni dupliquer', () => {
    expect(tranches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(tranches([], 2)).toEqual([]);
  });
});

describe('alignerLiens', () => {
  it("ne fait rien quand la liste n'a pas changé, même dans un autre ordre", () => {
    expect(alignerLiens(['a', 'b'], ['b', 'a'])).toBeUndefined();
  });

  it('ne connecte que les nouveaux et ne déconnecte que les retirés', () => {
    expect(alignerLiens(['a', 'b'], ['b', 'c'])).toEqual({ connect: [{ id: 'c' }], disconnect: [{ id: 'a' }] });
  });

  it('ignore les doublons de la liste voulue', () => {
    expect(alignerLiens([], ['a', 'a'])).toEqual({ connect: [{ id: 'a' }] });
  });
});
