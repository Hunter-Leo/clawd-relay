/**
 * RelayRoom — Durable Object for Clawd Relay.
 *
 * Manages WebSocket connections per relay token:
 * - One bridge (the local agent process) — exclusive
 * - Many clients (web UI, hardware) — concurrent
 * - Offline message buffer with RingBuffer
 * - Device state tracking for new-client replay
 * - Heartbeat detection via DO alarms
 */
import type { TokenRecord, Env } from "./types";
import type { AlwaysAllowRule } from "@clawd-relay/types";
import { STORAGE_KEYS } from "./types";

// ─── RingBuffer ────────────────────────────────────────────────────────────

/** Fixed-size circular buffer for offline message replay. */
export class RingBuffer<T> {
	private readonly buffer: T[];
	private index: number;
	private count: number;

	constructor(private readonly capacity: number) {
		this.buffer = new Array(capacity);
		this.index = 0;
		this.count = 0;
	}

	push(item: T): void {
		this.buffer[this.index] = item;
		this.index = (this.index + 1) % this.capacity;
		if (this.count < this.capacity) this.count++;
	}

	flush(): T[] {
		const result: T[] = [];
		const start = this.count < this.capacity ? 0 : this.index;
		for (let i = 0; i < this.count; i++) {
			result.push(this.buffer[(start + i) % this.capacity]);
		}
		return result;
	}
}

// ─── Message type helpers ──────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// ─── RelayRoom DO ──────────────────────────────────────────────────────────

export class RelayRoom implements DurableObject {
	private readonly storage: DurableObjectStorage;
	private bridges: Set<WebSocket> = new Set();
	private clients: Set<WebSocket> = new Set();
	private tokenRecord: TokenRecord | null = null;
	private lastBridgeActivity = 0;
	private readonly offlineBuffer = new RingBuffer<JsonValue>(50);
	private readonly deviceInfos = new Map<string, Record<string, unknown>>();
	private readonly deviceSessions = new Map<string, Record<string, unknown>[]>();

	// Mapping from client ws -> deviceId for disconnection tracking
	private readonly clientDevices = new WeakMap<WebSocket, string>();
	private alwaysAllowRules: AlwaysAllowRule[] = [];

	constructor(
		readonly state: DurableObjectState,
		readonly env: Env,
	) {
		this.storage = state.storage;
		// Load persisted always_allow rules
		state.blockConcurrencyWhile(async () => {
			const rules = await this.storage.get<AlwaysAllowRule[]>(STORAGE_KEYS.alwaysAllowRules);
			if (rules) this.alwaysAllowRules = rules;
		});
	}

	// ─── Admin API via fetch ───────────────────────────────────────────────

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method;

		// WebSocket upgrade — used by /relay/connect
		if (method === "GET" && url.pathname === "/ws") {
			return this.handleWebSocketUpgrade(request);
		}

		// Admin: register token
		if (method === "POST" && url.pathname === "/admin/register") {
			const body = (await request.json()) as TokenRecord;
			await this.storage.put(`${STORAGE_KEYS.tokenPrefix}${body.id}`, body);
			await this.addTokenId(body.id);
			return Response.json({ ok: true });
		}

		// Admin: get token record
		if (method === "GET" && url.pathname.startsWith("/admin/token/")) {
			const id = url.pathname.slice("/admin/token/".length);
			const record = await this.storage.get<TokenRecord>(`${STORAGE_KEYS.tokenPrefix}${id}`);
			if (!record) return new Response("Not found", { status: 404 });
			return Response.json(record);
		}

		// Admin: revoke token
		if (method === "DELETE" && url.pathname.startsWith("/admin/token/")) {
			const id = url.pathname.slice("/admin/token/".length);
			await this.storage.put(`${STORAGE_KEYS.tokenPrefix}${id}`, {
				id,
				label: "",
				createdAt: 0,
				revoked: true,
			});
			await this.removeTokenId(id);
			return Response.json({ ok: true });
		}

		// Admin: get bridge status
		if (method === "GET" && url.pathname === "/admin/status") {
			return Response.json({
				online: this.bridges.size > 0,
				clientCount: this.clients.size,
			});
		}

		// ─── Token Registry routes ────────────────────────────────────────

		// Registry: list all token IDs
		if (method === "GET" && url.pathname === "/registry/list") {
			const ids = await this.storage.get<string[]>(STORAGE_KEYS.tokenIds) ?? [];
			return Response.json({ tokenIds: ids });
		}

		// Registry: add token ID
		if (method === "POST" && url.pathname === "/registry/add") {
			const body = (await request.json()) as { id: string };
			await this.addTokenId(body.id);
			return Response.json({ ok: true });
		}

		// Registry: remove token ID
		if (method === "POST" && url.pathname === "/registry/remove") {
			const body = (await request.json()) as { id: string };
			await this.removeTokenId(body.id);
			return Response.json({ ok: true });
		}

