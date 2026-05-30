# 001 — 项目骨架与消息协议定义

project_stage: pre-launch

## Spec

### 背景与动机

clawd-relay 包含三个独立但有紧密数据依赖的子系统：Python Bridge（本地中继进程）、Cloudflare Worker（云端路由）、Web 客户端（实时展示）。这三个系统共享一套消息协议作为通信契约。在开始任何实现之前，需要先建立统一的项目目录结构、包管理机制和消息协议定义。

同时，该需求为后续所有需求提供基础设施——包括 uv workspace 配置、TypeScript 项目配置、开发工具链（lint、type check）以及共用的消息 schema。

### 核心目标

建立项目骨架，让后续开发在统一的目录结构和协议定义上进行。

### 使用场景

- 开发者 clone 项目后，执行 `uv sync` 和 `npm install` 即可获得所有依赖和类型定义
- Bridge 和 Worker 各自引用协议定义，确保产出的事件格式一致
- 新增消息类型时只需在一处修改定义，两端自动同步

## 需求

### 功能需求

1. uv workspace 根 `pyproject.toml`，包含 `bridge/` 子 package
2. npm workspace 根 `package.json`，包含 `packages/types/`、`worker/`、`web/` 子包
3. 通用 TypeScript 类型包 `packages/types/`：
   - `protocol.ts` 做消息协议的唯一类型定义文件（types/interfaces only，无运行时代码）
   - `worker/` 和 `web/` 都通过 npm workspace 依赖 `@clawd-relay/types` 引用
4. 消息协议定义（双端对齐：Pydantic ↔ TypeScript）：
   - `DeviceInfo`：设备信息
   - `SessionInfo`：会话状态
   - `SessionStateMsg`：状态事件消息
   - `PermissionRequestMsg`：权限请求消息
   - `PermissionResponseMsg`：权限回复消息
   - `HelloMsg` / `KeepaliveMsg`：连接与心跳
   - `DeviceOnlineMsg` / `SyncSnapshotMsg`：广播消息
   - `AGENT_META`：Agent 展示元数据（label/color/icon 映射表）
5. 类型安全保障：Bridge 端 Pydantic 自动校验，Worker/Web 端 TypeScript 编译检查
6. `uv.lock` 和 `package-lock.json` 可生成

### 技术需求

- Python >= 3.12, uv >= 0.5
- Node >= 20, npm >= 10
- Python: `pydantic>=2.0`, `websockets>=12`
- TypeScript: `hono`, `ws` typings 等（仅 dev 依赖声明）

### 接口定义

协议定义分两处，但保持语义一致：

- `bridge/src/bridge/schemas.py` — Python Pydantic models  
- `packages/types/src/protocol.ts` — TypeScript 类型定义（Worker + Web 共享）

### 预期产出

- 项目根 `pyproject.toml`（uv workspace 定义）
- 项目根 `package.json`（npm workspace 定义，workspaces: ["packages/*", "worker", "web"]）
- `packages/types/package.json` + `packages/types/src/protocol.ts`（共享类型包）
- `bridge/pyproject.toml`（FastAPI + Pydantic 依赖）
- `worker/package.json` + `wrangler.toml`
- `web/package.json`
- Pydantic schema 文件
- 可运行 `uv sync` 和 `npm install`

## Action Items

**Prerequisite documents** (if needed — see Phase 02 & 03):
- [x] `generated/data-model.md` — 全系统数据实体、关系、约束定义
- [ ] ~~`generated/research.md` — Python 异步框架对比~~（脑暴中已确认）

**Round artifacts** (maintained across rounds):
- [ ] `issues.md`

**Required documents** (always, in order):
- [ ] `generated/rounds/round-001/plan.md` — Phase 04
- [ ] `generated/rounds/round-001/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06

## Constitution

### 适用语言

Python 3.12+、TypeScript 5.x、HTML/CSS（web/）

### OOP & SOLID 原则

- **单一职责**：每个模块/类只做一件事。`schemas.py` 只定义数据模型，不包含序列化/校验逻辑之外的代码
- **开闭原则**：消息类型通过 Pydantic 的 `Literal[type]` 区分，新增消息类型不需修改已有处理逻辑
- **接口隔离**：Worker 端协议类型按消费者（Bridge 接收的消息 vs Client 接收的消息）分组，不混合
- **无循环依赖**：Python bridge 内部禁止循环 import；npm workspace 包之间只允许 types → worker/web 的单向依赖

### 类型注解

- Python：所有函数参数和返回值必须有类型注解，`mypy --strict` 通过
- TypeScript：启用 `strict: true`，所有 public 函数显式标注返回类型

### 命名规范

- Python: `snake_case` 变量/函数, `PascalCase` 类
- TypeScript: `camelCase` 变量/函数, `PascalCase` 类/类型
- 文件命名: Python 用 `snake_case.py`, TypeScript 用 `kebab-case.ts`
- 所有标识符、注释、文档用英文

### 错误处理

- Pydantic 校验失败应返回 422，携带具体哪个字段失败
- TypeScript 类型定义遵循 exact 模式，不使用 `any` 逃逸

### 测试

- Python: `pytest` 测试 schema 序列化/反序列化
- TypeScript: `vitest` 测试协议类型构建（`packages/types/` + `worker/` + `web/`）
- 覆盖场景：正常构造、缺失字段、类型错误
