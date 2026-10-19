import { describe, it, expect } from 'vitest';
import { parentAN } from './parents-amendements';

describe('parentAN', () => {
  const parUid = new Map([['AMANR5L17PO838901BTC2765P0D1N000662', 'p-commission']]);
  const parCanonique = new Map([['AMANR5L17PO838901B2765P0D1N000011', 'p-canonique']]);

  it('retrouve le parent par son uid', () => {
    expect(parentAN('AMANR5L17PO838901BTC2765P0D1N000662', parUid, parCanonique)).toBe('p-commission');
  });

  it('retrouve par la clé canonique un parent cité sous son uid de commission', () => {
    expect(parentAN('AMANR5L17PO838901BTC2765P0D1N000011', parUid, parCanonique)).toBe('p-canonique');
  });

  it('rend null pour un parent absent de la base', () => {
    expect(parentAN('AMANR5L17PO838901B2765P0D1N009999', parUid, parCanonique)).toBeNull();
  });
});
