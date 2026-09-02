import { describe, it, expect, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SujetsService } from './sujets.service';

/**
 * Factory de mock Prisma conforme au pattern du repository.
 * SujetsService ne dépend que de Prisma (pas de Redis).
 */
function createMockPrisma(overrides: Record<string, unknown> = {}) {
  const findUnique = vi.fn();
  const queryRaw = vi.fn();
  const prisma = {
    sujet: { findUnique },
    $queryRaw: queryRaw,
    ...overrides,
  };
  // Le service attend un PrismaClient complet ; le mock n'en couvre que la
  // surface utilisée. Les deux poignées évitent de recaster à chaque appel.
  return { prisma: prisma as unknown as PrismaClient, findUnique, queryRaw };
}

describe('SujetsService', () => {
  describe('resolveArchivedSlug', () => {
    it('renvoie null pour un slug inexistant', async () => {
      const { prisma, findUnique } = createMockPrisma();
      findUnique.mockResolvedValue(null);

      const service = new SujetsService(prisma);
      const result = await service.resolveArchivedSlug('inexistant');

      expect(result).toBeNull();
    });

    it('renvoie null pour un sujet actif (pas de redirection d\'un contenu vivant)', async () => {
      const { prisma, findUnique } = createMockPrisma();
      findUnique.mockResolvedValue({ id: 'sujet-123', actif: true });

      const service = new SujetsService(prisma);
      const result = await service.resolveArchivedSlug('sujet-actif');

      expect(result).toBeNull();
    });

    it('renvoie l\'uid du dossier pour un sujet inactif mono-dossier', async () => {
      const { prisma, findUnique, queryRaw } = createMockPrisma();
      findUnique.mockResolvedValue({ id: 'sujet-456', actif: false });
      queryRaw.mockResolvedValue([{ uid: 'DLR5L17N50162' }]);

      const service = new SujetsService(prisma);
      const result = await service.resolveArchivedSlug('sujet-archive');

      expect(result).toEqual({ dossierUid: 'DLR5L17N50162' });
    });

    it('renvoie un uid (non null) pour un sujet inactif multi-dossiers', async () => {
      // Cas des 26 URLs en 404 dur du 2026-07-29 : sujets inter-chambres (AN + Sénat)
      // dont le slug technique (type 'dlr5l17n50162') désactivé pointait vers deux dossiers.
      // L'ancien code renvoyait null dès qu'il détectait plusieurs dossiers, produisant
      // un 404 dur permanent que Google indexait comme soft 404.
      const { prisma, findUnique, queryRaw } = createMockPrisma();
      findUnique.mockResolvedValue({ id: 'sujet-multi', actif: false });
      // LIMIT 1 garantit qu'on ne reçoit qu'une ligne même si plusieurs dossiers existent
      queryRaw.mockResolvedValue([{ uid: 'DLR5L17N50162' }]);

      const service = new SujetsService(prisma);
      const result = await service.resolveArchivedSlug('dlr5l17n50162');

      // Ce test casse si on réintroduit une condition `if (cibles.length !== 1) return null`
      expect(result).not.toBeNull();
      expect(result?.dossierUid).toBe('DLR5L17N50162');
    });

    it('renvoie dossierUid null pour un sujet inactif sans dossier (404 légitime)', async () => {
      const { prisma, findUnique, queryRaw } = createMockPrisma();
      findUnique.mockResolvedValue({ id: 'sujet-vide', actif: false });
      queryRaw.mockResolvedValue([]);

      const service = new SujetsService(prisma);
      const result = await service.resolveArchivedSlug('sujet-sans-dossier');

      expect(result).toEqual({ dossierUid: null });
    });

    it('utilise un ORDER BY total se terminant par d.uid ASC', async () => {
      // Un ORDER BY non total fait dépendre la cible d'une redirection permanente (HTTP 301)
      // de l'ordre de lecture interne de Postgres. La cible pourrait changer entre deux
      // déploiements ou vacuum, rendant la redirection permanente instable et créant
      // des liens cassés pour Google.
      const { prisma, findUnique, queryRaw } = createMockPrisma();
      findUnique.mockResolvedValue({ id: 'sujet-ordre', actif: false });

      let capturedSql = '';
      queryRaw.mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
        // Reconstitution du SQL avec placeholders pour les valeurs interpolées
        capturedSql = strings.reduce((acc, str, i) => {
          const placeholder = values[i] !== undefined ? `$${i + 1}` : '';
          return acc + str + placeholder;
        }, '');
        return Promise.resolve([{ uid: 'test-uid' }]);
      });

      const service = new SujetsService(prisma);
      await service.resolveArchivedSlug('test-slug');

      expect(capturedSql).toContain('ORDER BY');

      // Extraction de la clause ORDER BY (jusqu'à LIMIT)
      const orderByMatch = capturedSql.match(/ORDER\s+BY\s+(.+?)\s+LIMIT\s+1/is);
      expect(orderByMatch).toBeTruthy();
      const orderByClause = orderByMatch![1] ?? '';

      // Vérification que le dernier critère de tri est bien d.uid ASC
      const sortKeys = orderByClause.split(',').map(s => s.trim());
      const lastKey = sortKeys[sortKeys.length - 1];
      expect(lastKey).toMatch(/d\.uid\s+ASC/i);
    });
    /**
     * Les tests de comportement ci-dessus passent par un `$queryRaw` simulé :
     * ils décrivent la réponse du mock, pas la règle appliquée par Postgres.
     * La garantie qui a réparé les 26 URLs vit donc dans deux propriétés du
     * code lui-même, vérifiées ici sur la source.
     */
    it('ne conditionne jamais la cible au nombre de dossiers', async () => {
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      // `import.meta` n'est pas disponible dans la sortie CommonJS du paquet.
      // Vitest s'exécute depuis la racine de `apps/api`.
      const source = readFileSync(
        join(process.cwd(), 'src/modules/sujets/sujets.service.ts'),
        'utf-8',
      );
      const corps = source.slice(source.indexOf('async resolveArchivedSlug'));
      const methode = corps.slice(0, corps.indexOf('\n  }\n'));

      // C'est exactement la forme qui renvoyait null dès le deuxième dossier,
      // et qui laissait 26 sujets inter-chambres en 404 dur.
      expect(methode).not.toMatch(/length\s*===\s*1/);
      expect(methode).not.toMatch(/take:\s*2/);

      // Le LIMIT 1 rend une cible toujours disponible dès qu'il existe au
      // moins un dossier : c'est la contrepartie du point ci-dessus.
      expect(methode).toMatch(/LIMIT 1/);
    });
  });
});