# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clawd Relay — 云端 AI Agent 事件中继。将 Claude Code 的 hook 事件通过本地 Bridge → Cloudflare Worker → 网页客户端进行实时推送，支持远程监控和权限审批。

```
Agent (Claude Code)
  → clawd-hook.js (stdin JSON 采集)
    → Bridge (Python FastAPI, 127.0.0.1)
      → WebSocket → Cloudflare Worker (Hono)
        → Durable Object (按 token 隔离的房间)
          → 网页客户端 (Preact)
```

## Architecture

### 模块

| 目录 | 语言 | 职责 |
|------|------|------|
| `bridge/` | Python 3.12+ (FastAPI, Pydantic) | 本地桥接进程：HTTP 接收 hook 事件、WebSocket 连接云端 |
| `bridge/src/bridge/hooks/` | JavaScript (Node.js 内置模块) | Claude Code hook 脚本：端口发现、事件采集、权限转发 |
| `worker/` | TypeScript (Hono, Durable Objects) | Cloudflare Worker：WebSocket 中继、房间管理、离线缓冲 |
| `web/` | Preact + Vite + Tailwind + daisyUI | 网页客户端：设备面板、权限气泡、设置、i18n |
| `packages/types/` | TypeScript | 共享消息协议类型（与 bridge/schemas.py 语义对齐） |

### 关键文档

- `.dev/blueprint.md` — 项目级需求追踪（全部 6 个需求已完成）
- `.dev/proposal.md` — 完整架构提案与数据流图
- `packages/types/src/protocol.ts` — 共享消息协议定义（等价于 `bridge/src/clawd_relay_bridge/schemas.py`）

### 数据流

1. Claude Code hook → `POST /state` (非阻塞) / `POST /permission` (阻塞等待)
2. Bridge 验证后通过 WebSocket 转发到 Worker Durable Object
3. DO 广播给所有连接的网页客户端
4. 网页发起的 `permission_response` 通过 DO 回传给 Bridge

## Commands

### Python Bridge

```bash
# 运行
uv run relay [--relay-url <url>] [--port <port>] [--qr-output <ascii|image|none>] [--show-qr]

# 测试（cd bridge 后）
uv run pytest                          # 全部
uv run pytest tests/test_server.py -v  # 单个文件
uv run pytest tests/test_qr_output.py  # QR 模块测试

# lint
uv run ruff check src/
```

### TypeScript（Worker / Web / Types）

```bash
# 安装依赖（根目录）
npm install

# Worker
npm run -w worker dev             # wrangler dev
npm run -w worker test            # vitest run
npm run -w worker deploy          # wrangler deploy

# Web
npm run -w web dev                # vite dev
npm run -w web build              # vite build

# Types 共享包
npm run -w @clawd-relay/types test
```

### Hook 脚本（Node.js）

```bash
# 测试
node --test bridge/src/bridge/hooks/*.test.js

# 语法检查
node -c bridge/src/bridge/hooks/*.js

# 安装（写入 ~/.claude/settings.json）
node bridge/src/bridge/hooks/install.js
```

### 全部测试一次性运行

```bash
# Bridge (96 tests)
cd bridge && uv run pytest && cd ..

# Worker (28 tests)
npm -w worker test

# Web (13 tests)
npm -w web test

# Types (17 tests)
npm -w @clawd-relay/types test

# Hook scripts (36 tests)
node --test bridge/src/bridge/hooks/*.test.js
```

### Monorepo 工具链

- **npm workspaces** — JS/TS 包（`packages/*`, `worker`, `web`）
- **uv** — Python（bridge 目录独立 pyproject.toml）
- TypeScript strict mode 启用

## Key Interfaces

### Bridge HTTP Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/state` | POST | Hook 状态事件推送 |
| `/permission` | POST | 权限请求（阻塞等待，通过 WS 转发到网页审批） |

### Worker Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `GET /relay/connect?token=xxx` | GET → WebSocket | 连接 DO 房间 |
| `GET /join/:token` | GET | 302 重定向到 `/?token=<token>`（扫码配对） |
| `POST /admin/token` | POST | 创建 token |
| `GET /admin/tokens` | GET | 列出所有 tokens |
| `DELETE /admin/token/:id` | DELETE | 撤销 token |
| `GET /admin` | GET | 管理控制台 HTML |
| `GET /` | GET | 健康检查 |

### Bridge CLI Flags

| Flag | Description |
|------|-------------|
| `--relay-url` | Worker relay URL（配对方框+二维码输出） |
| `--token` | 指定 token（覆盖 env/file） |
| `--regenerate-token` | 强制重新生成 token |
| `--port` | HTTP 端口（默认 23555-23559 自动发现） |
| `--qr-output` | QR 输出模式：ascii/image/none |
| `--show-qr` | `--qr-output image` 缩写 |

### Source Layout

```
bridge/src/clawd_relay_bridge/
├── main.py          # CLI entry, orchestration, pairing output
├── server.py        # FastAPI app
├── token.py         # Token generation, persistence, discovery
├── qr_output.py     # QR code rendering (3 modes)
├── schemas.py       # Pydantic models
└── ws_client.py     # WebSocket client to Worker

bridge/tests/
├── test_main.py, test_qr_output.py, test_server.py,
├── test_token.py, test_ws_client.py, test_schemas.py
└── test_retry_strategy.py

worker/src/
├── index.ts          # Hono routes + app entry
├── durable-object.ts # RelayRoom DO (WebSocket room, registry, buffering)
├── admin-console.ts  # Admin page HTML renderer
└── types.ts          # Worker env bindings

web/src/
├── main.tsx          # App entry
├── App.tsx           # Root component
├── state/store.ts    # Zustand state (devices, permissions, settings)
├── ws.ts             # WebSocket client
├── components/       # UI components
├── i18n/             # Internationalization
└── pages/            # Route pages
```

## Project Management

- `.dev/blueprint.md` tracks all 6 requirements (all completed)
- `.dev/TODO.md` for cross-requirement backlog items
- Each requirement has its own `.dev/[NNN]-[name]/` directory with `init.md` (spec), `generated/rounds/round-NNN/plan.md` + `tasks.md`
- Bridge is `pre-launch` stage — breaking changes allowed for new modules
