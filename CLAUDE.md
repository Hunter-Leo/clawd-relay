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

- `.dev/blueprint.md` — 项目级需求追踪
- `.dev/proposal.md` — 完整架构提案与数据流图
- `packages/types/src/protocol.ts` — 共享消息协议定义（等价于 `bridge/src/clawd_relay_bridge/schemas.py`）

### Durable Object 内部架构

`RelayRoom` DO 按 token 隔离房间，内部维护两套 WebSocket 连接：

- **Bridge** — exclusive（最多 1 个）。旧 bridge 连接被新连接替代时自动关闭旧连接。
- **Clients** — concurrent（多个浏览器标签页）。
- **RingBuffer**（容量 50）— 客户端离线期间的消息重放。push 时覆盖旧条目，flush 时按序输出。
- **Alarm** — 35 秒心跳检测。bridge 无活动超时后关闭连接，通知所有客户端设备离线。
- **Token Registry DO** — 全局 `__relay_registry__` DO 维护所有 token ID 列表，供 admin 控制台遍历 token。

### 消息协议分类

消息分为三个方向，定义在 `packages/types/src/protocol.ts` 和 bridge/schemas.py：

1. **Upstream**（Bridge → DO → Client）：`session_state`、`permission_request`、`hello`、`keepalive`
2. **Downstream**（Client → DO → Bridge）：`permission_response`、`dnd_change`、`always_allow`
3. **Broadcast**（DO → Client only，不转发 Bridge）：`device_online`、`sync_snapshot`

### 数据流

1. Claude Code hook → `POST /state` (非阻塞) / `POST /permission` (阻塞等待)
2. Bridge 通过 Pydantic schema 校验后通过 WebSocket 转发到 Worker Durable Object
3. DO 将 upstream 消息广播给所有连接的网页客户端，同时写入 RingBuffer
4. `permission_response` 由网页发出 → DO → Bridge WS → 唤醒 `/permission` 端点的阻塞等待

### 关键内部模式

- **Bridge 自动端口发现**：尝试 23555-23559 端口范围，使用 `socket.bind()` 检测可用端口，将结果写入 `~/.clawd-relay/port.json` 供 hook 脚本读取。
- **Hook 自动安装/卸载**：Bridge 启动时调用 `install.js` 写入 `~/.claude/settings.json`，关闭时调用 `--uninstall` 移除。
- **Web 客户端多 token 支持**：URL 参数 `?token=xxx&token=yyy` 可同时连接多个 relay token。支持自定义 relay_url 参数。
- **Demo 模式**：URL 参数 `?demo` 启动模拟数据模式，无需真实 bridge/worker 即可开发 UI。
- **Exponential Backoff**：Bridge WS 重连使用 `initial * 2^attempt`（上限 30s），Web 客户端使用相同策略（上限 6 次重试）。
- **_probe 端点**：`POST /state` 带 `{_probe: true}` 返回 204，hook 脚本用于探测 Bridge 是否存活。

## Commands

### Python Bridge

```bash
# 运行（cd bridge 后）
uv run relay [--relay-url <url>] [--port <port>] [--qr-output <ascii|image|none>] [--show-qr]

# 测试
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
npm run -w worker dev             # wrangler dev (localhost:8787)
npm run -w worker test            # vitest run
npm run -w worker deploy          # wrangler deploy

# Web
npm run -w web dev                # vite dev (localhost:5173)
npm run -w web build              # vite build
npm run -w web preview            # vite preview (built assets)
npm run -w web test               # vitest run
npm run -w web test:watch         # vitest watch

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

# 卸载
node bridge/src/bridge/hooks/install.js --uninstall
```

### 全部测试一次性运行

```bash
cd bridge && uv run pytest && cd ..   # Bridge
npm -w worker test                    # Worker
npm -w web test                       # Web
npm -w @clawd-relay/types test        # Types
node --test bridge/src/bridge/hooks/*.test.js  # Hook scripts
```

### Monorepo 工具链

- **npm workspaces** — JS/TS 包（`packages/*`, `worker`, `web`）
- **uv** — Python（bridge 目录独立 pyproject.toml）
- TypeScript strict mode 启用

## Key Interfaces

### Bridge HTTP Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/state` | POST | Hook 状态事件推送（含 `_probe` 探测） |
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
├── main.py          # CLI entry, orchestration, signal handling, hook lifecycle
├── server.py        # FastAPI app (/state, /permission)
├── token.py         # Token generation, persistence, discovery
├── qr_output.py     # QR code rendering (3 modes)
├── schemas.py       # Pydantic models (消息协议)
└── ws_client.py     # WebSocket client (连接/重连/心跳/权限等待)

bridge/tests/
├── test_main.py, test_qr_output.py, test_server.py,
├── test_token.py, test_ws_client.py, test_schemas.py
└── test_retry_strategy.py

worker/src/
├── index.ts          # Hono routes + app entry
├── durable-object.ts # RelayRoom DO (RingBuffer, alarm, bridge/client lifecycle)
├── admin-console.ts  # Admin page HTML renderer
└── types.ts          # Worker env bindings (D1, DO, secrets)

web/src/
├── main.tsx          # App entry
├── App.tsx           # Root component (reducer-based state, WS connect)
├── state/store.ts    # useReducer + context (devices, permissions, settings)
├── ws.ts             # WebSocket singleton manager (multi-token, exponential backoff)
├── components/       # Dashboard, DeviceGroup, SessionCard, PermissionModal,
│                     # SessionHUD, ConnectionIndicator, DNDToggle, SettingsPanel,
│                     # EmptyState, ErrorBoundary
├── i18n/             # en.ts, zh-CN.ts, index.tsx
├── theme/            # ThemeProvider (dark/light/system)
└── pages/            # Route pages
```

## Project Management

- `.dev/blueprint.md` tracks all requirements (7 个已完成)
- `.dev/TODO.md` for cross-requirement backlog items
- Each requirement has its own `.dev/[NNN]-[name]/` directory with `init.md` (spec), `generated/rounds/round-NNN/plan.md` + `tasks.md`
- Bridge is `pre-launch` stage — breaking changes allowed for new modules
