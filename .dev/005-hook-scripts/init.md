# 005 — Hook 脚本安装与状态采集

project_stage: pre-launch

## Spec

### 背景与动机

Bridge 需要 Agent 向其 HTTP 端点推送事件才能工作。Claude Code / Codex 等 Agent 通过 hook 机制触发事件——需要在 `~/.claude/settings.json` 等配置中注册 hook 脚本。

Hook 脚本是最靠近 Agent 的一层：它解析 Agent 的标准输入/环境变量，提取结构化事件，通过 HTTP POST 发送到 Bridge。

clawd-on-desk 已有成熟 hook 脚本可供借鉴，但本项目需要自实现不产生外部依赖。

### 核心目标

实现一套自包含的 hook 脚本，为 Claude Code（后续扩展 Codex）提供状态推送和权限审批能力。

### 使用场景

- 用户执行 `relay install-hooks` 安装 Claude Code hook
- Claude Code 每次状态变化时 hook 自动触发，事件进入 Bridge
- Claude Code 遇到权限请求时，hook 保持连接等待 Bridge 决策

## 需求

### 功能需求

1. **Claude Code Hook 脚本**：
   - 支持所有 hook 事件：`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop`
   - 提取并上报：session ID、state、title、model、cwd、tool name、tool input
   - 端口发现：扫描 `127.0.0.1:23555-23559`，找到运行的 Bridge
   - 只依赖 Node.js 内置模块（`http`、`crypto`、`fs`）

2. **Permission Hook 处理**：
   - Claude Code 的 permission_ask 事件触发阻塞式 HTTP POST
   - 请求保持打开状态直到 Bridge 返回 allow/deny
   - 超时处理：5 分钟后无回复则 timeout，拒绝请求

3. **Install 脚本**：
   - 将 hook 脚本注册到 `~/.claude/settings.json` 的 `hooks` 数组（追加，不覆盖）
   - 检查 Node.js 路径并嵌入绝对路径到 hook 命令中
   - 支持 `--uninstall` 移除本项目的 hook 条目

### 技术需求

- JavaScript（Node.js），只依赖内置模块
- Hook 脚本运行在 Claude Code 的 hook runner 中（受限 PATH）
- 需要分发为 `bridge/` 中的文件

### 接口定义

Hook 脚本调用 Bridge 的 HTTP 接口：

- `POST /state` — 状态事件（body: hook 事件 JSON）
- `POST /permission` — 权限请求（body: permission payload）

### 预期产出

- `bridge/src/bridge/hooks/clawd-hook.js`
- `bridge/src/bridge/hooks/install.js`
- `bridge/src/bridge/hooks/server-config.js`（端口发现工具，类似 clawd-on-desk 但不依赖）

## Action Items

**Round artifacts** (maintained across rounds):
- [ ] `issues.md`

**Required documents** (always, in order):
- [ ] `generated/rounds/round-001/plan.md` — Phase 04
- [ ] `generated/rounds/round-001/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06

## Constitution

### 适用语言

JavaScript（ECMAScript 2020+）

### 约束条件

- **只能依赖 Node.js 内置模块**（`http`、`crypto`、`fs`、`path`、`os`）
- 不能在 hook 脚本中使用 `node_modules`、`import`（Claude Code hook runner 没有）
- Hook 脚本入口必须是 `process.stdin` + `JSON.parse`（Claude Code hook 的 input 模式）

### 架构原则

- 端口发现逻辑单独提取到 `server-config.js`，方便测试
- Install 脚本和 hook 脚本分开——install 只做安装/卸载，hook 只做事件采集
- Hook 脚本尽可能短（< 200 行），保持只读操作

### 错误处理

- Hook 脚本内部 `try/catch` 所有操作，出错时 silent fail（不阻塞 Agent）
- 端口发现找不到 Bridge 时，输出错误到 stderr（Claude Code 会记录到日志）
- Permission 请求的 body 大小限制：256KB
