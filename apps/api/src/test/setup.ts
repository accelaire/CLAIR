// =============================================================================
// Test Setup - Configuration globale pour les tests
// =============================================================================

import { vi, beforeEach, afterEach } from 'vitest';

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// Mock environment variables for tests
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
