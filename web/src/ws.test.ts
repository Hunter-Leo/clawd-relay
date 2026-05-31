import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

describe("WebSocketManager", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", vi.fn(() => ({
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    // Reset module state
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should parse tokens from URL", async () => {
    vi.stubGlobal("window", {
      location: {
        search: "?token=abc123&token=def456",
        origin: "http://localhost:5173",
      },
      matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    } as any);

    const mod = await import("./ws");
    const ws = mod.getWSManager();
    expect(ws.tokens).toHaveLength(2);
  });

  it("should return disconnected status with no tokens", async () => {
    vi.stubGlobal("window", {
      location: { search: "", origin: "http://localhost:5173" },
      matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    } as any);

    const mod2 = await import("./ws");
    const ws = mod2.getWSManager();
    expect(ws.getStatus()).toBe("disconnected");
  });
});
