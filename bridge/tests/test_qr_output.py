"""Tests for QR code output module."""
import sys
import pytest
from pathlib import Path


class TestOutputQr:
    """Tests for QR code output modes."""

    def test_none_mode_produces_no_output(self, capsys: pytest.CaptureFixture[str]):
        """none mode should produce no stdout output."""
        from clawd_relay_bridge.qr_output import output_qr
        output_qr("https://example.com/join/test", mode="none")
        captured = capsys.readouterr()
        assert captured.out == ""

    def test_ascii_mode_produces_output(self, capsys: pytest.CaptureFixture[str]):
        """ascii mode should produce QR code on stdout."""
        import qrcode  # noqa: F401 — verify qrcode is available
        from clawd_relay_bridge.qr_output import output_qr
        output_qr("https://example.com/join/test", mode="ascii")
        captured = capsys.readouterr()
        assert len(captured.out) > 0

    def test_image_mode_creates_file(self, monkeypatch: pytest.MonkeyPatch):
        """image mode should generate a PNG file in a temp directory."""
        from clawd_relay_bridge.qr_output import output_qr
        created_paths: list[str] = []

        original_popen = __import__("subprocess").Popen
        def _fake_open(*args, **kwargs):
            created_paths.append(str(args[0][1]))
            return original_popen(["true"], stdout=__import__("subprocess").DEVNULL)

        monkeypatch.setattr("subprocess.Popen", _fake_open)
        output_qr("https://example.com/join/test", mode="image")

        assert len(created_paths) == 1
        assert created_paths[0].endswith("pairing-qr.png")

    def test_missing_qrcode_fallback(self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]):
        """When qrcode is not installed, output_qr should silently return."""
        import clawd_relay_bridge.qr_output as qr_module
        monkeypatch.setattr(qr_module, "_qrcode_available", lambda: False)
        qr_module.output_qr("https://example.com/join/test", mode="ascii")
        captured = capsys.readouterr()
        assert captured.out == ""

    def test_url_with_special_chars(self, capsys: pytest.CaptureFixture[str]):
        """URLs with special characters should not raise."""
        import qrcode  # noqa: F401
        from clawd_relay_bridge.qr_output import output_qr
        url = "https://example.com/join/token+abc/def?q=1&r=2"
        output_qr(url, mode="ascii")
        captured = capsys.readouterr()
        assert len(captured.out) > 0


class TestQrcodeAvailable:
    """Tests for the qrcode availability check."""

    def test_returns_true_when_installed(self):
        """_qrcode_available should return True when qrcode is installed."""
        from clawd_relay_bridge.qr_output import _qrcode_available
        assert _qrcode_available() is True
