// =============================================================================
// Utilitaires - Gestion des erreurs
// =============================================================================

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

// =============================================================================
// CUSTOM ERROR CLASS
// =============================================================================

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(statusCode: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCode(statusCode);
    this.details = details;
    this.name = 'ApiError';

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  private getDefaultCode(statusCode: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return codes[statusCode] || 'ERROR';
  }
}

// =============================================================================
// ERROR RESPONSES
// =============================================================================

export function notFound(message = 'Ressource non trouvée'): ApiError {
  return new ApiError(404, message, 'NOT_FOUND');
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, message, 'BAD_REQUEST', details);
}

export function unauthorized(message = 'Non authentifié'): ApiError {
  return new ApiError(401, message, 'UNAUTHORIZED');
}

export function forbidden(message = 'Accès interdit'): ApiError {
  return new ApiError(403, message, 'FORBIDDEN');
}

export function conflict(message: string): ApiError {
  return new ApiError(409, message, 'CONFLICT');
}

export function tooManyRequests(message = 'Trop de requêtes'): ApiError {
  return new ApiError(429, message, 'TOO_MANY_REQUESTS');
}

export function internalError(message = 'Erreur interne du serveur'): ApiError {
  return new ApiError(500, message, 'INTERNAL_ERROR');
}

// =============================================================================
// ERROR HANDLER
// =============================================================================

export function errorHandler(
  error: FastifyError | ApiError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({ err: error }, 'Error occurred');

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: 'Les données fournies sont invalides',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Custom API errors
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      error: error.name,
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // Fastify errors (validation, etc.)
  if ('statusCode' in error && error.statusCode) {
    return reply.status(error.statusCode).send({
      error: error.name || 'Error',
      code: error.code || 'ERROR',
      message: error.message,
    });
  }

  // Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    
    if (prismaError.code === 'P2002') {
      return reply.status(409).send({
        error: 'Conflict',
        code: 'DUPLICATE_ENTRY',
        message: 'Une entrée avec ces données existe déjà',
      });
    }

    if (prismaError.code === 'P2025') {
      return reply.status(404).send({
        error: 'Not Found',
        code: 'NOT_FOUND',
        message: 'Ressource non trouvée',
      });
    }
  }

  // Unknown errors
  const isProduction = process.env.NODE_ENV === 'production';
  
  return reply.status(500).send({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'Une erreur est survenue' : error.message,
    ...(!isProduction && { stack: error.stack }),
  });
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
