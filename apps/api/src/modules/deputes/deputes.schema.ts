// =============================================================================
// Module Députés - Schemas de validation
// =============================================================================

import { z } from 'zod';

// =============================================================================
// PARAMS & QUERY SCHEMAS
// =============================================================================

export const deputeParamsSchema = z.object({
  slug: z.string().min(1).describe('Slug unique du député'),
});

export const deputeIdParamsSchema = z.object({
  id: z.string().uuid().describe('UUID du député'),
});

export const deputeQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => val?.split(',').filter(Boolean) || [])
    .pipe(z.array(z.enum(['votes', 'interventions', 'amendements', 'stats'])))
    .describe('Relations à inclure'),
});

export const deputesListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).describe('Numéro de page'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Nombre de résultats par page'),
  groupe: z.string().optional().describe('Filtrer par slug de groupe politique'),
  departement: z.string().optional().describe('Filtrer par numéro de département'),
  search: z.string().optional().describe('Recherche par nom/prénom'),
  actif: z.coerce.boolean().optional().default(true).describe('Filtrer les députés actifs'),
  sort: z
    .enum(['nom', 'prenom', 'presence', 'loyaute', 'activite'])
    .default('nom')
    .describe('Champ de tri'),
  order: z.enum(['asc', 'desc']).default('asc').describe('Ordre de tri'),
});

export const deputeVotesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  position: z.enum(['pour', 'contre', 'abstention', 'absent']).optional(),
  tag: z.string().optional().describe('Filtrer par tag de scrutin'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const groupePolitiqueSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nom: z.string(),
  nomComplet: z.string().nullable(),
  couleur: z.string().nullable(),
  position: z.string().nullable(),
});

export const circonscriptionSchema = z.object({
  id: z.string().uuid(),
  departement: z.string(),
  numero: z.number(),
  nom: z.string(),
});

export const deputeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nom: z.string(),
  prenom: z.string(),
  sexe: z.string().nullable(),
  dateNaissance: z.date().nullable(),
  profession: z.string().nullable(),
  photoUrl: z.string().nullable(),
  twitter: z.string().nullable(),
  email: z.string().nullable(),
  siteWeb: z.string().nullable(),
  actif: z.boolean(),
  groupe: groupePolitiqueSchema.nullable(),
  circonscription: circonscriptionSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const deputeStatsSchema = z.object({
  presence: z.number().min(0).max(100).describe('Taux de présence en %'),
  loyaute: z.number().min(0).max(100).describe('Taux de loyauté au groupe en %'),
  participation: z.number().describe('Nombre de votes'),
  interventions: z.number().describe('Nombre d\'interventions'),
  amendements: z.object({
    proposes: z.number(),
    adoptes: z.number(),
  }),
  questions: z.number().describe('Nombre de questions posées'),
});

export const deputeDetailSchema = deputeSchema.extend({
  stats: deputeStatsSchema.optional(),
  votes: z.array(z.object({
    id: z.string().uuid(),
    position: z.string(),
    scrutin: z.object({
      id: z.string().uuid(),
      numero: z.number(),
      date: z.date(),
      titre: z.string(),
      sort: z.string(),
    }),
  })).optional(),
  interventions: z.array(z.object({
    id: z.string().uuid(),
    date: z.date(),
    type: z.string(),
    contenu: z.string(),
  })).optional(),
});

export const paginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const deputesListResponseSchema = z.object({
  data: z.array(deputeSchema),
  meta: paginationMetaSchema,
});

// =============================================================================
// TYPES
// =============================================================================

export type DeputeParams = z.infer<typeof deputeParamsSchema>;
export type DeputeIdParams = z.infer<typeof deputeIdParamsSchema>;
export type DeputeQuery = z.infer<typeof deputeQuerySchema>;
export type DeputesListQuery = z.infer<typeof deputesListQuerySchema>;
export type DeputeVotesQuery = z.infer<typeof deputeVotesQuerySchema>;

export type GroupePolitique = z.infer<typeof groupePolitiqueSchema>;
export type Circonscription = z.infer<typeof circonscriptionSchema>;
export type Depute = z.infer<typeof deputeSchema>;
export type DeputeStats = z.infer<typeof deputeStatsSchema>;
export type DeputeDetail = z.infer<typeof deputeDetailSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type DeputesListResponse = z.infer<typeof deputesListResponseSchema>;
