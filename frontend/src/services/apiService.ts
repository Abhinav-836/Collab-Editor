const API_BASE = '/api';

export const apiService = {
  async createRoom(): Promise<{ success: boolean; roomId: string }> {
    const response = await fetch(`${API_BASE}/rooms`, { method: 'POST' });
    return response.json();
  },

  async getRoom(roomId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/rooms/${roomId}`);
    return response.json();
  },

  async deleteRoom(roomId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/rooms/${roomId}`, { method: 'DELETE' });
    return response.json();
  },

  async getAISuggestions(code: string, language: string, position: number): Promise<string[]> {
    const response = await fetch(`${API_BASE}/ai/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, position })
    });
    const data = await response.json();
    return data.suggestions || [];
  },

  async explainCode(code: string, language: string): Promise<any> {
    const response = await fetch(`${API_BASE}/ai/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language })
    });
    return response.json();
  }
};