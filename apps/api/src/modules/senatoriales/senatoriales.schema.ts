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
  // « Qui remet son siège en jeu ? » — la question centrale du scrutin. Une
  // énumération plutôt qu'un booléen : les trois états (tous, candidats,
  // partants) sont bien trois valeurs, et aucune n'est l'absence de l'autre.
  candidat: z.enum(['oui', 'non']).optional(),
});

export type SortantsQuery = z.infer<typeof sortantsQuerySchema>;

/**
 * Familles politiques dérivées des nuances préfectorales.
 *
 * Découpage large, repris de celui que le ministère de l'Intérieur utilise
 * pour agréger ses propres résultats. À ne pas confondre avec la `position`
 * des groupes parlementaires : elles n'ont ni la même granularité, ni le même
 * objet. `sans-famille` est une valeur sentinelle, pour les nuances dont le
 * rattachement à un bloc relèverait d'un arbitrage éditorial.
 */
export const FAMILLES_CANDIDATS = [
  'gauche',
  'centre',
  'droite',
  'extreme_droite',
  'regionaliste',
  'divers',
  'sans-famille',
] as const;

export const candidatsQuerySchema = z.object({
  departement: z.string().min(1).max(120).optional(),
  famille: z.enum(FAMILLES_CANDIDATS).optional(),
  // Retient les unités de vote portant au moins un sortant. Au proportionnel,
  // la question posée est bien « cette liste porte-t-elle un sortant ? ».
  //
  // Surtout pas `z.coerce.boolean()` : sur une chaîne de requête il rend `true`
  // pour toute valeur non vide, donc `?sortants=false` filtrerait la liste. On
  // énumère les valeurs acceptées, et tout le reste est refusé.
  sortants: z
    .enum(['true', '1', 'false', '0'])
    .optional()
    .transform((valeur) => valeur === 'true' || valeur === '1'),
});

export type CandidatsQuery = z.infer<typeof candidatsQuerySchema>;
