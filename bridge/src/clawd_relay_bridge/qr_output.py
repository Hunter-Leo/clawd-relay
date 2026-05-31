"""QR code output — terminal ASCII and image generation.

Provides a ``QrOutput`` strategy class for rendering QR codes in
different output modes: terminal ASCII, image file, or no-op.
"""

from __future__ import annotations

import logging
import shutil
import tempfile
import subprocess
import sys
from typing import Literal

logger = logging.getLogger(__name__)

QrMode = Literal["ascii", "image", "none"]


def _qrcode_available() -> bool:
    """Check if the ``qrcode`` optional dependency is installed."""
    try:
        import qrcode  # noqa: F401
        return True
    except ImportError:
        return False


def _output_ascii(url: str) -> None:
    """Print a QR code in ASCII art to stdout."""
    import qrcode

    qr = qrcode.QRCode(box_size=1, border=1)
    qr.add_data(url)
    qr.print_ascii(out=sys.stdout)


def _output_image(url: str) -> str | None:
    """Generate a QR code image and open it in the system viewer.

    Returns the temporary file path, or ``None`` if creation failed.
    """
    import qrcode
    from PIL import Image

    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img: Image.Image = qr.make_image(fill_color="black", back_color="white")

    tmpdir = tempfile.mkdtemp(prefix="clawd-qr-")
    path = f"{tmpdir}/pairing-qr.png"
    img.save(path)

    # Try to open with system viewer
    if sys.platform == "darwin":
        subprocess.Popen(["open", path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif sys.platform == "linux":
        if shutil.which("xdg-open"):
            subprocess.Popen(["xdg-open", path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    logger.info("QR code image saved to %s", path)
    return path


def output_qr(url: str, mode: QrMode = "ascii") -> None:
    """Generate and output a QR code for the given URL.

    Args:
        url: The URL to encode in the QR code.
        mode: Output mode — ``"ascii"`` (terminal), ``"image"`` (system viewer),
            or ``"none"`` (silent).

    Raises:
        RuntimeError: If the ``qrcode`` library is not installed.
    """
    if mode == "none":
        return

    if not _qrcode_available():
        logger.warning("qrcode library not installed. Install via: uv sync --extra qr")
        return

    if mode == "ascii":
        _output_ascii(url)
    elif mode == "image":
        _output_image(url)
