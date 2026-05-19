import { logger } from '../utils/logger.js';

const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_EMBED_URL = 'https://api.mistral.ai/v1/embeddings';
const DEFAULT_MODEL = 'mistral-small-latest';
const DEFAULT_EMBED_MODEL = 'mistral-embed';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 512;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

interface MistralClientOptions {
  apiKey?: string;
  model?: string;
  embedModel?: string;
  temperature?: number;
  maxTokens?: number;
}

interface MistralChatResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface MistralEmbedResponse {
  data: { embedding: number[] }[];
  usage?: { prompt_tokens: number; total_tokens: number };
}

export class CLAIRMistralClient {
  private apiKey: string;
  private model: string;
  private embedModel: string;
  private temperature: number;
  private maxTokens: number;

  // Token tracking for cost monitoring
  public totalTokensIn = 0;
  public totalTokensOut = 0;

  constructor(options: MistralClientOptions = {}) {
    const apiKey = options.apiKey || process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY is required — set it in environment or pass via options');
    }

    this.apiKey = apiKey;
    this.model = options.model || DEFAULT_MODEL;
    this.embedModel = options.embedModel || DEFAULT_EMBED_MODEL;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  /**
   * Send a completion request with retry + exponential backoff on 429.
   */
  async complete(system: string, user: string, options?: { maxTokens?: number }): Promise<string> {
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(MISTRAL_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: this.temperature,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });

        if (!response.ok) {
          const status = response.status;
          const body = await response.text().catch(() => '');
          const error = new Error(`Mistral API ${status}: ${body.slice(0, 200)}`);
          (error as any).status = status;
          throw error;
        }

        const data: MistralChatResponse = await response.json();

        // Track tokens
        if (data.usage) {
          this.totalTokensIn += data.usage.prompt_tokens;
          this.totalTokensOut += data.usage.completion_tokens;
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from Mistral');
        }

        return content.trim();
      } catch (error: any) {
        lastError = error;

        // Retry on rate limit (429) or server errors (5xx)
        const status = error.status;
        const isRetryable = status === 429 || (status >= 500 && status < 600);

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          logger.warn(
            { attempt: attempt + 1, delay, status, error: error.message },
            'Mistral API error, retrying...'
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    throw lastError || new Error('Mistral completion failed after retries');
  }

  /**
   * Generate embeddings for a list of texts using Mistral Embed API.
   * Returns an array of dense vectors, one per input text.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(MISTRAL_EMBED_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.embedModel,
            input: texts,
          }),
        });

        if (!response.ok) {
          const status = response.status;
          const body = await response.text().catch(() => '');
          const error = new Error(`Mistral Embed API ${status}: ${body.slice(0, 200)}`);
          (error as any).status = status;
          throw error;
        }

        const data: MistralEmbedResponse = await response.json();

        if (data.usage) {
          this.totalTokensIn += data.usage.prompt_tokens || 0;
        }

        const embeddings = data.data?.map(d => d.embedding);
        if (!embeddings || embeddings.length !== texts.length) {
          throw new Error(`Mistral Embed returned ${embeddings?.length ?? 0} embeddings for ${texts.length} inputs`);
        }

        return embeddings;
      } catch (error: any) {
        lastError = error;

        const status = error.status;
        const isRetryable = status === 429 || (status >= 500 && status < 600);

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          logger.warn(
            { attempt: attempt + 1, delay, status, error: error.message },
            'Mistral Embed API error, retrying...'
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    throw lastError || new Error('Mistral embedding failed after retries');
  }
}
