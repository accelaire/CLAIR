// =============================================================================
// Module Feedback - Controller (Routes)
// API pour les retours utilisateurs (feedback)
// =============================================================================

import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { feedbackBodySchema, FeedbackBody } from './feedback.schema';

// =============================================================================
// Helper : notification Discord fire-and-forget
// =============================================================================
async function notifyDiscord(
  fastify: FastifyInstance,
  data: FeedbackBody,
): Promise<void> {
  const webhookUrl = process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  // Couleur de l'embed selon le sentiment
  const color =
    data.sentiment === 'positif' ? 0x22c55e : // vert
    data.sentiment === 'negatif' ? 0xef4444 : // rouge
    data.sentiment === 'neutre' ? 0xf59e0b : // ambre
    0x3b82f6; // bleu (aucun sentiment)

  const sentimentLabel =
    data.sentiment === 'positif' ? '😊 Positif' :
    data.sentiment === 'negatif' ? '😞 Négatif' :
    data.sentiment === 'neutre' ? '😐 Neutre' :
    '—';

  const typeLabel =
    data.type === 'bug' ? '🐛 Bug' :
    data.type === 'idee' ? '💡 Idée' :
    '📝 Autre';

  // Lien cliquable vers la page concernée
  const baseUrl = process.env.PUBLIC_APP_URL || 'https://clair.vote';
  const pageUrl = data.page
    ? `${baseUrl}${data.page.startsWith('/') ? '' : '/'}${data.page}`
    : null;

  // Champs de l'embed (email et page seulement s'ils sont renseignés)
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Type', value: typeLabel, inline: true },
    { name: 'Sentiment', value: sentimentLabel, inline: true },
    {
      name: 'Déclencheur',
      value: data.trigger === 'nudge' ? '✨ Sollicitation' : '🔘 Bouton',
      inline: true,
    },
  ];
  if (data.email) {
    fields.push({ name: '📧 Contact', value: data.email, inline: false });
  }
  if (pageUrl) {
    fields.push({ name: '📍 Page', value: `[${data.page}](${pageUrl})`, inline: false });
  }

  const embed = {
    title: '🗳️ Nouveau feedback CLAIR',
    description: data.message ? data.message.slice(0, 1500) : '_Aucun message laissé_',
    color,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'CLAIR · clair.vote' },
  };

  try {
    // globalThis.fetch disponible à partir de Node 18
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '📨 **Nouveau retour utilisateur**',
        embeds: [embed],
      }),
    });
  } catch (err) {
    fastify.log.warn({ err }, 'Échec notification Discord feedback');
  }
}

// =============================================================================
// Routes
// =============================================================================
export const feedbackRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // POST / - Envoyer un retour utilisateur
  // ===========================================================================
  fastify.post('/', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '10 minutes',
      },
    },
    schema: {
      tags: ['Feedback'],
      summary: 'Envoyer un retour utilisateur',
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      // -----------------------------------------------------------------------
      // 0. Honeypot : détection des bots sur le champ caché "website"
      //    (avant la validation Zod pour éviter les erreurs 400)
      // -----------------------------------------------------------------------
      const rawBody = request.body as Record<string, unknown> | undefined;
      if (rawBody?.website) {
        // Simulation silencieuse d'un succès
        return reply.status(201).send({ success: true });
      }

      // -----------------------------------------------------------------------
      // 1. Validation du corps de la requête
      // -----------------------------------------------------------------------
      const parsed = feedbackBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Données invalides',
        });
      }

      const data = parsed.data;

      // -----------------------------------------------------------------------
      // 2. Enregistrement dans la base de données
      // -----------------------------------------------------------------------
      const userAgent = (request.headers['user-agent'] ?? '')
        .slice(0, 500) || null;

      await fastify.prisma.feedback.create({
        data: {
          sentiment: data.sentiment ?? null,
          type: data.type,
          message: data.message ?? null,
          email: data.email ?? null,
          page: data.page ?? null,
          trigger: data.trigger,
          userAgent,
        },
      });

      // -----------------------------------------------------------------------
      // 3. Journalisation
      // -----------------------------------------------------------------------
      fastify.log.info(
        {
          type: 'feedback_received',
          feedbackType: data.type,
          sentiment: data.sentiment,
        },
        'Feedback reçu',
      );

      // -----------------------------------------------------------------------
      // 4. Notification Discord (fire-and-forget, non bloquante)
      // -----------------------------------------------------------------------
      void notifyDiscord(fastify, data);

      // -----------------------------------------------------------------------
      // 5. Réponse
      // -----------------------------------------------------------------------
      return reply.status(201).send({ success: true });
    },
  });
};