		return new Response("Not found", { status: 404 });
	}

	// ─── WebSocket Upgrade ─────────────────────────────────────────────────

	private handleWebSocketUpgrade(_request: Request): Response {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		server.accept();

		// The first message MUST be "hello" — we wait for it to classify
		// the connection as bridge or client.
		const self = this;
		server.addEventListener("message", function onFirstMessage(ev: MessageEvent) {
			try {
				const msg = JSON.parse(ev.data as string);
				if (msg.type === "hello") {
					self.handleHello(server, msg);
				} else {
					server.close(4001, "First message must be hello");
				}
			} catch {
				server.close(4001, "Invalid JSON");
			}
			server.removeEventListener("message", onFirstMessage);
		});

		return new Response(null, { status: 101, webSocket: client });
	}

	// ─── Hello handler ─────────────────────────────────────────────────────

	private async handleHello(ws: WebSocket, msg: { token?: string; device?: { id: string } }): Promise<void> {
		const token = msg.token;
		const deviceId = msg.device?.id ?? "unknown";

		if (!token) {
			ws.close(4001, "Missing token");
			return;
		}

		// Validate token against DO storage
		const record = await this.storage.get<TokenRecord>(`${STORAGE_KEYS.tokenPrefix}${token}`);
		if (!record || record.revoked) {
			ws.close(4001, "Invalid or revoked token");
			return;
		}

		this.tokenRecord = record;

		// Determine if this is bridge or client
		if (this.bridges.size === 0) {
			this.addBridge(ws, deviceId);
		} else {
			this.addClient(ws, deviceId);
		}
	}

	// ─── Connection management ─────────────────────────────────────────────

	private addBridge(ws: WebSocket, deviceId: string): void {
		for (const old of this.bridges) {
			try {
				old.close(1000, "Replaced by new bridge");
			} catch {
				// ignore
			}
			this.broadcast({ type: "device_online", device: { id: deviceId, host: "", platform: "", bridgeVersion: "" }, online: false });
		}
		this.bridges = new Set([ws]);
		this.lastBridgeActivity = Date.now();

		ws.addEventListener("message", (ev) => this.onBridgeMessage(ws, ev));
		ws.addEventListener("close", () => this.onBridgeClose(ws));
		ws.addEventListener("error", () => this.onBridgeClose(ws));

		this.sendJson(ws, {
			type: "device_online",
			device: { id: deviceId, host: "", platform: "", bridgeVersion: "" },
			online: true,
		});

		this.broadcast({
			type: "device_online",
			device: { id: deviceId, host: "", platform: "", bridgeVersion: "" },
			online: true,
		});

		this.state.storage.setAlarm(Date.now() + 30000);
	}

	private addClient(ws: WebSocket, deviceId: string): void {
		this.clients.add(ws);
		this.clientDevices.set(ws, deviceId);

		ws.addEventListener("message", (ev) => this.onClientMessage(ws, ev));
		ws.addEventListener("close", () => this.onClientClose(ws));
		ws.addEventListener("error", () => this.onClientClose(ws));

		// Send sync_snapshot with current device state for history
		const devicesArr: Record<string, unknown>[] = [];
		const sessionsObj: Record<string, Record<string, unknown>[]> = {};
		for (const [id, info] of this.deviceInfos) {
			devicesArr.push(info);
			const s = this.deviceSessions.get(id);
			if (s) sessionsObj[id] = s;
		}
		this.sendJson(ws, {
			type: "sync_snapshot",
			devices: devicesArr,
			sessions: sessionsObj,
		});

		// Replay offline buffer
		for (const msg of this.offlineBuffer.flush()) {
			this.sendJson(ws, msg);
		}

		// Send current bridge status
		this.sendJson(ws, {
			type: "device_online",
			device: { id: deviceId, host: "", platform: "", bridgeVersion: "" },
			online: this.bridges.size > 0,
		});
	}

	// ─── Bridge message handler ────────────────────────────────────────────

	private onBridgeMessage(ws: WebSocket, ev: MessageEvent): void {
		this.lastBridgeActivity = Date.now();

		let msg: Record<string, unknown>;
		try {
			msg = JSON.parse(ev.data as string) as Record<string, unknown>;
		} catch {
			return;
		}

		const type = msg.type as string;
		const json = ev.data as string;

		switch (type) {
			case "hello":
				break;

			case "keepalive":
				break;

			case "session_state": {
				const sessionMsg = msg as Record<string, unknown>;
				const device = sessionMsg.device as Record<string, unknown> | undefined;
				const session = sessionMsg.session as Record<string, unknown> | undefined;
				if (device && typeof device.id === "string") {
					this.deviceInfos.set(device.id, device);
					if (session && typeof session.id === "string") {
						const existing = this.deviceSessions.get(device.id) ?? [];
						const idx = (existing as Array<Record<string, unknown>>).findIndex((s: Record<string, unknown>) => s.id === session.id);
						if (idx >= 0) existing[idx] = session;
						else existing.push(session);
						this.deviceSessions.set(device.id, existing);
					}
				}
				this.offlineBuffer.push(msg as JsonValue);
				if (this.clients.size > 0) {
					this.broadcastRaw(json);
				}
				break;
			}

			case "permission_request": {
				// Check always_allow rules for auto-approval
				const rule = this.findMatchingRule(msg);
				if (rule) {
					this.sendJson(ws, {
						type: "permission_response",
						permissionId: (msg as { permissionId?: string }).permissionId ?? "",
						approved: true,
					});
					return;
				}
				this.offlineBuffer.push(msg as JsonValue);
				if (this.clients.size === 0) {
					this.sendJson(ws, {
						type: "no_clients",
						permissionId: (msg as { permissionId?: string }).permissionId ?? "",
					});
				} else {
					this.broadcastRaw(json);
				}
				break;
			}

			default:
				break;
		}
	}

	private onBridgeClose(ws: WebSocket): void {
		this.bridges.delete(ws);
		if (this.bridges.size === 0) {
			this.broadcast({
				type: "device_online",
				device: { id: "", host: "", platform: "", bridgeVersion: "" },
				online: false,
			});
		}
	}

	// ─── Client message handler ────────────────────────────────────────────

	private async onClientMessage(_ws: WebSocket, ev: MessageEvent): Promise<void> {
		let msg: { type: string; rule?: AlwaysAllowRule };
		try {
			msg = JSON.parse(ev.data as string) as { type: string; rule?: AlwaysAllowRule };
		} catch {
			return;
		}

		if (msg.type === "always_allow" && msg.rule) {
			this.alwaysAllowRules.push(msg.rule);
			await this.storage.put(STORAGE_KEYS.alwaysAllowRules, this.alwaysAllowRules);
		}

		if (
			msg.type === "permission_response" ||
			msg.type === "dnd_change" ||
			msg.type === "always_allow"
		) {
			for (const bridge of this.bridges) {
				this.sendJson(bridge, msg);
			}
		}
	}

	private findMatchingRule(request: Record<string, unknown>): AlwaysAllowRule | undefined {
		const reqDevice = request.device as { id?: string } | undefined;
		const reqToolName = request.toolName as string | undefined;
		if (!reqToolName) return undefined;
		return this.alwaysAllowRules.find(r =>
			r.toolName === reqToolName &&
			(!r.deviceId || !reqDevice?.id || r.deviceId === reqDevice.id)
		);
	}

	private onClientClose(ws: WebSocket): void {
		this.clients.delete(ws);
		this.clientDevices.delete(ws);
	}

	// ─── Heartbeat ─────────────────────────────────────────────────────────

	async alarm(): Promise<void> {
		const now = Date.now();
		if (this.bridges.size > 0 && now - this.lastBridgeActivity > 35000) {
			for (const ws of this.bridges) {
				try {
					ws.close(1000, "Heartbeat timeout");
				} catch {
					// ignore
				}
			}
			this.bridges.clear();
			this.broadcast({
				type: "device_online",
				device: { id: "", host: "", platform: "", bridgeVersion: "" },
				online: false,
			});
		}

		if (this.bridges.size > 0) {
			this.state.storage.setAlarm(now + 30000);
		}
	}

	// ─── Helpers ───────────────────────────────────────────────────────────

	private broadcast(msg: unknown): void {
		const text = JSON.stringify(msg);
		this.broadcastRaw(text);
	}

	private broadcastRaw(text: string): void {
		for (const ws of this.clients) {
			try {
				ws.send(text);
			} catch {
				this.clients.delete(ws);
			}
		}
	}

	private sendJson(ws: WebSocket, msg: unknown): void {
		try {
			ws.send(JSON.stringify(msg));
		} catch {
			this.bridges.delete(ws);
			this.clients.delete(ws);
		}
	}

	// ─── Token ID index management ─────────────────────────────────────────

	private async addTokenId(id: string): Promise<void> {
		const ids = await this.storage.get<string[]>(STORAGE_KEYS.tokenIds) ?? [];
		if (!ids.includes(id)) {
			ids.push(id);
			await this.storage.put(STORAGE_KEYS.tokenIds, ids);
		}
	}

	private async removeTokenId(id: string): Promise<void> {
		const ids = await this.storage.get<string[]>(STORAGE_KEYS.tokenIds) ?? [];
		const filtered = ids.filter((i) => i !== id);
		await this.storage.put(STORAGE_KEYS.tokenIds, filtered);
	}
}
