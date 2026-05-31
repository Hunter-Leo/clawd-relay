# 005 Hook 脚本 — 任务列表（Round 001）

## 状态表

| ID | Type | Task Name | Status | Priority | Deps | Notes |
|---|---|---|---|---|---|---|
| T-001 | feat | 实现 server-config.js 端口发现工具 | done | P0 | - | 已实现，同步 JSDoc，CommonJS |
| T-002 | test | server-config.js 单元测试 | done | P0 | T-001 | 8/8 tests pass |
| T-003 | feat | 实现 clawd-hook.js 标准事件处理 | done | P0 | T-001 | 205 lines, syntax OK |
| T-004 | feat | 实现 clawd-hook.js permission 处理 | done | P0 | T-003 | 重构为返回值模式，参考 clawd-on-desk 风格 |
| T-005 | test | clawd-hook.js 单元测试（含 permission） | done | P0 | T-004 | 16/16 tests pass, clean HTTP mock |
| T-006 | feat | 实现 install.js 安装/卸载脚本 | done | P0 | - | 依赖注入 options，MARKER 识别 |
| T-007 | test | install.js 单元测试 | in-progress | P0 | T-006 |

---

### T-001 — 实现 server-config.js 端口发现工具

**Goal:** 实现 Bridge 端口发现模块，供 hook 脚本调用。

**Requirements:**
- `probePort(port)` — 向 `127.0.0.1:{port}/state` 发送 `{"_probe": true}` POST，204 返回 true
- `readPersistedPort(dataDir)` — 读取 `~/.clawd-relay/port.json`，返回 `port` 字段或 null
- `discoverBridgePort(dataDir)` — 优先 `readPersistedPort()`，失败则扫描 23555-23559 端口
- 每个端口探测超时 100ms，总扫描 < 500ms
- 导出 `{ discoverBridgePort, readPersistedPort, probePort }`
- 只依赖 Node.js 内置模块（`http`、`fs`、`path`）

**Acceptance Criteria:**
- 导入后调用 `discoverBridgePort()` 返回数字端口或 null
- 端口扫描在超时范围内
- 所有 `try/catch` 覆盖网络错误

**References:** `plan.md § Step 1`

---

### T-002 — server-config.js 单元测试

**Goal:** 确保端口发现工具在各种场景下正确工作。

**Requirements:**
- 正常情况：端口可达返回端口号
- port.json 不存在时按扫描流程 fallback
- 所有端口不可达时返回 null（不 throw）
- 超时逻辑：慢端口不阻塞整体扫描

**Acceptance Criteria:**
- 测试覆盖：正常、端口不可达、port.json 不存在
- 使用 Node.js 内置 `node:test` + `node:assert`
- `node --test` 全部通过

**References:** `bridge/src/bridge/hooks/server-config.js`

---

### T-003 — 实现 clawd-hook.js 标准事件处理

**Goal:** 处理 Claude Code 6 种 hook 事件并转发到 Bridge。

**Requirements:**
- 入口 `process.stdin` → `JSON.parse` 事件
- 事件映射：
  - `SessionStart` → `state: "thinking"`
  - `UserPromptSubmit` → `state: "thinking"`，提取 title
  - `PreToolUse` → `state: "working"`，提取 toolName/toolInput
  - `PostToolUse` → `state: "thinking"`
  - `SessionEnd` / `Stop` → `state: "idle"`
  - `error` → `state: "error"`
- POST `/state` 发送结构化事件
- 通过 `server-config.js` 发现端口
- title 截断 80 字符，去除控制字符
- `try/catch` 全部操作，错误 silent fail

**Acceptance Criteria:**
- stdin JSON 输入 → HTTP POST 输出
- 错误不 throw 不 crash
- 事件 body ≤ 4KB

**References:** `plan.md § Step 2`, `bridge/src/bridge/hooks/clawd-hook.js`

---

### T-004 — 实现 clawd-hook.js permission 处理

**Goal:** 处理 `permission_ask` 事件，阻塞等待 Bridge 决策。

**Requirements:**
- 检测 `permission_ask` 事件类型
- 构建 permission payload → POST `/permission`
- 200 `{"approved": true}` → stdout `allow`
- 200 `{"approved": false}` → stdout `deny`
- 204 No Content → 不输出（退回终端）
- 408 Timeout → 不输出
- 超时 300s（与 Bridge PERMISSION_TIMEOUT 一致）
- 连接断开 → silent fail

**Acceptance Criteria:**
- 模拟 Bridge 各种响应，hook 输出对应决策
- 204/408 不输出任何内容
- 网络错误不 crash

**References:** `plan.md § Step 3`, `bridge/src/bridge/hooks/clawd-hook.js`

---

### T-005 — clawd-hook.js 单元测试（含 permission）

**Goal:** 确保 hook 脚本正确处理所有事件类型和边界情况。

**Requirements:**
- 测试所有 6 种标准事件：期望输出对应的 state
- 测试 `permission_ask`：200 allow、200 deny、204、408
- 测试无效 JSON 输入：silent ignore
- 测试 Bridge 不可达：silent fail
- 测试字段截断和 sanitization

**Acceptance Criteria:**
- 核心路径 100% 覆盖（事件映射 + permission 分支）
- 使用 Node.js 内置 `node:test` + `node:assert`
- `node --test` 全部通过

**References:** `bridge/src/bridge/hooks/clawd-hook.js`

---

### T-006 — 实现 install.js 安装/卸载脚本

**Goal:** 将 clawd-hook.js 注册到 `~/.claude/settings.json`。

**Requirements:**
- 默认行为（安装）：
  - 读取 `~/.claude/settings.json`
  - hooks 数组中追加本项目条目（不覆盖已有）
  - 嵌入 Node.js 绝对路径
- `--uninstall` 行为：
  - 读取 `~/.claude/settings.json`
  - 移除本项目 hook 条目
- 幂等：重复安装不重复追加
- 脚本路径硬编码验证

**Acceptance Criteria:**
- 安装 → `~/.claude/settings.json` hooks 数组正确
- 卸载 → 钩子条目被移除，其他条目保留
- 重复安装 2 次不会重复追加
- settings.json 不存在时自动初始化

**References:** `plan.md § Step 4`, `bridge/src/bridge/hooks/install.js`

---

### T-007 — install.js 单元测试

**Goal:** 确保安装/卸载逻辑在所有场景下正确。

**Requirements:**
- 正常安装：hooks 数组正确追加
- 重复安装：幂等，不重复
- `--uninstall`：正确移除
- settings.json 不存在：创建并写入
- settings.json 无 hooks 字段：初始化数组
- Node.js 路径不存在：报错提示

**Acceptance Criteria:**
- 使用临时目录模拟 `~/.claude` 场景
- 可逆操作：安装后卸载→回到原状态
- 使用 Node.js 内置 `node:test` + `node:assert`
- `node --test` 全部通过

**References:** `bridge/src/bridge/hooks/install.js`
