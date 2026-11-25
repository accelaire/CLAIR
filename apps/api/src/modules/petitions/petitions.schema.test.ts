import { describe, it, expect } from 'vitest';
import { petitionParamsSchema, petitionsQuerySchema } from './petitions.schema';

describe('petitionsQuerySchema', () => {
  it('trie par signatures, 20 par page, par défaut', () => {
    expect(petitionsQuerySchema.parse({})).toEqual({ page: 1, limit: 20, sort: 'signatures' });
  });

  // `z.coerce.boolean()` lirait « false » comme vrai et ne rendrait que les suivies.
  it('lit suivies=false comme faux', () => {
    expect(petitionsQuerySchema.parse({ suivies: 'false' }).suivies).toBe(false);
    expect(petitionsQuerySchema.parse({ suivies: 'true' }).suivies).toBe(true);
    expect(() => petitionsQuerySchema.parse({ suivies: 'oui' })).toThrow();
  });

  it('accepte une étape du parcours ou « aucune », rien d’autre', () => {
    expect(petitionsQuerySchema.parse({ etape: 'rapport' }).etape).toBe('rapport');
    expect(petitionsQuerySchema.parse({ etape: 'aucune' }).etape).toBe('aucune');
    expect(() => petitionsQuerySchema.parse({ etape: 'ouverte' })).toThrow();
  });

  it('borne la taille des pages et refuse une recherche vide', () => {
    expect(() => petitionsQuerySchema.parse({ limit: '500' })).toThrow();
    expect(() => petitionsQuerySchema.parse({ search: '   ' })).toThrow();
    expect(petitionsQuerySchema.parse({ search: ' Duplomb ' }).search).toBe('Duplomb');
  });
});

describe('petitionParamsSchema', () => {
  it('lit la chambre et le numéro de l’URL', () => {
    expect(petitionParamsSchema.parse({ chambre: 'assemblee', numero: '3014' })).toEqual({ chambre: 'assemblee', numero: 3014 });
  });

  it('refuse une chambre inconnue ou un numéro qui n’en est pas un', () => {
    expect(() => petitionParamsSchema.parse({ chambre: 'an', numero: '3014' })).toThrow();
    expect(() => petitionParamsSchema.parse({ chambre: 'senat', numero: 'i-742' })).toThrow();
    expect(() => petitionParamsSchema.parse({ chambre: 'senat', numero: '0' })).toThrow();
  });
});
