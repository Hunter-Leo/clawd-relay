<p align="center">
  <img alt="Clawd Relay" src="assets/logo.svg" width="80">
</p>

<h3 align="center">Real-time Claude Code event relay from your terminal to any browser</h3>

<p align="center">
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#development">Development</a>
</p>

---

Clawd Relay streams **Claude Code** hook events through a local bridge to the cloud, enabling real-time remote monitoring and permission approval from any device.

> **Currently supports Claude Code only.** Other AI agents (Codex, Gemini CLI, Copilot) are not yet supported — the hook installer registers Claude Code-specific hook events (`Elicitation`, `Notification`, `PostToolUse`), and the hook script uses Claude Code's event schema.

**What it does:**

- **Monitor** — Watch your agent's state, session activity, tool usage from any browser
- **Approve remotely** — Allow or deny permission requests without SSH-ing into the machine
- **Pair by token** — Generate a pairing URL or QR code on startup, open it on any device
- **Multi-device** — Connect multiple browser tabs or phones to the same agent simultaneously

---

## Architecture

```
┌────────────────────────────────────────────┐
│  AI Agent (Claude Code)  │
│    │                                       │
│    ▼ hook events                           │
│  clawd-hook.js                             │
│    │                                       │
│    ├── POST /state   (non-blocking)        │
│    └── POST /permission (blocking, waits)  │
│          │                                 │
│          ▼                                 │
│  ┌─ Bridge (Python, localhost) ─────────┐  │
│  │  FastAPI HTTP server                  │  │
│  │  WebSocket client ──────────────────┐ │  │
│  └─────────────────────────────────────┘ │  │
│                                          ▼  │
└──────────────────────────────────────────────┘
               │ WebSocket (persistent)
               │ wss://relay.example.com/relay/connect?token=xxx
               ▼
┌──────────────────────────────────────────────┐
│  Cloudflare Worker (Hono + Durable Objects)  │
│                                              │
│  ┌─ RelayRoom DO (per-token room) ─────────┐ │
│  │  Bridge (1, exclusive)                  │ │
│  │  Clients (many, concurrent)             │ │
│  │  RingBuffer (50 events for offline)     │ │
│  │  Alarm (35s heartbeat timeout)          │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  Endpoints:                                   │
│  GET /relay/connect?token= → WebSocket        │
│  GET /join/:token          → 302 redirect     │
│  POST /admin/token         → create token     │
│  GET /admin/tokens         → list tokens      │
│  GET /admin                → admin console UI │
└──────────────────────────────────────────────┘
               │ WebSocket
               ▼
┌──────────────────────────────────────────────┐
│  Web Client (Preact + Vite, Cloudflare Pages)│
│                                              │
│  ?token=xxx&relay_url=https://relay.example   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Device dashboard                      │  │
│  │  Session cards with real-time status   │  │
│  │  Permission request modals             │  │
│  │  Dark/light/system theme               │  │
│  │  Multi-language (en/zh-CN)             │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Local bridge vs. direct-to-cloud | Bridge process | Maintains persistent WebSocket (hooks are ephemeral), supports bidirectional permission flow, sub-1ms local latency, buffers offline events |
| Bridge language | Python 3.12+ (FastAPI) | Ecosystem maturity, type safety with Pydantic, async-native |
| Relay backend | Cloudflare Workers + DO | Free tier (10M DO minutes/day), WebSocket-native, global edge network |
| Web client | Preact + Vite + daisyUI | Lightweight (40KB gzipped), tree-shakeable, fast HMR |
| Token auth | Random hex tokens, admin-created | Zero-config pairing, no user accounts needed |

---

## Quick Start

### Prerequisites

| Component | Requires |
|-----------|----------|
| Bridge | Python 3.12+ with [uv](https://docs.astral.sh/uv/) |
| Hook scripts | Node.js (built-in modules only, zero deps) |
| Worker (dev) | Node.js 20+ |
| Web (dev) | Node.js 20+ |

### 1. Install the Relay

```bash
git clone https://github.com/Hunter-Leo/clawd-relay
cd clawd-relay

