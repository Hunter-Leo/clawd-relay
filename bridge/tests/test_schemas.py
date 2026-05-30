"""Tests for Pydantic message models (schemas.py)."""
import json
import pytest
from pydantic import ValidationError
from clawd_relay_bridge.schemas import (
    DeviceInfo,
    SessionInfo,
    SessionStateMsg,
    PermissionRequestMsg,
    PermissionResponseMsg,
    HelloMsg,
    KeepaliveMsg,
    DNDChangeMsg,
    AlwaysAllowMsg,
    AlwaysAllowRule,
    NoClientsMsg,
    DeviceOnlineMsg,
    SyncSnapshotMsg,
    TokenRecord,
    PermissionRecord,
)


def make_device() -> DeviceInfo:
    return DeviceInfo(id="dev-001", host="my-macbook", platform="darwin", bridgeVersion="0.1.0")


def make_session() -> SessionInfo:
    return SessionInfo(
        id="sess-001",
        agentId="claude-code",
        state="running",
        title="Code review",
        cwd="/home/user/project",
        model="claude-sonnet-4-6",
        toolName="Read",
        toolInput={"path": "src/main.ts"},
        updatedAt=1717000000000,
    )


class TestDeviceInfo:
    def test_construct(self):
        d = DeviceInfo(id="dev-001", host="my-macbook", platform="darwin", bridgeVersion="0.1.0")
        assert d.id == "dev-001"
        assert d.bridge_version == "0.1.0"

    def test_serialize_camelcase(self):
        d = make_device()
        raw = d.model_dump_json(by_alias=True)
        data = json.loads(raw)
        assert data["bridgeVersion"] == "0.1.0"
        assert "bridge_version" not in data

    def test_deserialize_camelcase(self):
        raw = '{"id":"dev-001","host":"my-macbook","platform":"darwin","bridgeVersion":"0.1.0"}'
        d = DeviceInfo.model_validate_json(raw)
        assert d.id == "dev-001"
        assert d.bridge_version == "0.1.0"

    def test_invalid_platform(self):
        with pytest.raises(ValidationError):
            DeviceInfo(id="dev-001", host="my-macbook", platform="windows", bridgeVersion="0.1.0")

    def test_missing_id(self):
        with pytest.raises(ValidationError):
            DeviceInfo(host="my-macbook", platform="darwin", bridgeVersion="0.1.0")


class TestSessionInfo:
    def test_construct_all_fields(self):
        s = make_session()
        assert s.state == "running"
        assert s.tool_name == "Read"
        assert s.updated_at == 1717000000000

    def test_null_optionals(self):
        s = SessionInfo(
            id="sess-002", agentId="codex", state="idle", title=None, cwd=None,
            model=None, toolName=None, toolInput=None, updatedAt=1717000000000,
        )
        assert s.title is None
        assert s.tool_name is None

    def test_serialize_camelcase(self):
        s = make_session()
        raw = s.model_dump_json(by_alias=True)
        data = json.loads(raw)
        assert data["agentId"] == "claude-code"
        assert data["toolName"] == "Read"

    def test_deserialize_camelcase(self):
        raw = '{"id":"sess-001","agentId":"claude-code","state":"running","title":null,"cwd":null,"model":null,"toolName":null,"toolInput":null,"updatedAt":1717000000000}'
        s = SessionInfo.model_validate_json(raw)
        assert s.agent_id == "claude-code"

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            SessionInfo(id="sess-001", state="idle")


class TestTokenRecord:
    def test_construct(self):
        t = TokenRecord(id="abc123...", label="my device", createdAt=1717000000000)
        assert t.id == "abc123..."
        assert t.label == "my device"

    def test_default_label(self):
        t = TokenRecord(id="tok-001", createdAt=1717000000000)
        assert t.label == ""

    def test_optional_expires(self):
        t = TokenRecord(id="tok-001", createdAt=1717000000000, expiresAt=1718000000000)
        assert t.expires_at == 1718000000000

    def test_roundtrip(self):
        t = TokenRecord(id="tok-001", createdAt=1717000000000)
        raw = t.model_dump_json(by_alias=True)
        data = json.loads(raw)
        assert data["createdAt"] == 1717000000000


class TestPermissionRecord:
    def test_construct_pending(self):
        p = PermissionRecord(
            permissionId="perm-001", deviceId="dev-001", prompt="Allow?",
            toolName="Bash", toolInput={"cmd": "ls"}, status="pending",
            createdAt=1717000000000,
        )
        assert p.permission_id == "perm-001"
        assert p.status == "pending"

    def test_with_session(self):
        p = PermissionRecord(
            permissionId="perm-001", deviceId="dev-001", sessionId="sess-001",
            prompt="Allow?", toolName="Bash", toolInput={}, status="pending",
            createdAt=1717000000000,
        )
        assert p.session_id == "sess-001"

    def test_responded(self):
        p = PermissionRecord(
            permissionId="perm-001", deviceId="dev-001", prompt="Allow?",
            toolName="Bash", toolInput={}, status="approved",
            createdAt=1717000000000, respondedAt=1717000060000,
        )
        assert p.responded_at == 1717000060000

    def test_roundtrip(self):
        p = PermissionRecord(
            permissionId="perm-001", deviceId="dev-001", prompt="Allow?",
            toolName="Bash", toolInput={}, status="pending",
            createdAt=1717000000000,
        )
        raw = p.model_dump_json(by_alias=True)
        data = json.loads(raw)
        assert data["permissionId"] == "perm-001"


