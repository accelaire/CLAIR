// =============================================================================
// Tests unitaires - Service Parlementaires
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ParlementairesService } from './parlementaires.service';
import { createMockPrismaClient, createMockRedisClient } from '../../test/mocks';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  mockParlementaireWithRelations,
  mockParlementaireList,
  mockVote,
} from '../../test/fixtures';

describe('ParlementairesService', () => {
  let service: ParlementairesService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockRedis: ReturnType<typeof createMockRedisClient>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    mockRedis = createMockRedisClient();
    service = new ParlementairesService(
      mockPrisma as unknown as PrismaClient,
      mockRedis as unknown as Redis,
    );

    // Clear Redis mock store between tests
    mockRedis._clear();
  });

  describe('getParlementaires', () => {
    const defaultQuery = {
      page: 1,
      limit: 20,
      actif: true,
      sort: 'nom' as const,
      order: 'asc' as const,
      periode: 'mandat' as const,
    };

    it('devrait retourner la liste paginée des parlementaires', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue(mockParlementaireList);
      mockPrisma.parlementaire.count.mockResolvedValue(2);

      const result = await service.getParlementaires(defaultQuery);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(false);
    });

    it('devrait retourner les données du cache si disponibles', async () => {
      const cachedData = {
        data: [{ id: 'cached-1', nom: 'Cached' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      };

      // Pre-populate cache
      const cacheKey = `parlementaires:list:${JSON.stringify(defaultQuery)}`;
      await mockRedis.set(cacheKey, JSON.stringify(cachedData));

      const result = await service.getParlementaires(defaultQuery);

      expect(result).toEqual(cachedData);
      expect(mockPrisma.parlementaire.findMany).not.toHaveBeenCalled();
    });

    it('devrait filtrer par groupe', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      mockPrisma.parlementaire.count.mockResolvedValue(0);

      await service.getParlementaires({ ...defaultQuery, groupe: 'renaissance' });

      expect(mockPrisma.parlementaire.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            groupe: { slug: 'renaissance' },
          }),
        })
      );
    });

    it('devrait filtrer par département', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      mockPrisma.parlementaire.count.mockResolvedValue(0);

      await service.getParlementaires({ ...defaultQuery, departement: '75' });

      expect(mockPrisma.parlementaire.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            circonscription: { departement: '75' },
          }),
        })
      );
    });

    it('devrait appliquer la recherche textuelle', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      mockPrisma.parlementaire.count.mockResolvedValue(0);

      await service.getParlementaires({ ...defaultQuery, search: 'dupont' });

      expect(mockPrisma.parlementaire.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('devrait forcer la chambre si spécifiée', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      mockPrisma.parlementaire.count.mockResolvedValue(0);

      await service.getParlementaires(defaultQuery, 'senat');

      expect(mockPrisma.parlementaire.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            chambre: 'senat',
          }),
        })
      );
    });

    it('devrait calculer correctement la pagination', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      mockPrisma.parlementaire.count.mockResolvedValue(100);

      const result = await service.getParlementaires({ ...defaultQuery, page: 3, limit: 20 });

      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrev).toBe(true);
    });

    it('devrait transformer les _count en propriétés nommées', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue(mockParlementaireList);
      mockPrisma.parlementaire.count.mockResolvedValue(2);

      const result = await service.getParlementaires(defaultQuery);

      expect(result.data[0]).toHaveProperty('votesCount', 150);
      expect(result.data[0]).toHaveProperty('interventionsCount', 42);
      expect(result.data[0]).toHaveProperty('amendementsCount', 25);
      // _count est défini à undefined (la propriété existe mais vaut undefined)
      expect(result.data[0]._count).toBeUndefined();
    });

    it('devrait mettre en cache le résultat', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue(mockParlementaireList);
      mockPrisma.parlementaire.count.mockResolvedValue(2);

      await service.getParlementaires(defaultQuery);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('parlementaires:list'),
        3600, // CACHE_TTL
        expect.any(String)
      );
    });
  });

  describe('getParlementaireBySlug', () => {
    it('devrait retourner un parlementaire par son slug', async () => {
      mockPrisma.parlementaire.findUnique.mockResolvedValue(mockParlementaireWithRelations);

      const result = await service.getParlementaireBySlug('jean-dupont');

      expect(result).toBeDefined();
      expect(result?.slug).toBe('jean-dupont');
      expect(mockPrisma.parlementaire.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'jean-dupont' },
        })
      );
    });

    it('devrait retourner null si non trouvé', async () => {
      mockPrisma.parlementaire.findUnique.mockResolvedValue(null);

      const result = await service.getParlementaireBySlug('inconnu');

      expect(result).toBeNull();
    });

    it('devrait retourner les données du cache si disponibles', async () => {
      const cachedData = { ...mockParlementaireWithRelations, cached: true };
      const cacheKey = 'parlementaire:jean-dupont:base';
      await mockRedis.set(cacheKey, JSON.stringify(cachedData));

      const result = await service.getParlementaireBySlug('jean-dupont');

      expect(result).toHaveProperty('cached', true);
      expect(mockPrisma.parlementaire.findUnique).not.toHaveBeenCalled();
    });

    it('devrait inclure les votes si demandé', async () => {
      mockPrisma.parlementaire.findUnique.mockResolvedValue({
        ...mockParlementaireWithRelations,
        votes: [mockVote],
      });

      await service.getParlementaireBySlug('jean-dupont', ['votes']);

      expect(mockPrisma.parlementaire.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            votes: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('getParlementaireById', () => {
    it('devrait retourner un parlementaire par son ID', async () => {
      mockPrisma.parlementaire.findUnique.mockResolvedValue(mockParlementaireWithRelations);

      const result = await service.getParlementaireById('parl-1');

      expect(result).toBeDefined();
      expect(mockPrisma.parlementaire.findUnique).toHaveBeenCalledWith({
        where: { id: 'parl-1' },
        include: {
          groupe: true,
          circonscription: true,
        },
      });
    });
  });

  describe('getParlementaireStats', () => {
    it('devrait retourner les stats pré-calculées si disponibles', async () => {
      mockPrisma.parlementaire.findUnique.mockResolvedValue({
        statsPresence: 85,
        statsPresenceSolennel: 92,
        statsLoyaute: 90,
        statsParticipation: 150,
        statsInterventions: 42,
        statsAmendements: 25,
        statsAmendementsAdoptes: 10,
        statsQuestions: 15,
        statsCalculatedAt: new Date(),
      });

      const result = await service.getParlementaireStats('parl-1', 'assemblee');

      expect(result.presence).toBe(85);
      expect(result.presenceSolennel).toBe(92);
      expect(result.loyaute).toBe(90);
      expect(result.participation).toBe(150);
      expect(result.interventions).toBe(42);
      expect(result.amendements.proposes).toBe(25);
      expect(result.amendements.adoptes).toBe(10);
      expect(result.questions).toBe(15);
    });

    it('devrait retourner les stats du cache si disponibles', async () => {
      const cachedStats = {
        presence: 80,
        presenceSolennel: 88,
        loyaute: 85,
        participation: 100,
        interventions: 30,
        amendements: { proposes: 20, adoptes: 5 },
        questions: 10,
      };

      await mockRedis.set('parlementaire:stats:parl-1', JSON.stringify(cachedStats));

      const result = await service.getParlementaireStats('parl-1', 'assemblee');

      expect(result).toEqual(cachedStats);
      expect(mockPrisma.parlementaire.findUnique).not.toHaveBeenCalled();
    });

    it('devrait gérer les valeurs null avec des défauts', async () => {
      mockPrisma.parlementaire.findUnique.mockResolvedValue({
        statsPresence: null,
        statsPresenceSolennel: null,
        statsLoyaute: null,
        statsParticipation: null,
        statsInterventions: null,
        statsAmendements: null,
        statsAmendementsAdoptes: null,
        statsQuestions: null,
        statsCalculatedAt: new Date(),
      });

      const result = await service.getParlementaireStats('parl-1', 'assemblee');

      expect(result.presence).toBe(0);
      expect(result.presenceSolennel).toBeNull();
      expect(result.loyaute).toBe(0);
    });
  });
});
