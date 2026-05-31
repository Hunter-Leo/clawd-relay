# Round 1 计划 — 003 cf-worker (Hono + Durable Object)

## 项目结构

```
worker/
├── package.json            — 依赖: @clawd-relay/types, hono; devDeps: wrangler, typescript, @cloudflare/workers-types
├── tsconfig.json           — strict: true, target ES2022
├── wrangler.toml           — DO 绑定 RELAY_ROOM → RelayRoom, migration v1
└── src/
    ├── index.ts            — Hono 应用: 路由 + WS 升级转发 (修改现有文件)
    ├── durable-object.ts   — RelayRoom DO: 连接集合, 消息路由, RingBuffer 缓冲
    ├── admin-console.ts    — 管理控制台 HTML 模板生成
    └── types.ts            — Worker 专有类型 (新建)
```

需修改的现有文件:
- `worker/src/index.ts` — 添加所有路由和 WS 升级逻辑
- `worker/wrangler.toml` — 无需修改 (DO 绑定已配置)

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Hono ^4.7 | CF Workers 原生支持, upgradeWebSocket 辅助函数 |
| WS 升级 | 标准 CF DO 模式 | DO.fetch() + WebSocketPair, 非 Hono 的 upgradeWebSocket |
| DO 存储 | `state.storage` | 内建功能, 免费 1GB, 无需外部数据库 |
| 语言 | TypeScript 5.7, strict | 类型安全, discriminated union 消息分发 |
| 协议类型 | `@clawd-relay/types` (workspace 依赖) | 单一真相源, 不重复定义 |
| 构建 | Wrangler + esbuild | CF 零配置构建流水线 |

## 实现路径

### 步骤 1 — `src/types.ts` — Worker 专有类型

共享协议未覆盖的 DO 存储类型:
- `TokenRecord` — `{ id, label, createdAt, expiresAt?, revoked? }` 存储在 DO storage
- `AdminTokenRequest` — `{ label, expiresInDays? }`
- `AdminTokenListResponse` — `{ tokens: TokenRecord[], bridgeStatus: Record<string, boolean> }`

### 步骤 2 — `src/durable-object.ts` — RelayRoom DO

核心 DO 类, 包含:
- **连接集合**: `bridges: Set<WebSocket>` (最多 1 个), `clients: Set<WebSocket>` (多路)
- **消息路由**: 基于 `type` 字段的 discriminated union 分发
- **离线缓冲**: RingBuffer, 最多保留最近 50 条 BroadcastMsg
- **心跳检测**: alarm 定时器, 35s 空闲 → 标记 bridge 离线
- **Token CRUD**: 通过 `fetch()` 处理 Admin API 调用
- **无客户端处理**: permission_request 时 `clients.size === 0` → 回复 `no_clients` 给 bridge

### 步骤 3 — `src/index.ts` — 所有路由

扩展现有路由:
- `GET /relay/connect?token=` → WS 升级, 转发到 DO
- `POST /admin/token` → 创建 token (ADMIN_SECRET 鉴权)
- `GET /admin/tokens` → 列出所有 token
- `DELETE /admin/token/:id` → 撤销 token
- `GET /admin` → 管理控制台页面
- 错误中间件: 400/401/403/500

### 步骤 4 — `src/admin-console.ts` — 管理页面

内联 HTML 模板:
- 登录表单 (输入 ADMIN_SECRET → sessionStorage)
- Token 列表表格含设备在线状态
- 创建 Token 表单
- 撤销 Token 按钮
- 响应式内联 CSS, 无外部依赖

## 关键技术要点

### 消息路由矩阵

| 方向 | 消息类型 | 动作 |
|------|----------|------|
| Bridge → DO | hello | 校验 token, 加入 bridges, 发送 device_online |
| Bridge → DO | session_state | 广播给所有 clients |
| Bridge → DO | permission_request | 广播给所有 clients (若无 clients 则回复 no_clients) |
| Bridge → DO | keepalive | 仅更新 lastBridgeActivity 时间戳 |
| Client → DO | permission_response | 转发给 bridge (若存在) |
| Client → DO | dnd_change | 转发给 bridge |
| Client → DO | always_allow | 转发给 bridge |

### DO 存储模型

```
每个 token 的记录:
  key: `token:${id}`
  value: { id, label, createdAt, expiresAt?, revoked? }

Token 注册索引:
  key: `token_ids`
  value: string[]  (有序 token ID 列表)
```

### WebSocket 升级流程

```
Client → GET /relay/connect?token=xxx
  → index.ts 校验 ?token= 参数 (缺失返回 400)
  → DO stub = RELAY_ROOM.idFromName(token)
  → room.fetch(request) → DO.fetch() 通过 WebSocketPair 处理升级
  → DO.webSocketMessage 收到 "hello"
  → 校验 token 与 state.storage 匹配
  → 接受: 加入 bridges/clients, 发送 device_online: true
  → 拒绝: 关闭连接 4001
```

### 心跳检测

- 每次 bridge 消息: 记录 `lastBridgeActivity = Date.now()`
- `alarm` 每 30s 触发, 检查: `Date.now() - lastBridgeActivity > 35000`
- 超时 → 从 bridges 移除, 广播 `device_online: false`
- 新 bridge 连接 → 踢旧 bridge, 广播旧 bridge 离线

### 离线缓冲 (RingBuffer)

- 数组长度最多 50, 循环覆盖
- Bridge 消息追加到缓冲后再广播
- 新 client 连接: 仅向该 client 推送所有缓冲消息
- 过滤不缓冲: keepalive (无状态), device_online (已被新状态取代)

## 不做范围

- 网页客户端 UI (REQ-004)
- Token 轮换 / 自动清理 (后续轮次)
- 除 ADMIN_SECRET 外的认证方式
- 跨 DO 通信
- WebSocket 压缩协商

## Design Compliance Review

- [x] **SRP** — index.ts(路由), durable-object.ts(DO), admin-console.ts(HTML), types.ts(类型)
- [x] **OCP** — 消息路由基于 `type` 的 discriminated union 分发; 新增消息类型只需添加新 case
- [x] **LSP** — 无继承层次
- [x] **ISP** — DO 只导出 `RelayRoom` 类; 类型只暴露所需接口
- [x] **DIP** — index.ts 依赖 DO namespace 抽象, 非具体连接管理
- [x] 所有决策符合 init.md Constitution (严格 TS, 无 `any`, discriminated union)
- [x] 无硬编码密钥 (环境变量: ADMIN_SECRET, DO 绑定来自 wrangler.toml)
- [x] 不重复定义: 协议类型从 @clawd-relay/types 导入
- [x] 错误处理: try/catch 广播, 400/401/403/500 响应
