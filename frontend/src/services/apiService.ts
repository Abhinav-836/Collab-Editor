// 🔥 Always resolve correct base URL
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

if (!API_BASE) {
  console.warn("⚠️ VITE_API_URL is not set. API calls may fail in production.");
}

// 🔥 Reusable request helper (prevents JSON crash)
async function request(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  // 🔴 Handle non-JSON safely (fixes your 'Unexpected token T' bug)
  const contentType = res.headers.get("content-type");

  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ API Error:", errorText);
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    console.error("❌ Non-JSON response:", text);
    throw new Error("Invalid server response");
  }

  return res.json();
}

export const apiService = {
  async createRoom(): Promise<{ success: boolean; roomId: string }> {
    return request(`${API_BASE}/api/rooms`, {
      method: "POST",
    });
  },

  async getRoom(roomId: string): Promise<any> {
    return request(`${API_BASE}/api/rooms/${roomId}`);
  },

  async deleteRoom(roomId: string): Promise<{ success: boolean }> {
    return request(`${API_BASE}/api/rooms/${roomId}`, {
      method: "DELETE",
    });
  },

  async getAISuggestions(
    code: string,
    language: string,
    position: number
  ): Promise<string[]> {
    const data = await request(`${API_BASE}/api/ai/suggest`, {
      method: "POST",
      body: JSON.stringify({ code, language, position }),
    });
    return data.suggestions || [];
  },

  async explainCode(code: string, language: string): Promise<any> {
    return request(`${API_BASE}/api/ai/explain`, {
      method: "POST",
      body: JSON.stringify({ code, language }),
    });
  },
};
