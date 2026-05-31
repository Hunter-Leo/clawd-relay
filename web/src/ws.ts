type EventMap = {
  connecting: [];
  connected: [];
  disconnected: [];
  message: [unknown];
};

type Listener<T extends keyof EventMap> = (...args: EventMap[T]) => void;

interface WSConnection {
  ws: WebSocket | null;
  token: string;
  status: "connecting" | "connected" | "disconnected";
  retries: number;
}

function parseTokens(): string[] {
  const params = new URLSearchParams(window.location.search);
  const tokens = params.getAll("token");
  return tokens.length > 0 ? tokens : [];
}

function getRelayUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const custom = params.get("relay_url");
  return custom ?? window.location.origin;
}

const MAX_RETRIES = 6;
const INITIAL_RETRY_DELAY = 1000;

function calcDelay(retries: number): number {
  return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retries), 30000);
}

class WebSocketManager {
  private connections: Map<string, WSConnection> = new Map();
  private listeners: Map<string, Set<Listener<any>>> = new Map();
  private relayUrl: string;

  constructor() {
    this.relayUrl = getRelayUrl();
    const tokens = parseTokens();
    for (const token of tokens) {
      this.connect(token);
    }
  }

  get tokens(): string[] {
    return Array.from(this.connections.keys());
  }

  get tokensCount(): number {
    return this.connections.size;
  }

  private getOrCreateEventTarget<T extends keyof EventMap>(
    event: T,
  ): Set<Listener<T>> {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    return set;
  }

  on<T extends keyof EventMap>(event: T, listener: Listener<T>) {
    this.getOrCreateEventTarget(event).add(listener);
    return () => this.getOrCreateEventTarget(event).delete(listener);
  }

  private emit<T extends keyof EventMap>(event: T, ...args: EventMap[T]) {
    this.getOrCreateEventTarget(event).forEach((fn) => fn(...args));
  }

  connect(token: string) {
    if (this.connections.has(token)) return;
    const conn: WSConnection = { ws: null, token, status: "connecting", retries: 0 };
    this.connections.set(token, conn);
    this.initConnection(token);
  }

  disconnect(token: string) {
    const conn = this.connections.get(token);
    if (!conn) return;
    conn.retries = MAX_RETRIES; // stop reconnecting
    conn.ws?.close();
    this.connections.delete(token);
  }

  disconnectAll() {
    for (const token of this.connections.keys()) {
      this.disconnect(token);
    }
  }

  send(token: string, data: unknown) {
    const conn = this.connections.get(token);
    if (conn?.ws?.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(data));
    }
  }

  sendAll(data: unknown) {
    for (const token of this.connections.keys()) {
      this.send(token, data);
    }
  }

  getStatus(): "connecting" | "connected" | "disconnected" {
    const conns = Array.from(this.connections.values());
    if (conns.length === 0) return "disconnected";
    if (conns.some((c) => c.status === "connecting")) return "connecting";
    if (conns.every((c) => c.status === "connected")) return "connected";
    return "connecting";
  }

  private initConnection(token: string) {
    const conn = this.connections.get(token);
    if (!conn) return;

    const url = `${this.relayUrl.replace(/^http/, "ws")}/relay/connect?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    conn.ws = ws;
    conn.status = "connecting";
    this.emit("connecting");

    ws.onopen = () => {
      conn.status = "connected";
      conn.retries = 0;
      this.emit("connected");
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.emit("message", data);
      } catch {
        console.warn("[ws] failed to parse message:", event.data);
      }
    };

    ws.onclose = () => {
      conn.status = "disconnected";
      this.emit("disconnected");
      this.scheduleReconnect(token);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }

  private scheduleReconnect(token: string) {
    const conn = this.connections.get(token);
    if (!conn || conn.retries >= MAX_RETRIES) return;

    conn.retries++;
    const delay = calcDelay(conn.retries - 1);
    setTimeout(() => this.initConnection(token), delay);
  }
}

let instance: WebSocketManager | null = null;

export function getWSManager(): WebSocketManager {
  if (!instance) {
    instance = new WebSocketManager();
  }
  return instance;
}

export function resetWSManager() {
  if (instance) {
    instance.disconnectAll();
  }
  instance = null;
}
