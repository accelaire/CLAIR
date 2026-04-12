import { z } from 'zod';

export const dossiersListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  etat: z.enum(['en_cours', 'adopte', 'rejete', 'promulgue']).optional(),
  chambre: z.enum(['assemblee', 'senat']).optional(),
  procedureCode: z.string().optional(),
  procedureLibelle: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(['date', 'scrutins']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const amendementsQuerySchema = paginationQuerySchema.extend({
  voted: z.coerce.boolean().optional(),
  groupe: z.string().optional(), // slug du groupe politique pour filtrer par auteur
  sort: z.string().optional(), // valeur exacte du sort (ex: "adopté", "rejeté", "retiré")
});

export const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6),
});
