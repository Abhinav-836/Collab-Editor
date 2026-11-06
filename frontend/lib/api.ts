import { API_BASE } from './config';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function post<T = any>(path: string, body: unknown, signal?: AbortSignal): Promise<{ status: number; ok: boolean; data: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal
  });
  const data = await res.json().catch(() => ({}) as T);
  return { status: res.status, ok: res.ok, data };
}

export const NETWORK_ERROR =
  "Can't reach the server. It sleeps when nobody's using it and takes up to a minute to wake — try again shortly.";

/** Create a room, optionally password-protected. Returns the room id and access token. */
export async function createRoom(password?: string): Promise<{ roomId: string; token?: string }> {
  const { ok, status, data } = await post('/api/rooms', password ? { password } : {});
  if (!ok) throw new ApiError(data?.error || `Couldn't create the room (HTTP ${status}).`, status);
  if (!data?.roomId) throw new ApiError('The server did not return a room code.', status);
  return { roomId: data.roomId, token: data.token };
}

/** Check a room and exchange its password for a token. 401 = password needed or wrong. */
export async function joinRoom(roomId: string, password?: string): Promise<{ token: string | null }> {
  const { ok, status, data } = await post(`/api/rooms/${encodeURIComponent(roomId)}/join`, password ? { password } : {});
  if (status === 401) throw new ApiError('PASSWORD_REQUIRED', 401);
  if (!ok) throw new ApiError(data?.error || `Couldn't join (HTTP ${status}).`, status);
  return { token: data?.token ?? null };
}

export interface AIModel {
  name: string;
  id: string;
}

export async function fetchModels(): Promise<AIModel[]> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/models`);
    const data = await res.json();
    return data?.success && Array.isArray(data.models) ? data.models : [];
  } catch {
    return [];
  }
}

export async function sendChat(payload: {
  message: string;
  code: string;
  language: string;
  model: string;
  history: Array<{ role: string; content: string }>;
}): Promise<string> {
  const { ok, status, data } = await post('/api/ai/chat', payload);
  if (!ok) throw new ApiError(data?.error || `HTTP ${status}`, status);
  return data?.response || '';
}

/** Explain the selection (with the file as context), or the whole file if `selection` is empty. */
export async function explainCode(payload: {
  code: string;
  selection: string;
  language: string;
  model: string;
}): Promise<{ text: string; scope: 'selection' | 'file'; truncated: boolean }> {
  const { ok, status, data } = await post('/api/ai/explain', payload);
  if (!ok || !data?.success) throw new ApiError(data?.error || `HTTP ${status}`, status);
  return { text: data.explanation || '', scope: data.scope === 'selection' ? 'selection' : 'file', truncated: !!data.truncated };
}

/** Review the whole file and get up to 5 concrete improvements. */
export async function suggestImprovements(payload: {
  code: string;
  language: string;
  model: string;
}): Promise<{ text: string; truncated: boolean }> {
  const { ok, status, data } = await post('/api/ai/suggest', payload);
  if (!ok || !data?.success) throw new ApiError(data?.error || `HTTP ${status}`, status);
  return { text: data.suggestions || '', truncated: !!data.truncated };
}

export interface RunResult {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  compileOutput: string;
  compiler: string;
  durationMs: number;
}

export async function runCode(
  body: { language: string; code: string; stdin: string },
  signal?: AbortSignal
): Promise<RunResult> {
  const { ok, status, data } = await post('/api/run', body, signal);
  if (!ok || !data?.success) throw new ApiError(data?.error || `Run failed (HTTP ${status}).`, status);
  return data.result;
}