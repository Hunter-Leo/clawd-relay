# tasks.md — Round 1 — 002 Python Bridge

## Task Table

| ID    | Type | Task Name                          | Status      | Priority | Deps       | Notes |
|-------|------|------------------------------------|-------------|----------|------------|-------|
| T-001 | feat | 实现 Token 管理模块 (token.py)       | done        | P0       | -          | TokenManager: generate/load/regenerate/get_relay_url, CLI/env/file 优先级 |
| T-002 | test | Token 管理单元测试                   | done        | P0       | T-001      | 11 tests: generate/load/regenerate/priority/url |
| T-003 | feat | 实现 WebSocket 客户端 (ws_client.py) | done        | P0       | T-001      | WebSocketClient: connect/reconnect/heartbeat/permission dispatch/goodbye |
| T-004 | test | WebSocket 客户端单元测试             | done        | P0       | T-003      | 8 tests: hello/send/keepalive/permission_response/no_clients/timeout/disconnect |
| T-005 | feat | 实现 HTTP 服务器 (server.py)         | in-progress | P0       | T-003      |       |
| T-006 | test | HTTP 服务器单元测试                  | not-started | P0       | T-005      |       |
| T-007 | feat | 实现主入口 (main.py)                 | not-started | P0       | T-001, T-003, T-005 | |
| T-008 | test | 主入口及集成测试                     | not-started | P0       | T-007      |       |

**Status:** `not-started` · `in-progress` · `done` · `blocked`

---

## Task Details

#### T-001 — 实现 Token 管理模块 (token.py)

**Goal:** 创建 `bridge/src/clawd_relay_bridge/token.py`，实现 Token 的生成、持久化、读取、命令行参数/env 覆盖。

**Requirements:**
- `secrets.token_hex(16)` 生成 32 位 hex token
- 持久化到 `~/.clawd-relay/token.json`（JSON: `{"token": "...", "created_at": ...}`）
- 启动时读取；不存在则自动生成
- `--token <token>` 命令行参数或 `RELAY_TOKEN` 环境变量覆盖文件内容
- `--relay-url` 和 `RELAY_RELAY_URL` 用于指定 Worker URL
- 首次启动输出配对链接格式

**Acceptance Criteria:**
- 无 token 文件时自动生成并写入
- token 文件存在时读取成功
- 命令行参数优先于环境变量，环境变量优先于文件
- 路径统一使用 `pathlib.Path`（跨平台）

**References:** `plan.md § Token 管理`, `bridge/src/clawd_relay_bridge/`

**Implementation Summary:** *(完成时填入)*

---

#### T-002 — Token 管理单元测试

**Goal:** 为 `token.py` 编写完整单元测试。

**Requirements:**
- 测试 token 生成格式（32 位 hex 字符串）
- 测试 token 文件写入和读取
- 测试优先级：CLI 参数 > 环境变量 > 文件
- 测试 `--relay-url` / `RELAY_RELAY_URL`
- 使用 `tmp_path` fixture 隔离文件系统

**Acceptance Criteria:**
- 正常情况：文件创建、读取、参数覆盖均覆盖
- 边界情况：空 token 文件、格式异常、并发写入
- 错误情况：无法写入文件路径（权限不足）

**References:** `plan.md § Token 管理`, `token.py`

**Implementation Summary:** *(完成时填入)*

---

#### T-003 — 实现 WebSocket 客户端 (ws_client.py)

**Goal:** 创建 `bridge/src/clawd_relay_bridge/ws_client.py`，实现 WebSocket 连接、自动重连、心跳、消息分发。

**Requirements:**
- `WebSocketClient` 类管理连接生命周期
- 连接到 `{relay_url}/relay/connect?token={token}`
- 指数退避重连：1s → 2s → 4s → 8s → 16s → 30s（最大 5 次后持续 30s 重试）
- 每 15 秒发送 `KeepaliveMsg`
- 接收消息按 `type` 分发：`permission_response` → 按 `permission_id` 匹配 asyncio.Event
- `send(msg)` / `send_json(data)` 接口供 server 调用
- `connect()` 返回已连接的客户端实例
- 消息模型使用 `schemas.py` 中的 Pydantic 模型

**Acceptance Criteria:**
- 能成功连接并发送 HelloMsg
- 断线后按指数退避重连
- 心跳按间隔发送
- 收到 `PermissionResponseMsg` 正确设置对应 Event
- 收到 `NoClientsMsg` 能正确处理
- 支持优雅关闭（发送 goodbye 消息）

**References:** `plan.md § WebSocket 客户端`, `plan.md § Permission 阻塞机制`, `schemas.py`

