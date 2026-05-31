# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clawd Relay streams AI agent hook events from a local machine to the cloud via Bridge → Cloudflare Worker → Web Client, enabling real-time remote monitoring and permission approval.

```
Agent → clawd-hook.js → Bridge (Python, localhost)
                             ↓ WebSocket
                      Cloudflare Worker + DO
                             ↓ WebSocket
                        Web Client (Preact)
```

## Architecture

### Modules

| Directory | Language | Role |
|-----------|----------|------|
| `bridge/` | Python 3.12+ (FastAPI) | Local bridge: HTTP server for hooks, WS client to Worker |
| `bridge/src/clawd_relay_bridge/hooks/` | JavaScript (Node.js) | Hook scripts for Claude Code event collection |
| `worker/` | TypeScript (Hono, DO) | Cloudflare Worker: WebSocket relay, room management |
| `web/` | Preact + Vite + Tailwind | Web client: device dashboard, permission approval |
| `packages/types/` | TypeScript | Shared protocol types (aligned with bridge/schemas.py) |

### Key Documents

- `.dev/blueprint.md` — Requirements overview (9 reqs completed)
- `.dev/proposal.md` — Full architecture proposal with data flow diagrams
- `packages/types/src/protocol.ts` — Message protocol (= bridge/schemas.py)

### Durable Object Internals

`RelayRoom` DO isolates each token into its own room:
- **Bridge** — exclusive (max 1). Old bridge kicked when new one connects.
- **Clients** — concurrent (many browser tabs).
- **RingBuffer** (cap 50) — offline message replay. `sync_snapshot` on new client connect.
- **Alarm** — 35s heartbeat. Bridge timeout kills connection, broadcasts offline.
- **Token Registry DO** — global `__relay_registry__` for token enumeration by admin API.

### Message Flow

1. **Upstream** (Bridge → DO → Client): `session_state`, `permission_request`, `hello`, `keepalive`
2. **Downstream** (Client → DO → Bridge): `permission_response`, `dnd_change`, `always_allow`
3. **Broadcast** (DO → Client only): `device_online`, `sync_snapshot`

## Commands

### Python Bridge

```bash
# Development (local repo)
cd bridge
uv run relay [--relay-url <url>] [--token <token>] [--qr-output ascii|image|none]

# Production (install from GitHub — hook scripts included via package data)
uv tool install --package clawd-relay-bridge git+https://github.com/Hunter-Leo/clawd-relay.git
relay --relay-url https://relay.example.com --token <token>

# Or run without installing
uvx --package clawd-relay-bridge relay --relay-url https://relay.example.com --token <token>

# Tests
cd bridge
uv run pytest                          # All 96 tests
uv run pytest tests/test_server.py -v  # Single file
uv run ruff check src/                 # Lint
```

### Worker

```bash
npm -w worker dev          # wrangler dev (localhost:8787)
npm -w worker test         # 28 tests
npm -w worker deploy       # wrangler deploy
```

### Web

```bash
npm -w web dev             # vite dev (localhost:5173)
npm -w web build           # vite build
npm -w web test            # 13 tests
```

### Hook Scripts

```bash
node --test bridge/src/clawd_relay_bridge/hooks/*.test.js  # 36 tests
node bridge/src/clawd_relay_bridge/hooks/install.js         # Manual install
node bridge/src/clawd_relay_bridge/hooks/install.js --uninstall  # Manual uninstall
```

### Types

```bash
npm -w @clawd-relay/types test  # 17 tests
```

### All Tests

```bash
cd bridge && uv run pytest && cd ..
npm -w worker test
npm -w web test
npm -w @clawd-relay/types test
node --test bridge/src/bridge/hooks/*.test.js
# Total: 190+ tests
```

### Monorepo Tooling

- **npm workspaces**: `packages/*`, `worker`, `web`
- **uv**: Python (bridge has its own pyproject.toml)
- TypeScript strict mode

## Key Interfaces

### Bridge HTTP

| Path | Method | Purpose |
|------|--------|---------|
| `/state` | POST | Hook state events (with `_probe` support) |
| `/permission` | POST | Permission requests (blocking, WS-forwarded) |

### Worker Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/relay/connect?token=` | GET → WS | WebSocket upgrade to DO room |
| `/join/:token` | GET | 302 redirect to `/?token=<token>` |
| `POST /admin/token` | POST | Create token |
| `GET /admin/tokens` | GET | List all tokens |
| `DELETE /admin/token/:id` | DELETE | Revoke token |
| `GET /admin` | GET | Admin console |
| `GET /` | GET | Health check |

### Bridge CLI Flags

| Flag | Description |
|------|-------------|
| `--relay-url` | Worker relay URL |
| `--token` | Token (overrides env/file) |
| `--regenerate-token` | Force new token |
| `--port` | HTTP port (auto 23555-23559) |
| `--qr-output` | QR mode: ascii/image/none |

### Web Client URL Params

| Param | Description |
|-------|-------------|
| `token` | One or more relay tokens (`?token=a&token=b`) |
| `relay_url` | Custom Worker URL |
| `demo` | Mock data mode |

## Source Layout

```
bridge/src/clawd_relay_bridge/
├── main.py           # Entry, orchestration, hook lifecycle
├── server.py         # FastAPI app
├── token.py          # Token generation/persistence
├── qr_output.py      # QR code (ascii/image/none)
├── schemas.py        # Pydantic models
└── ws_client.py      # WebSocket client

worker/src/
├── index.ts          # Hono routes
├── durable-object.ts # RelayRoom DO
├── admin-console.ts  # Admin UI
└── types.ts          # Env bindings

web/src/
├── App.tsx           # Root component
├── ws.ts             # WebSocket singleton
├── state/store.ts    # useReducer state
├── components/       # UI components
├── i18n/             # en, zh-CN
└── theme/            # Dark/light/system
```

## Project Management

- `.dev/blueprint.md` tracks 9 completed requirements
- `.dev/TODO.md` for cross-req backlog
- Each req has `.dev/[NNN]-[name]/init.md` (spec), `generated/rounds/round-NNN/plan.md` + `tasks.md`
- Project stage: `pre-launch` — breaking changes allowed for new modules
