// =============================================================================
// Mock Prisma Client pour les tests unitaires
// =============================================================================

import { vi, type Mock } from 'vitest';

// Type helper pour créer des mocks Prisma avec méthodes Vitest
export type MockPrismaModel = {
  findMany: Mock;
  findUnique: Mock;
  findFirst: Mock;
  create: Mock;
  createMany: Mock;
  update: Mock;
  updateMany: Mock;
  delete: Mock;
  deleteMany: Mock;
  count: Mock;
  aggregate: Mock;
  groupBy: Mock;
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
    // `groupBy` renvoie une liste : le défaut est le tableau vide, pas `undefined`.
    // Sans ça, tout appel non stubé explose sur `.filter` au lieu de se comporter
    // comme un résultat vide.
    groupBy: vi.fn().mockResolvedValue([]),
  };
}

export interface MockPrismaClient {
  parlementaire: MockPrismaModel;
  groupePolitique: MockPrismaModel;
  circonscription: MockPrismaModel;
  scrutin: MockPrismaModel;
  vote: MockPrismaModel;
  intervention: MockPrismaModel;
  amendement: MockPrismaModel;
  lobbyiste: MockPrismaModel;
  actionLobby: MockPrismaModel;
  user: MockPrismaModel;
  alerte: MockPrismaModel;
  favori: MockPrismaModel;
  sourceState: MockPrismaModel;
  dossierLegislatif: MockPrismaModel;
  $connect: Mock;
  $disconnect: Mock;
  $transaction: Mock;
  $queryRaw: Mock;
  $queryRawUnsafe: Mock;
  $executeRaw: Mock;
}

export function createMockPrismaClient(): MockPrismaClient {
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
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
  };
}