**Implementation Summary:** *(完成时填入)*

---

#### T-004 — WebSocket 客户端单元测试

**Goal:** 为 `ws_client.py` 编写完整的单元测试（mock WebSocket 连接）。

**Requirements:**
- 测试连接成功（HelloMsg 发送）
- 测试断线重连（指数退避时序）
- 测试心跳间隔
- 测试 `on_message` 分发（permission_response / no_clients）
- 测试优雅关闭信号处理
- 使用 `pytest-asyncio` 和 mock WebSocket 服务器

**Acceptance Criteria:**
- 正常：连接、发送、接收全链路
- 边界：快速连接/断开循环
- 错误：服务器拒绝连接、DNS 解析失败、TLS 错误
- 超时：permission 等待超时

**References:** `plan.md § WebSocket 客户端`, `ws_client.py`

**Implementation Summary:** *(完成时填入)*

---

#### T-005 — 实现 HTTP 服务器 (server.py)

**Goal:** 创建 `bridge/src/clawd_relay_bridge/server.py`，实现 FastAPI 应用：`/state` 和 `/permission` 端点。

**Requirements:**
- `POST /state`：用 `SessionStateMsg` 校验 → 返回 200，将事件放入 WS 发送队列
- `POST /permission`：用 `PermissionRequestMsg` 校验 → 生成唯一 `permission_id` → WS 发送 → 用 asyncio.Event 阻塞等待（5 分钟超时 → 408）
- 探针端点：body 含 `{"_probe": true}` 返回 204
- 端口退避：依次尝试 23555→23556→...→23559，将选中端口写入 `~/.clawd-relay/port.json`
- CORS：允许 localhost 来源（hook 脚本本地发送请求）
- 服务器监听 `127.0.0.1`

**Acceptance Criteria:**
- `/state` 返回 200 并转发消息到 WS
- `/permission` 返回 200（保持连接），超时返回 408
- 探针请求返回 204
- 端口被占用时自动尝试下一个
- CORS 头正确设置

**References:** `plan.md § HTTP 服务器`, `plan.md § 端口退避`, `plan.md § 探针端点`

**Implementation Summary:** *(完成时填入)*

---

#### T-006 — HTTP 服务器单元测试

**Goal:** 为 `server.py` 编写完整的单元测试（使用 FastAPI TestClient）。

**Requirements:**
- 测试 `POST /state` 正常请求（200）和异常请求（422）
- 测试 `POST /permission` 正常流程和超时流程
- 测试探针端点（204）
- 测试端口退避逻辑
- 测试 CORS 头

**Acceptance Criteria:**
- 正常：合法请求正确处理
- 边界：超大请求体、特殊字符、并发请求
- 错误：非法 schema、超时、端口全部不可用
- 使用 `TestClient`（`httpx` 兼容模式）

**References:** `plan.md § HTTP 服务器`, `server.py`

**Implementation Summary:** *(完成时填入)*

---

#### T-007 — 实现主入口 (main.py)

**Goal:** 创建 `bridge/src/clawd_relay_bridge/main.py`，组装所有模块，提供 CLI 入口和优雅退出。

**Requirements:**
- `argparse` 参数：`--relay-url`、`--token`、`--regenerate-token`、`--port`
- 启动流程：解析参数 → 加载 token → 创建 WS 客户端 → 启动 FastAPI/Uvicorn
- 信号处理：SIGINT/SIGTERM 触发优雅关闭（WS goodbye → 停止 server → 退出）
- `main()` 函数作为 `[project.scripts]` 的 `relay` 入口点
- 启动时打印配对链接

**Acceptance Criteria:**
- CLI 参数正确解析
- 启动流程完整（token → WS → server）
- SIGINT/SIGTERM 触发优雅关闭
- 可通过 `relay` 命令直接运行

**References:** `plan.md § 主入口`, `plan.md § 跨平台支持`, `token.py`, `ws_client.py`, `server.py`

**Implementation Summary:** *(完成时填入)*

---

#### T-008 — 主入口及集成测试

**Goal:** 为 `main.py` 编写组件级测试，验证模块装配和 CLI 功能。

**Requirements:**
- 测试 CLI 参数解析（argparse）
- 测试启动装配流程（mock WS/Server）
- 测试信号处理（mock asyncio 事件循环）
- 测试 `--regenerate-token` 逻辑

**Acceptance Criteria:**
- 正常：参数解析、完整启动流程
- 边界：参数冲突、端口全部不可用
- 错误：无效参数值、依赖初始化失败

**References:** `plan.md § 主入口`, `main.py`

**Implementation Summary:** *(完成时填入)*
