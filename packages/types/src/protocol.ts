// ---------------------------------------------------------------------------
// Clawd Relay — Shared Message Protocol
// TypeScript type definitions (semantically aligned with bridge/schemas.py)
// ---------------------------------------------------------------------------

// ─── Device & Session Info ────────────────────────────────────────────────

export interface DeviceInfo {
  id: string;
  host: string;
  platform: "darwin" | "linux" | "win32";
  bridgeVersion: string;
}

export interface SessionInfo {
  id: string;
  agentId: string;
  state: string;
  title: string | null;
  cwd: string | null;
  model: string | null;
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  toolUseId?: string;
  failureKind?: string;
  apiErrorType?: string;
  updatedAt: number; // epoch ms
}

// ─── Upstream Messages (Bridge → Worker → Client) ─────────────────────────

export interface SessionStateMsg {
  type: "session_state";
  device: DeviceInfo;
  session: SessionInfo;
}

export interface PermissionRequestMsg {
  type: "permission_request";
  device: DeviceInfo;
  permissionId: string;
  prompt: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface HelloMsg {
  type: "hello";
  device: DeviceInfo;
  token: string;
}

export interface KeepaliveMsg {
  type: "keepalive";
}

// ─── Downstream Messages (Client → Worker → Bridge) ───────────────────────

export interface PermissionResponseMsg {
  type: "permission_response";
  permissionId: string;
  approved: boolean;
  /** Elicitation answers (keyed by question text). */
  answers?: Record<string, string>;
  /** Selected suggestion index. */
  suggestion?: string;
}

export interface DNDChangeMsg {
  type: "dnd_change";
  dnd: boolean;
}

export interface AlwaysAllowMsg {
  type: "always_allow";
  rule: AlwaysAllowRule;
}

/** A persisted always-allow rule. */
export interface AlwaysAllowRule {
  deviceId: string;
  toolName: string;
  pattern?: string; // tool_input 匹配模式，默认 "*" 通配
  createdAt: number; // epoch ms
}

// ─── DO Internal Messages (DO → Bridge, not broadcast) ────────────────────

export interface NoClientsMsg {
  type: "no_clients";
  permissionId: string;
}

// ─── Broadcast Messages (Worker → Client only) ────────────────────────────

export interface DeviceOnlineMsg {
  type: "device_online";
  device: DeviceInfo;
  online: boolean;
}

export interface SyncSnapshotMsg {
  type: "sync_snapshot";
  devices: DeviceInfo[];
  sessions: Record<string, SessionInfo[]>; // device_id → sessions
}

// ─── Union Type ───────────────────────────────────────────────────────────

export type UpstreamMsg =
  | SessionStateMsg
  | PermissionRequestMsg
  | HelloMsg
  | KeepaliveMsg;

export type DownstreamMsg =
  | PermissionResponseMsg
  | DNDChangeMsg
  | AlwaysAllowMsg;

export type BroadcastMsg =
  | SessionStateMsg
  | PermissionRequestMsg
  | DeviceOnlineMsg
  | SyncSnapshotMsg;

export type WorkerMsg = DownstreamMsg | BroadcastMsg;

// ─── Agent Display Metadata ────────────────────────────────────────────────

export const AGENT_META: Record<string, { label: string; color: string; icon: string }> = {
  "claude-code": { label: "Claude Code", color: "#8B5CF6", icon: "🤖" },
  "codex":       { label: "Codex CLI",  color: "#3B82F6", icon: "⌨️" },
  "copilot":     { label: "Copilot CLI", color: "#22C55E", icon: "🦾" },
  "gemini-cli":  { label: "Gemini CLI", color: "#F59E0B", icon: "🌙" },
  "cursor":      { label: "Cursor",     color: "#06B6D4", icon: "🖱️" },
  "opencode":    { label: "opencode",   color: "#A855F7", icon: "🔓" },
} as const;
