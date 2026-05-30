# 005 — Hook 脚本安装与状态采集 — 实现计划

## 项目结构

```
bridge/src/bridge/hooks/
├── clawd-hook.js          # Claude Code hook 脚本（事件采集 + 权限转发）
├── install.js             # 安装/卸载 CLI 脚本
└── server-config.js       # 端口发现 + HTTP 请求工具
```

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 运行环境 | Node.js（内置模块）| Claude Code hook runner 仅提供 Node 内置 API |
| 事件输入 | stdin JSON | Claude Code hook 协议标准输入格式 |
| HTTP 请求 | Node `http` 模块 | 无外部依赖要求 |

## 实现路径

### 步骤 1 — 端口发现工具 (`server-config.js`)
- 从 clawd-on-desk 参考项目提取端口发现逻辑，精简改写
- 功能：
  - 扫描 `127.0.0.1:23555-23559` 端口
  - 发送 `{"_probe": true}` 探针 POST 到 `/state`，收到 204 即确认 Bridge 存活
  - 缓存活跃端口到 `~/.clawd-relay/port.json`
  - 超时：每个端口 100ms，总扫描 < 500ms
  - **所有端口检测失败时**：输出错误到 stderr `"Bridge 未运行，请执行 'relay' 启动"`（Claude Code hook 日志可见）
- 只依赖 Node.js 内置模块：`http`、`fs`、`path`、`os`

### 步骤 2 — Hook 脚本 (`clawd-hook.js`)
- 入口：`process.stdin` + `JSON.parse`（Claude Code hook input 模式）
- 事件处理映射：
  - `SessionStart` → `state: "thinking"`
  - `UserPromptSubmit` → `state: "thinking"`，提取 title
  - `PreToolUse` → `state: "working"`，提取 toolName、toolInput
  - `PostToolUse` → `state: "thinking"`
  - `SessionEnd` / `Stop` → `state: "idle"`
  - `error` → `state: "error"`
- 每次事件通过 HTTP POST 发送到 Bridge `/state`
- 安全处理：
  - title 截断 80 字符，去除控制字符
  - toolInput 截断敏感字段（API key、token 的正则匹配）
  - 事件 body 总大小限制 4KB
  - `try/catch` 所有操作，错误 silent fail（不阻塞 Agent）

### 步骤 3 — Permission Hook 处理
- 在 `PreToolUse` 事件中检测 permission_ask（Claude Code hook 标准）
- 构建 `PermissionRequestMsg`，发送到 Bridge `/permission`
- 阻塞等待响应（HTTP 连接保持打开）
- 收到响应后：
  - `approved: true`（200）→ `process.stdout.write("allow")`
  - `approved: false`（200）→ `process.stdout.write("deny")`
  - **204 No Content** → 不输出任何内容，静默退出 → Claude Code 退回终端原生审批提示（hook 的 `defaultResult`）
- 超时（10 分钟） → 按 204 处理，不输出决策，退给终端
- Hook 侧连接意外断开 → silent fail，不阻塞 Agent
- 最大 body 大小：256KB

### 步骤 4 — Install 脚本 (`install.js`)
- 使用方式：`relay install-hooks`（Bridge CLI 的子命令）
- 安装流程：
  - 读取 `~/.claude/settings.json`
  - 解析已有 `hooks` 数组
  - 检查是否已安装本项目的 hook（通过 hook 脚本内的 marker 注释判断）
  - 追加 hook 条目（不覆盖已有条目）
  - 嵌入 Node.js 绝对路径（解决 hook runner 的受限 PATH）
  - 写入文件
- 卸载流程：`relay uninstall-hooks`
  - 读取 `~/.claude/settings.json`
  - 移除本项目标记的 hook 条目
  - 写入文件
- Cursor Agent 支持（Phase 2 扩展）：同理处理 `~/.cursor/hooks.json`

## 关键技术要点

### HTTP 请求 URL
```javascript
// 端口发现后构建 URL
const bridgeUrl = `http://127.0.0.1:${port}`
// 状态事件
http.request(`${bridgeUrl}/state`, { method: "POST" })
// 权限请求
http.request(`${bridgeUrl}/permission`, { method: "POST" })
```

### 事件 body 结构
```json
{
  "event": "PreToolUse",
  "session_id": "cmZ8kX2a",
  "state": "working",
  "claude_pid": 12345,
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" },
  "model": "claude-sonnet-4-6",
  "host": "my-mac",
  "cwd": "/home/user/project",
  "agent_id": "claude-code"
}
```

### Hook 安装 marker
每条 hook 条目末尾加 JSON 注释 marker，方便识别和卸载：
```json
{
  "matcher": "session_state",
  "command": "/path/to/node /path/to/clawd-hook.js PreToolUse"
}
```
通过比较 `command` 字段中的脚本路径来判断是否为本项目的 hook。

## 不做范围
- 除 Claude Code 外的 Agent 集成（Codex、Cursor 等 Phase 2）
- BLE 硬件支持（clawstick 项目覆盖）
- 远程 SSH 场景（clawd-on-desk 覆盖）
