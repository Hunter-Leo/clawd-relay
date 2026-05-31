/**
 * Clawd Relay — Cloudflare Worker entry point.
 *
 * Routes:
 * - GET  /relay/connect  — WebSocket upgrade, forwarded to DO
 * - POST /admin/token    — Create a new relay token
 * - GET  /admin/tokens   — List all tokens with bridge status
 * - DELETE /admin/token/:id — Revoke a token
 * - GET  /admin          — Admin console HTML
 * - GET  /               — Health check
 */
import { Hono } from "hono";
import type { Env } from "./types";
import { RelayRoom } from "./durable-object";

const app = new Hono<{ Bindings: Env }>();

// ─── Admin secret guard ────────────────────────────────────────────────────

function guardAdmin(c: { env: Env; req: { header: (name: string) => string | undefined } }): boolean {
	const auth = c.req.header("Authorization");
	if (!auth) return false;
	const secret = c.env.ADMIN_SECRET;
	if (!secret) return false;
	return auth === `Bearer ${secret}`;
}

// ─── Registry DO helper ────────────────────────────────────────────────────

function getRegistry(c: { env: Env }): DurableObjectStub {
	return c.env.RELAY_ROOM.get(c.env.RELAY_ROOM.idFromName("__relay_registry__"));
}

// ─── Health check ──────────────────────────────────────────────────────────

app.get("/", (c) => c.text("Clawd Relay Worker — OK"));

// ─── WebSocket upgrade ─────────────────────────────────────────────────────

app.get("/relay/connect", async (c) => {
	const token = c.req.query("token");
	if (!token) {
		return c.json({ error: "Missing token parameter" }, 400);
	}

	const roomId = token;
	const stub = c.env.RELAY_ROOM.idFromName(roomId);
	const room = c.env.RELAY_ROOM.get(stub);

	return room.fetch(new Request(new URL("/ws", c.req.url), {
		method: "GET",
		headers: c.req.raw.headers,
	}));
});

// ─── Admin: create token ───────────────────────────────────────────────────

app.post("/admin/token", async (c) => {
	if (!guardAdmin(c)) {
		if (!c.env.ADMIN_SECRET) {
			c.status(503);
			return c.json({ error: "ADMIN_SECRET not configured" });
		}
		c.status(403);
		return c.json({ error: "Forbidden" });
	}

	const body = await c.req.json<{ label?: string; expiresInDays?: number }>();
	const label = body.label ?? "";
	const expiresInDays = body.expiresInDays;

	const tokenBytes = new Uint8Array(16);
	crypto.getRandomValues(tokenBytes);
	const tokenId = Array.from(tokenBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	const record = {
		id: tokenId,
		label,
		createdAt: Date.now(),
		...(expiresInDays ? { expiresAt: Date.now() + expiresInDays * 86400000 } : {}),
	};

	const stub = c.env.RELAY_ROOM.get(c.env.RELAY_ROOM.idFromName(tokenId));
	await stub.fetch("http://fake/admin/register", {
		method: "POST",
		body: JSON.stringify(record),
	});

	// Register token ID in the global registry
	const registry = getRegistry(c);
	await registry.fetch("http://fake/registry/add", {
		method: "POST",
		body: JSON.stringify({ id: tokenId }),
	});

	return c.json({ token: tokenId, createdAt: record.createdAt });
});

// ─── Admin: list tokens ────────────────────────────────────────────────────

app.get("/admin/tokens", async (c) => {
	if (!guardAdmin(c)) {
		if (!c.env.ADMIN_SECRET) {
			c.status(503);
			return c.json({ error: "ADMIN_SECRET not configured" });
		}
		c.status(403);
		return c.json({ error: "Forbidden" });
	}

	const registry = getRegistry(c);
	const listRes = await registry.fetch("http://fake/registry/list");
	const { tokenIds } = await listRes.json() as { tokenIds: string[] };

	const tokens: Array<Record<string, unknown>> = [];
	const bridgeStatus: Record<string, boolean> = {};

	for (const id of tokenIds) {
		const stub = c.env.RELAY_ROOM.get(c.env.RELAY_ROOM.idFromName(id));
		try {
			const [tokenRes, statusRes] = await Promise.all([
				stub.fetch("http://fake/admin/token/" + id),
				stub.fetch("http://fake/admin/status"),
			]);
			if (tokenRes.ok) {
				const record = await tokenRes.json() as Record<string, unknown>;
				if (!record.revoked) {
					tokens.push(record);
				}
				const status = await statusRes.json() as { online: boolean };
				bridgeStatus[id] = status.online;
			}
		} catch {
			// Skip tokens that fail to respond
		}
	}

	return c.json({ tokens, bridgeStatus });
});

// ─── Admin: revoke token ───────────────────────────────────────────────────

app.delete("/admin/token/:id", async (c) => {
	if (!guardAdmin(c)) {
		if (!c.env.ADMIN_SECRET) {
			c.status(503);
			return c.json({ error: "ADMIN_SECRET not configured" });
		}
		c.status(403);
		return c.json({ error: "Forbidden" });
	}

	const tokenId = c.req.param("id");
	const stub = c.env.RELAY_ROOM.get(c.env.RELAY_ROOM.idFromName(tokenId));
	await stub.fetch(`http://fake/admin/token/${tokenId}`, { method: "DELETE" });

	return c.json({ ok: true });
});

// ─── Admin: console page ───────────────────────────────────────────────────

app.get("/admin", async (c) => {
	const { renderAdminConsole } = await import("./admin-console");
	return c.html(renderAdminConsole());
});

// ─── Re-export DO class ────────────────────────────────────────────────────

export { RelayRoom };
export default app;
