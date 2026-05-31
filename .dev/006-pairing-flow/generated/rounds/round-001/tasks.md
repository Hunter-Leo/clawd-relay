# Tasks — 006 Pairing Flow (Round 1)

## Status Table

| ID | Type | Task Name | Status | Priority | Deps | Notes |
|----|------|-----------|--------|----------|------|-------|
| T-001 | config | Add `qrcode[pil]` optional dependency to pyproject.toml | done | P1 | - | Added qr optional-deps + --qr-output/--show-qr CLI args |
| T-002 | feat | Implement QR code output module (`qr_output.py`) | done | P1 | T-001 | QrOutput module with ascii/image/none modes, graceful no-qrcode fallback |
| T-003 | feat | Enhance pairing link output with box format and QR | done | P1 | T-002 | Boxed pairing link output with green ANSI + QR code; token-only fallback |
| T-004 | feat | Add `/join/:token` redirect route to Worker | done | P1 | - | Added before health check route, 302 redirect with encodeURIComponent |
| T-005 | test | Unit tests for QR output module | done | P1 | T-002 | 6 tests: none/ascii/image/missing-dep/special-chars/availability |
| T-006 | test | Unit tests for Worker `/join` redirect | done | P2 | T-004 | 2 tests: normal redirect + special chars encoding |

---

#### T-001 — Add `qrcode[pil]` optional dependency

**Goal:** Declare QR code generation library as an optional dependency so `relay --qr-output` works without forcing all users to install it.

**Requirements:**
- Add `[project.optional-dependencies] qr = ["qrcode[pil]>=7.4"]` to `bridge/pyproject.toml`
- Add `--qr-output` CLI argument to `main.py` with choices: `ascii`, `image`, `none`
- Add `--show-qr` flag (equivalent to `--qr-output image`)

**References:** `bridge/pyproject.toml`, `plan.md § 可选依赖声明`

---

#### T-002 — Implement QR code output module (`qr_output.py`)

**Goal:** Create a reusable QR code output module under `bridge/src/clawd_relay_bridge/` that supports ASCII terminal output and image file generation.

**Requirements:**
- `QrOutput` class with `ASCII`, `IMAGE`, `NONE` output modes
- `output_qr(url: str, mode: str) -> None` — generate QR code in selected mode
  - ASCII: print to stdout using terminal box chars
  - IMAGE: generate PNG to temp dir, auto-open with system viewer
  - NONE: no output
- Handle `qrcode` import missing gracefully (when optional dep not installed)

**References:** `plan.md § 二维码输出策略`, `bridge/src/clawd_relay_bridge/`

---

#### T-003 — Enhance pairing link output with box format and QR

**Goal:** Improve the current `print(f"配对链接: {relay_url}/join/{token}")` to a visually appealing box with QR code.

**Requirements:**
- Print a bordered box with：配对链接、Token、二维码（ASCII）
- ANSI green color for links
- When no relay URL configured: print "Token: <token>" without box
- Integrate with T-002's QR output module
- Use `--qr-output` to control QR mode

**References:** `bridge/src/clawd_relay_bridge/main.py` line 117, `plan.md § 步骤 2`

---

#### T-004 — Add `/join/:token` redirect route to Worker

**Goal:** Add a simple 302 redirect route so QR codes with `/join/<token>` URLs work seamlessly.

**Requirements:**
- Add `app.get("/join/:token", ...)` before the health check route
- Extract token from path param, redirect to `/?token=<token>` with 302

**References:** `worker/src/index.ts`, `plan.md § 步骤 4`

---

#### T-005 — Unit tests for QR output module

**Goal:** Ensure QR module handles all three modes correctly, handles missing optional dep, and edge cases.

**Requirements:**
- Test ASCII mode produces non-empty output
- Test IMAGE mode creates a PNG file in temp dir
- Test NONE mode produces no output
- Test graceful handling when `qrcode` is not importable
- Test special characters in URL

**References:** `plan.md § 步骤 3`

---

#### T-006 — Unit tests for Worker `/join` redirect

**Goal:** Verify the redirect route returns 302 with the correct target URL.

**Requirements:**
- Test that `/join/test123` redirects to `/?token=test123`
- Test that `/join/` with empty token still produces a valid redirect
- Test that the response status is 302

**References:** `plan.md § 步骤 4`, `worker/src/index.ts`
