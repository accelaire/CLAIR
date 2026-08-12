// =============================================================================
// Mock Redis Client pour les tests unitaires
// =============================================================================

import { vi } from 'vitest';
import type { Redis } from 'ioredis';

/**
 * Glob Redis (`*` seulement) → RegExp. L'ancienne version ne remplaçait que la
 * PREMIÈRE étoile et n'échappait rien : `parlementaire:votes:<uuid>:*` laissait
 * les autres caractères spéciaux (`.`, `-`) agir comme des métacaractères.
 */
function matchGlob(pattern: string, key: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(key);
}

export function createMockRedisClient() {
  const store = new Map<string, string>();

  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) || null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    setex: vi.fn((key: string, _seconds: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((...keys: string[]) => {
      let n = 0;
      for (const key of keys) if (store.delete(key)) n++;
      return Promise.resolve(n);
    }),
    keys: vi.fn((pattern: string) => {
      return Promise.resolve(Array.from(store.keys()).filter((k) => matchGlob(pattern, k)));
    }),
    // Le vrai `scan` parcourt l'espace de clés par lots ; ici tout tient en
    // mémoire, on renvoie donc tout d'un coup avec le curseur final '0'.
    scan: vi.fn((_cursor: string, ...args: (string | number)[]) => {
      const matchIdx = args.findIndex((a) => String(a).toUpperCase() === 'MATCH');
      const pattern = matchIdx >= 0 ? String(args[matchIdx + 1]) : '*';
      return Promise.resolve([
        '0',
        Array.from(store.keys()).filter((k) => matchGlob(pattern, k)),
      ]);
    }),
    flushall: vi.fn(() => {
      store.clear();
      return Promise.resolve('OK');
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    ttl: vi.fn(() => Promise.resolve(-1)),
    exists: vi.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    incr: vi.fn((key: string) => {
      const val = parseInt(store.get(key) || '0', 10) + 1;
      store.set(key, val.toString());
      return Promise.resolve(val);
    }),
    // Helper pour les tests: accès direct au store
    _store: store,
    _clear: () => store.clear(),
  } as unknown as Redis & { _store: Map<string, string>; _clear: () => void };
}

export type MockRedisClient = ReturnType<typeof createMockRedisClient>;
