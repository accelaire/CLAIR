import { z } from 'zod';

export const chambreEnum = z.enum(['assemblee', 'senat']);
export const typeCommissionEnum = z.enum([
  'permanente',
  'enquete',
  'speciale',
  'mixte_paritaire',
  'office',
  'delegation',
  'mission_info',
  'groupe_etudes',
  'groupe_amitie',
  'assemblee_internationale',
  'hemicycle',
  'autre',
]);

export const commissionQuerySchema = z.object({
  chambre: chambreEnum.optional(),
  type: typeCommissionEnum.optional(),
  actif: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(20),
});

export const commissionDetailSchema = z.object({
  slug: z.string(),
});

export const commissionReunionsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  passees: z.enum(['true', 'false']).optional(),
});

export type CommissionQuery = z.infer<typeof commissionQuerySchema>;
export type CommissionDetail = z.infer<typeof commissionDetailSchema>;
export type CommissionReunionsQuery = z.infer<typeof commissionReunionsQuerySchema>;
