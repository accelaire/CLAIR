// =============================================================================
// Tests unitaires - Bypass par clé API du rate limiting
// =============================================================================

import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { hasValidApiKey } from './rate-limit';

/** Construit une requête minimale ne portant que le header x-api-key. */
function req(key?: string): FastifyRequest {
  const headers: Record<string, string> = {};
  if (key !== undefined) headers['x-api-key'] = key;
  return { headers } as unknown as FastifyRequest;
}

const ORIGINAL = process.env.CLAIR_API_KEYS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CLAIR_API_KEYS;
  else process.env.CLAIR_API_KEYS = ORIGINAL;
});

describe('hasValidApiKey', () => {
  it('renvoie false quand aucune clé n’est configurée', () => {
    delete process.env.CLAIR_API_KEYS;
    expect(hasValidApiKey(req('anything'))).toBe(false);
  });

  it('renvoie false quand CLAIR_API_KEYS est vide ou blanc', () => {
    process.env.CLAIR_API_KEYS = '   ,  ';
    expect(hasValidApiKey(req('anything'))).toBe(false);
  });

  it('accepte une clé valide', () => {
    process.env.CLAIR_API_KEYS = 'secret-key-abc';
    expect(hasValidApiKey(req('secret-key-abc'))).toBe(true);
  });

  it('rejette une clé invalide', () => {
    process.env.CLAIR_API_KEYS = 'secret-key-abc';
    expect(hasValidApiKey(req('wrong-key'))).toBe(false);
  });

  it('rejette l’absence de header x-api-key', () => {
    process.env.CLAIR_API_KEYS = 'secret-key-abc';
    expect(hasValidApiKey(req())).toBe(false);
  });

  it('rejette un header vide', () => {
    process.env.CLAIR_API_KEYS = 'secret-key-abc';
    expect(hasValidApiKey(req(''))).toBe(false);
  });

  it('gère plusieurs clés séparées par des virgules (révocation par consommateur)', () => {
    process.env.CLAIR_API_KEYS = 'key-alice, key-bob ,key-carol';
    expect(hasValidApiKey(req('key-alice'))).toBe(true);
    expect(hasValidApiKey(req('key-bob'))).toBe(true);
    expect(hasValidApiKey(req('key-carol'))).toBe(true);
    expect(hasValidApiKey(req('key-dave'))).toBe(false);
  });

  it('ne matche pas un préfixe / sous-chaîne d’une clé valide', () => {
    process.env.CLAIR_API_KEYS = 'secret-key-abc';
    expect(hasValidApiKey(req('secret-key-ab'))).toBe(false);
    expect(hasValidApiKey(req('secret-key-abcd'))).toBe(false);
  });

  it('prend en compte un changement de CLAIR_API_KEYS (cache invalidé)', () => {
    process.env.CLAIR_API_KEYS = 'old-key';
    expect(hasValidApiKey(req('old-key'))).toBe(true);

    process.env.CLAIR_API_KEYS = 'new-key';
    expect(hasValidApiKey(req('old-key'))).toBe(false);
    expect(hasValidApiKey(req('new-key'))).toBe(true);
  });
});
