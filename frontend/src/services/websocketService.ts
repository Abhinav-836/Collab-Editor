export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';
type MessageHandler = (data: any) => void;
type StatusHandler = (status: ConnectionStatus) => void;

/**
 * Resolve the WebSocket base URL:
 *   1. VITE_WS_URL                     (e.g. wss://my-api.onrender.com)
 *   2. VITE_API_URL with http→ws       (e.g. https://my-api.onrender.com → wss://…)
 *   3. same origin as the page         (works with the Vite dev proxy)
 * Any trailing "/ws" or "/" is stripped so we never end up with /ws/ws.
 */
export function getWsBase(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  const api = import.meta.env.VITE_API_URL as string | undefined;
  let base: string;
  if (explicit) base = explicit;
  else if (api) base = api.replace(/^http/, 'ws');
  else base = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return base.replace(/\/+$/, '').replace(/\/ws$/, '');
}

/** Close codes after which reconnecting is pointless. */
const FATAL_CLOSE_CODES = new Set([1008]);

/**
 * A WebSocket that reconnects with exponential backoff, keeps its listeners
 * across reconnects and can be shut down for good with close().
 */
export class CollabSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  status: ConnectionStatus = 'connecting';

  constructor(private url: string) {
    window.addEventListener('online', this.reconnectNow);
    this.open();
  }

  private open(): void {
    if (this.closedByUser) return;
    this.setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.attempts = 0;
      this.setStatus('open');
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        console.warn('Ignoring malformed message', event.data);
        return;
      }
      if (data && typeof data.type === 'string') this.emit(data.type, data);
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedByUser || FATAL_CLOSE_CODES.has(event.code)) {
        if (event.reason) console.error('WebSocket closed:', event.reason);
        this.setStatus('closed');
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose always follows; reconnect logic lives there
    };
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting');
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    // 0.5s, 1s, 2s, 4s … capped at 10s. Free-tier hosts can take ~1 min to wake up,
    // so keep trying instead of giving up after a few attempts.
    const delay = Math.min(500 * 2 ** this.attempts, 10_000);
    this.attempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private reconnectNow = () => {
    if (this.closedByUser || this.ws) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.open();
  };

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusHandlers.forEach((h) => h(status));
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(type: string, data: Record<string, unknown> = {}): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ ...data, type }));
    return true;
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private emit(type: string, data: any): void {
    this.handlers.get(type)?.forEach((h) => {
      try {
        h(data);
      } catch (err) {
        console.error(`Handler for "${type}" failed:`, err);
      }
    });
  }

  /** Permanently close (leaving the room / unmount). */
  close(): void {
    this.closedByUser = true;
    window.removeEventListener('online', this.reconnectNow);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const ws = this.ws;
    this.ws = null;
    // Closing a CONNECTING socket is allowed and prevents a leaked connection
    if (ws && ws.readyState !== WebSocket.CLOSED) ws.close(1000, 'Left room');
    this.setStatus('closed');
  }
}