# Tasks — 001 项目骨架与消息协议定义 (Round 1)

## Status Table

| ID | Type | Task Name | Status | Priority | Deps | Notes |
|----|------|-----------|--------|----------|------|-------|
| T-001 | config | 配置 uv workspace 根和 bridge 子包 | not-started | P0 | - | |
| T-002 | test | 验证 uv workspace 安装 | not-started | P0 | T-001 | |
| T-003 | config | 配置 npm workspace 根 | not-started | P0 | - | |
| T-004 | config | 创建共享 TS 类型包 packages/types | not-started | P0 | T-003 | |
| T-005 | feat | 定义 TS 协议类型 (protocol.ts) | not-started | P0 | T-004 | 含 9 种消息类型 + AGENT_META |
| T-006 | test | 测试 TS 协议类型构建 | not-started | P0 | T-005 | |
| T-007 | config | 配置 Worker 脚手架 (package.json, tsconfig, wrangler) | not-started | P0 | T-003 | |
| T-008 | config | 配置 Web 脚手架 (package.json, vite.config, tsconfig) | not-started | P0 | T-003 | |
| T-009 | feat | 创建 Pydantic 消息模型 (schemas.py) | not-started | P0 | T-001 | |
| T-010 | test | 验证 Pydantic schema 序列化/反序列化 | not-started | P0 | T-009 | |
| T-011 | test | 验证 TS ↔ Pydantic 类型对齐 | not-started | P0 | T-006, T-010 | |

## Detail Blocks

#### T-001 — 配置 uv workspace 根和 bridge 子包

**Goal:** 项目根 pyproject.toml 声明 uv workspace，bridge/pyproject.toml 定义 Python 依赖。

**Requirements:**
- 根 pyproject.toml：`[tool.uv.workspace]` 含 `members = ["bridge"]`
- bridge/pyproject.toml：依赖 FastAPI>=0.115, Uvicorn, websockets>=12, Pydantic>=2
- Bridge 支持 `[project.scripts] relay = "bridge.main:main"`

**Acceptance Criteria:**
- `uv sync` 成功安装 bridge 依赖
- `uv run relay --help` 显示帮助信息

**References:** plan.md § 步骤 1

---

#### T-002 — 验证 uv workspace 安装

**Goal:** 确保 uv 依赖解析和 workspace 成员正确。

**Requirements:**
- `uv sync` 在根目录执行成功
- 检查 `.python-version` 存在

**Acceptance Criteria:**
- `uv run --with fastapi python -c "import fastapi"` 成功

**References:** plan.md § 步骤 1

---

#### T-003 — 配置 npm workspace 根

**Goal:** 根 package.json 声明 npm workspaces，管理所有 TypeScript 子包。

**Requirements:**
- `workspaces: ["packages/*", "worker", "web"]`
- `devDependencies: { typescript: "^5.7" }`
- `.gitignore` 包含 node_modules/ 等

**Acceptance Criteria:**
- `npm install` 在根目录执行成功
- packages/types/ 下的 node_modules 被 hoist 到根

**References:** plan.md § 步骤 2

---

#### T-004 — 创建共享 TS 类型包 packages/types

**Goal:** 创建 `@clawd-relay/types` 包，作为所有 TypeScript 消息类型的唯一来源。

**Requirements:**
- package.json：`name: "@clawd-relay/types"`，无运行时依赖
- tsconfig.json：`strict: true`, `declaration: true`
- src/index.ts：重新导出所有类型

**Acceptance Criteria:**
- `npm ls @clawd-relay/types` 显示在 workspace 树中
- tsc 编译无错误

**References:** plan.md § 步骤 3

---

#### T-005 — 定义 TS 协议类型 (protocol.ts)

**Goal:** 在 packages/types/src/protocol.ts 中定义完整的消息协议类型。

