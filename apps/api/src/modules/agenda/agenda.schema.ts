import { z } from 'zod';

export const agendaQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(s + 'T00:00:00.000Z')),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(s + 'T23:59:59.999Z')).optional(),
  // 'evenement' = uniquement les repères institutionnels (aucune réunion)
  type: z.enum(['commission', 'seance', 'evenement', 'tous']).default('tous'),
  commissionId: z.string().uuid().optional(),
  chambre: z.enum(['assemblee', 'senat']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(50),
});

export const reunionDetailSchema = z.object({
  uid: z.string(),
});

/**
 * Le débat d'une réunion, page par page.
 *
 * Une séance publique porte 355 prises de parole en moyenne et jusqu'à 1 614,
 * soit plus d'un mégaoctet de texte : elle ne peut pas être servie d'un bloc.
 * La pagination vaut aussi pour les commissions, dont les comptes rendus sont
 * plus courts — un seul chemin plutôt que deux qui divergeront.
 */
export const debatDeReunionSchema = z.object({
  uid: z.string(),
});

export const debatDeReunionQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
});

/** Prochaines échéances institutionnelles (bloc d'accueil, page sénatoriales…). */
export const prochainesEcheancesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(5),
  // true = uniquement les échéances marquées comme majeures
  importantOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

export type AgendaQuery = z.infer<typeof agendaQuerySchema>;
export type ReunionDetail = z.infer<typeof reunionDetailSchema>;
export type DebatDeReunionQuery = z.infer<typeof debatDeReunionQuerySchema>;
export type ProchainesEcheancesQuery = z.infer<typeof prochainesEcheancesQuerySchema>;
