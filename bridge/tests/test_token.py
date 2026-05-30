"""Tests for Token management module."""
import json
import os
import pytest
from pathlib import Path


class TestGenerateToken:
    """Tests for token generation."""

    def test_generates_32_hex_chars(self):
        """A generated token should be a 32-character hex string."""
        from clawd_relay_bridge.token import generate_token
        token = generate_token()
        assert len(token) == 32
        int(token, 16)  # should not raise

    def test_generates_different_tokens(self):
        """Each call should produce a unique token."""
        from clawd_relay_bridge.token import generate_token
        t1 = generate_token()
        t2 = generate_token()
        assert t1 != t2


class TestLoadToken:
    """Tests for token loading with file/env/cli priority."""

    def test_creates_token_when_file_missing(self, tmp_path: Path):
        """When token file doesn't exist, load_token should create one."""
        from clawd_relay_bridge.token import load_token
        token_dir = tmp_path / ".clawd-relay"
        token = load_token(data_dir=token_dir)
        assert len(token) == 32
        token_file = token_dir / "token.json"
        assert token_file.exists()
        saved = json.loads(token_file.read_text())
        assert saved["token"] == token

    def test_reads_existing_token(self, tmp_path: Path):
        """When token file exists, load_token should return the saved token."""
        from clawd_relay_bridge.token import load_token
        token_dir = tmp_path / ".clawd-relay"
        token_dir.mkdir(parents=True)
        (token_dir / "token.json").write_text(
            json.dumps({"token": "abcd1234abcd1234abcd1234abcd1234", "created_at": 1717000000})
        )
        token = load_token(data_dir=token_dir)
        assert token == "abcd1234abcd1234abcd1234abcd1234"

    def test_cli_arg_overrides_file(self, tmp_path: Path):
        """CLI token argument should take priority over file."""
        from clawd_relay_bridge.token import load_token
        token_dir = tmp_path / ".clawd-relay"
        token_dir.mkdir(parents=True)
        (token_dir / "token.json").write_text(
            json.dumps({"token": "file_token_abcd1234file_token1234", "created_at": 1717000000})
        )
        token = load_token(data_dir=token_dir, cli_token="cli_token_abcd1234cli_token4321")
        assert token == "cli_token_abcd1234cli_token4321"

    def test_env_var_overrides_file(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """RELAY_TOKEN env var should take priority over file."""
        from clawd_relay_bridge.token import load_token
        token_dir = tmp_path / ".clawd-relay"
        token_dir.mkdir(parents=True)
        (token_dir / "token.json").write_text(
            json.dumps({"token": "file_token_abcd1234file_token1234", "created_at": 1717000000})
        )
        monkeypatch.setenv("RELAY_TOKEN", "env_token_abcd1234env_token4321")
        token = load_token(data_dir=token_dir)
        assert token == "env_token_abcd1234env_token4321"

    def test_cli_trumps_env(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """CLI argument should override env var."""
        from clawd_relay_bridge.token import load_token
        token_dir = tmp_path / ".clawd-relay"
        monkeypatch.setenv("RELAY_TOKEN", "env_token_abcd1234env_token4321")
        token = load_token(data_dir=token_dir, cli_token="cli_token_abcd1234cli_token4321")
        assert token == "cli_token_abcd1234cli_token4321"

    def test_relay_url_from_cli(self):
        """RELAY_RELAY_URL should return from cli arg."""
        from clawd_relay_bridge.token import get_relay_url
        url = get_relay_url(cli_url="https://example.com")
        assert url == "https://example.com"

    def test_relay_url_from_env(self, monkeypatch: pytest.MonkeyPatch):
        """RELAY_RELAY_URL should return from env var."""
        from clawd_relay_bridge.token import get_relay_url
        monkeypatch.setenv("RELAY_RELAY_URL", "https://env-url.com")
        url = get_relay_url()
        assert url == "https://env-url.com"

    def test_relay_url_default(self):
        """RELAY_RELAY_URL should return default when nothing set."""
        from clawd_relay_bridge.token import get_relay_url
        url = get_relay_url()
        assert url == "http://127.0.0.1:23555"


class TestRegenerateToken:
    """Tests for token regeneration."""

    def test_regenerate_creates_new_token(self, tmp_path: Path):
        """regenerate_token should create a new token and save it."""
        from clawd_relay_bridge.token import regenerate_token, load_token
        token_dir = tmp_path / ".clawd-relay"
        # First create one
        token1 = load_token(data_dir=token_dir)
        # Then regenerate
        token2 = regenerate_token(data_dir=token_dir)
        assert token1 != token2
        # Verify it was persisted
        assert load_token(data_dir=token_dir) == token2
