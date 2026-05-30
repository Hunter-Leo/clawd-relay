"""Token management — generation, persistence, and discovery.

Provides a single TokenManager class that handles token lifecycle:
generation, reading from file, environment variables, and CLI args.
"""
import json
import os
import secrets
import time
from pathlib import Path

DEFAULT_RELAY_URL = "http://127.0.0.1:23555"


def generate_token() -> str:
    """Generate a 32-character hex token."""
    return secrets.token_hex(16)


def _token_path(data_dir: Path) -> Path:
    return data_dir / "token.json"


def _save_token(token: str, data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    _token_path(data_dir).write_text(
        json.dumps({"token": token, "created_at": int(time.time())})
    )


def load_token(data_dir: Path | None = None, cli_token: str | None = None) -> str:
    """Load token with priority: CLI arg > env var > file > generate.

    Priority:
    1. *cli_token* argument (highest)
    2. ``RELAY_TOKEN`` environment variable
    3. Token file in *data_dir* (or ``~/.clawd-relay/token.json``)
    4. Generate a new token and save it (lowest)

    Returns the token string.
    """
    # 1. CLI arg
    if cli_token:
        return cli_token

    # 2. Environment variable
    env_token = os.environ.get("RELAY_TOKEN")
    if env_token:
        return env_token

    if data_dir is None:
        data_dir = Path.home() / ".clawd-relay"

    # 3. File
    token_path = _token_path(data_dir)
    if token_path.exists():
        try:
            data = json.loads(token_path.read_text())
            if data.get("token"):
                return data["token"]
        except (json.JSONDecodeError, KeyError):
            pass

    # 4. Generate new token
    token = generate_token()
    _save_token(token, data_dir)
    return token


def regenerate_token(data_dir: Path | None = None) -> str:
    """Generate a new token, overwriting any existing one.

    Returns the new token string.
    """
    token = generate_token()
    if data_dir is None:
        data_dir = Path.home() / ".clawd-relay"
    _save_token(token, data_dir)
    return token


def get_relay_url(cli_url: str | None = None) -> str:
    """Resolve relay URL with priority: CLI arg > env var > default.

    Returns the relay URL string.
    """
    if cli_url:
        return cli_url
    env_url = os.environ.get("RELAY_RELAY_URL")
    if env_url:
        return env_url
    return DEFAULT_RELAY_URL
