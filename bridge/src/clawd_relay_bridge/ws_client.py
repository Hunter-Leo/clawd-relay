"""WebSocket client — connection, reconnection, heartbeat, and message dispatch.

Connects to the Cloudflare Worker relay endpoint, manages the connection
lifecycle with automatic reconnection and heartbeat, and dispatches
incoming permission responses to waiting HTTP handlers.
"""
import asyncio
import json
import logging
from typing import Any, Protocol

import websockets

from clawd_relay_bridge.schemas import HelloMsg, KeepaliveMsg, DeviceInfo

logger = logging.getLogger(__name__)


class PermissionTimeout(Exception):
    """Raised when waiting for a permission response times out."""


class RetryStrategy(Protocol):
    """Protocol for reconnection delay computation.

    Implementations compute the delay before a given retry attempt.
    """

    def next_delay(self, attempt: int) -> float:
        """Return delay in seconds before the given retry *attempt*.

        Args:
            attempt: Zero-based retry attempt number (0 = first retry).
        """
        ...


class ExponentialBackoff:
    """Exponential backoff retry strategy with optional cap.

    Delays follow: initial_delay * factor^attempt, capped at max_delay.
    """

    def __init__(
        self,
        initial_delay: float = 1.0,
        max_delay: float = 30.0,
        factor: float = 2.0,
    ) -> None:
        self._initial_delay = initial_delay
        self._max_delay = max_delay
        self._factor = factor

    def next_delay(self, attempt: int) -> float:
        if attempt == 0:
            return self._initial_delay
        delay = self._initial_delay * (self._factor ** attempt)
        return min(delay, self._max_delay)


class WebSocketClient:
    """Manages a WebSocket connection to the relay worker.

    Handles connection, reconnection with exponential backoff, heartbeat,
    and message dispatch for permission responses.
    """

    def __init__(
        self,
        relay_url: str,
        token: str,
        device_id: str,
        host: str,
        platform: str,
        bridge_version: str,
        heartbeat_interval: float = 15.0,
        retry_strategy: RetryStrategy | None = None,
    ) -> None:
        self._relay_url = relay_url.rstrip("/")
        self._token = token
        self._device_id = device_id
        self._host = host
        self._platform = platform
        self._bridge_version = bridge_version
        self._heartbeat_interval = heartbeat_interval
        self._retry_strategy = retry_strategy or ExponentialBackoff()

        self._ws: websockets.WebSocketClientProtocol | None = None
        self._should_run = True
        self._pending: dict[str, asyncio.Event] = {}
        self._permission_results: dict[str, bool | None] = {}

    def _make_device_info(self) -> DeviceInfo:
        return DeviceInfo(
            id=self._device_id,
            host=self._host,
            platform=self._platform,
            bridgeVersion=self._bridge_version,  # type: ignore[arg-type]
        )

    async def _connect_impl(self) -> websockets.WebSocketClientProtocol:
        """Establish a raw WebSocket connection. Override in tests."""
        ws_url = self._relay_url.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/relay/connect?token={self._token}"
        logger.info("Connecting to %s", ws_url)
        return await websockets.connect(ws_url)

    async def connect(self) -> None:
        """Connect to the relay and start the receive loop."""
        self._ws = await self._connect_impl()
        # Send hello
        hello = HelloMsg(
            type="hello",
            device=self._make_device_info(),
            token=self._token,
        )
        await self._ws.send(hello.model_dump_json(by_alias=True))
        logger.info("Connected, hello sent")
        # Start background tasks
        asyncio.ensure_future(self._recv_loop())
        asyncio.ensure_future(self._heartbeat_loop())

    async def send_json(self, data: dict[str, Any]) -> None:
        """Send a JSON message through the WebSocket."""
        if self._ws is None:
            raise RuntimeError("Not connected")
        await self._ws.send(json.dumps(data))

    async def on_message(self, raw: str) -> None:
        """Handle an incoming WebSocket message."""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON received: %s", raw[:100])
            return

        msg_type = data.get("type")
        if msg_type == "permission_response":
            perm_id = data.get("permissionId")
            approved = data.get("approved", False)
            logger.info("Permission response: %s approved=%s", perm_id, approved)
            self._permission_results[perm_id] = approved
            if perm_id in self._pending:
                self._pending[perm_id].set()
        elif msg_type == "no_clients":
            perm_id = data.get("permissionId")
            logger.info("No clients for permission: %s", perm_id)
            self._permission_results[perm_id] = None  # sentinel
            if perm_id in self._pending:
                self._pending[perm_id].set()
        else:
            logger.debug("Ignored message type: %s", msg_type)

    async def wait_for_permission(self, permission_id: str, timeout: float = 300.0) -> bool | None:
        """Wait for a permission response.

        Returns True for approved, False for denied, None for no_clients.
        Raises PermissionTimeout if timeout elapses.
        """
        event = asyncio.Event()
        self._pending[permission_id] = event
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            result = self._permission_results.pop(permission_id, False)
            return result
        except asyncio.TimeoutError:
            self._pending.pop(permission_id, None)
            self._permission_results.pop(permission_id, None)
            raise PermissionTimeout(f"Permission {permission_id} timed out after {timeout}s")
        finally:
            self._pending.pop(permission_id, None)

    async def _recv_loop(self) -> None:
        """Continuously receive messages from the WebSocket."""
        while self._should_run and self._ws is not None:
            try:
                raw = await self._ws.recv()
                if isinstance(raw, str):
                    await self.on_message(raw)
                else:
                    logger.debug("Ignored binary message (%d bytes)", len(raw))
            except websockets.ConnectionClosed:
                logger.warning("WebSocket connection closed")
                break
            except Exception:
                logger.exception("Error in recv loop")
                break
        # Trigger reconnection if we should still be running
        if self._should_run:
            asyncio.ensure_future(self._reconnect_loop())

    async def _heartbeat_loop(self) -> None:
        """Send keepalive messages at regular intervals."""
        while self._should_run and self._ws is not None:
            await asyncio.sleep(self._heartbeat_interval)
            try:
                keepalive = KeepaliveMsg(type="keepalive")
                await self._ws.send(keepalive.model_dump_json(by_alias=True))
            except websockets.ConnectionClosed:
                logger.warning("Heartbeat send failed (connection closed)")
                break
            except Exception:
                logger.exception("Heartbeat send failed")
                break

    async def _reconnect_loop(self) -> None:
        """Attempt reconnection using the configured retry strategy."""
        attempt = 0
        while self._should_run:
            delay = self._retry_strategy.next_delay(attempt)
            try:
                logger.info("Reconnect attempt %d in %.1fs", attempt + 1, delay)
                await asyncio.sleep(delay)
                self._ws = await self._connect_impl()
                # Re-send hello
                hello = HelloMsg(
                    type="hello",
                    device=self._make_device_info(),
                    token=self._token,
                )
                await self._ws.send(hello.model_dump_json(by_alias=True))
                logger.info("Reconnected successfully")
                # Restart loops
                asyncio.ensure_future(self._recv_loop())
                asyncio.ensure_future(self._heartbeat_loop())
                return
            except Exception:
                logger.exception("Reconnect attempt %d failed", attempt + 1)
                attempt += 1

    async def disconnect(self) -> None:
        """Disconnect gracefully, sending a goodbye message."""
        self._should_run = False
        if self._ws is not None:
            try:
                await self._ws.send(json.dumps({"type": "goodbye"}))
            except Exception:
                pass
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        logger.info("Disconnected")
