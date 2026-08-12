import { logger } from '../utils/logger.js';
import { errorMessage, httpStatus } from '../utils/errors.js';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-small-latest';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 512;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

interface MistralClientOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface MistralResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export class CLAIRMistralClient {
  private apiKey: string;
  private model: string;
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
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  /**
   * Send a completion request with retry + exponential backoff on 429.
   */
  async complete(system: string, user: string, options?: { maxTokens?: number }): Promise<string> {
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(MISTRAL_API_URL, {
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
          const error: Error & { status?: number } = new Error(
            `Mistral API ${status}: ${body.slice(0, 200)}`
          );
          error.status = status;
          throw error;
        }

        const data = (await response.json()) as MistralResponse;

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
      } catch (error) {
        lastError = error;

        // Retry on rate limit (429) or server errors (5xx)
        const status = httpStatus(error);
        const isRetryable =
          status === 429 || (status !== undefined && status >= 500 && status < 600);

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          logger.warn(
            { attempt: attempt + 1, delay, status, error: errorMessage(error) },
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
}
