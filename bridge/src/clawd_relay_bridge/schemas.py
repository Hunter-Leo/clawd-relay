"""Pydantic message models for Clawd Relay protocol.

Semantically aligned with packages/types/src/protocol.ts.
All JSON serialization uses camelCase; Python side uses snake_case via Field(alias=...).
"""
from pydantic import BaseModel, Field
from typing import Literal

# ─── Enums (shared constants) ──────────────────────────────────────────────

AGENT_IDS = Literal[
    "claude-code",
    "codex",
    "copilot",
    "gemini-cli",
    "cursor-agent",
    "opencode",
    "pi",
    "unknown",
]

SESSION_STATES = Literal[
    "running",
    "thinking",
    "working",
    "idle",
    "error",
    "notification",
    "sleeping",
    "attention",
]

PERMISSION_STATUS = Literal[
    "pending",
    "approved",
    "denied",
    "timed_out",
]

# ─── Device & Session ──────────────────────────────────────────────────────


class DeviceInfo(BaseModel):
    model_config = {"populate_by_name": True}

    id: str
    host: str
    platform: Literal["darwin", "linux", "win32"]
    bridge_version: str = Field(alias="bridgeVersion")


class SessionInfo(BaseModel):
    model_config = {"populate_by_name": True}

    id: str
    agent_id: AGENT_IDS = Field(alias="agentId")  # type: ignore[valid-type]
    state: SESSION_STATES  # type: ignore[valid-type]
    title: str | None = None
    cwd: str | None = None
    model: str | None = None
    tool_name: str | None = Field(None, alias="toolName")
    tool_input: dict | None = Field(None, alias="toolInput")
    tool_use_id: str | None = Field(None, alias="toolUseId")
    failure_kind: str | None = Field(None, alias="failureKind")
    api_error_type: str | None = Field(None, alias="apiErrorType")
    updated_at: int = Field(alias="updatedAt")

# ─── Token ─────────────────────────────────────────────────────────────────


class TokenRecord(BaseModel):
    model_config = {"populate_by_name": True}

    id: str
    label: str = ""
    created_at: int = Field(alias="createdAt")
    expires_at: int | None = Field(None, alias="expiresAt")

# ─── Permission ────────────────────────────────────────────────────────────


class PermissionRecord(BaseModel):
    model_config = {"populate_by_name": True}

    permission_id: str = Field(alias="permissionId")
    device_id: str = Field(alias="deviceId")
    session_id: str | None = Field(None, alias="sessionId")
    prompt: str
    tool_name: str = Field(alias="toolName")
    tool_input: dict = Field(alias="toolInput")
    status: PERMISSION_STATUS  # type: ignore[valid-type]
    created_at: int = Field(alias="createdAt")
    responded_at: int | None = Field(None, alias="respondedAt")


class AlwaysAllowRule(BaseModel):
    model_config = {"populate_by_name": True}

    device_id: str = Field(alias="deviceId")
    tool_name: str = Field(alias="toolName")
    pattern: str = "*"
    created_at: int = Field(alias="createdAt")

# ─── Upstream Messages (Bridge → Worker → Client) ──────────────────────────


class SessionStateMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["session_state"] = "session_state"
    device: DeviceInfo
    session: SessionInfo


class PermissionRequestMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["permission_request"] = "permission_request"
    device: DeviceInfo
    permission_id: str = Field(alias="permissionId")
    prompt: str
    tool_name: str = Field(alias="toolName")
    tool_input: dict = Field(alias="toolInput")


class HelloMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["hello"] = "hello"
    device: DeviceInfo
    token: str


class KeepaliveMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["keepalive"] = "keepalive"

# ─── Downstream / Control Messages (Client → Worker → Bridge/DO) ───────────


class PermissionResponseMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["permission_response"] = "permission_response"
    permission_id: str = Field(alias="permissionId")
    approved: bool
    answers: dict[str, str] | None = None
    suggestion: str | None = None


class DNDChangeMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["dnd_change"] = "dnd_change"
    dnd: bool


class AlwaysAllowMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["always_allow"] = "always_allow"
    rule: AlwaysAllowRule

# ─── DO Internal Messages (DO → Bridge) ────────────────────────────────────


class NoClientsMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["no_clients"] = "no_clients"
    permission_id: str = Field(alias="permissionId")

# ─── Broadcast Messages (Worker → Client only) ─────────────────────────────


class DeviceOnlineMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["device_online"] = "device_online"
    device: DeviceInfo
    online: bool


class SyncSnapshotMsg(BaseModel):
    model_config = {"populate_by_name": True}

    type: Literal["sync_snapshot"] = "sync_snapshot"
    devices: list[DeviceInfo]
    sessions: dict[str, list[SessionInfo]]
