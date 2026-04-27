import { z } from 'zod';

export const agendaQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(s)),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => new Date(s)).optional(),
  type: z.enum(['commission', 'seance', 'tous']).default('tous'),
  commissionId: z.string().uuid().optional(),
  chambre: z.enum(['assemblee', 'senat']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(50),
});

export const reunionDetailSchema = z.object({
  uid: z.string(),
});

export type AgendaQuery = z.infer<typeof agendaQuerySchema>;
export type ReunionDetail = z.infer<typeof reunionDetailSchema>;
