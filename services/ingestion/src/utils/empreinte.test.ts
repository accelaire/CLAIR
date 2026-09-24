import { describe, it, expect } from 'vitest';
import { empreinte } from './empreinte';

describe('empreinte', () => {
  it("ne dépend pas de l'ordre des clés, y compris imbriquées", () => {
    expect(empreinte({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(
      empreinte({ b: { d: [1, 2], c: 2 }, a: 1 }),
    );
  });

  it("dépend de l'ordre des éléments d'un tableau", () => {
    expect(empreinte([1, 2])).not.toBe(empreinte([2, 1]));
  });

  it('lit une date sous sa forme ISO', () => {
    expect(empreinte({ d: new Date('2026-09-23T00:00:00Z') })).toBe(
      empreinte({ d: new Date(Date.UTC(2026, 8, 23)) }),
    );
    expect(empreinte({ d: new Date('2026-09-23T00:00:00Z') })).not.toBe(
      empreinte({ d: new Date('2026-09-24T00:00:00Z') }),
    );
  });

  it('confond undefined et null, comme la base', () => {
    expect(empreinte({ a: undefined })).toBe(empreinte({ a: null }));
  });

  it('distingue une chaîne de son nombre', () => {
    expect(empreinte({ n: '1' })).not.toBe(empreinte({ n: 1 }));
  });

  it("change avec la moindre modification d'un texte", () => {
    expect(empreinte({ t: 'nous nous opposons' })).not.toBe(empreinte({ t: 'nous opposons' }));
  });
});
