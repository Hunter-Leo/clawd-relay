from pydantic import BaseModel, Field
from typing import Literal


class DeviceInfo(BaseModel):
    id: str
    host: str
    platform: Literal["darwin", "linux", "win32"]
    bridge_version: str = Field(alias="bridgeVersion")


class SessionInfo(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    state: str
    title: str | None = None
    cwd: str | None = None
    model: str | None = None
    tool_name: str | None = Field(None, alias="toolName")
    tool_input: dict | None = Field(None, alias="toolInput")
    updated_at: int = Field(alias="updatedAt")


class SessionStateMsg(BaseModel):
    type: Literal["session_state"] = "session_state"
    device: DeviceInfo
    session: SessionInfo


class PermissionRequestMsg(BaseModel):
    type: Literal["permission_request"] = "permission_request"
    device: DeviceInfo
    permission_id: str = Field(alias="permissionId")
    prompt: str
    tool_name: str = Field(alias="toolName")
    tool_input: dict = Field(alias="toolInput")


class HelloMsg(BaseModel):
    type: Literal["hello"] = "hello"
    device: DeviceInfo
    token: str


class KeepaliveMsg(BaseModel):
    type: Literal["keepalive"] = "keepalive"


class PermissionResponseMsg(BaseModel):
    type: Literal["permission_response"] = "permission_response"
    permission_id: str = Field(alias="permissionId")
    approved: bool


class DNDChangeMsg(BaseModel):
    type: Literal["dnd_change"] = "dnd_change"
    dnd: bool


class AlwaysAllowRule(BaseModel):
    device_id: str = Field(alias="deviceId")
    tool_name: str = Field(alias="toolName")
    pattern: str = "*"


class AlwaysAllowMsg(BaseModel):
    type: Literal["always_allow"] = "always_allow"
    rule: AlwaysAllowRule


class NoClientsMsg(BaseModel):
    type: Literal["no_clients"] = "no_clients"
    permission_id: str = Field(alias="permissionId")


class DeviceOnlineMsg(BaseModel):
    type: Literal["device_online"] = "device_online"
    device: DeviceInfo
    online: bool


class SyncSnapshotMsg(BaseModel):
    type: Literal["sync_snapshot"] = "sync_snapshot"
    devices: list[DeviceInfo]
    sessions: dict[str, list[SessionInfo]]