class TestAlwaysAllowRule:
    def test_default_pattern(self):
        r = AlwaysAllowRule(deviceId="dev-001", toolName="Read", createdAt=1717000000000)
        assert r.pattern == "*"

    def test_serialize(self):
        r = AlwaysAllowRule(deviceId="dev-001", toolName="Bash", createdAt=1717000000000)
        raw = r.model_dump_json(by_alias=True)
        data = json.loads(raw)
        assert data["deviceId"] == "dev-001"
        assert data["createdAt"] == 1717000000000


class TestSessionStateMsg:
    def test_construct(self):
        msg = SessionStateMsg(type="session_state", device=make_device(), session=make_session())
        assert msg.type == "session_state"
        assert msg.device.id == "dev-001"
        assert msg.session.state == "running"

    def test_roundtrip(self):
        msg = SessionStateMsg(type="session_state", device=make_device(), session=make_session())
        raw = msg.model_dump_json(by_alias=True)
        restored = SessionStateMsg.model_validate_json(raw)
        assert restored.device.id == "dev-001"


class TestPermissionRequestMsg:
    def test_construct(self):
        msg = PermissionRequestMsg(
            type="permission_request", device=make_device(), permissionId="perm-001",
            prompt="Allow?", toolName="Bash", toolInput={"cmd": "ls"},
        )
        assert msg.permission_id == "perm-001"

    def test_roundtrip(self):
        msg = PermissionRequestMsg(
            type="permission_request", device=make_device(), permissionId="perm-001",
            prompt="Allow?", toolName="Bash", toolInput={},
        )
        raw = msg.model_dump_json(by_alias=True)
        assert json.loads(raw)["permissionId"] == "perm-001"


class TestPermissionResponseMsg:
    def test_approve(self):
        msg = PermissionResponseMsg(type="permission_response", permissionId="perm-001", approved=True)
        assert msg.approved is True

    def test_deny(self):
        msg = PermissionResponseMsg(type="permission_response", permissionId="perm-001", approved=False)
        assert msg.approved is False

    def test_roundtrip(self):
        raw = PermissionResponseMsg(type="permission_response", permissionId="perm-001", approved=True).model_dump_json(by_alias=True)
        assert json.loads(raw)["approved"] is True


class TestHelloMsg:
    def test_construct(self):
        msg = HelloMsg(type="hello", device=make_device(), token="abc123")
        assert msg.token == "abc123"

    def test_roundtrip(self):
        raw = HelloMsg(type="hello", device=make_device(), token="abc123").model_dump_json(by_alias=True)
        assert json.loads(raw)["token"] == "abc123"


class TestKeepaliveMsg:
    def test_construct(self):
        msg = KeepaliveMsg(type="keepalive")
        assert msg.type == "keepalive"

    def test_roundtrip(self):
        assert json.loads(KeepaliveMsg(type="keepalive").model_dump_json(by_alias=True))["type"] == "keepalive"


class TestDNDChangeMsg:
    def test_on(self):
        msg = DNDChangeMsg(type="dnd_change", dnd=True)
        assert msg.dnd is True

    def test_off(self):
        msg = DNDChangeMsg(type="dnd_change", dnd=False)
        assert msg.dnd is False

    def test_roundtrip(self):
        raw = DNDChangeMsg(type="dnd_change", dnd=False).model_dump_json(by_alias=True)
        assert json.loads(raw)["dnd"] is False


class TestAlwaysAllowMsg:
    def test_construct(self):
        rule = AlwaysAllowRule(deviceId="dev-001", toolName="Bash", createdAt=1717000000000)
        msg = AlwaysAllowMsg(type="always_allow", rule=rule)
        assert msg.rule.device_id == "dev-001"

    def test_roundtrip(self):
        msg = AlwaysAllowMsg(
            type="always_allow",
            rule=AlwaysAllowRule(deviceId="dev-001", toolName="Bash", createdAt=1717000000000),
        )
        data = json.loads(msg.model_dump_json(by_alias=True))
        assert data["rule"]["deviceId"] == "dev-001"


class TestNoClientsMsg:
    def test_construct(self):
        msg = NoClientsMsg(type="no_clients", permissionId="perm-001")
        assert msg.permission_id == "perm-001"

    def test_roundtrip(self):
        data = json.loads(NoClientsMsg(type="no_clients", permissionId="perm-001").model_dump_json(by_alias=True))
        assert data["permissionId"] == "perm-001"


class TestDeviceOnlineMsg:
    def test_online(self):
        msg = DeviceOnlineMsg(type="device_online", device=make_device(), online=True)
        assert msg.online is True

    def test_offline(self):
        msg = DeviceOnlineMsg(type="device_online", device=make_device(), online=False)
        assert msg.online is False

    def test_roundtrip(self):
        raw = DeviceOnlineMsg(type="device_online", device=make_device(), online=True).model_dump_json(by_alias=True)
        data = json.loads(raw)
        assert data["online"] is True
        assert data["device"]["bridgeVersion"] == "0.1.0"


class TestSyncSnapshotMsg:
    def test_construct(self):
        msg = SyncSnapshotMsg(
            type="sync_snapshot", devices=[make_device()],
            sessions={"dev-001": [make_session()]},
        )
        assert len(msg.devices) == 1

    def test_empty(self):
        msg = SyncSnapshotMsg(type="sync_snapshot", devices=[], sessions={})
        assert len(msg.devices) == 0

    def test_roundtrip(self):
        msg = SyncSnapshotMsg(
            type="sync_snapshot", devices=[make_device()],
            sessions={"dev-001": [make_session()]},
        )
        data = json.loads(msg.model_dump_json(by_alias=True))
        assert len(data["devices"]) == 1
        assert len(data["sessions"]["dev-001"]) == 1
        restored = SyncSnapshotMsg.model_validate_json(msg.model_dump_json(by_alias=True))
        assert restored.devices[0].id == "dev-001"
