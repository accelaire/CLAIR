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

    it('devrait exposer les compteurs de relations en propriétés nommées', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue(mockParlementaireList);
      mockPrisma.parlementaire.count.mockResolvedValue(2);
      mockPrisma.vote.groupBy.mockResolvedValue([
        { parlementaireId: 'parl-1', _count: { _all: 150 } },
        { parlementaireId: 'parl-2', _count: { _all: 145 } },
      ]);
      mockPrisma.intervention.groupBy.mockResolvedValue([
        { parlementaireId: 'parl-1', _count: { _all: 42 } },
      ]);
      mockPrisma.amendement.groupBy.mockResolvedValue([
        { parlementaireId: 'parl-1', _count: { _all: 25 } },
      ]);

      const result = await service.getParlementaires(defaultQuery);

      expect(result.data[0]).toHaveProperty('votesCount', 150);
      expect(result.data[0]).toHaveProperty('interventionsCount', 42);
      expect(result.data[0]).toHaveProperty('amendementsCount', 25);
      expect(result.data[1]).toHaveProperty('votesCount', 145);
      // Absent du groupBy = 0, jamais undefined : Postgres n'émet pas de ligne
      // pour un parlementaire sans aucune intervention.
      expect(result.data[1]).toHaveProperty('interventionsCount', 0);
      expect(result.data[1]).toHaveProperty('amendementsCount', 0);
    });

    it('devrait borner les compteurs aux parlementaires de la page', async () => {
      mockPrisma.parlementaire.findMany.mockResolvedValue(mockParlementaireList);
      mockPrisma.parlementaire.count.mockResolvedValue(2);

      await service.getParlementaires(defaultQuery);

      // Le garde-fou du correctif : sans le `where`, Prisma agrège la TOTALITÉ de
      // votes / interventions / amendements à chaque appel (cf. countRelationsForPage).
      const pageIds = mockParlementaireList.map((p) => p.id);
      for (const model of [mockPrisma.vote, mockPrisma.intervention, mockPrisma.amendement]) {
        expect(model.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            by: ['parlementaireId'],
            where: { parlementaireId: { in: pageIds } },
          })
        );
      }
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

  // ===========================================================================
  // VOTES D'UN PARLEMENTAIRE
  // ===========================================================================

  describe('getParlementaireVotes', () => {
    const PARL = 'ac08f258-d040-4a0b-93c0-ebbe55dc9aec';
    const GROUPE = '4a306451-bd1f-4879-b9d1-56cc19bdd862';
    const baseQuery = { page: 1, limit: 20, dissidentOnly: false };

    /** Une ligne telle que la renvoie le SQL brut. */
    const voteRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'vote-1',
      position: 'contre',
      groupe_position: 'pour',
      scrutin_id: 'scrutin-1',
      scrutin_numero: 1234,
      scrutin_chambre: 'assemblee',
      scrutin_session: null,
      scrutin_date: new Date('2024-03-14'),
      scrutin_titre: 'Titre du scrutin',
      scrutin_sort: 'adopte',
      scrutin_type_vote: 'ordinaire',
      scrutin_tags: ['sante'],
      scrutin_importance: 3,
      scrutin_nombre_pour: 100,
      scrutin_nombre_contre: 50,
      scrutin_nombre_abstention: 10,
      ...overrides,
    });

    /**
     * Les deux requêtes lancées en Promise.all : page puis comptage.
     * Le discriminant vise `COUNT(*)::int as total` et non `COUNT(*)` : la CTE
     * de majorité compte elle aussi, et confondrait les deux requêtes.
     */
    const mockQueries = (rows: unknown[], total: number) => {
      const sql: string[] = [];
      mockPrisma.$queryRawUnsafe.mockImplementation((q: string) => {
        sql.push(q);
        return Promise.resolve(q.includes('COUNT(*)::int as total') ? [{ total }] : rows);
      });
      return sql;
    };

    it('retourne les votes paginés avec la position du groupe', async () => {
      mockQueries([voteRow()], 42);

      const result = await service.getParlementaireVotes(PARL, GROUPE, baseQuery);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'vote-1',
        position: 'contre',
        groupePosition: 'pour',
      });
      expect(result.data[0].scrutin).toMatchObject({ id: 'scrutin-1', numero: 1234 });
      expect(result.meta).toMatchObject({ total: 42, page: 1, totalPages: 3, hasNext: true });
    });

    it('transmet une majorité absente telle quelle (groupe ex æquo)', async () => {
      mockQueries([voteRow({ groupe_position: null })], 1);

      const result = await service.getParlementaireVotes(PARL, GROUPE, baseQuery);

      // null ⇒ le front n'affiche pas de badge « dissident ».
      expect(result.data[0].groupePosition).toBeNull();
    });

    it('retourne vide sans requête SQL si dissidentOnly et pas de groupe', async () => {
      const result = await service.getParlementaireVotes(PARL, null, {
        ...baseQuery,
        dissidentOnly: true,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Les deux régimes de requête
    // -------------------------------------------------------------------------

    it('sélectionne la page AVANT de calculer la majorité en affichage simple', async () => {
      const sql = mockQueries([voteRow()], 1);

      await service.getParlementaireVotes(PARL, GROUPE, baseQuery);

      const [votes, count] = sql;
      expect(votes).toContain('WITH page AS');
      expect(votes).toContain('AND gv.scrutin_id IN (SELECT scrutin_id FROM page)');
      // Le comptage n'a aucune condition sur la majorité : la CTE y serait un
      // agrégat calculé pour rien.
      expect(count).not.toContain('group_majority');
    });

    it('garde la CTE complète des deux côtés quand dissidentOnly filtre dessus', async () => {
      const sql = mockQueries([voteRow()], 1);

      await service.getParlementaireVotes(PARL, GROUPE, {
        ...baseQuery,
        dissidentOnly: true,
      });

      const [votes, count] = sql;
      // Un filtre s'applique avant la pagination : borner la CTE à la page
      // écarterait des votes dissidents des pages suivantes.
      expect(votes).not.toContain('IN (SELECT scrutin_id FROM page)');
      expect(votes).toContain('group_majority');
      expect(count).toContain('group_majority');
      expect(count).toContain('gm.majority_position IS NOT NULL');
    });

    it('applique les filtres position, tag et dates en paramètres liés', async () => {
      const sql = mockQueries([voteRow()], 1);

      await service.getParlementaireVotes(PARL, GROUPE, {
        ...baseQuery,
        position: 'contre',
        tag: 'sante',
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
      });

      expect(sql[0]).toContain('v.position = $2');
      expect(sql[0]).toContain('$3 = ANY(s.tags)');
      expect(sql[0]).toContain('s.date >= $4');
      expect(sql[0]).toContain('s.date <= $5');
      const params = mockPrisma.$queryRawUnsafe.mock.calls[0].slice(1);
      expect(params[0]).toBe(PARL);
      expect(params[1]).toBe('contre');
      expect(params[2]).toBe('sante');
    });

    // -------------------------------------------------------------------------
    // Cache
    // -------------------------------------------------------------------------

    it('sert le cache sans toucher à la base', async () => {
      mockQueries([voteRow()], 1);
      await service.getParlementaireVotes(PARL, GROUPE, baseQuery);
      mockPrisma.$queryRawUnsafe.mockClear();

      const result = await service.getParlementaireVotes(PARL, GROUPE, baseQuery);

      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('sépare les entrées de cache par page et par filtre', async () => {
      mockQueries([voteRow()], 1);

      await service.getParlementaireVotes(PARL, GROUPE, baseQuery);
      await service.getParlementaireVotes(PARL, GROUPE, { ...baseQuery, page: 2 });
      await service.getParlementaireVotes(PARL, GROUPE, { ...baseQuery, position: 'pour' });
      await service.getParlementaireVotes(PARL, GROUPE, { ...baseQuery, dissidentOnly: true });

      const cles = [...mockRedis._store.keys()].filter((k) => k.startsWith('parlementaire:votes:'));
      expect(cles).toHaveLength(4);
    });

    it('distingue deux groupes courants : ils servent de repli au mandat d’époque', async () => {
      mockQueries([voteRow()], 1);

      await service.getParlementaireVotes(PARL, GROUPE, baseQuery);
      await service.getParlementaireVotes(PARL, '99999999-8888-7777-6666-555555555555', baseQuery);

      const cles = [...mockRedis._store.keys()].filter((k) => k.startsWith('parlementaire:votes:'));
      expect(cles).toHaveLength(2);
    });

    it('purge le cache des votes à l’invalidation du parlementaire', async () => {
      mockQueries([voteRow()], 1);
      await service.getParlementaireVotes(PARL, GROUPE, baseQuery);
      await service.getParlementaireVotes(PARL, GROUPE, { ...baseQuery, page: 2 });
      mockPrisma.parlementaire.findUnique.mockResolvedValue({ slug: 'un-depute' });

      await service.invalidateCache(PARL);

      const restants = [...mockRedis._store.keys()].filter((k) =>
        k.startsWith(`parlementaire:votes:${PARL}:`),
      );
      expect(restants).toEqual([]);
    });

    it('ne purge pas les votes d’un autre parlementaire (cas témoin)', async () => {
      mockQueries([voteRow()], 1);
      const AUTRE = '11111111-2222-3333-4444-555555555555';
      await service.getParlementaireVotes(PARL, GROUPE, baseQuery);
      await service.getParlementaireVotes(AUTRE, GROUPE, baseQuery);
      mockPrisma.parlementaire.findUnique.mockResolvedValue({ slug: 'un-depute' });

      await service.invalidateCache(PARL);

      const restants = [...mockRedis._store.keys()].filter((k) =>
        k.startsWith('parlementaire:votes:'),
      );
      expect(restants).toHaveLength(1);
      expect(restants[0]).toContain(AUTRE);
    });
  });

  // ===========================================================================
  // AMENDEMENTS D'UN PARLEMENTAIRE
  // ===========================================================================

  describe('getParlementaireAmendements', () => {
    const PARL = 'ac08f258-d040-4a0b-93c0-ebbe55dc9aec';
    const baseQuery = { page: 1, limit: 20 };

    /** Page d'ids (SQL brut) + total (SQL brut) ; le détail vient de Prisma. */
    const mockQueries = (ids: string[], total: number) => {
      const sql: string[] = [];
      mockPrisma.$queryRawUnsafe.mockImplementation((q: string) => {
        sql.push(q);
        return Promise.resolve(
          q.includes('COUNT(*)::int as total') ? [{ total }] : ids.map((id) => ({ id })),
        );
      });
      // Prisma renvoie volontairement dans le désordre : `IN` ne trie pas.
      mockPrisma.amendement.findMany.mockImplementation(({ where }: never) =>
        Promise.resolve(
          [...((where as { id: { in: string[] } }).id.in)]
            .reverse()
            .map((id) => ({ id, numero: `n-${id}` })),
        ),
      );
      return sql;
    };

    it('remet la page dans l’ordre décidé par le SQL, pas celui de Prisma', async () => {
      mockQueries(['a', 'b', 'c'], 3);

      const result = await service.getParlementaireAmendements(PARL, baseQuery);

      expect(result.data.map((a: { id: string }) => a.id)).toEqual(['a', 'b', 'c']);
    });

    it('remplace le OR par une UNION de deux branches indexables', async () => {
      const sql = mockQueries(['a'], 1);

      await service.getParlementaireAmendements(PARL, baseQuery);

      const [pageSql] = sql;
      expect(pageSql).toContain('UNION');
      expect(pageSql).toContain('SELECT id FROM amendements WHERE parlementaire_id = $1');
      expect(pageSql).toContain('SELECT "A" AS id FROM "_AmendementCosignataires" WHERE "B" = $1');
      expect(pageSql).not.toMatch(/parlementaire_id = \$1\s+OR/);
    });

    it('départage le tri par id, sans quoi la pagination saute des lignes', async () => {
      const sql = mockQueries(['a'], 1);

      await service.getParlementaireAmendements(PARL, baseQuery);

      expect(sql[0]).toContain('a.numero_ordre DESC NULLS LAST, a.id ASC');
    });

    it('compte à part, pour garder le total sur une page hors bornes', async () => {
      // `COUNT(*) OVER ()` ne renvoie aucune ligne quand la page est vide :
      // le total serait tombé à 0 alors que le jeu en compte 17 902.
      mockQueries([], 17902);

      const result = await service.getParlementaireAmendements(PARL, { page: 9999, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(17902);
      expect(mockPrisma.amendement.findMany).not.toHaveBeenCalled();
    });

    it('lie les filtres en paramètres et non par interpolation', async () => {
      const sql = mockQueries(['a'], 1);

      await service.getParlementaireAmendements(PARL, {
        ...baseQuery,
        sort: 'Rejeté',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        votedOnly: true,
      });

      expect(sql[0]).toContain('a.sort = $2');
      expect(sql[0]).toContain('a.date_depot >= $3');
      expect(sql[0]).toContain('a.date_depot <= $4');
      expect(sql[0]).toContain('EXISTS (SELECT 1 FROM "_AmendementToScrutin"');
      const params = mockPrisma.$queryRawUnsafe.mock.calls[0].slice(1);
      expect(params[0]).toBe(PARL);
      expect(params[1]).toBe('Rejeté');
      expect(params[2]).toBeInstanceOf(Date);
    });

    it('n’ajoute aucune clause WHERE quand aucun filtre n’est passé', async () => {
      const sql = mockQueries(['a'], 1);

      await service.getParlementaireAmendements(PARL, baseQuery);

      expect(sql[0]).not.toContain('WHERE a.');
    });

    it('sert le cache sans retoucher à la base', async () => {
      mockQueries(['a'], 1);
      await service.getParlementaireAmendements(PARL, baseQuery);
      mockPrisma.$queryRawUnsafe.mockClear();
      mockPrisma.amendement.findMany.mockClear();

      const result = await service.getParlementaireAmendements(PARL, baseQuery);

      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(mockPrisma.amendement.findMany).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('calcule la pagination à partir du total', async () => {
      mockQueries(['a'], 45);

      const result = await service.getParlementaireAmendements(PARL, { page: 2, limit: 20 });

      expect(result.meta).toMatchObject({
        total: 45,
        page: 2,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });
});
