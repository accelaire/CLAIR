import { z } from 'zod';

export const TRIS_SORTANTS = [
  'departement',
  'nom',
  'presence',
  'loyaute',
  'amendements',
  'interventions',
] as const;

export const sortantsQuerySchema = z.object({
  departement: z.string().min(1).max(120).optional(),
  // `sans-groupe` est une valeur sentinelle : elle cible les mandats sans groupe
  // rattaché, que le slug d'un groupe réel ne peut pas exprimer.
  groupe: z.string().min(1).max(120).optional(),
  tri: z.enum(TRIS_SORTANTS).default('departement'),
});

export type SortantsQuery = z.infer<typeof sortantsQuerySchema>;
