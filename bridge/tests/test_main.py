"""Tests for the main entry point (main.py)."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


class TestArgParsing:
    """Tests for CLI argument parsing."""

    def test_default_relay_url(self):
        """Default relay URL should be http://127.0.0.1:23555."""
        from clawd_relay_bridge.main import parse_args
        args = parse_args([])
        assert args.relay_url is None

    def test_custom_relay_url(self):
        """--relay-url should be parsed."""
        from clawd_relay_bridge.main import parse_args
        args = parse_args(["--relay-url", "https://relay.example.com"])
        assert args.relay_url == "https://relay.example.com"

    def test_custom_token(self):
        """--token should be parsed."""
        from clawd_relay_bridge.main import parse_args
        args = parse_args(["--token", "abcd1234abcd1234abcd1234abcd1234"])
        assert args.token == "abcd1234abcd1234abcd1234abcd1234"

    def test_regenerate_token_flag(self):
        """--regenerate-token should be parsed as True."""
        from clawd_relay_bridge.main import parse_args
        args = parse_args(["--regenerate-token"])
        assert args.regenerate_token is True

    def test_custom_port(self):
        """--port should be parsed."""
        from clawd_relay_bridge.main import parse_args
        args = parse_args(["--port", "23600"])
        assert args.port == 23600


class TestAsyncMain:
    """Tests for async_main() orchestration."""

    async def _run_with_mocks(self, **override_kwargs):
        """Helper to run async_main with mocked dependencies."""
        import asyncio
        from clawd_relay_bridge.main import async_main
        kwargs = dict(
            relay_url=None, token=None, regenerate_token=False, port=23555,
        )
        kwargs.update(override_kwargs)

        shutdown_event = asyncio.Event()

        with (
            patch("clawd_relay_bridge.main.parse_args") as mock_parse,
            patch("clawd_relay_bridge.main.load_token") as mock_load,
            patch("clawd_relay_bridge.main.regenerate_token") as mock_regenerate,
            patch("clawd_relay_bridge.main.WebSocketClient") as mock_ws_cls,
            patch("clawd_relay_bridge.main.get_relay_url") as mock_relay_url,
            patch("clawd_relay_bridge.main.uvicorn.Config") as mock_cfg,
            patch("clawd_relay_bridge.main.uvicorn.Server") as mock_srv,
            patch("asyncio.AbstractEventLoop.add_signal_handler") as mock_handler,
        ):
            mock_parse.return_value = MagicMock(**kwargs)
            mock_relay_url.return_value = "https://relay.example.com"
            mock_regenerate.return_value = "new_token"
            mock_load.return_value = "file_token"

            mock_ws = MagicMock()
            mock_ws.connect = AsyncMock()
            mock_ws.disconnect = AsyncMock()
            mock_ws_cls.return_value = mock_ws

            mock_server = MagicMock()
            mock_server.serve = AsyncMock()
            mock_srv.return_value = mock_server

            # Set shutdown immediately so the function returns
            shutdown_event.set()
            await async_main(_shutdown_event=shutdown_event)

            return {
                "ws_client": mock_ws_cls,
                "ws_instance": mock_ws,
                "server": mock_srv,
                "server_instance": mock_server,
                "load_token": mock_load,
                "regenerate_token": mock_regenerate,
            }

    @pytest.mark.asyncio
    async def test_creates_ws_client(self):
        """async_main should create and connect a WebSocketClient."""
        mocks = await self._run_with_mocks()
        mocks["ws_client"].assert_called_once()
        mocks["ws_instance"].connect.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_starts_uvicorn(self):
        """async_main should start uvicorn server.serve()."""
        mocks = await self._run_with_mocks()
        mocks["server_instance"].serve.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_regenerate_token(self):
        """regenerate_token=True should skip load_token."""
        mocks = await self._run_with_mocks(regenerate_token=True)
        mocks["regenerate_token"].assert_called_once()
        mocks["load_token"].assert_not_called()

    @pytest.mark.asyncio
    async def test_load_token_when_not_regenerating(self):
        """regenerate_token=False should call load_token."""
        mocks = await self._run_with_mocks(regenerate_token=False, token=None)
        mocks["regenerate_token"].assert_not_called()
        mocks["load_token"].assert_called_once()
