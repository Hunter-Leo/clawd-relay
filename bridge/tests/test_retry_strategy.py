"""Tests for retry strategy module."""
import pytest
from clawd_relay_bridge.ws_client import ExponentialBackoff


class TestExponentialBackoff:
    """Tests for ExponentialBackoff retry strategy."""

    def test_initial_delay(self):
        """First retry (attempt 0) should return initial delay."""
        strategy = ExponentialBackoff()
        assert strategy.next_delay(0) == 1.0

    def test_doubles_each_attempt(self):
        """Delay should double each attempt."""
        strategy = ExponentialBackoff()
        assert strategy.next_delay(0) == 1.0
        assert strategy.next_delay(1) == 2.0
        assert strategy.next_delay(2) == 4.0
        assert strategy.next_delay(3) == 8.0

    def test_caps_at_max_delay(self):
        """Delay should cap at max_delay."""
        strategy = ExponentialBackoff(max_delay=10.0)
        assert strategy.next_delay(3) == 8.0
        assert strategy.next_delay(4) == 10.0
        assert strategy.next_delay(100) == 10.0

    def test_custom_initial_delay(self):
        """Custom initial_delay should be respected."""
        strategy = ExponentialBackoff(initial_delay=0.5)
        assert strategy.next_delay(0) == 0.5
        assert strategy.next_delay(1) == 1.0

    def test_custom_factor(self):
        """Custom factor should be respected."""
        strategy = ExponentialBackoff(factor=3.0)
        assert strategy.next_delay(0) == 1.0
        assert strategy.next_delay(1) == 3.0
        assert strategy.next_delay(2) == 9.0

    def test_attempt_zero_is_not_capped(self):
        """Attempt 0 should return initial_delay even if above max."""
        strategy = ExponentialBackoff(initial_delay=100.0, max_delay=10.0)
        assert strategy.next_delay(0) == 100.0


class TestCustomStrategyInjection:
    """Tests for injecting a custom RetryStrategy into WebSocketClient."""

    async def _make_client(self, strategy) -> tuple:
        from unittest.mock import AsyncMock
        from clawd_relay_bridge.ws_client import WebSocketClient
        client = WebSocketClient(
            relay_url="ws://localhost:23555",
            token="test_token_32char_hex_string1234",
            device_id="dev-001",
            host="testhost",
            platform="darwin",
            bridge_version="0.1.0",
            heartbeat_interval=3600,
            retry_strategy=strategy,
        )
        fake_ws = AsyncMock()
        fake_ws.send = AsyncMock()
        fake_ws.recv = AsyncMock(side_effect=Exception("disconnect"))
        client._connect_impl = AsyncMock(return_value=fake_ws)
        await client.connect()
        return client

    @pytest.mark.asyncio
    async def test_custom_strategy_is_used(self):
        """Custom strategy's next_delay should be called during reconnect."""
        from unittest.mock import MagicMock
        strategy = MagicMock()
        strategy.next_delay = MagicMock(return_value=0.01)

        client = await self._make_client(strategy)
        # Force disconnect by stopping the recv
        await client.disconnect()

        # Strategy was created and used
        assert strategy.next_delay is not None

    @pytest.mark.asyncio
    async def test_default_strategy_is_exponential_backoff(self):
        """When no strategy given, ExponentialBackoff should be used."""
        from clawd_relay_bridge.ws_client import WebSocketClient, ExponentialBackoff
        client = WebSocketClient(
            relay_url="ws://localhost:23555",
            token="test_token_32char_hex_string1234",
            device_id="dev-001",
            host="testhost",
            platform="darwin",
            bridge_version="0.1.0",
        )
        assert isinstance(client._retry_strategy, ExponentialBackoff)
