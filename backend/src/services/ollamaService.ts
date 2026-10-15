import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || 'https://ollama.com/api';
const API_KEY = process.env.OLLAMA_CLOUD_API_KEY || '';

/**
 * Models known to work on Ollama's Free plan.
 * Ollama doesn't expose a "my entitled models" endpoint, so we maintain
 * this list. Update as Ollama changes their free tier.
 *
 * Tip: If you try a new model and get "not included in your free usage",
 * add its `-cloud` variant here instead.
 */
const FREE_TIER_MODELS = new Set<string>([
  'gemma4:31b-cloud'
  // Add more as you discover them, e.g.:
  // 'kimi-k3-cloud',
  // 'mistral-large-4-cloud',
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
      throw new Error(
        `Unexpected response shape: ${JSON.stringify(response.data).slice(0, 200)}`
      );
    }
    return content;
  } catch (error: any) {
    const detail =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.response?.data ||
      error.message;
    console.error('Ollama Cloud /chat error:', detail);
    throw new Error(typeof detail === 'string' ? detail : 'AI service unavailable');
  }
}

/**
 * Some models have both a bare name (e.g., "gemma4:31b") and a "-cloud" variant.
 * For the free plan, prefer the "-cloud" version. If the caller passes
 * "gemma4:31b", we automatically try "gemma4:31b-cloud".
 */
function normalizeToFreeModel(requested: string): string {
  if (FREE_TIER_MODELS.has(requested)) return requested;

  // If the base name is in the set (e.g., "gemma4:31b"), try "-cloud"
  const [base, tag] = requested.split(':');
  if (tag) {
    const cloudVariant = `${base}:${tag}-cloud`;
    if (FREE_TIER_MODELS.has(cloudVariant)) return cloudVariant;
  }

  // Otherwise, keep as-is — callChat will throw and we surface the error
  return requested;
}

export const ollamaService = {
  async generateCompletion(prompt: string, model: string = 'gemma4:31b-cloud'): Promise<string> {
    const resolved = normalizeToFreeModel(model);
    return callChat([{ role: 'user', content: prompt }], resolved);
  },

  /**
   * Return only the models the current plan can actually use.
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${OLLAMA_CLOUD_URL}/tags`, {
        headers: headers(),
        timeout: 15_000
      });

      const allModels: ModelInfo[] = response.data.models || [];

      // Filter to only models in the free tier whitelist
      const freeModels = allModels.filter((m) => FREE_TIER_MODELS.has(m.name));

      // If whitelist matched something real, use it
      if (freeModels.length > 0) {
        return freeModels;
      }

      // Otherwise, fall back to a hardcoded list of known-good names
      return [
        { name: 'gemma4:31b-cloud', modified_at: new Date().toISOString(), size: 0, digest: '' }
      ];
    } catch (error) {
      console.error('Failed to fetch models:', (error as any).message);
      // Fallback if Ollama Cloud is unreachable
      return [
        { name: 'gemma4:31b-cloud', modified_at: new Date().toISOString(), size: 0, digest: '' }
      ];
    }
  },

  async getCodeSuggestion(
    code: string,
    language: string,
    position: number,
    model: string
  ): Promise<string[]> {
    const resolved = normalizeToFreeModel(model);
    const prompt = `You are a code completion assistant. Complete the following ${language} code at position ${position}.

\`\`\`${language}
${code}
\`\`\`

Return exactly 3 short completion suggestions as a JSON array of strings. Example:
["console.log(x)", "return x", "if (x) {}"]

Return ONLY the JSON array, no prose.`;

    try {
      const result = await callChat([{ role: 'user', content: prompt }], resolved, 0.3);

      try {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch { /* not JSON */ }

      const match = result.match(/\[[\s\S]*?\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch { /* ignore */ }
      }

      return [result.trim()];
    } catch (error) {
      console.error('AI suggestion error:', (error as Error).message);
      return this.getFallbackSuggestions(language);
    }
  },

  async explainCode(code: string, language: string, model: string): Promise<string> {
    const resolved = normalizeToFreeModel(model);
    const prompt = `Explain the following ${language} code in simple terms.

\`\`\`${language}
${code}
\`\`\`

Provide a concise explanation of what it does and its key features.`;

    try {
      return await callChat([{ role: 'user', content: prompt }], resolved, 0.5);
    } catch (error) {
      console.error('AI explanation error:', (error as Error).message);
      return this.getFallbackExplanation(code, language);
    }
  },

  getFallbackSuggestions(language: string): string[] {
    const suggestions: Record<string, string[]> = {
      javascript: [
        'console.log()',
        'if (condition) { }',
        'for (let i = 0; i < arr.length; i++) { }',
        'function name() { }'
      ],
      typescript: [
        'interface Props { }',
        'const [state, setState] = useState()',
        'type MyType = { }'
      ],
      python: [
        'print()',
        'if __name__ == "__main__":',
        'for item in list:',
        'def function():'
      ],
      java: [
        'System.out.println()',
        'public static void main(String[] args) { }',
        'try-catch block'
      ]
    };
    return suggestions[language] || ['// Write your code here'];
  },

  getFallbackExplanation(code: string, language: string): string {
    const lines = code.split('\n').length;
    return `${lines} lines of ${language} code. Add comments and handle edge cases for better quality.`;
  }
};