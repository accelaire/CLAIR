// =============================================================================
// Client HuggingFace Inference API - Génération d'Embeddings
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import pLimit from 'p-limit';
import { logger } from '../../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models';
const DEFAULT_MODEL = 'Alibaba-NLP/gte-multilingual-base';
const EMBEDDING_DIMENSIONS = 768;

// Rate limiting for free tier (30k requests/month ≈ 1 req/sec)
const RATE_LIMIT_DELAY_MS = 1000;

// =============================================================================
// TYPES
// =============================================================================

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export interface EmbeddingClientOptions {
  apiKey?: string;
  model?: string;
  rateLimitMs?: number;
}

// =============================================================================
// CLIENT
// =============================================================================

export class HuggingFaceEmbeddingClient {
  private client: AxiosInstance;
  private model: string;
  private rateLimitMs: number;
  private lastRequestTime: number = 0;
  private requestLimit: ReturnType<typeof pLimit>;

  constructor(options: EmbeddingClientOptions = {}) {
    const apiKey = options.apiKey || process.env.HF_API_KEY;
    if (!apiKey) {
      throw new Error('HF_API_KEY is required for HuggingFace embedding client');
    }

    this.model = options.model || process.env.HF_MODEL || DEFAULT_MODEL;
    this.rateLimitMs = options.rateLimitMs || RATE_LIMIT_DELAY_MS;
    this.requestLimit = pLimit(1); // Only 1 concurrent request

    this.client = axios.create({
      baseURL: HF_API_URL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info({ model: this.model }, 'HuggingFace Embedding Client initialized');
  }

  /**
   * Rate limiting helper - ensures minimum delay between requests
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    return this.requestLimit(async () => {
      await this.waitForRateLimit();

      try {
        const url = `/${this.model}/pipeline/feature-extraction`;
        logger.debug({ url, baseURL: HF_API_URL }, 'Calling HuggingFace API');

        const response = await this.client.post(url, {
          inputs: text,
          options: {
            wait_for_model: true,
          },
        });

        // HuggingFace returns nested array for single input
        const embedding = this.normalizeEmbedding(response.data);

        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          logger.warn({
            expected: EMBEDDING_DIMENSIONS,
            received: embedding.length,
          }, 'Unexpected embedding dimensions');
        }

        return embedding;
      } catch (error: any) {
        if (error.response?.status === 503) {
          // Model loading - wait and retry
          logger.info({ model: this.model }, 'Model is loading, waiting...');
          await new Promise(resolve => setTimeout(resolve, 20000));
          return this.embed(text);
        }

        if (error.response?.status === 429) {
          // Rate limited - wait longer and retry
          logger.warn('Rate limited by HuggingFace, waiting 60s...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          return this.embed(text);
        }

        logger.error({
          error: error.message,
          status: error.response?.status,
          responseData: error.response?.data,
          text: text.substring(0, 100),
        }, 'Failed to generate embedding');
        throw error;
      }
    });
  }

  /**
   * Generate embeddings for multiple texts (batched)
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    // Process one at a time to respect rate limits
    for (const text of texts) {
      try {
        const embedding = await this.embed(text);
        results.push({ text, embedding });
      } catch (error) {
        logger.error({ text: text.substring(0, 50) }, 'Skipping text due to embedding error');
        // Continue with other texts
      }
    }

    return results;
  }

  /**
   * Normalize the HuggingFace response to a flat embedding array
   */
  private normalizeEmbedding(data: any): number[] {
    // HuggingFace can return:
    // - [[...]] for single input with sentence-transformers
    // - [...] for single input with some models
    // - [[[...]]] for some models with nested pooling

    if (!Array.isArray(data)) {
      throw new Error('Unexpected embedding format: not an array');
    }

    // Flatten until we get a number array
    let result = data;
    while (Array.isArray(result) && Array.isArray(result[0])) {
      // Check if inner is numbers (we've reached the embedding)
      if (typeof result[0][0] === 'number') {
        // This is the embedding wrapped in array
        result = result[0];
        break;
      }
      result = result[0];
    }

    // For token-level models, we might need to mean-pool
    if (Array.isArray(result[0])) {
      // Mean pooling across tokens
      const numTokens = result.length;
      const dims = result[0].length;
      const pooled = new Array(dims).fill(0);

      for (const tokenEmb of result) {
        for (let i = 0; i < dims; i++) {
          pooled[i] += tokenEmb[i] / numTokens;
        }
      }

      return pooled;
    }

    return result as number[];
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate centroid of multiple embeddings
   */
  static calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot calculate centroid of empty array');
    }

    const dims = embeddings[0].length;
    const centroid = new Array(dims).fill(0);

    for (const emb of embeddings) {
      for (let i = 0; i < dims; i++) {
        centroid[i] += emb[i] / embeddings.length;
      }
    }

    return centroid;
  }
}

export default HuggingFaceEmbeddingClient;
