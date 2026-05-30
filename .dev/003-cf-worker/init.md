# 003 — CF Worker (Hono + Durable Object)

project_stage: pre-launch

## Spec

### 背景与动机

Cloudflare Worker 是 Clawd Relay 的云端入口。它负责接收 Bridge 的 WebSocket 连接，按 token 路由到 Durable Object 房间，在 Bridge 和网页/硬件客户端之间中继消息，并提供管理控制台。

Worker 运行在 Cloudflare 全球边缘网络上，零服务器运维，免费额度足够个人使用。

### 核心目标

实现一个无状态 Worker 入口 + 有状态 DO 房间的消息路由系统，提供 WebSocket 接入、Token 鉴权、管理控制台 API 和管理员控制页面。

### 使用场景

- Bridge 通过 `wss://relay.xxxx.workers.dev/relay/connect?token=abc123` 连入
- 网页端通过浏览器 WebSocket 连入同一个 token 的房间，实时看到设备状态
- 管理员通过 Web 控制台查看所有活跃 token、设备状态、撤销 token
- 管理员通过 API 生成邀请码给朋友使用
- Bridge 断线重连后恢复事件流

## 需求

### 功能需求

**1. Worker 入口**（Hono）：
- `GET /relay/connect` — WebSocket 升级端点，校验 `?token=` 参数
- `POST /admin/token` — 生成新 token（校验 `Authorization: Bearer <ADMIN_SECRET>`）
- `GET /admin/tokens` — 列出所有活跃 token 及其状态
- `DELETE /admin/token/:id` — 撤销 token
- 错误处理：无效 token 返回 401，缺少参数返回 400

**2. Durable Object 房间**：
- 按 token 路由，一个 DO 实例对应一个 token
- 维护两个 WebSocket 集合：`bridges`（独占，最多 1 个）和 `clients`（多路）
- 消息路由：
  - Bridge → DO：广播给所有 clients
  - Client → DO：仅转发给 bridge（permission_response）
  - Bridge → DO 的 keepalive：更新在线状态，不广播
- 离线缓冲：最多保留最近 50 条事件（RingBuffer），新 client 连入时推送
- 心跳检测：35 秒无消息则将 bridge 标记为离线

**3. Token 鉴权**：
- WebSocket 建立时校验 token 是否在白名单中
- Token 记录存储在 DO storage（`state.storage`）
- Token 包含：`id`（token 值）、`label`（备注）、`created_at`、`expires_at`（可选）
- Admin API 生成的 token 自动存入对应 DO 房间的 storage

**4. WebSocket 生命周期管理**：
- Bridge 断开后清除 bridges 集合，广播 `device_online: false`
- Client 断开后清除 clients 集合，不影响其他
- 新的 Bridge 连接踢掉旧 Bridge
- 所有连接关闭时发送 WebSocket Close frame（1000）

**5. Admin 控制台页面**（内嵌在 Worker 中的管理页面）
- `GET /admin` — 管理员控制台页面（内嵌 HTML，用 Hono 的 html helper 或静态内联）
- 页面功能：
  - 显示所有活跃 token 列表（ID、备注、创建时间、到期时间、状态）
  - 每个 token 的设备在线状态（是否连接了 Bridge）
  - 生成新 token 表单（输入 label + 可选过期时间）
  - 撤销 token 按钮
  - 全局概览：总 token 数、在线设备数、活跃房间数
- 认证方式：`ADMIN_SECRET` 输入表单（输入后存 sessionStorage，请求时带 `Authorization` header）
- 页面实现：内联 HTML + Preact（客户端渲染），与 Admin API 交互
- 响应式设计，美观实用

### 技术需求

- TypeScript 5.x，`hono`（WebSocket helper + html template），`wrangler` 部署
- Durable Objects（DO）启用
- 环境变量：`ADMIN_SECRET`
- `wrangler.toml` 配置 DO class 绑定
- Admin 控制台页面不依赖外部 CSS/JS CDN（自包含，可离线加载）

### 接口定义

接收和发送的消息格式遵从 001 号需求定义的 `@clawd-relay/types` 共享协议包。

Admin API 使用 JSON 格式：

| 端点 | 方法 | 认证 | 描述 |
|---|---|---|---|
| `/admin/token` | POST | `ADMIN_SECRET` | 生成 token，body: `{label, expires_in_days?}` |
| `/admin/tokens` | GET | `ADMIN_SECRET` | 列出所有 token 及状态 |
| `/admin/token/:id` | DELETE | `ADMIN_SECRET` | 撤销 token |

### 预期产出

- `worker/src/index.ts` — Worker 入口（API + 控制台路由）
- `worker/src/durable-object.ts` — DO 实现
- `worker/src/admin-console.ts` — 管理控制台页面 HTML 生成
- `worker/wrangler.toml` — 部署配置
- `worker/package.json`（依赖 `@clawd-relay/types`，不自建 protocol.ts）

## Action Items

**Round artifacts** (maintained across rounds):
- [ ] `issues.md`

**Required documents** (always, in order):
- [ ] `generated/rounds/round-001/plan.md` — Phase 04
- [ ] `generated/rounds/round-001/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06

## Constitution

### 适用语言

TypeScript 5.x

### 架构原则

- **单一职责**：
  - `index.ts` — 路由 + WS 升级
  - `durable-object.ts` — 房间连接管理 + 消息转发
  - `protocol.ts` — 消息类型定义（引用 `@clawd-relay/types`，补充 Worker 专有类型）
  - `admin-console.ts` — 管理页面 HTML 模板
- **使用 Hono 的 `upgradeWebSocket` helper**，避免手动处理 WS 升级
- **DO 内部使用 `state.storage` 持久化**，不依赖外部数据库
- **所有广播操作需要 try/catch**，单个 client 断开不影响其他

### 类型安全

- `strict: true` 启用
- 消息类型用 discriminated union（`type` 字段区分）
- 不使用 `any` 逃逸
- 所有函数参数和返回值显式标注

### 错误处理

- WebSocket upgrade 时 token 无效 → 返回 401 JSON
- DO 内 WS 发送失败 → 从 clients 集合移除该 socket，继续
- Admin API 的 `ADMIN_SECRET` 不匹配 → 返回 403，不泄露信息
- Admin 控制台页面内 API 请求失败 → 页面内显示友好错误提示
- 所有未预期异常捕获并返回 500

### 测试

- DO 房间逻辑单元测试（vitest + `miniflare`）
- 消息路由正确性：Bridge → Client、Client → Bridge、广播
- Token 鉴权流程
- Admin API 端点测试
