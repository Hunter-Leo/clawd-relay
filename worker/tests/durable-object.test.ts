/**
 * Tests for RingBuffer and RelayRoom Durable Object.
 */
import { describe, it, expect, assert } from "vitest";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { RingBuffer } from "../src/durable-object.js";
import type { TokenRecord } from "../src/types.js";

// ─── RingBuffer tests (pure logic) ─────────────────────────────────────────

describe("RingBuffer", () => {
	it("should store and flush items up to capacity", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		expect(buf.flush()).toEqual([1, 2, 3]);
	});

	it("should wrap around when exceeding capacity", () => {
		const buf = new RingBuffer<number>(3);
		buf.push(1);
		buf.push(2);
		buf.push(3);
		buf.push(4);
		buf.push(5);
		expect(buf.flush()).toEqual([3, 4, 5]);
	});

	it("should return empty array when empty", () => {
		const buf = new RingBuffer<number>(3);
		expect(buf.flush()).toEqual([]);
	});

	it("should handle capacity of 1", () => {
		const buf = new RingBuffer<number>(1);
		buf.push(1);
		buf.push(2);
		expect(buf.flush()).toEqual([2]);
	});
});

// ─── RelayRoom Admin API tests ─────────────────────────────────────────────

describe("RelayRoom Admin API", () => {
	it("should register and retrieve a token", async () => {
		const ns: DurableObjectNamespace = env.RELAY_ROOM;
		const id = ns.newUniqueId();
		const stub = ns.get(id);

		const registerRes = await stub.fetch("http://fake/admin/register", {
			method: "POST",
			body: JSON.stringify({ id: "test-token", label: "test", createdAt: 1000 }),
		});
		expect(registerRes.status).toBe(200);

		const getRes = await stub.fetch("http://fake/admin/token/test-token");
		expect(getRes.status).toBe(200);
		const record = await getRes.json();
		expect(record).toMatchObject({ id: "test-token", label: "test" });
	});

	it("should return 404 for unknown token", async () => {
		const ns: DurableObjectNamespace = env.RELAY_ROOM;
		const stub = ns.get(ns.newUniqueId());

		const res = await stub.fetch("http://fake/admin/token/nonexistent");
		expect(res.status).toBe(404);
	});

	it("should revoke a token", async () => {
		const ns: DurableObjectNamespace = env.RELAY_ROOM;
		const stub = ns.get(ns.newUniqueId());

		await stub.fetch("http://fake/admin/register", {
			method: "POST",
			body: JSON.stringify({ id: "revoke-me", label: "revoke", createdAt: 1000 }),
		});

		const revokeRes = await stub.fetch("http://fake/admin/token/revoke-me", { method: "DELETE" });
		expect(revokeRes.status).toBe(200);

		const record: TokenRecord = await (
			await stub.fetch("http://fake/admin/token/revoke-me")
		).json();
		expect(record.revoked).toBe(true);
	});

	it("should return bridge status", async () => {
		const ns: DurableObjectNamespace = env.RELAY_ROOM;
		const stub = ns.get(ns.newUniqueId());

		const res = await stub.fetch("http://fake/admin/status");
		expect(res.status).toBe(200);
		const status = await res.json();
		expect(status).toHaveProperty("online");
		expect(status).toHaveProperty("clientCount");
	});
});
