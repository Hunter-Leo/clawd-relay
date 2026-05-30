import { describe, it, expect } from "vitest";
import type {
  DeviceInfo,
  SessionInfo,
  SessionStateMsg,
  PermissionRequestMsg,
  PermissionResponseMsg,
  HelloMsg,
  KeepaliveMsg,
  DeviceOnlineMsg,
  SyncSnapshotMsg,
  UpstreamMsg,
  DownstreamMsg,
  BroadcastMsg,
  WorkerMsg,
} from "../src/protocol";
import { AGENT_META } from "../src/protocol";

describe("DeviceInfo", () => {
  it("constructs valid device info", () => {
    const device: DeviceInfo = {
      id: "dev-001",
      host: "my-macbook",
      platform: "darwin",
      bridgeVersion: "0.1.0",
    };
    expect(device.id).toBe("dev-001");
    expect(device.host).toBe("my-macbook");
    expect(device.platform).toBe("darwin");
    expect(device.bridgeVersion).toBe("0.1.0");
  });
});

describe("SessionInfo", () => {
  it("constructs with all fields", () => {
    const session: SessionInfo = {
      id: "sess-001",
      agentId: "claude-code",
      state: "running",
      title: "Code review",
      cwd: "/home/user/project",
      model: "claude-sonnet-4-6",
      toolName: "Read",
      toolInput: { path: "src/main.ts" },
      updatedAt: 1717000000000,
    };
    expect(session.agentId).toBe("claude-code");
    expect(session.state).toBe("running");
  });

  it("allows null optional fields", () => {
    const session: SessionInfo = {
      id: "sess-002",
      agentId: "codex",
      state: "idle",
      title: null,
      cwd: null,
      model: null,
      toolName: null,
      toolInput: null,
      updatedAt: 1717000000000,
    };
    expect(session.title).toBeNull();
    expect(session.toolName).toBeNull();
  });
});

describe("SessionStateMsg", () => {
  it("constructs with device and session", () => {
    const msg: SessionStateMsg = {
      type: "session_state",
      device: {
        id: "dev-001",
        host: "my-macbook",
        platform: "darwin",
        bridgeVersion: "0.1.0",
      },
      session: {
        id: "sess-001",
        agentId: "claude-code",
        state: "running",
        title: null,
        cwd: "/project",
        model: "claude-sonnet-4-6",
        toolName: null,
        toolInput: null,
        updatedAt: 1717000000000,
      },
    };
    expect(msg.type).toBe("session_state");
    expect(msg.device.id).toBe("dev-001");
    expect(msg.session.state).toBe("running");
  });
});

describe("PermissionRequestMsg", () => {
  it("constructs with permission data", () => {
    const msg: PermissionRequestMsg = {
      type: "permission_request",
      device: {
        id: "dev-001",
        host: "my-macbook",
        platform: "darwin",
        bridgeVersion: "0.1.0",
      },
      permissionId: "perm-001",
      prompt: "Allow running shell command: rm -rf /tmp/test",
      toolName: "Bash",
      toolInput: { command: "rm -rf /tmp/test" },
    };
    expect(msg.permissionId).toBe("perm-001");
    expect(msg.prompt).toContain("rm -rf");
  });
});

describe("PermissionResponseMsg", () => {
  it("constructs with approval", () => {
    const msg: PermissionResponseMsg = {
      type: "permission_response",
      permissionId: "perm-001",
      approved: true,
    };
    expect(msg.approved).toBe(true);
    expect(msg.permissionId).toBe("perm-001");
  });

  it("constructs with denial", () => {
    const msg: PermissionResponseMsg = {
      type: "permission_response",
      permissionId: "perm-002",
      approved: false,
    };
    expect(msg.approved).toBe(false);
  });
});

describe("HelloMsg", () => {
  it("constructs with device and token", () => {
    const msg: HelloMsg = {
      type: "hello",
      device: {
        id: "dev-001",
        host: "my-macbook",
        platform: "darwin",
        bridgeVersion: "0.1.0",
      },
      token: "abc123def456",
    };
    expect(msg.type).toBe("hello");
    expect(msg.token).toBe("abc123def456");
  });
});