# Hook scripts have zero external dependencies — ready to use.
# For Bridge development, install Python dependencies:
cd bridge && uv sync && cd ..
```

### 2. Start the Worker locally

```bash
cd worker
npm install && npm run dev
# → http://localhost:8787
```

> Bridge and hook scripts don't need npm. `npm install` is only required for developing the Worker or Web client.

### 3. Create a relay token

```bash
curl -X POST http://localhost:8787/admin/token \
  -H 'Content-Type: application/json' \
  -d '{"label":"my-machine"}'

# Returns: {"token":"abc123...", "createdAt": ...}
```

### 4. Start the Bridge

```bash
cd bridge

# Connect to local worker
uv run relay --relay-url http://localhost:8787 --token <your-token>
```

You'll see a pairing box with a QR code:

```
┌──────────────────────────────────────────────┐
│  🔗 Pairing URL:                              │
│  http://localhost:8787/join/abc123...          │
│                                               │
│  Or enter token manually:                     │
│  abc123...                                    │
└──────────────────────────────────────────────┘
```

### 5. Open the Web Client

```bash
cd web
npm run dev
# → http://localhost:5173
```

Open `http://localhost:5173/?token=<token>&relay_url=http://localhost:8787` in your browser.

The web client connects via WebSocket and displays your agent's activity in real time.

---

## Deployment

### Worker (Cloudflare)

```bash
# Set admin password
npx wrangler secret put ADMIN_SECRET

# Deploy
cd worker && npm run deploy
# → https://relay.009912.xyz (custom domain)

# Or use the default *.workers.dev domain
```

For custom domains, add to `worker/wrangler.toml`:

```toml
[[routes]]
pattern = "relay.yourdomain.com"
custom_domain = true
```

### Web Client (Cloudflare Pages)

```bash
cd web && npm run build
npx wrangler pages deploy dist --branch main --project-name clawd-relay-web
```

Configure a custom domain via the Cloudflare Dashboard: `https://dash.cloudflare.com/.../pages/view/clawd-relay-web/domains`

### Full Production Setup

```bash
# 1. Deploy Worker with ADMIN_SECRET
npx wrangler secret put ADMIN_SECRET  # enter: your-secret-password
npm -w worker deploy

# 2. Create a token via admin API
curl -X POST https://relay.009912.xyz/admin/token \
  -H 'Authorization: Bearer your-secret-password' \
  -H 'Content-Type: application/json' \
  -d '{"label":"production-bridge"}'

# 3. Start Bridge on your machine
uv run relay --relay-url https://relay.009912.xyz --token <token>

# 4. Open web client
#    https://clawdrelay.009912.xyz/?token=<token>&relay_url=https://relay.009912.xyz
```

---

## Configuration

### Bridge CLI

| Flag | Default | Description |
|------|---------|-------------|
| `--relay-url` | `http://127.0.0.1:23555` | Worker relay URL |
| `--token` | auto-generated | Relay token (overrides env/file) |
| `--regenerate-token` | — | Force generate a new token |
| `--port` | 23555-23559 | HTTP port (auto-discovers free port) |
| `--qr-output` | `ascii` | QR mode: `ascii`, `image`, `none` |
| `--show-qr` | — | Alias for `--qr-output image` |

Environment variables: `RELAY_TOKEN`, `RELAY_RELAY_URL`, `CLAMD_DEVICE_ID`

### Token File

Bridge persists tokens to `~/.clawd-relay/token.json`:
```json
{"token": "abc123...", "created_at": 1717000000}
```

### Web Client URL Parameters

| Parameter | Description |
|-----------|-------------|
| `token` | One or more relay tokens (`?token=a&token=b`) |
| `relay_url` | Custom Worker URL (defaults to `window.location.origin`) |
| `demo` | Enable demo mode with mock data |

### Hook Auto-Management

The Bridge automatically installs Claude Code hooks on startup and uninstalls them on shutdown. Hooks are written to `~/.claude/settings.json` in the current format:

```json
{
  "hooks": {
    "Elicitation": [{ "matcher": "", "hooks": [{ "type": "command", "command": "...", "timeout": 5, "async": true }] }],
    "Notification": [...],
    "PostToolUse": [...]
  }
}
```

Existing third-party hooks (e.g., clawd-on-desk) are preserved.

---

## Project Structure

