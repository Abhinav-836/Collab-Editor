import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || 'https://ollama.com/api';
const API_KEY = process.env.OLLAMA_CLOUD_API_KEY || '';

export interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export const ollamaService = {
  async generateCompletion(prompt: string, model: string = 'llama3.2:latest'): Promise<string> {
    try {
      const response = await axios.post(`${OLLAMA_CLOUD_URL}/generate`, {
        model: model,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 }
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data.response;
    } catch (error: any) {
      console.error('Generate completion error:', error.response?.data || error.message);
      return 'AI service temporarily unavailable. Please try again.';
    }
  },

  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${OLLAMA_CLOUD_URL}/tags`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });
      return response.data.models || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      // These are the CORRECT Ollama Cloud model names
      return [
        { name: 'llama3.2:latest', modified_at: new Date().toISOString(), size: 0, digest: '' },
        { name: 'llama3.1:latest', modified_at: new Date().toISOString(), size: 0, digest: '' },
        { name: 'mistral:latest', modified_at: new Date().toISOString(), size: 0, digest: '' },
        { name: 'codellama:latest', modified_at: new Date().toISOString(), size: 0, digest: '' }
      ];
    }
  },

  async getCodeSuggestion(code: string, language: string, position: number, model: string): Promise<string[]> {
    // Ensure model name has :latest suffix for cloud
    const cloudModel = model.includes(':') ? model : `${model}:latest`;
    
    const prompt = `Complete the following ${language} code at position ${position}:
    
${code}

Provide 3 short code completion suggestions as a JSON array. Example: ["suggestion1", "suggestion2", "suggestion3"]`;
    
    try {
      const response = await axios.post(`${OLLAMA_CLOUD_URL}/generate`, {
        model: cloudModel,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 }
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = response.data.response;
      try {
        const suggestions = JSON.parse(result);
        return Array.isArray(suggestions) ? suggestions : [result];
      } catch {
        return [result];
      }
    } catch (error: any) {
      console.error('AI suggestion error:', error.response?.data || error.message);
      return this.getFallbackSuggestions(language);
    }
  },

  async explainCode(code: string, language: string, model: string): Promise<string> {
    // Ensure model name has :latest suffix for cloud
    const cloudModel = model.includes(':') ? model : `${model}:latest`;
    
    const prompt = `Explain the following ${language} code in simple terms:
    
${code}

Provide a concise explanation focusing on what the code does and its key features.`;
    
    try {
      const response = await axios.post(`${OLLAMA_CLOUD_URL}/generate`, {
        model: cloudModel,
        prompt: prompt,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.response;
    } catch (error: any) {
      console.error('AI explanation error:', error.response?.data || error.message);
      return this.getFallbackExplanation(code, language);
    }
  },

  getFallbackSuggestions(language: string): string[] {
    const suggestions: Record<string, string[]> = {
      javascript: ['console.log()', 'if (condition) { }', 'for (let i = 0; i < arr.length; i++) { }', 'function name() { }'],
      typescript: ['interface Props { }', 'const [state, setState] = useState()', 'type MyType = { }'],
      python: ['print()', 'if __name__ == "__main__":', 'for item in list:', 'def function():'],
      java: ['System.out.println()', 'public static void main(String[] args) { }', 'try-catch block']
    };
    return suggestions[language] || ['// Write your code here'];
  },

  getFallbackExplanation(code: string, language: string): string {
    const lines = code.split('\n').length;
    return `${lines} lines of ${language} code. Add comments and handle edge cases for better quality.`;
  }
};