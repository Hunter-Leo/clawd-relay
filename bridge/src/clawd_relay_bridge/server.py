"""HTTP server — FastAPI application with /state and /permission endpoints.

Receives hook events via HTTP POST, validates with Pydantic schemas,
forwards to the WebSocket client, and blocks on /permission pending
a response from the cloud relay.
"""
import json
import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from clawd_relay_bridge.schemas import SessionStateMsg, PermissionRequestMsg
from clawd_relay_bridge.ws_client import WebSocketClient, PermissionTimeout

logger = logging.getLogger(__name__)

PERMISSION_TIMEOUT: float = 300.0  # 5 minutes for permission wait


def create_app(ws_client: WebSocketClient) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        ws_client: A connected WebSocketClient instance for message relay.

    Returns:
        Configured FastAPI application.
    """

    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(127\.0\.0\.1|localhost)(:\d+)?",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/state")
    async def handle_state(request: Request) -> Response:
        """Handle a session state event from a hook script."""
        body = await request.json()

        # Probe check — hook scripts use this to verify Bridge is running
        if isinstance(body, dict) and body.get("_probe"):
            return Response(status_code=204)

        # Validate and forward
        try:
            msg = SessionStateMsg(**body)
        except ValidationError:
            return Response(status_code=422)

        await ws_client.send_json(json.loads(msg.model_dump_json(by_alias=True)))
        return Response(content=json.dumps({"ok": True}), media_type="application/json")

    @app.post("/permission")
    async def handle_permission(request: Request) -> Response:
        """Handle a permission request from a hook script.

        Forwards the request to the cloud relay via WebSocket and blocks
        the HTTP connection until a response is received or timeout.
        """
        body = await request.json()
        try:
            msg = PermissionRequestMsg(**body)
        except ValidationError:
            return Response(status_code=422)

        # Forward to WebSocket
        await ws_client.send_json(json.loads(msg.model_dump_json(by_alias=True)))

        # Wait for permission response
        try:
            result = await ws_client.wait_for_permission(
                msg.permission_id, timeout=PERMISSION_TIMEOUT
            )
        except PermissionTimeout:
            return Response(
                content=json.dumps({"error": "timeout", "permissionId": msg.permission_id}),
                status_code=408,
                media_type="application/json",
            )

        # None means no_clients — return 204 to fall back to terminal
        if result is None:
            return Response(status_code=204)

        return Response(
            content=json.dumps({"approved": result, "permissionId": msg.permission_id}),
            media_type="application/json",
        )

    return app
