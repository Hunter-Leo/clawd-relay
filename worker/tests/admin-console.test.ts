/**
 * Tests for admin-console.ts HTML generation.
 */
import { describe, it, expect } from "vitest";

describe("admin-console HTML", () => {
	it("should render valid HTML with required elements", async () => {
		const { renderAdminConsole } = await import("../src/admin-console.js");
		const html = renderAdminConsole();
		expect(html).toContain("Clawd Relay");
		expect(html).toContain("admin-secret-input");
		expect(html).toContain("createToken");
		expect(html).toContain("revokeToken");
		expect(html).toContain("login");
	});

	it("should include login form", async () => {
		const { renderAdminConsole } = await import("../src/admin-console.js");
		const html = renderAdminConsole();
		expect(html).toContain("ADMIN_SECRET");
		expect(html).toContain('type="password"');
	});

	it("should include token management elements", async () => {
		const { renderAdminConsole } = await import("../src/admin-console.js");
		const html = renderAdminConsole();
		expect(html).toContain("Create Token");
		expect(html).toContain("Tokens");
		expect(html).toContain("Revoke");
	});

	it("should include overview stats", async () => {
		const { renderAdminConsole } = await import("../src/admin-console.js");
		const html = renderAdminConsole();
		expect(html).toContain("overview");
	});

	it("should have no external dependencies", async () => {
		const { renderAdminConsole } = await import("../src/admin-console.js");
		const html = renderAdminConsole();
		// No script src= or link href= referencing external URLs
		expect(html).not.toContain("src=\"http");
		expect(html).not.toContain("src=\"//");
		expect(html).not.toContain("href=\"http");
		expect(html).not.toContain("href=\"//");
	});
});
