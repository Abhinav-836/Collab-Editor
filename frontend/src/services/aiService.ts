export interface AISuggestion {
  text: string;
  type: 'completion' | 'fix' | 'refactor';
}

export const aiService = {
  async getCompletions(code: string, language: string, model: string): Promise<string[]> {
    try {
      const response = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, position: 0, model })
      });
      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error('AI completion error:', error);
      return [];
    }
  },

  async explainCode(code: string, language: string, model: string): Promise<any> {
    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, model })
      });
      return await response.json();
    } catch (error) {
      console.error('AI explanation error:', error);
      return { success: false, error: 'AI service unavailable' };
    }
  },

  async getAvailableModels(): Promise<{ name: string; id: string }[]> {
    try {
      const response = await fetch('/api/ai/models');
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [
        { name: 'llama3.2', id: 'llama3.2' },
        { name: 'codellama:7b', id: 'codellama:7b' },
        { name: 'deepseek-coder:6.7b', id: 'deepseek-coder:6.7b' },
        { name: 'mistral:7b', id: 'mistral:7b' }
      ];
    }
  }
};