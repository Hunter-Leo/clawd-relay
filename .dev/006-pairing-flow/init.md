# 006 — 配对流程与二维码

project_stage: pre-launch

## Spec

### 背景与动机

Bridge 启动后生成一个随机 token，用户需要在网页端输入这个 token 或通过扫码来连接。配对流程是 Bridge 和网页端的"握手"步骤，决定了用户体验的第一印象。

### 核心目标

实现从 Bridge 启动到网页端看到实时状态的完整配对体验，提供 URL 和二维码两种方式。

### 使用场景

- 本地 Mac 启动 Bridge → 终端显示配对 URL 和二维码
- 用户手机扫描二维码 → 浏览器打开 → 实时看到 Mac 上的 Agent 状态
- 朋友拿到邀请 token → 在浏览器打开配对链接 → 看到朋友机器上的状态

## 需求

### 功能需求

1. **Token 生成与持久化**：
   - Bridge 启动时生成 32 位随机 hex token（或可选的更短格式）
   - 持久化到 `~/.clawd-relay/token`
   - 下次启动优先读取已有 token（保持不变）
   - 支持 `--regenerate-token` 强制重新生成
   - Relay URL 通过 `--relay-url` 或环境变量 `RELAY_RELAY_URL` 传入，无默认值
   - 未配置 Relay URL 时仅打印 token 值、不输出配对链接

2. **配对链接输出**：
   - Bridge 启动时在 stdout 输出：`🔗 配对链接: <relay_url>/join/<token>`
   - 输出二维码（终端中打印 ASCII QR code 或显示图片）

3. **简化配对 URL**：
   - CF Worker 提供 `GET /join/<token>` → 302 重定向到 `/?token=<token>`
   - 方便扫码后自动跳转

4. **二维码生成**：
   - 使用 Python 库（如 `qrcode`）在终端输出 QR 码
   - 可选：输出二维码图片到临时目录，自动打开预览（macOS `open` 命令）

### 技术需求

- Python: `qrcode[pil]` 库（或类似轻量库）
- 二维码内容为配对 URL
- 不依赖外部 API
- Bridge 需通过 CLI 参数或环境变量接收 Relay URL

### 预期产出

- Bridge 启动时的二维码/链接输出
- Worker 的 `/join/<token>` 重定向路由
- Token 持久化和轮换逻辑

## Action Items

**Round artifacts** (maintained across rounds):
- [ ] `issues.md`

**Required documents** (always, in order):
- [ ] `generated/rounds/round-001/plan.md` — Phase 04
- [ ] `generated/rounds/round-001/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06

## Constitution

### 适用语言

Python 3.12+（Bridge 端）、TypeScript（Worker 端 `/join` 路由）

### 架构原则

- Token 生成放在 `token.py`，不散落在其他模块
- 二维码输出策略可配置（终端 QR / 图片 / 关闭）
- Worker 的 `/join` 路由是纯粹的重定向，不包含任何业务逻辑

### 依赖管理

- `qrcode` 作为 Bridge 的可选依赖（`bridge[qr]`），不影响核心功能
- Worker 端的 `/join` 路由不需要额外依赖
