// =============================================================================
// Module Sujets - Schemas (Validation Zod)
// =============================================================================

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const categoryEnum = z.enum([
  'budget',
  'sante',
  'securite',
  'immigration',
  'environnement',
  'travail',
  'education',
  'justice',
  'institutions',
  'europe',
  'international',
  'agriculture',
  'logement',
  'transports',
  'culture',
  'autre',
]);

export type Category = z.infer<typeof categoryEnum>;

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

export const sujetsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: categoryEnum.optional(),
  search: z.string().optional(),
  featured: z.coerce.boolean().optional(),
  actif: z.coerce.boolean().optional().default(true),
});

export type SujetsListQuery = z.infer<typeof sujetsListQuerySchema>;

export const sujetParamsSchema = z.object({
  slug: z.string().min(1),
});

export type SujetParams = z.infer<typeof sujetParamsSchema>;

export const sujetScrutinsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  chambre: z.enum(['assemblee', 'senat']).optional(),
});

export type SujetScrutinsQuery = z.infer<typeof sujetScrutinsQuerySchema>;

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

export const createSujetSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: categoryEnum.optional(),
  featured: z.boolean().optional().default(false),
  featuredOrder: z.number().int().optional().default(0),
  usefulLinks: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
  })).optional().default([]),
  newsUrl: z.string().url().optional(),
});

export type CreateSujetInput = z.infer<typeof createSujetSchema>;

export const updateSujetSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: categoryEnum.optional(),
  featured: z.boolean().optional(),
  featuredOrder: z.number().int().optional(),
  usefulLinks: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
  })).optional(),
  newsUrl: z.string().url().nullable().optional(),
  actif: z.boolean().optional(),
});

export type UpdateSujetInput = z.infer<typeof updateSujetSchema>;

export const linkScrutinSchema = z.object({
  scrutinId: z.string().uuid(),
  similarity: z.number().min(0).max(1).optional(),
});

export type LinkScrutinInput = z.infer<typeof linkScrutinSchema>;

export const mergeSujetsSchema = z.object({
  targetSlug: z.string().min(1),
});

export type MergeSujetsInput = z.infer<typeof mergeSujetsSchema>;
