import { z } from 'zod';
import { booleenDeRequete } from '../../utils/requete';

export const chambrePetitionEnum = z.enum(['assemblee', 'senat']);

/** Types d'étape du parcours, plus `aucune` pour une pétition sans étape. */
export const ETAPES_PETITION = [
  'rapporteur',
  'decision',
  'examen',
  'rapport',
  'classement',
  'seuil_atteint',
  'decision_conference',
] as const;

export const petitionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  chambre: chambrePetitionEnum.optional(),
  /** Slug de la commission (AN) */
  commission: z.string().min(1).max(200).optional(),
  collecte: z.enum(['ouverte', 'close']).optional(),
  etape: z.enum([...ETAPES_PETITION, 'aucune']).optional(),
  /** Seules les pétitions suivies : au moins 10 000 signatures ou une étape institutionnelle */
  suivies: booleenDeRequete.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['signatures', 'date', 'etape']).default('signatures'),
});

export const petitionParamsSchema = z.object({
  chambre: chambrePetitionEnum,
  numero: z.coerce.number().int().positive(),
});

export type PetitionsQuery = z.infer<typeof petitionsQuerySchema>;
export type PetitionParams = z.infer<typeof petitionParamsSchema>;
