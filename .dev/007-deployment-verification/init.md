# 007 — deployment-verification

project_stage: pre-launch

## Spec

### Background & Motivation

All 6 requirements are implemented and all 154 tests pass, but the full end-to-end
pipeline has never been verified with all 3 components (Worker, Bridge, Web) running
simultaneously. This requirement validates the complete data flow and surfaces any
integration issues before declaring the project ready for production deployment.

### Core Goal

Verify the complete relay pipeline end-to-end: Bridge → WebSocket → Worker (Durable Object) → Web Client, and back.

### Usage Scenarios

1. Developer runs all 3 components locally to verify full data flow
2. Hook events published by Bridge appear in the Web Client in real-time
3. Pairing flow (token + QR + redirect) works correctly end-to-end

## Requirements

### Functional Requirements

1. **Worker local dev** — `wrangler dev` starts successfully with Durable Object bindings
2. **Web dev server** — Vite dev server proxies or connects to the worker dev URL
3. **Bridge connects to local Worker** — Bridge with `--relay-url http://localhost:8787` connects via WebSocket
4. **State event relay** — Bridge `/state` event appears in Web Client within reasonable latency
5. **Pairing output verified** — Bridge startup shows pairing box + QR code with local URL

### Technical Requirements

- wrangler dev runs on default port 8787
- vite dev runs on port 5173 (default)
- Bridge auto-discovers free port in 23555-23559
- No Cloudflare account needed for local verification (`wrangler dev` is fully local)

### Out of Scope

- Production deployment to Cloudflare (separate requirement)
- Load testing or performance benchmarking
- Cross-machine verification (all components on same machine)
- HTTPS or TLS configuration

## Action Items

**Round artifacts** (maintained across rounds):
- [ ] `generated/issues.md`

**Required documents** (always, in order):
- [ ] `generated/rounds/round-001/plan.md` — Phase 04
- [ ] `generated/rounds/round-001/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06

## Constitution

### Languages

- Python 3.12+ (Bridge), TypeScript (Worker / Web)
- All identifiers, comments, and docs in English

### Architecture Principles

- All 3 components run locally on `127.0.0.1`
- Web client connects to wrangler dev via `relay_url` query parameter
- Bridge connects to wrangler dev via `--relay-url` CLI flag
- No environment variables or config files needed for local dev

### Testing

- Verification is manual (not automated E2E tests)
- Each task produces a concrete observation (screenshot or stdout output)

### Git Workflow

Branch: `feat/007-deployment-verification`

Commit format:
```
[007] T-XXX <type>: <imperative summary ≤ 72 chars>
```
