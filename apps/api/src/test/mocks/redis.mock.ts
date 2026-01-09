// =============================================================================
// Mock Redis Client pour les tests unitaires
// =============================================================================

import { vi } from 'vitest';
import type { Redis } from 'ioredis';

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
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    keys: vi.fn((pattern: string) => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return Promise.resolve(Array.from(store.keys()).filter((k) => regex.test(k)));
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
