// Use environment variable for production, fallback to relative path for local
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const apiService = {
  async createRoom(): Promise<{ success: boolean; roomId: string }> {
    const response = await fetch(`${API_BASE}/rooms`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  async getRoom(roomId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/rooms/${roomId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  async deleteRoom(roomId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/rooms/${roomId}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  async getAISuggestions(code: string, language: string, position: number): Promise<string[]> {
    const response = await fetch(`${API_BASE}/ai/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, position })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.suggestions || [];
  },

  async explainCode(code: string, language: string): Promise<any> {
    const response = await fetch(`${API_BASE}/ai/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
};