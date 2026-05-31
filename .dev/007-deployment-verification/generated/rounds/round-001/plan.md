# 007 — Deployment Verification — Implementation Plan

## Project Structure

No file changes needed. This requirement verifies existing code by running all 3 components simultaneously.

```
Terminal 1: worker/   npm run dev          → wrangler dev on :8787
Terminal 2: web/      npm run dev          → vite dev on :5173
Terminal 3: bridge/   uv run relay --relay-url http://localhost:8787
Terminal 4: curl      POST /state events   → verify Web Client receives them
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Worker port | 8787 (wrangler default) | Standard, no conflict |
| Web port | 5173 (vite default) | Standard, no conflict |
| Bridge port | 23555 (auto-discover) | Implementation default |

## Connection Flow

```
Bridge (:23555) ── WebSocket ──→ Worker (:8787) ── WebSocket ──→ Web Client (:5173)
                                     │
                               wrangler dev (fully local)
```

## Implementation Path

1. **Start Worker locally** — `npm -w worker dev` → verify Durable Objects bindings, health check
2. **Start Web dev server** — `npm -w web dev` → verify no build errors
3. **Connect Bridge** — `uv run relay --relay-url http://localhost:8787` → verify pairing output + WS connection
4. **E2E state event test** — curl POST `/state` to Bridge → verify event appears in Web Client
5. **E2E pairing flow** — open `http://localhost:5173?token=<token>&relay_url=http://localhost:8787` → verify device appears

## Key Technical Points

- Web Client reads `relay_url` from URL query param; in production this defaults to `window.location.origin`
- Bridge needs the `RELAY_TOKEN` env var (or existing `~/.clawd-relay/token.json`) to match what the Web Client uses
- wrangler dev Durable Objects run in-memory — this is fine for local testing
