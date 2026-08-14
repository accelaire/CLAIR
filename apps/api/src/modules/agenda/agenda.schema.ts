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
export type ProchainesEcheancesQuery = z.infer<typeof prochainesEcheancesQuerySchema>;
