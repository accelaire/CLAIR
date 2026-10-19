import { describe, it, expect } from 'vitest';
import { amendementsQuerySchema } from './dossiers.schema';

describe('amendementsQuerySchema', () => {
  // `z.coerce.boolean()` lit toute chaîne non vide comme vraie : « false »
  // aurait retiré les sous-amendements de la liste.
  it('lit racines=false comme faux', () => {
    expect(amendementsQuerySchema.parse({ racines: 'false' }).racines).toBe(false);
    expect(amendementsQuerySchema.parse({ racines: 'true' }).racines).toBe(true);
    expect(amendementsQuerySchema.parse({}).racines).toBeUndefined();
  });

  // `voted=false` renvoyait les seuls amendements mis aux voix.
  it('lit voted=false comme faux', () => {
    expect(amendementsQuerySchema.parse({ voted: 'false' }).voted).toBe(false);
    expect(amendementsQuerySchema.parse({ voted: 'true' }).voted).toBe(true);
    expect(amendementsQuerySchema.parse({}).voted).toBeUndefined();
  });

  it('refuse une valeur de racines qui n’est pas un booléen', () => {
    expect(() => amendementsQuerySchema.parse({ racines: 'oui' })).toThrow();
  });

  it('garde l’uid de l’amendement visé', () => {
    const uid = 'AMANR5L17PO838901BTC1583P0D1N000040';
    expect(amendementsQuerySchema.parse({ amendement: uid }).amendement).toBe(uid);
  });
});
