import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { isInternalRequest, hasInternalSecret, INTERNAL_HEADER } from './internal-auth';

const ORIGINAL_SECRET = process.env.CLAIR_INTERNAL_SECRET;
const ORIGINAL_LEGACY = process.env.CACHE_WARM_TOKEN;

/** Requête minimale : seuls les en-têtes sont lus. */
function req(headers: Record<string, string | string[] | undefined>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

beforeEach(() => {
  delete process.env.CLAIR_INTERNAL_SECRET;
  delete process.env.CACHE_WARM_TOKEN;
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CLAIR_INTERNAL_SECRET;
  else process.env.CLAIR_INTERNAL_SECRET = ORIGINAL_SECRET;
  if (ORIGINAL_LEGACY === undefined) delete process.env.CACHE_WARM_TOKEN;
  else process.env.CACHE_WARM_TOKEN = ORIGINAL_LEGACY;
});

describe('isInternalRequest', () => {
  it('accepte le bon secret', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    expect(isInternalRequest(req({ [INTERNAL_HEADER]: 'secret-interne' }))).toBe(true);
  });

  it('refuse un secret erroné', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    expect(isInternalRequest(req({ [INTERNAL_HEADER]: 'pas-le-bon' }))).toBe(false);
  });

  it('refuse un secret de longueur différente sans lever', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    // timingSafeEqual lève sur des buffers de tailles différentes : le hash
    // SHA-256 les ramène à 32 octets, donc la comparaison reste sûre.
    expect(() => isInternalRequest(req({ [INTERNAL_HEADER]: 'x' }))).not.toThrow();
    expect(isInternalRequest(req({ [INTERNAL_HEADER]: 'x' }))).toBe(false);
  });

  it('tolère les espaces autour du secret fourni', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    expect(isInternalRequest(req({ [INTERNAL_HEADER]: '  secret-interne  ' }))).toBe(true);
  });

  it('refuse quand aucun secret n\'est configuré, même avec un en-tête', () => {
    expect(isInternalRequest(req({ [INTERNAL_HEADER]: 'peu-importe' }))).toBe(false);
  });

  it('refuse quand le secret configuré est vide ou blanc', () => {
    process.env.CLAIR_INTERNAL_SECRET = '   ';
    expect(isInternalRequest(req({ [INTERNAL_HEADER]: '   ' }))).toBe(false);
  });

  it('refuse une requête sans en-tête', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    expect(isInternalRequest(req({}))).toBe(false);
  });

  it('refuse un en-tête répété (tableau), non exploitable en comparaison', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    expect(isInternalRequest(req({ [INTERNAL_HEADER]: ['secret-interne'] }))).toBe(false);
  });

  it('ne se laisse pas berner par un Origin falsifié', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    expect(isInternalRequest(req({ origin: 'https://clair.vote' }))).toBe(false);
  });

  describe('compatibilité pendant la bascule', () => {
    it('accepte encore l\'ancien en-tête x-warm-token', () => {
      process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
      expect(isInternalRequest(req({ 'x-warm-token': 'secret-interne' }))).toBe(true);
    });

    it('retombe sur CACHE_WARM_TOKEN si la nouvelle variable est absente', () => {
      process.env.CACHE_WARM_TOKEN = 'ancien-token';
      expect(isInternalRequest(req({ [INTERNAL_HEADER]: 'ancien-token' }))).toBe(true);
    });

    it('donne la priorité à CLAIR_INTERNAL_SECRET quand les deux existent', () => {
      process.env.CLAIR_INTERNAL_SECRET = 'nouveau';
      process.env.CACHE_WARM_TOKEN = 'ancien';
      expect(isInternalRequest(req({ [INTERNAL_HEADER]: 'nouveau' }))).toBe(true);
      expect(isInternalRequest(req({ [INTERNAL_HEADER]: 'ancien' }))).toBe(false);
    });
  });
});

describe('hasInternalSecret', () => {
  it('est faux sans configuration', () => {
    expect(hasInternalSecret()).toBe(false);
  });

  it('est faux si la variable est blanche', () => {
    process.env.CLAIR_INTERNAL_SECRET = '  ';
    expect(hasInternalSecret()).toBe(false);
  });

  it('est vrai dès que la variable est renseignée', () => {
    process.env.CLAIR_INTERNAL_SECRET = 'secret-interne';
    expect(hasInternalSecret()).toBe(true);
  });
});
