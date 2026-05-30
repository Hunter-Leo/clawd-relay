# 002 — Python Bridge

project_stage: pre-launch

## Spec

### 背景与动机

Bridge 是 Clawd Relay 的本地组件，运行在开发者机器上。它接收来自 Claude Code / Codex 等 Agent 的 hook 事件（HTTP POST），对 `/state` 事件即时响应并转发到 Cloudflare Worker，对 `/permission` 请求则保持连接阻塞等待云端决策。

Bridge 是连接本地 Agent 事件与云端中继的桥梁，是系统的"生产者"端。

### 核心目标

实现一个轻量、可靠、自恢复的本地中继进程，负责事件采集、云端转发和权限审批的中继。

### 使用场景

- 开发者在终端启动 Bridge：`cd bridge && uv run relay`
- Bridge 启动后打印配对链接和二维码
- Claude Code hook 脚本触发的状态事件瞬时转发到云端
- 网页端用户在权限气泡上操作，Bridge 收到回复后解除 hook 的阻塞

## 需求

### 功能需求

1. **作为 `uv tool` 安装**：
   - Bridge package 定义 `[project.scripts]` 入口点：`relay = bridge.main:main`
   - 用户执行 `uv tool install bridge/` 后，`relay` 命令全局可用
   - 或者直接用 `uvx relay` 临时运行

2. **HTTP Server**（FastAPI + Uvicorn）：
   - `POST /state` — 接收 hook 事件，校验 Pydantic schema，直接返回 200
   - `POST /permission` — 接收权限请求，返回 200（但连接保持），直到云端回复后释放

3. **WebSocket Client**：
   - 连接到 CF Worker 的 WebSocket 端点
   - 持久化连接，掉线自动重连（指数退避，1s→30s，最大 5 次后持续重试）
   - 每 15 秒发送 `keepalive`
   - 接收 `permission_response` 并匹配给等待中的 HTTP 请求

4. **Token 管理**：
   - 启动时自动生成随机 32 位 hex token，持久化到 `~/.clawd-relay/token`
   - 可接受命令行参数 `--token <token>` 或环境变量 `RELAY_TOKEN`
   - 启动时输出：`配对链接: https://relay.workers.dev/join/<token>`

5. **并发 Permission 处理**：
   - 支持多个 hook 进程同时发来 permission 请求
   - 每个请求有唯一 `permission_id`，通过 WebSocket 发送后等待响应
   - 使用 `asyncio.Event` 或类似机制，不阻塞其他请求

6. **优雅退出**：
   - 收到 SIGINT/SIGTERM 时发送离线通知到 Worker 再关闭

### 技术需求

- Python 3.12+, FastAPI, Uvicorn, `websockets` >= 12, Pydantic >= 2
- HTTP Server 监听 `127.0.0.1`，端口区间 `23555-23559`
- **跨平台支持**：macOS（darwin/arm64, darwin/x64）+ Linux（x64）
- 零外部存储依赖（token 写到本地文件，重启时读取）
- Bridge package 可执行 `uv tool install` 安装，入口点 `relay`

### 接口定义

参见 001 号需求的协议定义。Bridge 是协议的"发送者"（上行）和 `permission_response` 的接收者（下行）。

### 预期产出

- `bridge/src/bridge/__init__.py` `main.py` `server.py` `ws_client.py` `token.py`
- `bridge/pyproject.toml` 完整依赖，含 `[project.scripts]` 入口 `relay`
- Hook 可运行的 `/state` 和 `/permission` 端点
- 可测试的 WS 重连逻辑
- 可通过 `uv tool install` 全局安装验证

## Action Items

**Prerequisite documents**:
- [ ] `generated/plan.md` — Phase 04
- [ ] `generated/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06

**Round artifacts** (maintained across rounds):
- [ ] `issues.md`

**Required documents** (always, in order):
- [ ] `generated/rounds/round-001/plan.md` — Phase 04
- [ ] `generated/rounds/round-001/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06`

## Constitution

### 适用语言

Python 3.12+

### 架构原则

- **单一职责**：
  - `server.py` — 只负责 HTTP 路由和请求处理
  - `ws_client.py` — 只负责 WebSocket 连接生命周期
  - `token.py` — 只负责 token 的生成、读取、持久化
  - `main.py` — 只负责组装和启动（依赖注入）
- **开闭原则**：
  - WS 重连策略通过策略模式实现，不同策略可替换
  - 新增命令行参数不需要修改核心逻辑
- **依赖倒置**：
  - Bridge 核心逻辑不直接依赖具体 HTTP/WS 框架，通过抽象接口交互

### 类型注解

- 所有函数参数和返回值显式标注
- 使用 `mypy --strict` 检查（或 `pyright`）
- 使用 `typing` 模块的 `Protocol` 定义接口

### 错误处理

- WS 断开时：自动重连，指数退避，日志警告
- Token 文件不存在时：生成新的，不是报错
- HTTP 请求异常：返回结构化 JSON 错误，不抛未处理异常
- Permission 请求超时（默认 5 分钟）：返回 408，不泄漏连接
