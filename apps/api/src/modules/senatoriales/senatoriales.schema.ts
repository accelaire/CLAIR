import { z } from 'zod';

/**
 * Tris acceptés pour la liste des sortants.
 *
 * Deux familles s'y côtoient. Les tris de regroupement — département, groupe,
 * commission, profession — rassemblent les sortants en sections ; les tris de
 * classement — présence, loyauté, amendements, interventions, âge — les
 * ordonnent sur une valeur. Chacun a son graphique côté web, qui illustre
 * précisément la lecture demandée.
 */
export const TRIS_SORTANTS = [
  'departement',
  'groupe',
  'commission',
  'profession',
  'nom',
  'age',
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
