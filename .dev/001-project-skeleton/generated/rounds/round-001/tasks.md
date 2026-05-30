# Tasks — 001 项目骨架与消息协议定义 (Round 1)

## Status Table

| ID | Type | Task Name | Status | Priority | Deps | Notes |
|----|------|-----------|--------|----------|------|-------|
| T-001 | config | 配置 uv workspace 根和 bridge 子包 | done | P0 | - | 初始提交已创建 |
| T-002 | test | 验证 uv workspace 安装 | done | P0 | T-001 | uv sync 成功，所有依赖可导入 |
| T-003 | config | 配置 npm workspace 根 | done | P0 | - | 初始提交已创建 |
| T-004 | config | 创建共享 TS 类型包 packages/types | done | P0 | T-003 | 初始提交已创建 |
| T-005 | feat | 定义 TS 协议类型 (protocol.ts) | done | P0 | T-004 | 含 11 种消息类型 + AGENT_META |
| T-006 | test | 测试 TS 协议类型构建 | done | P0 | T-005 | 17 tests 全部通过 (vitest) |
| T-007 | config | 配置 Worker 脚手架 | done | P0 | T-003 | 初始提交已创建 |
| T-008 | config | 配置 Web 脚手架 | done | P0 | T-003 | 初始提交已创建 |
| T-009 | feat | 创建 Pydantic 消息模型 (schemas.py) | done | P0 | T-001 | 已实现 11 种消息类型 + 3 个 Literal 枚举 + model_config。见 ISS-001 |
| T-010 | test | 验证 Pydantic schema 序列化/反序列化 | in-progress | P0 | T-009 | pytest 测试文件已创建，待执行 |
| T-011 | test | 验证 TS ↔ Pydantic 类型对齐 | pending | P0 | T-006, T-010 | |

## Detail Blocks

#### T-001 — 配置 uv workspace 根和 bridge 子包

**Goal:** 项目根 pyproject.toml 声明 uv workspace，bridge/pyproject.toml 定义 Python 依赖。

**Requirements:**
- 根 pyproject.toml：`[tool.uv.workspace]` 含 `members = ["bridge"]`
- bridge/pyproject.toml：依赖 FastAPI>=0.115, Uvicorn, websockets>=12, Pydantic>=2
- Bridge 支持 `[project.scripts] relay = "bridge.main:main"`

**Status:** done — 初始提交 `0d203b8` 已创建所有配置文件。

---

#### T-002 — 验证 uv workspace 安装

**Goal:** 确保 uv 依赖解析和 workspace 成员正确。

**Requirements:**
- `uv sync --directory bridge` 执行成功
- 依赖可导入 (fastapi, pydantic, websockets, pytest)

**Status:** done — 所有依赖已安装并验证通过。

---

#### T-003 — 配置 npm workspace 根

**Goal:** 根 package.json 声明 npm workspaces，管理所有 TypeScript 子包。

**Requirements:**
- `workspaces: ["packages/*", "worker", "web"]`
- `devDependencies: { typescript: "^5.7" }`
- `.gitignore` 包含 node_modules/ 等

**Status:** done — 初始提交已创建。

---

#### T-004 — 创建共享 TS 类型包 packages/types

**Goal:** 创建 `@clawd-relay/types` 包。

**Status:** done — 初始提交已创建 package.json + tsconfig.json + src/index.ts。

---

#### T-005 — 定义 TS 协议类型 (protocol.ts)

**Goal:** 定义完整的消息协议类型（11 种消息类型 + AGENT_META）。

**Requirements:**
- 接口：DeviceInfo, SessionInfo
- 上行消息：SessionStateMsg, PermissionRequestMsg, HelloMsg, KeepaliveMsg
- 下行消息：PermissionResponseMsg, DNDChangeMsg, AlwaysAllowMsg
- DO 内部消息：NoClientsMsg
- 广播消息：DeviceOnlineMsg, SyncSnapshotMsg
- 联合类型：UpstreamMsg, DownstreamMsg, BroadcastMsg, WorkerMsg
- 显示元数据：AGENT_META 常量表
- 所有字段使用 camelCase

**Status:** done — 已实现 11 种类型 + 联合类型。TS 编译通过。

---

#### T-006 — 测试 TS 协议类型构建

**Goal:** 验证消息对象可正确构造且类型安全。

**Requirements:**
- vitest 测试
- 测试正常构造各消息类型
- 测试可选字段 null 值
- 测试联合类型兼容性

**Status:** done — 17 tests 全部通过。测试文件: `packages/types/tests/protocol.test.ts`

---

#### T-007 — 配置 Worker 脚手架

**Goal:** 创建 worker/ 目录的基础配置文件。

**Status:** done — 初始提交已创建。

---

#### T-008 — 配置 Web 脚手架

**Goal:** 创建 web/ 目录的基础配置文件和 Preact 入口。

**Status:** done — 初始提交已创建。

---

#### T-009 — 创建 Pydantic 消息模型 (schemas.py)

**Goal:** 在 bridge/src/bridge/schemas.py 中定义与 TS 语义对齐的 Pydantic 模型，包含 data-model.md 全部实体。

**Requirements:**
- 与 TS protocol.ts 的 11 种消息类型对齐
- 包含 data-model.md 的核心实体：TokenRecord, PermissionRecord, AlwaysAllowRule（含 created_at）
- 添加 Python 端 Literal 枚举：AGENT_IDS, SESSION_STATES, PERMISSION_STATUS
- 所有模型配置 `model_config = {"populate_by_name": True}`
- 使用 `Field(alias=...)` 实现 camelCase ↔ snake_case 映射

**Acceptance Criteria:**
- 所有模型可正确导入
- 序列化 JSON 使用 camelCase 字段名
- 反序列化支持 camelCase JSON 输入
- 缺失必填字段抛出 ValidationError

**Deviation:** ISS-001 — 初始实现缺少 TokenRecord, PermissionRecord, created_at, Literal 枚举, model_config。已在第 2 轮实现中修复。

---

#### T-010 — 验证 Pydantic schema 序列化/反序列化

**Goal:** 确保 Pydantic 模型的序列化行为正确。

**Requirements:**
- pytest 测试（测试文件: bridge/tests/test_schemas.py）
- 测试每个模型的正常构造、roundtrip JSON、缺失字段校验

**Acceptance Criteria:**
- pytest 全部通过
- 序列化后的 JSON 使用 camelCase 字段名

---

#### T-011 — 验证 TS ↔ Pydantic 类型对齐

**Goal:** 确保 Pydantic schema 与 TypeScript 协议类型在字段名、类型、可选性上一致。

**Requirements:**
- 检查所有消息类型的字段列表在两端一致
- 检查相同字段的类型对应正确（str↔string, int↔number, list↔array 等）
- 检查可选性一致（None ↔ null/undefined）
- 补充 TS protocol.ts 缺失的消息类型（DNDChangeMsg, AlwaysAllowMsg, NoClientsMsg 的 index.ts 导出）
- 定义 TS 端的枚举值（SessionState 等）

**Acceptance Criteria:**
- 手动对照清单通过
- TS 编译无错误
