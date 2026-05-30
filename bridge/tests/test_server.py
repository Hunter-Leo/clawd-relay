"""Tests for the HTTP server (server.py)."""
import json
import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient


@pytest.fixture
def ws_client():
    """Create a mock WebSocket client for test dependency injection."""
    from unittest.mock import AsyncMock, MagicMock
    mock = MagicMock()
    mock.send_json = AsyncMock()
    mock.wait_for_permission = AsyncMock()
    return mock


@pytest.fixture
def client(ws_client):
    """Create a TestClient with the FastAPI app."""
    from clawd_relay_bridge.server import create_app
    app = create_app(ws_client)
    return TestClient(app)


class TestStateEndpoint:
    """Tests for POST /state."""

    def test_valid_state_returns_200(self, client, ws_client):
        """A valid SessionStateMsg should return 200 and forward to WS."""
        body = {
            "type": "session_state",
            "device": {"id": "dev-001", "host": "test", "platform": "darwin", "bridgeVersion": "0.1.0"},
            "session": {
                "id": "sess-001", "agentId": "claude-code", "state": "running",
                "title": "test", "cwd": "/tmp", "model": "sonnet",
                "updatedAt": 1717000000000,
            },
        }
        resp = client.post("/state", json=body)
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        ws_client.send_json.assert_awaited_once()

    def test_invalid_state_returns_422(self, client):
        """An invalid body should return 422."""
        resp = client.post("/state", json={"type": "session_state", "device": {}})
        assert resp.status_code == 422

    def test_probe_returns_204(self, client, ws_client):
        """A probe request should return 204 without forwarding."""
        resp = client.post("/state", json={"_probe": True})
        assert resp.status_code == 204
        ws_client.send_json.assert_not_called()


class TestPermissionEndpoint:
    """Tests for POST /permission."""

    def test_valid_permission_returns_approved(self, client, ws_client):
        """A valid permission request that gets approved should return 200."""
        ws_client.wait_for_permission = AsyncMock(return_value=True)
        body = {
            "type": "permission_request",
            "device": {"id": "dev-001", "host": "test", "platform": "darwin", "bridgeVersion": "0.1.0"},
            "permissionId": "perm-001",
            "prompt": "Allow reading /etc/passwd?",
            "toolName": "Read",
            "toolInput": {"path": "/etc/passwd"},
        }
        resp = client.post("/permission", json=body)
        assert resp.status_code == 200
        data = resp.json()
        assert data["approved"] is True

    def test_valid_permission_returns_denied(self, client, ws_client):
        """A denied permission request should return 200 with approved=False."""
        ws_client.wait_for_permission = AsyncMock(return_value=False)
        body = {
            "type": "permission_request",
            "device": {"id": "dev-001", "host": "test", "platform": "darwin", "bridgeVersion": "0.1.0"},
            "permissionId": "perm-002",
            "prompt": "Allow rm -rf /?",
            "toolName": "Bash",
            "toolInput": {"cmd": "rm -rf /"},
        }
        resp = client.post("/permission", json=body)
        assert resp.status_code == 200
        data = resp.json()
        assert data["approved"] is False

    def test_no_clients_returns_204(self, client, ws_client):
        """No clients response should return 204."""
        ws_client.wait_for_permission = AsyncMock(return_value=None)
        body = {
            "type": "permission_request",
            "device": {"id": "dev-001", "host": "test", "platform": "darwin", "bridgeVersion": "0.1.0"},
            "permissionId": "perm-003",
            "prompt": "Allow?",
            "toolName": "Bash",
            "toolInput": {},
        }
        resp = client.post("/permission", json=body)
        assert resp.status_code == 204

    def test_invalid_permission_returns_422(self, client):
        """An invalid permission request should return 422."""
        resp = client.post("/permission", json={"type": "permission_request", "device": {}})
        assert resp.status_code == 422


class TestCORS:
    """Tests for CORS configuration."""

    def test_options_has_cors_headers(self, client):
        """OPTIONS preflight should include CORS headers."""
        resp = client.options("/state", headers={
            "Origin": "http://localhost:23555",
            "Access-Control-Request-Method": "POST",
        })
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers

    def test_state_response_has_cors(self, client):
        """POST /state response should have CORS headers."""
        resp = client.post("/state", json={"_probe": True}, headers={"Origin": "http://localhost:3000"})
        assert resp.status_code == 204
        assert "access-control-allow-origin" in resp.headers
