// =============================================================================
// Module Feedback - Schéma de validation
// Gère les retours utilisateurs (sentiment, bugs, idées)
// =============================================================================

import { z } from 'zod';

// =============================================================================
// BODY SCHEMA
// =============================================================================

export const feedbackBodySchema = z
  .object({
    sentiment: z
      .enum(['positif', 'neutre', 'negatif'])
      .optional()
      .describe('Sentiment général de l’utilisateur'),
    type: z
      .enum(['bug', 'idee', 'autre'])
      .describe('Type de feedback (bug, idée, autre)'),
    message: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .describe('Message détaillé (max 2000 caractères)'),
    email: z
      .string()
      .email()
      .max(200)
      .optional()
      .or(z.literal(''))
      .transform((val) => val === '' ? undefined : val)
      .describe('Email de contact (optionnel)'),
    page: z
      .string()
      .max(300)
      .optional()
      .describe('Page concernée (optionnel)'),
    trigger: z
      .enum(['passif', 'nudge'])
      .default('passif')
      .describe('Déclencheur du formulaire (passif ou nudge)'),
    website: z
      .string()
      .max(0)
      .optional()
      .describe('Champ anti-spam (doit rester vide)'),
  })
  .refine(
    (data) => data.sentiment != null || (data.message != null && data.message.length > 0),
    { message: 'Un sentiment ou un message est requis' },
  );

// =============================================================================
// TYPES
// =============================================================================

export type FeedbackBody = z.infer<typeof feedbackBodySchema>;