```
clawd-relay/
├── bridge/                          # Local bridge (Python)
│   ├── src/clawd_relay_bridge/
│   │   ├── main.py                  # CLI entry, orchestration, hook lifecycle
│   │   ├── server.py                # FastAPI app (/state, /permission)
│   │   ├── token.py                 # Token generation & persistence
│   │   ├── qr_output.py             # QR code rendering (ascii/image/none)
│   │   ├── schemas.py               # Pydantic models (message protocol)
│   │   └── ws_client.py             # WebSocket client (reconnect, heartbeat)
│   └── src/clawd_relay_bridge/hooks/
│       ├── clawd-hook.js            # Hook event handler (state + permission)
│       ├── install.js               # Hook installer/uninstaller
│       └── server-config.js         # Bridge port discovery
│
├── worker/                          # Cloudflare Worker (TypeScript)
│   ├── src/
│   │   ├── index.ts                 # Hono routes, auth, WebSocket upgrade
│   │   ├── durable-object.ts        # RelayRoom DO (room, buffer, alarm)
│   │   ├── admin-console.ts         # Admin console HTML template
│   │   └── types.ts                 # Worker env bindings
│   └── wrangler.toml
│
├── web/                             # Web client (Preact + Vite)
│   ├── src/
│   │   ├── App.tsx                  # Root component (state, WS lifecycle)
│   │   ├── ws.ts                    # WebSocket singleton (multi-token)
│   │   ├── state/store.ts           # useReducer + context
│   │   ├── components/              # UI components
│   │   ├── i18n/                    # en.ts, zh-CN.ts
│   │   └── theme/                   # Dark/light/system
│   └── vite.config.ts
│
├── packages/types/                  # Shared protocol types (TypeScript)
│
├── .dev/                            # Development docs & tracking
│   ├── blueprint.md                 # Requirements overview
│   ├── proposal.md                  # Architecture proposal
│   └── [NNN]-[name]/                # Per-requirement specs & plans
│
├── .gitignore
└── package.json                     # npm workspaces root
```

---

## Development

### Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+ (for Worker/Web dev)
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) (for Worker deployment)

### Running All Tests

```bash
# Bridge (Python) — 96 tests
cd bridge && uv run pytest

# Hook scripts (Node.js) — 36 tests
node --test bridge/src/clawd_relay_bridge/hooks/*.test.js

# Worker (TypeScript) — 28 tests
npm -w worker test

# Web client (TypeScript) — 13 tests
npm -w web test

# Shared types — 17 tests
npm -w @clawd-relay/types test
```

**Total: 190+ tests**

### Bridge Test Commands

```bash
cd bridge
uv run pytest                          # All
uv run pytest tests/test_server.py -v  # Single file
uv run pytest tests/test_qr_output.py  # QR module
uv run ruff check src/                 # Lint
```

### Local Development Workflow

> `npm install` is only needed once. Run it from the worker or web directory when setting up for the first time.

```bash
# Terminal 1: Worker
cd worker && npm run dev

# Terminal 2: Web
cd web && npm run dev

# Terminal 3: Create token & Bridge
curl -X POST http://localhost:8787/admin/token \
  -H 'Authorization: Bearer dev-admin-secret-123' \
  -H 'Content-Type: application/json' \
  -d '{"label":"dev"}'

uv run relay --relay-url http://localhost:8787 --token <token>

# Terminal 4: Test event
curl -X POST http://127.0.0.1:23555/state \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "session_state",
    "device": {"id":"dev-1","host":"my-machine","platform":"darwin","bridgeVersion":"0.1.0"},
    "session": {"id":"sess-1","agentId":"claude-code","state":"working","title":"Dev session","updatedAt":1780000000000}
  }'

# Open browser: http://localhost:5173/?token=<token>&relay_url=http://localhost:8787
```

### Architecture Notes

- **RelayRoom DO** isolates each token into its own room. Bridge connections are exclusive (1 per room); client connections are concurrent (N per room).
- **RingBuffer** (capacity 50) provides offline replay — the last 50 events are sent to newly connected clients along with a `sync_snapshot` of current device state.
- **Exponential backoff** governs reconnection: `1000ms * 2^attempt`, capped at 30s for Bridge and 10s (6 retries) for web clients.
- **Hook lifecycle** is managed by the Bridge: `node install.js` on startup, `node install.js --uninstall` on shutdown. Hook failures never block the agent.

---

<p align="center">
  Built with Python, TypeScript, and Cloudflare Workers.
</p>