**Requirements:**
- 接口：DeviceInfo, SessionInfo
- 上行消息：SessionStateMsg, PermissionRequestMsg, HelloMsg, KeepaliveMsg
- 下行消息：PermissionResponseMsg, DNDChangeMsg, AlwaysAllowMsg
- DO 内部消息：NoClientsMsg
- 广播消息：DeviceOnlineMsg, SyncSnapshotMsg
- 联合类型：UpstreamMsg, DownstreamMsg, BroadcastMsg, WorkerMsg
- 显示元数据：AGENT_META 常量表（claude-code, codex 等 agent 的 label/color/icon）
- 所有字段使用 camelCase

**Acceptance Criteria:**
- TypeScript 编译通过
- 所有类型可正确 import

**References:** plan.md § 步骤 3, data-model.md § 2-3

---

#### T-006 — 测试 TS 协议类型构建

**Goal:** 验证消息对象可正确构造且类型安全。

**Requirements:**
- 测试正常构造各消息类型
- 测试缺失必填字段的编译错误
- 测试可选字段不提供的合理性

**Acceptance Criteria:**
- vitest 测试通过

**References:** plan.md § 步骤 7

---

#### T-007 — 配置 Worker 脚手架

**Goal:** 创建 worker/ 目录的基础配置文件。

**Requirements:**
- package.json：依赖 hono, `@clawd-relay/types`, wrangler
- tsconfig.json：strict 模式，ES module
- wrangler.toml：DO 绑定 RELAY_ROOM → RelayRoom，migration v1
- src/index.ts：Hono 应用占位

**Acceptance Criteria:**
- `npm install` 成功
- TypeScript 编译无错误

**References:** plan.md § 步骤 4

---

#### T-008 — 配置 Web 脚手架

**Goal:** 创建 web/ 目录的基础配置文件和 Preact 入口。

**Requirements:**
- package.json：依赖 preact, `@clawd-relay/types`, vite, @preact/preset-vite, tailwindcss
- tsconfig.json：strict 模式，JSX react-jsx，preact 解析
- vite.config.ts：Preact 插件 + Tailwind 插件
- index.html：Preact 挂载点
- src/main.tsx：App 入口
- src/style.css：Tailwind 指令 + daisyUI

**Acceptance Criteria:**
- `npm install` 成功
- `npm run build` 构建成功

**References:** plan.md § 步骤 5

---

#### T-009 — 创建 Pydantic 消息模型 (schemas.py)

**Goal:** 在 bridge/src/bridge/schemas.py 中定义与 TS 语义对齐的 Pydantic 模型。

**Requirements:**
- 与 TS protocol.ts 的 10+1 种消息类型对齐
- 使用 `Field(alias=...)` 实现 camelCase ↔ snake_case 映射
- 所有模型继承 pydantic.BaseModel
- 配置 `model_config = {"populate_by_name": True}` 支持按 name 和 alias 访问

**Acceptance Criteria:**
- Python 类型检查通过
- 消息可正确序列化 JSON（camelCase 字段名）
- 消息可正确反序列化（从 camelCase JSON）

**References:** plan.md § 步骤 6, data-model.md § 2-3

---

#### T-010 — 验证 Pydantic schema 序列化/反序列化

**Goal:** 确保 Pydantic 模型的序列化行为正确。

**Requirements:**
- pytest 测试
- 测试正常构造和序列化
- 测试缺失必填字段抛出 ValidationError
- 测试 Field alias 的 JSON 输入/输出一致性

**Acceptance Criteria:**
- pytest 通过
- 序列化后的 JSON 使用 camelCase 字段名

**References:** plan.md § 步骤 7

---

#### T-011 — 验证 TS ↔ Pydantic 类型对齐

**Goal:** 确保 Pydantic schema 与 TypeScript 协议类型在字段名、类型、可选性上一致。

**Requirements:**
- 检查所有消息类型的字段列表在两端一致
- 检查相同字段的类型对应正确（str↔string, int↔number, list↔array 等）
- 检查可选性一致（None ↔ null/undefined）

**Acceptance Criteria:**
- 手动对照清单通过

**References:** plan.md § 步骤 7
