// =============================================================================
// Tests d'intégration - Controller Parlementaires
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, closeTestApp, TestApp } from '../../test/helpers/app.helper';
import { deputesRoutes } from './parlementaires.controller';
import {
  mockParlementaireWithRelations,
  mockParlementaireList,
  mockGroupe,
} from '../../test/fixtures';

describe('Parlementaires Controller - Integration Tests', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await buildTestApp({
      routes: async (fastify) => {
        await fastify.register(deputesRoutes, { prefix: '/api/v1/deputes' });
      },
    });
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    // Clear mocks and cache between tests
    app.mockRedis._clear();
  });

  describe('GET /api/v1/deputes', () => {
    it('devrait retourner la liste des députés', async () => {
      app.mockPrisma.parlementaire.findMany.mockResolvedValue(mockParlementaireList);
      app.mockPrisma.parlementaire.count.mockResolvedValue(2);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);
    });

    it('devrait supporter la pagination', async () => {
      app.mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      app.mockPrisma.parlementaire.count.mockResolvedValue(100);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes?page=3&limit=10',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.meta.page).toBe(3);
      expect(body.meta.limit).toBe(10);
      expect(body.meta.totalPages).toBe(10);
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.hasPrev).toBe(true);
    });

    it('devrait filtrer par groupe politique', async () => {
      app.mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      app.mockPrisma.parlementaire.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes?groupe=renaissance',
      });

      expect(response.statusCode).toBe(200);
      expect(app.mockPrisma.parlementaire.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            groupe: { slug: 'renaissance' },
          }),
        })
      );
    });

    it('devrait filtrer par département', async () => {
      app.mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      app.mockPrisma.parlementaire.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes?departement=75',
      });

      expect(response.statusCode).toBe(200);
      expect(app.mockPrisma.parlementaire.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            circonscription: { departement: '75' },
          }),
        })
      );
    });

    it('devrait supporter la recherche', async () => {
      app.mockPrisma.parlementaire.findMany.mockResolvedValue([]);
      app.mockPrisma.parlementaire.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes?search=dupont',
      });

      expect(response.statusCode).toBe(200);
      expect(app.mockPrisma.parlementaire.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('devrait rejeter une limite trop élevée', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes?limit=500',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/deputes/:slug', () => {
    it('devrait retourner un député par son slug', async () => {
      app.mockPrisma.parlementaire.findUnique.mockResolvedValue({
        ...mockParlementaireWithRelations,
        chambre: 'assemblee',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/jean-dupont',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body.data.slug).toBe('jean-dupont');
    });

    it('devrait retourner 404 si non trouvé', async () => {
      app.mockPrisma.parlementaire.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/inconnu',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('devrait retourner 404 si le parlementaire est un sénateur', async () => {
      app.mockPrisma.parlementaire.findUnique.mockResolvedValue({
        ...mockParlementaireWithRelations,
        chambre: 'senat',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/senateur-slug',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/deputes/groupes', () => {
    it('devrait retourner la liste des groupes politiques', async () => {
      app.mockPrisma.groupePolitique.findMany.mockResolvedValue([
        { ...mockGroupe, _count: { parlementaires: 50 } },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/groupes',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/deputes/compare', () => {
    it('devrait comparer plusieurs députés', async () => {
      app.mockPrisma.parlementaire.findMany.mockResolvedValue([
        { ...mockParlementaireWithRelations, slug: 'depute-1', chambre: 'assemblee' },
        { ...mockParlementaireWithRelations, slug: 'depute-2', chambre: 'assemblee' },
      ]);
      app.mockPrisma.parlementaire.findUnique.mockResolvedValue({
        statsPresence: 80,
        statsLoyaute: 90,
        statsParticipation: 100,
        statsInterventions: 50,
        statsAmendements: 20,
        statsAmendementsAdoptes: 10,
        statsQuestions: 5,
        statsCalculatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/compare?slugs=depute-1,depute-2',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
    });

    it('devrait rejeter si moins de 2 slugs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/compare?slugs=depute-1',
      });

      expect(response.statusCode).toBe(400);
    });

    it('devrait rejeter si plus de 4 slugs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/compare?slugs=d1,d2,d3,d4,d5',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/deputes/:slug/stats', () => {
    it('devrait retourner les statistiques', async () => {
      app.mockPrisma.parlementaire.findUnique
        .mockResolvedValueOnce({ id: 'parl-1', chambre: 'assemblee' })
        .mockResolvedValueOnce({
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

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/jean-dupont/stats',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('presence');
      expect(body.data).toHaveProperty('loyaute');
      expect(body.data).toHaveProperty('amendements');
    });
  });

  describe('GET /api/v1/deputes/:slug/votes', () => {
    it('devrait retourner 404 si parlementaire non trouvé', async () => {
      app.mockPrisma.parlementaire.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/inconnu/votes',
      });

      expect(response.statusCode).toBe(404);
    });

    it('devrait retourner une liste vide si dissidentOnly et pas de groupe', async () => {
      app.mockPrisma.parlementaire.findUnique.mockResolvedValue({
        id: 'parl-1',
        chambre: 'assemblee',
        groupeId: null, // Pas de groupe
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/deputes/jean-dupont/votes?dissidentOnly=true',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });
  });
});
