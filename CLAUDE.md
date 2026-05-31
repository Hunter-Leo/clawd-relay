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

| 目录 | 语言 | 职责 | 状态 |
|------|------|------|------|
| `bridge/` | Python 3.12+ (FastAPI, Pydantic) | 本地桥接进程：HTTP 接收 hook 事件、WebSocket 连接云端 | ✅ done |
| `bridge/src/bridge/hooks/` | JavaScript (Node.js 内置模块) | Claude Code hook 脚本：端口发现、事件采集、权限转发 | ▶ in-progress |
| `worker/` | TypeScript (Hono, Durable Objects) | Cloudflare Worker：WebSocket 中继、房间管理、离线缓冲 | ✅ done |
| `web/` | Preact + Vite + Tailwind + daisyUI | 网页客户端：设备面板、权限气泡、设置、i18n | ⏳ pending |
| `packages/types/` | TypeScript | 共享消息协议类型（与 bridge/schemas.py 语义对齐） | ✅ done |

### 关键文档

- `.dev/proposal.md` — 完整架构提案与数据流图
- `.dev/blueprint.md` — 项目级需求追踪
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
uv run relay [--relay-url <url>] [--port <port>]

# 测试
cd bridge && uv run pytest        # 全部
cd bridge && uv run pytest tests/test_server.py -v   # 单个文件

# lint
cd bridge && uv run ruff check src/
```

### TypeScript（Worker / Web / Types）

```bash
# 安装依赖（根目录）
npm install

# Worker
npm run -w worker dev             # wrangler dev
npm run -w worker test            # vitest run

# Web
npm run -w web dev                # vite dev
npm run -w web build              # vite build

# Types（共享包）
npm run -w packages/types test    # vitest run
```

### Hook 脚本（Node.js）

```bash
# 测试
node --test bridge/src/bridge/hooks/*.test.js

# 语法检查
node -c bridge/src/bridge/hooks/*.js

# 安装（到 ~/.claude/settings.json）
node bridge/src/bridge/hooks/install.js
```

### 部署 Worker

```bash
npm run -w worker deploy          # wrangler deploy
```

### Monorepo 工具链

- **npm workspaces** — JS/TS 包（`-w <workspace>`）
- **uv** — Python（项目根 pyproject.toml workspace + bridge 成员）
- TypeScript strict mode 启用

## 关键接口

### Bridge HTTP 端点

| 路径 | 方法 | 用途 |
|------|------|------|
| `/state` | POST | hook 状态事件 | 
| `/permission` | POST | 权限请求（阻塞等待） |

### Worker 端点

| 路径 | 方法 | 用途 |
|------|------|------|
| `GET /relay/connect?token=xxx` | GET → WebSocket | 连接 DO 房间 |
| `POST /admin/token` | POST | 创建 token |
| `GET /admin/tokens` | GET | 列出 tokens |
| `DELETE /admin/token/:id` | DELETE | 撤销 token |
| `GET /` | GET | 健康检查 |
