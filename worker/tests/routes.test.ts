/**
 * Tests for Hono routes (index.ts).
 *
 * Uses SELF from cloudflare:test to run the worker with proper bindings.
 */
import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("index.ts routes", () => {
	it("should return OK on GET /", async () => {
		const res = await SELF.fetch("http://fake/");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("OK");
	});

	it("should return 400 on /relay/connect without token", async () => {
		const res = await SELF.fetch(new Request("http://fake/relay/connect"));
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data).toHaveProperty("error");
	});

	it("should return 503 on /admin/token without ADMIN_SECRET", async () => {
		const res = await SELF.fetch(new Request("http://fake/admin/token", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ label: "test" }),
		}));
		expect(res.status).toBe(503);
	});

	it("should return 503 on /admin/tokens without ADMIN_SECRET", async () => {
		const res = await SELF.fetch(new Request("http://fake/admin/tokens"));
		expect(res.status).toBe(503);
	});

	it("should return 503 on /admin/token/:id without ADMIN_SECRET", async () => {
		const res = await SELF.fetch(new Request("http://fake/admin/token/test123", {
			method: "DELETE",
		}));
		expect(res.status).toBe(503);
	});

	it("should return HTML on GET /admin", async () => {
		const res = await SELF.fetch(new Request("http://fake/admin"));
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("Clawd Relay");
		expect(text).toContain("admin-secret-input");
		expect(text).toContain("createToken");
	});

	it("should return 404 on unknown routes", async () => {
		const res = await SELF.fetch(new Request("http://fake/unknown"));
		expect(res.status).toBe(404);
	});

	it("should redirect /join/:token to /?token=:token", async () => {
		const res = await SELF.fetch(new Request("http://fake/join/test123", { redirect: "manual" }));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/?token=test123");
	});

	it("should encode special chars in /join/:token redirect", async () => {
		const res = await SELF.fetch(new Request("http://fake/join/token+abc", { redirect: "manual" }));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/?token=token%2Babc");
	});
});
