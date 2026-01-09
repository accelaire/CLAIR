// =============================================================================
// Tests unitaires - Gestion des erreurs
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  ApiError,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  tooManyRequests,
  internalError,
  errorHandler,
  isApiError,
} from './errors';
import { ZodError, ZodIssue } from 'zod';

describe('ApiError', () => {
  it('devrait créer une erreur avec les propriétés correctes', () => {
    const error = new ApiError(404, 'Ressource introuvable', 'CUSTOM_NOT_FOUND');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Ressource introuvable');
    expect(error.code).toBe('CUSTOM_NOT_FOUND');
    expect(error.name).toBe('ApiError');
  });

  it('devrait utiliser le code par défaut si non fourni', () => {
    const error = new ApiError(400, 'Requête invalide');
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('devrait inclure les détails si fournis', () => {
    const details = { field: 'email', reason: 'format invalide' };
    const error = new ApiError(400, 'Validation échouée', 'VALIDATION_ERROR', details);

    expect(error.details).toEqual(details);
  });

  it('devrait retourner le code par défaut pour chaque status', () => {
    const cases = [
      { status: 400, expectedCode: 'BAD_REQUEST' },
      { status: 401, expectedCode: 'UNAUTHORIZED' },
      { status: 403, expectedCode: 'FORBIDDEN' },
      { status: 404, expectedCode: 'NOT_FOUND' },
      { status: 409, expectedCode: 'CONFLICT' },
      { status: 422, expectedCode: 'UNPROCESSABLE_ENTITY' },
      { status: 429, expectedCode: 'TOO_MANY_REQUESTS' },
      { status: 500, expectedCode: 'INTERNAL_ERROR' },
      { status: 418, expectedCode: 'ERROR' }, // Cas non mappé
    ];

    cases.forEach(({ status, expectedCode }) => {
      const error = new ApiError(status, 'Test');
      expect(error.code).toBe(expectedCode);
    });
  });
});

describe('Fonctions helper pour les erreurs', () => {
  it('notFound() devrait créer une erreur 404', () => {
    const error = notFound();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Ressource non trouvée');
  });

  it('notFound() devrait accepter un message personnalisé', () => {
    const error = notFound('Député non trouvé');
    expect(error.message).toBe('Député non trouvé');
  });

  it('badRequest() devrait créer une erreur 400', () => {
    const error = badRequest('Paramètre manquant');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Paramètre manquant');
  });

  it('badRequest() devrait inclure les détails', () => {
    const details = { missing: ['page', 'limit'] };
    const error = badRequest('Paramètres manquants', details);
    expect(error.details).toEqual(details);
  });

  it('unauthorized() devrait créer une erreur 401', () => {
    const error = unauthorized();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('forbidden() devrait créer une erreur 403', () => {
    const error = forbidden();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('conflict() devrait créer une erreur 409', () => {
    const error = conflict('Entrée dupliquée');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('tooManyRequests() devrait créer une erreur 429', () => {
    const error = tooManyRequests();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('internalError() devrait créer une erreur 500', () => {
    const error = internalError();
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

describe('isApiError', () => {
  it('devrait retourner true pour une ApiError', () => {
    const error = new ApiError(400, 'Test');
    expect(isApiError(error)).toBe(true);
  });

  it('devrait retourner false pour une Error standard', () => {
    const error = new Error('Test');
    expect(isApiError(error)).toBe(false);
  });

  it('devrait retourner false pour null/undefined', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });

  it('devrait retourner false pour un objet quelconque', () => {
    expect(isApiError({ statusCode: 400, message: 'Test' })).toBe(false);
  });
});

describe('errorHandler', () => {
  const mockRequest = {
    log: { error: vi.fn() },
  } as any;

  const createMockReply = () => ({
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  });

  it('devrait gérer les erreurs Zod', () => {
    const reply = createMockReply();
    const zodIssues: ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['email'], message: 'Expected string' },
    ];
    const zodError = new ZodError(zodIssues);

    errorHandler(zodError, mockRequest, reply as any);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: 'Les données fournies sont invalides',
      details: [{ path: 'email', message: 'Expected string' }],
    });
  });

  it('devrait gérer les ApiError', () => {
    const reply = createMockReply();
    const error = new ApiError(404, 'Député non trouvé', 'DEPUTE_NOT_FOUND');

    errorHandler(error, mockRequest, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'ApiError',
      code: 'DEPUTE_NOT_FOUND',
      message: 'Député non trouvé',
    });
  });

  it('devrait inclure les détails dans ApiError si présents', () => {
    const reply = createMockReply();
    const error = new ApiError(400, 'Erreur', 'ERROR', { field: 'test' });

    errorHandler(error, mockRequest, reply as any);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { field: 'test' },
      })
    );
  });

  it('devrait gérer les erreurs Fastify avec statusCode', () => {
    const reply = createMockReply();
    const error = { statusCode: 422, name: 'FastifyError', code: 'FST_ERR', message: 'Fastify error' } as any;

    errorHandler(error, mockRequest, reply as any);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'FastifyError',
      code: 'FST_ERR',
      message: 'Fastify error',
    });
  });

  it('devrait gérer les erreurs Prisma P2002 (duplicate)', () => {
    const reply = createMockReply();
    const error = { name: 'PrismaClientKnownRequestError', code: 'P2002', message: 'Unique constraint' } as any;

    errorHandler(error, mockRequest, reply as any);

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Conflict',
      code: 'DUPLICATE_ENTRY',
      message: 'Une entrée avec ces données existe déjà',
    });
  });

  it('devrait gérer les erreurs Prisma P2025 (not found)', () => {
    const reply = createMockReply();
    const error = { name: 'PrismaClientKnownRequestError', code: 'P2025', message: 'Record not found' } as any;

    errorHandler(error, mockRequest, reply as any);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Not Found',
      code: 'NOT_FOUND',
      message: 'Ressource non trouvée',
    });
  });

  it('devrait gérer les erreurs inconnues en production', () => {
    const reply = createMockReply();
    vi.stubEnv('NODE_ENV', 'production');

    const error = new Error('Secret error message');
    errorHandler(error, mockRequest, reply as any);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue',
    });

    vi.unstubAllEnvs();
  });

  it('devrait inclure le message et stack en développement', () => {
    const reply = createMockReply();
    vi.stubEnv('NODE_ENV', 'test');

    const error = new Error('Debug message');
    errorHandler(error, mockRequest, reply as any);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Debug message',
        stack: expect.any(String),
      })
    );

    vi.unstubAllEnvs();
  });
});
