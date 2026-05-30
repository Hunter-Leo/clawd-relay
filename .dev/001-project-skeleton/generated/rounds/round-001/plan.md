# 001 — 项目骨架与消息协议定义 — 实现计划

## 项目结构

```
clawd-relay/
├── pyproject.toml                     # uv workspace 根
├── uv.lock                            # 自动生成
├── package.json                       # npm workspaces 根
├── package-lock.json                  # 自动生成
│
├── packages/
│   └── types/                         # @clawd-relay/types — 共享 TS 类型
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts               # 重新导出 protocol.ts
│
├── bridge/                            # Python Bridge (uv 子包)
│   ├── pyproject.toml
│   └── src/
│       └── bridge/
│           ├── __init__.py
│           └── schemas.py             # Pydantic 模型（语义对齐）
│
├── worker/                            # CF Worker (npm 子包)
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   └── src/
│       └── index.ts                   # 占位入口
│
└── web/                               # 网页客户端 (npm 子包)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx                   # Preact 入口
        └── style.css                  # Tailwind 入口
```

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| Python 包管理器 | uv >= 0.5 | 原生 workspace 支持，快速 resolver，`uv tool` |
| JS 包管理器 | npm >= 10 | workspace 零配置，显式 lockfile |
| Python 异步框架 | FastAPI + Uvicorn | 异步原生，Pydantic 集成，自动文档 |
| CF Worker 框架 | Hono | TypeScript 原生，WS upgrade helper，极简 |
| 网页框架 | Preact + Vite + Tailwind + daisyUI | 轻量、快速开发、UI 美观零成本 |
| TS 类型共享 | npm workspaces (`packages/types/`) | 零运行时开销，Vite + esbuild 原生解析 |
| 数据模型规范 | `generated/data-model.md` | 全系统 Pydantic 数据模型统一标准 |

## 前置文档

- [x] `generated/data-model.md` — 已创建。所有需求的数据实体定义应遵循此文档。

## 实现路径

### 步骤 1 — uv workspace 根
- 根 `pyproject.toml`：声明 `[tool.uv.workspace]`，成员 `members = ["bridge"]`
- `bridge/pyproject.toml`：Python 3.12+，FastAPI，Uvicorn，Pydantic>=2，websockets>=12

### 步骤 2 — npm workspace 根
- 根 `package.json`：`workspaces: ["packages/*", "worker", "web"]`

### 步骤 3 — 共享 TypeScript 类型包
- `package.json`：name `@clawd-relay/types`，无运行时依赖
- `tsconfig.json`：`strict: true`，`declaration: true`
- `src/protocol.ts`：定义 9 种消息类型接口
- `src/index.ts`：重新导出所有类型


### 步骤 4 — Worker 脚手架
- `worker/package.json`：依赖 `hono`，`@clawd-relay/types`
- `worker/tsconfig.json`：严格模式，ES module
- `worker/wrangler.toml`：DO 绑定 + migration

### 步骤 5 — Web 脚手架
- `web/package.json`：依赖 `preact`，`@clawd-relay/types`，`vite`
- `web/vite.config.ts`：Preact 插件 + Tailwind 插件
- `web/index.html` + `web/src/main.tsx` + `web/src/style.css`

### 步骤 6 — Pydantic Schema
- `bridge/src/bridge/schemas.py`：Pydantic BaseModel，与 TypeScript 类型语义对齐
- 包含 data-model.md 定义的所有实体：
  - 枚举类型：`AGENT_IDS`、`SESSION_STATES`、`PERMISSION_STATUS`（仅 Python 端，TS 端通过字符串字面量）
  - 核心实体：`DeviceInfo`、`SessionInfo`、`TokenRecord`、`PermissionRecord`、`AlwaysAllowRule`
  - 11 种消息类型：`SessionStateMsg`、`PermissionRequestMsg`、`HelloMsg`、`KeepaliveMsg`、`PermissionResponseMsg`、`DNDChangeMsg`、`AlwaysAllowMsg`、`NoClientsMsg`、`DeviceOnlineMsg`、`SyncSnapshotMsg`（+ 可选 `ProbeMsg`）
  - 所有模型配置 `model_config = {"populate_by_name": True}`
  - 所有字段使用 `Field(alias=...)` 实现 camelCase ↔ snake_case 映射
- 同时同步更新 TS protocol.ts，确保消息类型数与 Python 端一致（11 种）

### 步骤 7 — 一致性验证
- 编写测试验证双端消息构造正确
- 所有字段名、类型、可选性规则一致

## 关键技术要点

### TypeScript ↔ Pydantic 语义对齐
协议定义在两个文件中，需保持同步：
- `packages/types/src/protocol.ts` — TypeScript 唯一来源
- `bridge/src/bridge/schemas.py` — Python 等价（手动同步）

无代码生成器。同步规则：
1. 两端定义同样的 11 种消息类型，顺序一致（见步骤 6 清单）
2. 字段名使用 camelCase（通用约定）
3. Pydantic 使用 `Field(alias=...)` 处理命名差异
4. 代码审查时需同时检查两端的协议文件

### 端口区间
Bridge 保留端口范围 `23555-23559`，与 clawd-on-desk 的 `23333-23337` 无冲突。

## 不做范围
- Bridge/Worker/Web 的运行时代码（仅创建脚手架文件）
- CI/CD 配置
- 部署脚本
- Hook 目录 `bridge/src/bridge/hooks/` 下的任何代码
