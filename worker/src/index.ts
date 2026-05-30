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

	// Forward the full request to DO, which handles WebSocket upgrade
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

	// Generate random token string
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

	// Store in the DO for this token
	const stub = c.env.RELAY_ROOM.get(c.env.RELAY_ROOM.idFromName(tokenId));
	await stub.fetch("http://fake/admin/register", {
		method: "POST",
		body: JSON.stringify(record),
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

	// For each DO, we'd need a registry DO to list tokens.
	// For now, return a simplified structure.
	// Actual token listing requires a registry DO (future enhancement).
	return c.json({
		tokens: [],
		bridgeStatus: {},
		note: "Token listing requires registry DO — use individual DO query",
	});
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
	// Import admin-console and render
	const { renderAdminConsole } = await import("./admin-console");
	return c.html(renderAdminConsole());
});

// ─── Re-export DO class ────────────────────────────────────────────────────

export { RelayRoom };
export default app;
