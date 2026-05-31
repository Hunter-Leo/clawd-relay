"""Main entry point — CLI, orchestration, and signal handling.

Assembles all modules (token, WebSocket client, HTTP server), starts
the Uvicorn server, and handles graceful shutdown on SIGINT/SIGTERM.
"""
import argparse
import asyncio
import json
import logging
import os
import platform
import signal
import socket
import sys

import uvicorn

from clawd_relay_bridge.server import create_app
from clawd_relay_bridge.token import (
    load_token,
    regenerate_token,
    get_relay_url,
)
from clawd_relay_bridge.ws_client import WebSocketClient

logger = logging.getLogger(__name__)

DEFAULT_PORT_RANGE = list(range(23555, 23560))
DEVICE_ID_ENV = "CLAMD_DEVICE_ID"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments.

    Args:
        argv: Argument list (defaults to sys.argv[1:]).

    Returns:
        Parsed namespace with relay_url, token, regenerate_token, and port.
    """
    parser = argparse.ArgumentParser(prog="relay", description="Clawd Relay — local bridge process")
    parser.add_argument(
        "--relay-url",
        help="Cloudflare Worker relay URL (default: http://127.0.0.1:23555)",
    )
    parser.add_argument(
        "--token",
        help="Relay authentication token (overrides env var and file)",
    )
    parser.add_argument(
        "--regenerate-token",
        action="store_true",
        help="Force generate a new token",
    )
    parser.add_argument(
        "--qr-output",
        choices=["ascii", "image", "none"],
        default="ascii",
        help="QR code output mode (default: ascii)",
    )
    parser.add_argument(
        "--show-qr",
        action="store_true",
        help="Alias for --qr-output image",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="HTTP server port (default: auto-detect 23555-23559)",
    )
    return parser.parse_args(argv)


def _resolve_device_id() -> str:
    """Resolve device ID from env var or hostname."""
    env_id = os.environ.get(DEVICE_ID_ENV)
    if env_id:
        return env_id
    return platform.node() or "unknown"


def _find_free_port(preferred: int, fallback_range: list[int]) -> int:
    """Try ports in order, returning the first available one.

    Args:
        preferred: First port to try.
        fallback_range: Additional ports to try if preferred is taken.

    Returns:
        The first free port found.
    """
    candidates = [preferred] + [p for p in fallback_range if p != preferred]
    for port in candidates:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    msg = f"No free port in range {candidates[0]}-{candidates[-1]}"
    raise RuntimeError(msg)


def _save_port(port: int, data_dir: str) -> None:
    """Persist the selected port for hook script discovery."""
    path = os.path.join(data_dir, "port.json")
    os.makedirs(data_dir, exist_ok=True)
    with open(path, "w") as f:
        json.dump({"port": port}, f)


async def async_main(_shutdown_event: asyncio.Event | None = None) -> None:
    """Async orchestrator — assemble and start the Bridge.

    Args:
        _shutdown_event: Optional event for test injection. When set, shuts down.
    """
    args = parse_args()
    relay_url = get_relay_url(args.relay_url)
    data_dir = os.path.expanduser("~/.clawd-relay")

    if args.regenerate_token:
        token = regenerate_token(data_dir=data_dir)
    else:
        token = load_token(data_dir=data_dir, cli_token=args.token)

    print(f"配对链接: {relay_url}/join/{token}")

    device_id = _resolve_device_id()
    ws_client = WebSocketClient(
        relay_url=relay_url,
        token=token,
        device_id=device_id,
        host=device_id,
        platform=sys.platform,
        bridge_version="0.1.0",
    )
    await ws_client.connect()

    app = create_app(ws_client)

    port = _find_free_port(args.port or DEFAULT_PORT_RANGE[0], DEFAULT_PORT_RANGE)
    _save_port(port, data_dir)
    logger.info("Bridge listening on 127.0.0.1:%d", port)
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
    )
    server = uvicorn.Server(config)

    # Handle graceful shutdown
    shutdown_event = _shutdown_event or asyncio.Event()

    def _handle_signal() -> None:
        logger.info("Shutdown signal received")
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    # Run the server (blocks until shutdown)
    server_task = asyncio.ensure_future(server.serve())

    # Wait for either shutdown signal or server completion
    await shutdown_event.wait()
    logger.info("Shutting down...")
    await ws_client.disconnect()
    server.should_exit = True
    await server_task


def main() -> None:
    """Synchronous entry point for the ``relay`` console script."""
    asyncio.run(async_main())
