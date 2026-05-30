# 002 — Python Bridge — 实现计划

## 项目结构

```
bridge/
├── pyproject.toml
└── src/
    └── bridge/
        ├── __init__.py
        ├── main.py              # CLI 入口：argparse、asyncio.run()
        ├── server.py            # FastAPI 应用：/state、/permission 端点
        ├── ws_client.py         # WebSocket 客户端：连接、重连、心跳
        ├── token.py             # Token 生成、持久化、读取
        └── schemas.py           # Pydantic 消息模型
```

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| HTTP 框架 | FastAPI 0.115+ | 异步原生、Pydantic 自动校验、自动文档 |
| ASGI 服务器 | Uvicorn | 轻量、异步兼容 |
| WS 客户端 | websockets >= 12 | 纯异步、维护活跃 |
| 运行时 | asyncio | FastAPI 和 websockets 都基于 asyncio |

## 实现路径

### 步骤 1 — HTTP 服务器 (`server.py`)
- 使用 FastAPI 创建 App，定义两个路由
- `POST /state`：用 Pydantic `SessionStateMsg` 校验请求体，返回 200，将事件放入 WS 发送队列
- `POST /permission`：校验为 `PermissionRequestMsg`，生成唯一 `permission_id`，通过 WS 发送到云端，用 `asyncio.Event` 阻塞等待响应或超时（5分钟 → 408）
- CORS：允许 localhost 来源（hook 脚本从本机发送请求）
- 服务器监听 `127.0.0.1:23555`，端口不可用时尝试 23556-23559

### 步骤 2 — WebSocket 客户端 (`ws_client.py`)
- `WebSocketClient` 类：连接到 `{relay_url}/relay/connect?token={token}`
- 自动重连：指数退避 1s→30s（因子 2，最大 5 次后持续重试）
- 心跳：每 15 秒发送 `KeepaliveMsg`
- 消息分发：收到 `PermissionResponseMsg` → 按 `permission_id` 匹配 → 设置 `asyncio.Event`
- `connect()` 返回共享客户端实例；`send(msg)` 供 server 调用
- 收到 SIGINT/SIGTERM：通过 WS 发送 goodbye 消息，优雅关闭

### 步骤 3 — Token 管理 (`token.py`)
- 生成：`secrets.token_hex(16)`（32 位 hex 字符）
- 持久化到 `~/.clawd-relay/token.json`（JSON: `{"token": "...", "created_at": ...}`）
- 启动时读取；不存在则生成；`--regenerate-token` 强制重新生成
- `--relay-url` / `RELAY_RELAY_URL` 环境变量用于指定 CF Worker URL
- 启动时打印配对链接（二维码输出推迟到 REQ-006）

### 步骤 4 — 主入口 (`main.py`)
- `argparse`：`--relay-url`、`--token`、`--regenerate-token`、`--port`
- 子命令 `install-hooks`：通过 `subprocess.run(["node", find_install_js_path(), ...])` 调用 `install.js`
- `find_node()` 辅助函数：`shutil.which("node")` + 常见路径（`/opt/homebrew/bin/node`、`/usr/local/bin/node`）查找
- `find_install_js_path()`：定位到 `hooks/install.js` 的绝对路径（相对于 `__file__`）
- 启动流程：创建 WS 客户端 → 启动 FastAPI/Uvicorn
- 信号处理：SIGINT/SIGTERM 优雅关闭

### 步骤 5 — 跨平台支持
- 路径处理统一使用 `pathlib.Path`，兼容 macOS 和 Linux
- 主目录获取使用 `pathlib.Path.home()`（跨平台）
- 信号注册同时支持 SIGINT 和 SIGTERM
- 启动脚本不依赖任何平台特定 API

## 关键技术要点

### Permission 阻塞机制
```
Bridge 阻塞 HTTP 请求，等 DO 回复

POST /permission (hook)
  → Bridge 生成 permission_id，通过 WS 发送 permission_request
  → DO 检查 clients 集合：

  场景 A: clients.size === 0
  ─────────────────────────
  DO 立即在 Bridge 的 WS 连接上回复
  { type: "no_clients", permission_id }
  → Bridge 收到 → 返回 204 No Content
  → Hook 看到 204，不输出 stdout → Agent 退回终端原生审批

  场景 B: clients.size >= 1（有网页/硬件客户端在线）
  ────────────────────────────────────────────────
  DO 将 permission_request 广播给所有 clients
  → 用户点击 Allow/Deny
  → Client 发送 permission_response → DO 转发给 Bridge
  → Bridge 设置 asyncio.Event → 返回 200 { approved: bool }
  → Hook 收到 allow/deny → stdout 输出

  场景 C: 10 分钟超时无响应
  ─────────────────────
  Bridge 返回 204 → 退回终端
```
- 使用 `asyncio.Event` + `dict[permission_id, Event]` 匹配 DO 的回复
- `no_clients` 回复和 `permission_response` 都通过同一个 Event 机制处理
- 线程安全：FastAPI 异步处理函数与 WS 客户端在同一事件循环
- 关键原则：**绝不主动 deny**，没有决策就让 Agent 退回终端原生提示

### 端口退避
依次尝试 23555→23556→...→23559。首个可用端口胜出。将所选端口写入 `~/.clawd-relay/port.json` 供 hook 脚本发现。

### 探针端点
Bridge 的 `/state` 端点需处理探针检查：若 body 包含 `{"_probe": true}`，返回 204 而非 200，避免探针事件被误入事件队列。Hook 脚本的端口发现使用此探针区分 Bridge 与其他进程。

### 作为 `uv tool` 安装
`pyproject.toml` 中配置 `[project.scripts] relay = "bridge.main:main"`。用户执行 `uv tool install bridge/` 后直接运行 `relay` 命令。

## 不做范围
- Hook 脚本安装注册（REQ-005）
- 二维码生成（REQ-006）
- Admin API 客户端逻辑
- Worker 端 DO 实现
