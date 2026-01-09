// =============================================================================
// Mock Prisma Client pour les tests unitaires
// =============================================================================

import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Type helper pour créer des mocks Prisma
type MockPrismaModel = {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
};

function createMockModel(): MockPrismaModel {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

export function createMockPrismaClient() {
  return {
    parlementaire: createMockModel(),
    groupePolitique: createMockModel(),
    circonscription: createMockModel(),
    scrutin: createMockModel(),
    vote: createMockModel(),
    intervention: createMockModel(),
    amendement: createMockModel(),
    lobbyiste: createMockModel(),
    actionLobby: createMockModel(),
    user: createMockModel(),
    alerte: createMockModel(),
    favori: createMockModel(),
    sourceState: createMockModel(),
    dossierLegislatif: createMockModel(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(createMockPrismaClient())),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  } as unknown as PrismaClient & { [key: string]: MockPrismaModel };
}

export type MockPrismaClient = ReturnType<typeof createMockPrismaClient>;
