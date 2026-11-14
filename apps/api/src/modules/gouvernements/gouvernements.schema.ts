import { z } from 'zod';

export const gouvernementDetailSchema = z.object({
  slug: z.string(),
});

export type GouvernementDetail = z.infer<typeof gouvernementDetailSchema>;
