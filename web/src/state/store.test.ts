import { describe, it, expect } from "vitest";
import { appReducer, initialState } from "./store";
import type { DeviceInfo, SessionInfo } from "@clawd-relay/types";

const mockDevice: DeviceInfo = {
  id: "dev-1",
  host: "my-mac",
  platform: "darwin",
  bridgeVersion: "0.1.0",
};

const mockSession: SessionInfo = {
  id: "sess-1",
  agentId: "claude-code",
  state: "working",
  title: "Building project",
  cwd: "/Users/me/project",
  model: "claude-sonnet-4-6",
  toolName: "Bash",
  toolInput: { command: "npm run build" },
  updatedAt: Date.now(),
};

describe("appReducer", () => {
  it("should handle SESSION_UPDATE", () => {
    const state = appReducer(initialState, {
      type: "SESSION_UPDATE",
      device: mockDevice,
      session: mockSession,
    });
    const device = state.devices.get("dev-1");
    expect(device).toBeDefined();
    expect(device!.online).toBe(true);
    expect(device!.sessions).toHaveLength(1);
    expect(device!.sessions[0].id).toBe("sess-1");
  });

  it("should update existing session", () => {
    const withSession = appReducer(initialState, {
      type: "SESSION_UPDATE",
      device: mockDevice,
      session: mockSession,
    });
    const updated = appReducer(withSession, {
      type: "SESSION_UPDATE",
      device: mockDevice,
      session: { ...mockSession, state: "idle" },
    });
    const device = updated.devices.get("dev-1")!;
    expect(device.sessions).toHaveLength(1);
    expect(device.sessions[0].state).toBe("idle");
  });

  it("should handle DEVICE_ONLINE", () => {
    const state = appReducer(initialState, {
      type: "DEVICE_ONLINE",
      device: mockDevice,
      online: true,
    });
    const device = state.devices.get("dev-1")!;
    expect(device.online).toBe(true);
    expect(device.sessions).toEqual([]);
  });

  it("should handle DEVICE_ONLINE offline", () => {
    const withDevice = appReducer(initialState, {
      type: "DEVICE_ONLINE",
      device: mockDevice,
      online: true,
    });
    const state = appReducer(withDevice, {
      type: "DEVICE_ONLINE",
      device: mockDevice,
      online: false,
    });
    expect(state.devices.get("dev-1")!.online).toBe(false);
  });

  it("should handle SYNC_SNAPSHOT", () => {
    const devices = [mockDevice];
    const sessions: Record<string, SessionInfo[]> = {
      "dev-1": [mockSession],
    };
    const state = appReducer(initialState, {
      type: "SYNC_SNAPSHOT",
      devices,
      sessions,
    });
    expect(state.devices.size).toBe(1);
    expect(state.devices.get("dev-1")!.sessions).toHaveLength(1);
  });

  it("should handle PERMISSION_REQUEST", () => {
    const req = {
      type: "permission_request" as const,
      device: mockDevice,
      permissionId: "perm-1",
      prompt: "Allow this?",
      toolName: "Bash",
      toolInput: { command: "rm -rf /" },
    };
    const state = appReducer(initialState, { type: "PERMISSION_REQUEST", request: req });
    expect(state.permissions).toHaveLength(1);
    expect(state.permissions[0].permissionId).toBe("perm-1");
  });

  it("should deduplicate PERMISSION_REQUEST", () => {
    const req = {
      type: "permission_request" as const,
      device: mockDevice,
      permissionId: "perm-1",
      prompt: "Allow this?",
      toolName: "Bash",
      toolInput: { command: "rm" },
    };
    const s1 = appReducer(initialState, { type: "PERMISSION_REQUEST", request: req });
    const s2 = appReducer(s1, { type: "PERMISSION_REQUEST", request: req });
    expect(s2.permissions).toHaveLength(1);
  });

  it("should handle CLEAR_PERMISSION", () => {
    const req = {
      type: "permission_request" as const,
      device: mockDevice,
      permissionId: "perm-1",
      prompt: "Allow this?",
      toolName: "Bash",
      toolInput: {},
    };
    const s1 = appReducer(initialState, { type: "PERMISSION_REQUEST", request: req });
    const s2 = appReducer(s1, { type: "CLEAR_PERMISSION", permissionId: "perm-1" });
    expect(s2.permissions).toHaveLength(0);
  });

  it("should handle CONNECTION_STATUS", () => {
    const state = appReducer(initialState, {
      type: "CONNECTION_STATUS",
      status: "connected",
    });
    expect(state.connectionStatus).toBe("connected");
  });

  it("should handle SETTINGS_UPDATE", () => {
    const state = appReducer(initialState, {
      type: "SETTINGS_UPDATE",
      settings: { dnd: true, language: "zh-CN" },
    });
    expect(state.settings.dnd).toBe(true);
    expect(state.settings.language).toBe("zh-CN");
  });

  it("should handle DND_CHANGE", () => {
    const state = appReducer(initialState, { type: "DND_CHANGE", dnd: true });
    expect(state.settings.dnd).toBe(true);
  });
});
