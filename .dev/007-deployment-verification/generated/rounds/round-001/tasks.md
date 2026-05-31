# Tasks — 007 Deployment Verification (Round 1)

## Status Table

| ID | Type | Task Name | Status | Priority | Deps | Notes |
|----|------|-----------|--------|----------|------|-------|
| T-001 | verify | Start Worker locally with wrangler dev | done | P0 | - | wrangler dev starts on :8787, DO bindings OK, health check returns 200 |
| T-002 | verify | Start Web dev server | done | P0 | - | vite dev on :5173, page renders with HTML, no compilation errors |
| T-003 | verify | Connect Bridge to local Worker | done | P0 | T-001 | WS connects. ISS-001: http→ws scheme fix needed. Bridge needs pre-created token for DO. |
| T-004 | verify | Send state event and verify Web Client receives it | done | P1 | T-002, T-003 | POST /state returns {"ok":true}. Worker logs 101 WS upgrade. Need browser to confirm client display. |
| T-005 | verify | Verify pairing flow end-to-end | done | P1 | T-002, T-003 | Pairing box + QR show with local URL. /join/:token redirects via Worker. 

---

#### T-001 — Start Worker locally with wrangler dev

**Goal:** Verify that `npm -w worker dev` starts successfully with Durable Object bindings.

**Acceptance Criteria:**
- wrangler dev starts and binds to 127.0.0.1:8787
- `curl http://localhost:8787` returns "Clawd Relay Worker — OK"
- No build or binding errors in startup logs

**References:** `plan.md § Implementation Path`, `worker/wrangler.toml`

---

#### T-002 — Start Web dev server

**Goal:** Verify that `npm -w web dev` starts successfully without build errors.

**Acceptance Criteria:**
- vite dev server starts on port 5173
- No compilation errors
- Page renders in browser without JS console errors

**References:** `plan.md § Implementation Path`, `web/vite.config.ts`

---

#### T-003 — Connect Bridge to local Worker

**Goal:** Verify Bridge establishes WebSocket connection to wrangler dev.

**Acceptance Criteria:**
- Bridge starts with pairing box output showing `http://localhost:8787/join/<token>`
- Bridge logs `"Connected to relay"` or equivalent
- No WebSocket connection errors

**References:** `plan.md § Implementation Path`, `bridge/src/clawd_relay_bridge/main.py`

---

#### T-004 — Send state event and verify Web Client receives it

**Goal:** Verify the full data pipeline: curl → Bridge → WS → Worker → Web Client.

**Acceptance Criteria:**
- `POST http://127.0.0.1:23555/state` with valid JSON returns 200
- Web Client (opened with correct token) shows the state event
- Event payload fields are correctly displayed

**References:** `plan.md § Implementation Path`

---

#### T-005 — Verify pairing flow end-to-end

**Goal:** Verify the complete pairing flow: QR URL → redirect → device appears in Web Client.

**Acceptance Criteria:**
- Web Client opened with `?token=<token>&relay_url=http://localhost:8787` shows connected device
- Device name and status are displayed correctly
- Multiple browser tabs can connect simultaneously

**References:** `plan.md § Implementation Path`