describe("KeepaliveMsg", () => {
  it("constructs with just type", () => {
    const msg: KeepaliveMsg = { type: "keepalive" };
    expect(msg.type).toBe("keepalive");
  });
});

describe("DeviceOnlineMsg", () => {
  it("constructs for online event", () => {
    const msg: DeviceOnlineMsg = {
      type: "device_online",
      device: {
        id: "dev-001",
        host: "my-macbook",
        platform: "darwin",
        bridgeVersion: "0.1.0",
      },
      online: true,
    };
    expect(msg.online).toBe(true);
  });

  it("constructs for offline event", () => {
    const msg: DeviceOnlineMsg = {
      type: "device_online",
      device: {
        id: "dev-001",
        host: "my-macbook",
        platform: "darwin",
        bridgeVersion: "0.1.0",
      },
      online: false,
    };
    expect(msg.online).toBe(false);
  });
});

describe("SyncSnapshotMsg", () => {
  it("constructs with devices and sessions map", () => {
    const msg: SyncSnapshotMsg = {
      type: "sync_snapshot",
      devices: [
        {
          id: "dev-001",
          host: "my-macbook",
          platform: "darwin",
          bridgeVersion: "0.1.0",
        },
      ],
      sessions: {
        "dev-001": [
          {
            id: "sess-001",
            agentId: "claude-code",
            state: "running",
            title: null,
            cwd: null,
            model: null,
            toolName: null,
            toolInput: null,
            updatedAt: 1717000000000,
          },
        ],
      },
    };
    expect(msg.devices).toHaveLength(1);
    expect(msg.sessions["dev-001"]).toHaveLength(1);
    expect(msg.sessions["dev-001"]![0].state).toBe("running");
  });
});

describe("Union types", () => {
  it("UpstreamMsg accepts all upstream types", () => {
    const messages: UpstreamMsg[] = [
      {
        type: "session_state",
        device: {
          id: "dev-001",
          host: "my-macbook",
          platform: "darwin",
          bridgeVersion: "0.1.0",
        },
        session: {
          id: "sess-001",
          agentId: "claude-code",
          state: "running",
          title: null,
          cwd: null,
          model: null,
          toolName: null,
          toolInput: null,
          updatedAt: 1717000000000,
        },
      } as SessionStateMsg,
      {
        type: "permission_request",
        device: {
          id: "dev-001",
          host: "my-macbook",
          platform: "darwin",
          bridgeVersion: "0.1.0",
        },
        permissionId: "perm-001",
        prompt: "test",
        toolName: "Bash",
        toolInput: {},
      } as PermissionRequestMsg,
      {
        type: "hello",
        device: {
          id: "dev-001",
          host: "my-macbook",
          platform: "darwin",
          bridgeVersion: "0.1.0",
        },
        token: "token-123",
      } as HelloMsg,
      { type: "keepalive" } as KeepaliveMsg,
    ];
    expect(messages).toHaveLength(4);
  });

  it("DownstreamMsg accepts all downstream types", () => {
    const messages: DownstreamMsg[] = [
      {
        type: "permission_response",
        permissionId: "perm-001",
        approved: true,
      } as PermissionResponseMsg,
      { type: "dnd_change", dnd: true } as DownstreamMsg,
      {
        type: "always_allow",
        rule: {
          deviceId: "dev-001",
          toolName: "Bash",
          pattern: "*",
        },
      } as DownstreamMsg,
    ];
    expect(messages).toHaveLength(3);
  });
});

describe("AGENT_META", () => {
  it("covers all known agents", () => {
    const agents = Object.keys(AGENT_META);
    expect(agents).toContain("claude-code");
    expect(agents).toContain("codex");
    expect(agents).toContain("copilot");
    expect(agents).toContain("gemini-cli");
    expect(agents).toContain("cursor");
    expect(agents).toContain("opencode");
  });

  it("every agent has label, color, and icon", () => {
    for (const [id, meta] of Object.entries(AGENT_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(meta.icon).toBeTruthy();
    }
  });

  it("claude-code has purple color", () => {
    expect(AGENT_META["claude-code"].color).toBe("#8B5CF6");
  });
});
