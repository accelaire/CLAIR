// =============================================================================
// Module Sujets - Schemas (Validation Zod)
// =============================================================================

import { z } from 'zod';

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

export const sujetsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
  featured: z.coerce.boolean().optional(),
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

export const sujetDossiersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SujetDossiersQuery = z.infer<typeof sujetDossiersQuerySchema>;
