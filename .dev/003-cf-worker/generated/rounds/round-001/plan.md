# 003 — CF Worker (Hono + Durable Object) — 实现计划

## 项目结构

```
worker/
├── package.json            # 依赖 @clawd-relay/types（共享协议类型）
├── tsconfig.json
├── wrangler.toml
├── src/
│   ├── index.ts              # Hono 应用：路由、WS 升级、Admin API
│   ├── durable-object.ts     # RelayRoom DO 类
│   └── admin-console.ts      # 管理控制台页面 HTML
└── node_modules/
```

> 注意：消息类型定义已移至 `packages/types/src/protocol.ts`（`@clawd-relay/types`），worker 不单独维护 `protocol.ts`。

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Hono 4.7+ | 原生 CF Workers 支持，`upgradeWebSocket` 辅助函数 |
| DO 存储 | `state.storage` | 内建功能，免费 1GB，无需外部数据库 |
| 构建 | Wrangler + esbuild | CF 零配置构建流水线 |

## 实现路径

### 步骤 1 — 环境配置与 Wrangler 配置
- `wrangler.toml`：DO 绑定 `RELAY_ROOM → RelayRoom`，配置 migration
- 环境变量 `ADMIN_SECRET`（字符串类型，必填—无默认值）
- Worker 入口处检查 `c.env.ADMIN_SECRET`：若缺失则所有 `/admin/*` 路由返回 503 并附带说明性错误消息

### 步骤 2 — Durable Object (`durable-object.ts`)

**类：`RelayRoom`**
- 构造函数：初始化 `bridges: Set<WebSocket>`、`clients: Set<WebSocket>`、`tokenRecord: TokenRecord | null`
- `fetch(request)`：接受 WebSocket 升级请求

**WebSocket 升级流程（DO 侧）：**
```typescript
async fetch(request: Request): Promise<Response> {
  // 标准 CF Workers DO WebSocket 升级模式
  // DO 的 fetch 接收来自 Worker 路由的完整请求
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)
  
  // 接受 WebSocket 连接——此后 webSocketMessage 事件会在 DO 内触发
  this.webSocket = server
  server.accept()
  
  // 检查是否为 Bridge（通过 HelloMsg）还是 Client
  // 存储到相应集合
  
  return new Response(null, { status: 101, webSocket: client })
}
```

**WebSocket 生命周期：**
- `webSocketMessage(ws, message)`：
  - 收到 `hello` 消息 → 校验 token 并关联设备信息，将 ws 加入对应集合（Bridge 连入 → `bridges`，Client 连入 → `clients`）
  - 收到 `keepalive` → 更新 Bridge 的最后活跃时间
  - 收到上行消息（type 为 session_state 等）→ 广播给所有 clients
  - 收到下行消息（type 为 permission_response/dnd_change/always_allow）→ 转发给 bridge
  - **收到 `permission_request`** → 检查 `clients.size`：
    - **`clients.size === 0`**：在 Bridge 的 WS 连接上直接回复 `{"type": "no_clients", "permission_id": msg.permissionId}`
    - **`clients.size >= 1`**：广播给所有 clients，等用户回复
- `webSocketClose(ws)`：
  - 如果是 Bridge 断开：从 `bridges` 移除，广播 `{ type: "device_online", online: false }`
  - 如果是 Client 断开：从 `clients` 移除
- `webSocketError(ws, err)`：记录日志，按断开处理

**Token 校验：**
- 将 `tokenRecord { id, label, created_at, expires_at }` 存储在 `state.storage`
- WebSocket 连接时接收到 `HelloMsg` → 校验 token 与存储记录匹配
- 35 秒空闲超时：超过 35 秒未收到 bridge 的任何消息，广播离线状态

**离线事件缓冲：**
- `recentEvents: CircularBuffer<50>` — 固定长度 RingBuffer
- 每条 Bridge → Client 消息追加到缓冲
- 新 Client 连接时，将缓冲内容作为 `SyncSnapshotMsg` 推送

### 步骤 3 — Worker 入口 (`index.ts`)

**路由表：**

| 路由 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/relay/connect` | GET | `?token=` 查询参数 | WebSocket 升级 → 按 token 路由到 DO |
| `/join/:token` | GET | 无 | 302 重定向到 `/?token=:token` |
| `/admin/token` | POST | `Authorization: Bearer ADMIN_SECRET` | 生成 token |
| `/admin/tokens` | GET | Bearer ADMIN_SECRET | 列出所有活跃 token |
| `/admin/token/:id` | DELETE | Bearer ADMIN_SECRET | 撤销 token |
| `/admin` | GET | 表单输入密码 | 管理员控制台页面 |

**WebSocket 升级（标准 CF Workers DO 模式）：**
```typescript
// Worker 入口——将 WS 请求直接转发给 DO，由 DO 处理升级
app.get("/relay/connect", async (c) => {
  const token = c.req.query("token")
  if (!token) return c.text("Missing token parameter", 400)
  
  const roomId = token
  const stub = c.env.RELAY_ROOM.idFromName(roomId)
  const room = c.env.RELAY_ROOM.get(stub)
  
  // 将整个请求转发给 DO——DO 的 fetch 方法负责 WS 升级和后续消息处理
  return room.fetch(c.req.raw)
})
```

**原理说明：**
- Hono 不介入 WS 升级过程——Worker 只是路由层，将请求无条件转发给 DO
- DO 的 `fetch()` 接收请求，通过 `new WebSocketPair()` 完成升级
- 升级后 DO 通过 `server.accept()` 接管连接，`webSocketMessage`/`webSocketClose` 等事件直接在 DO 内触发
- Worker 侧不再参与 WS 消息处理，纯路由
- 这是 CF Workers 官方文档推荐的标准 Durable Object WebSocket 模式

### 步骤 4 — Admin Console 页面 (`admin-console.ts`)
- 返回自包含 HTML 页面（Hono 的 `html` helper）
- 前端用 Preact 内联渲染（无 CDN 依赖）
- 功能：
  - 登录表单（输入 ADMIN_SECRET，存入 sessionStorage）
  - Token 列表表格（ID、备注、创建时间、过期时间、设备在线状态）
  - 创建 Token 表单（输入 label + 可选过期天数）
  - 撤销 Token 按钮
  - 全局概览：总 token 数、已注册 token 数

## 关键技术要点

### Token 路由隔离
```
Worker: /relay/connect?token=abc123
  → roomId = "abc123"
  → DO stub = RELAY_ROOM.idFromName("abc123")
  → 每个 token 对应独立的 DO 实例，完全隔离
```

### Admin API Token 存储
创建 Token 时通过 DO namespace 路由存储：
```
创建 Token:
  → DO stub = RELAY_ROOM.idFromName(token)   // 按 token 名创建 DO
  → stub.fetch(new Request("/admin/register", { method: "POST", body: JSON.stringify(record) }))
```
列出 Token：维护一个独立的 "token registry" DO 实例，映射 token → 元数据。

## 不做范围
- 网页客户端 UI（REQ-004）
- Token 轮换/到期自动清理（Phase 2）
- ADMIN_SECRET 之外的认证方式
- Token 持久化到外部数据库（仅用 DO storage）
