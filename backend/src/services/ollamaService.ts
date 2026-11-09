import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || 'https://ollama.com/api';
const API_KEY = process.env.OLLAMA_CLOUD_API_KEY || '';

export const DEFAULT_MODEL = 'gemma4:31b-cloud';

/**
 * Models visitors may pick. Ollama Cloud bills per token, so only models on
 * this list are ever called; anything else falls back to DEFAULT_MODEL.
 * Add more with OLLAMA_ALLOWED_MODELS=model1,model2 on Render.
 */
const FREE_TIER_MODELS = new Set<string>([
  DEFAULT_MODEL,
  ...(process.env.OLLAMA_ALLOWED_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
]);

export interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

const headers = () => ({
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
});

/**
 * Call Ollama Cloud's /api/chat endpoint (non-streaming).
 * Throws if the service is unreachable or returns no content — callers turn
 * that into an error response. Nothing here invents a reply.
 */
async function callChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string,
  temperature = 0.7
): Promise<string> {
  try {
    const response = await axios.post(
      `${OLLAMA_CLOUD_URL}/chat`,
      { model, messages, stream: false, options: { temperature } },
      { headers: headers(), timeout: 120_000 }
    );

    const content = response.data?.message?.content;
    if (!content) {
      throw new Error(`Unexpected response shape: ${JSON.stringify(response.data).slice(0, 200)}`);
    }
    return content;
  } catch (error: any) {
    const detail =
      error.response?.data?.error || error.response?.data?.message || error.response?.data || error.message;
    console.error('Ollama Cloud /chat error:', detail);
    throw new Error(typeof detail === 'string' ? detail : 'AI service unavailable');
  }
}

/**
 * Some models have both a bare name (e.g., "gemma4:31b") and a "-cloud" variant.
 * For the free plan, prefer the "-cloud" version. If the caller passes
 * "gemma4:31b", we automatically try "gemma4:31b-cloud".
 */
export function normalizeToFreeModel(requested: string): string {
  if (FREE_TIER_MODELS.has(requested)) return requested;

  const [base, tag] = requested.split(':');
  if (tag) {
    const cloudVariant = `${base}:${tag}-cloud`;
    if (FREE_TIER_MODELS.has(cloudVariant)) return cloudVariant;
  }

  // Not on the list: never let a visitor pick a (possibly expensive) model
  return DEFAULT_MODEL;
}

const fallbackModelList = (): ModelInfo[] => [
  { name: DEFAULT_MODEL, modified_at: new Date().toISOString(), size: 0, digest: '' }
];

export const ollamaService = {
  /** Single-turn completion. Lower temperature for explanations and reviews. */
  async generateCompletion(prompt: string, model: string = DEFAULT_MODEL, temperature = 0.7): Promise<string> {
    return callChat([{ role: 'user', content: prompt }], normalizeToFreeModel(model), temperature);
  },

  /** Return only the models the current plan can actually use. */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${OLLAMA_CLOUD_URL}/tags`, {
        headers: headers(),
        timeout: 15_000
      });
      const allModels: ModelInfo[] = response.data.models || [];
      const freeModels = allModels.filter((m) => FREE_TIER_MODELS.has(m.name));
      return freeModels.length > 0 ? freeModels : fallbackModelList();
    } catch (error) {
      console.error('Failed to fetch models:', (error as any).message);
      return fallbackModelList();
    }
  }
};