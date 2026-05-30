"""Tests for WebSocket client module."""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock


class FakeWebSocket:
    """A fake WebSocket connection for testing."""

    def __init__(self):
        self.sent: list[str] = []
        self.closed = False
        self.close_code: int | None = None
        self._recv_future: asyncio.Future | None = None

    async def send(self, message: str) -> None:
        self.sent.append(message)

    async def recv(self) -> str:
        loop = asyncio.get_running_loop()
        self._recv_future = loop.create_future()
        return await self._recv_future

    async def close(self, code: int = 1000) -> None:
        self.closed = True
        self.close_code = code

    def close_recv(self) -> None:
        """Simulate WebSocket connection closing (recv raises)."""
        if self._recv_future and not self._recv_future.done():
            self._recv_future.cancel()


async def make_client(heartbeat_interval: float = 3600) -> tuple:
    """Helper to create a client with fake connection."""
    from clawd_relay_bridge.ws_client import WebSocketClient
    client = WebSocketClient(
        relay_url="ws://localhost:23555",
        token="test_token_32char_hex_string1234",
        device_id="dev-001",
        host="testhost",
        platform="darwin",
        bridge_version="0.1.0",
        heartbeat_interval=heartbeat_interval,
    )
    fake_ws = FakeWebSocket()
    client._connect_impl = AsyncMock(return_value=fake_ws)
    return client, fake_ws


@pytest.mark.asyncio
async def test_connect_sends_hello():
    """Connecting should send a HelloMsg with token and device info."""
    client, fake_ws = await make_client()
    await client.connect()
    hello = json.loads(fake_ws.sent[0])
    assert hello["type"] == "hello"
    assert hello["token"] == "test_token_32char_hex_string1234"
    assert hello["device"]["id"] == "dev-001"


@pytest.mark.asyncio
async def test_send_json():
    """send_json should encode and send via websocket."""
    client, fake_ws = await make_client()
    await client.connect()
    fake_ws.sent.clear()
    await client.send_json({"type": "keepalive"})
    assert json.loads(fake_ws.sent[0]) == {"type": "keepalive"}


@pytest.mark.asyncio
async def test_sends_keepalive():
    """The client should send keepalive messages periodically."""
    client, fake_ws = await make_client(heartbeat_interval=0.05)
    await client.connect()
    await asyncio.sleep(0.15)
    keepalives = [s for s in fake_ws.sent if json.loads(s).get("type") == "keepalive"]
    assert len(keepalives) >= 2


@pytest.mark.asyncio
async def test_disconnect_stops():
    """Disconnect should close the websocket."""
    client, fake_ws = await make_client()
    await client.connect()
    await client.disconnect()
    assert fake_ws.closed


@pytest.mark.asyncio
async def test_on_message_permission_response():
    """on_message should handle permission_response correctly."""
    from clawd_relay_bridge.ws_client import WebSocketClient, PermissionTimeout
    client, _ = await make_client()
    await client.connect()

    async def delayed_response():
        await asyncio.sleep(0.05)
        await client.on_message(json.dumps({
            "type": "permission_response",
            "permissionId": "perm-001",
            "approved": True,
        }))

    asyncio.ensure_future(delayed_response())
    result = await client.wait_for_permission("perm-001", timeout=5)
    assert result is True


@pytest.mark.asyncio
async def test_on_message_no_clients():
    """on_message should handle no_clients message."""
    client, _ = await make_client()
    await client.connect()

    async def delayed_response():
        await asyncio.sleep(0.05)
        await client.on_message(json.dumps({
            "type": "no_clients",
            "permissionId": "perm-002",
        }))

    asyncio.ensure_future(delayed_response())
    result = await client.wait_for_permission("perm-002", timeout=5)
    assert result is None


@pytest.mark.asyncio
async def test_permission_timeout():
    """wait_for_permission should raise PermissionTimeout on timeout."""
    from clawd_relay_bridge.ws_client import PermissionTimeout, WebSocketClient
    client = WebSocketClient(
        relay_url="ws://localhost:23555",
        token="test_token_32char_hex_string1234",
        device_id="dev-001",
        host="testhost",
        platform="darwin",
        bridge_version="0.1.0",
        heartbeat_interval=3600,
    )
    with pytest.raises(PermissionTimeout):
        await client.wait_for_permission("perm-timeout", timeout=0.05)


@pytest.mark.asyncio
async def test_disconnect_sends_goodbye():
    """Disconnect should send a goodbye message then close."""
    client, fake_ws = await make_client()
    await client.connect()
    fake_ws.sent.clear()
    await client.disconnect()
    assert any("goodbye" in s for s in fake_ws.sent)
    assert fake_ws.closed
