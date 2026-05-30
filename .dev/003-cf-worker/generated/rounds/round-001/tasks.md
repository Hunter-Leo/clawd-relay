# 任务列表 — 003 cf-worker, Round 1

## 状态表

| ID    | 类型   | 任务名称                            | 状态        | 优先级 | 依赖       | 备注 |
|-------|--------|-------------------------------------|-------------|--------|------------|------|
| T-001 | config | 配置 vitest + miniflare 测试环境     | done        | P0     | -          | vitest 4.1.7 + @cloudflare/vitest-pool-workers 0.16.10, wrangler.toml 配置 |
| T-002 | feat   | 实现 types.ts                       | not-started | P0     | -          |      |
| T-003 | test   | 测试 types.ts 类型定义               | not-started | P0     | T-002      |      |
| T-004 | feat   | 实现 RelayRoom DO                   | not-started | P0     | T-002      |      |
| T-005 | test   | 测试 RelayRoom DO 逻辑               | not-started | P0     | T-004      |      |
| T-006 | feat   | 实现 index.ts 路由和 WS 升级         | not-started | P0     | T-002, T-004 |      |
| T-007 | test   | 测试 index.ts 路由                   | not-started | P0     | T-006      |      |
| T-008 | feat   | 实现 admin-console.ts 管理页面       | not-started | P1     | T-004      |      |
| T-009 | test   | 测试 admin-console.ts                | not-started | P1     | T-008      |      |

---

#### T-001 — 配置 vitest + miniflare 测试环境

**目标:** 搭建支持 DO 的 Worker 测试基础设施。

**需求:**
- 安装 vitest 和 `@cloudflare/vitest-pool-workers` 为 devDependencies
- 创建 `vitest.config.ts` 或基于 `wrangler.toml` 的测试配置
- 编写冒烟测试验证测试环境可运行

**验收标准:**
- `npm test` 成功执行 vitest
- 冒烟测试通过 (DO binding mock 或 miniflare 本地模式)

**参考:** `plan.md § 实现路径 Step 1`

**实现摘要:** *(执行时填写)*

---

#### T-002 — 实现 types.ts

**目标:** 定义 Worker 专有类型 (TokenRecord, Admin API 类型)。

**需求:**
- `TokenRecord`: `{ id: string; label: string; createdAt: number; expiresAt?: number; revoked?: boolean }`
- `AdminTokenRequest`: `{ label: string; expiresInDays?: number }`
- `AdminTokenListResponse`: `{ tokens: TokenRecord[]; bridgeStatus: Record<string, boolean> }`

**验收标准:**
- 所有类型正确导出
- TokenRecord 与共享协议类型清晰区分

**参考:** `plan.md § Step 1`

**实现摘要:** *(执行时填写)*

---

#### T-003 — 测试 types.ts 类型定义

**目标:** Worker 专有类型的单元测试。

**需求:**
- 测试 TokenRecord 构造
- 测试 AdminTokenRequest 结构
- 测试 AdminTokenListResponse 结构

**验收标准:**
- 所有测试通过

**参考:** `plan.md § Step 1`

**实现摘要:** *(执行时填写)*

---

#### T-004 — 实现 RelayRoom DO

**目标:** 实现 RelayRoom Durable Object 类。

**需求:**
- 连接集合: `bridges: Set<WebSocket>` (最多 1 个), `clients: Set<WebSocket>` (多路)
- 基于 `type` 字段的 discriminated union 消息路由:
  - `hello` → 校验 token, 加入 bridges/clients, 发送 `device_online`
  - `session_state` / `permission_request` → 广播给所有 clients
  - `keepalive` → 仅更新 `lastBridgeActivity`
  - `permission_response` / `dnd_change` / `always_allow` → 转发给 bridge
- 离线缓冲: RingBuffer 最多 50 条 BroadcastMsg, 新 client 连接时推送
- 心跳检测: alarm 每 30s 触发, 35s 空闲阈值 → 广播 `device_online: false`
- 无客户端处理: `clients.size === 0` 时 permission_request → 回复 `no_clients` 给 bridge
- Token CRUD 通过 `fetch()` 处理 Admin API 调用
- 新 bridge 替换旧 bridge (踢旧 + 广播离线)

**验收标准:**
- DO 类默认导出
- 消息路由矩阵正确
- 心跳检测正常工作
- 离线缓冲最多保留 50 条消息

**参考:** `plan.md § Step 2, 消息路由矩阵, DO 存储模型`

**实现摘要:** *(执行时填写)*

---

#### T-005 — 测试 RelayRoom DO 逻辑

**目标:** DO 逻辑的单元测试 (mock WebSocket 和 storage)。

**需求:**
- 测试消息路由: Bridge→Client, Client→Bridge, keepalive
- 测试有效/无效 token 的 hello 处理
- 测试 clients 为空时的 no_clients 响应
- 测试心跳超时触发离线广播
- 测试离线缓冲 (RingBuffer) 容量和推送
- 测试 bridge 替换 (踢旧, 广播)

**验收标准:**
- 所有测试通过

**参考:** `plan.md § Step 2, 消息路由矩阵`

**实现摘要:** *(执行时填写)*

---

#### T-006 — 实现 index.ts 路由和 WS 升级

**目标:** 扩展 Hono 应用添加所有路由和 WebSocket 升级。

**需求:**
- `GET /relay/connect?token=` → 校验 token 参数, 转发请求到 DO stub
- `POST /admin/token` → 校验 `Authorization: Bearer <ADMIN_SECRET>`, 通过 DO fetch 创建 token
- `GET /admin/tokens` → 校验 ADMIN_SECRET, 通过 token registry DO 列出所有 token
- `DELETE /admin/token/:id` → 校验 ADMIN_SECRET, 通过 DO 撤销 token
- `GET /admin` → 返回管理控制台 HTML
- 错误中间件: 400 (缺参数), 401 (无认证), 403 (认证错误), 500 (未预期错误)
- 启动时检查 `c.env.ADMIN_SECRET`; 缺失 → admin 路由返回 503

**验收标准:**
- 所有路由注册正确
- WS 升级正确流转到 DO
- Admin 路由由 ADMIN_SECRET 保护

**参考:** `plan.md § Step 3, WebSocket 升级流程`

**实现摘要:** *(执行时填写)*

---

#### T-007 — 测试 index.ts 路由

**目标:** Hono 路由测试 (使用 miniflare 或 mock env)。

**需求:**
- 测试 GET / 返回 OK
- 测试 /relay/connect 缺 token 返回 400
- 测试 admin 路由带/不带正确的 Authorization header
- 测试未知路由返回 404

**验收标准:**
- 所有测试通过

**参考:** `plan.md § Step 3`

**实现摘要:** *(执行时填写)*

---

#### T-008 — 实现 admin-console.ts 管理页面

**目标:** 生成管理控制台 HTML 页面。

**需求:**
- 内联 HTML 字符串 (无外部依赖)
- 登录表单: 输入 ADMIN_SECRET → 存入 sessionStorage
- Token 列表表格: ID, 备注, 创建时间, 过期时间, 在线状态
- 创建 Token 表单: 输入 label + 可选过期天数
- 每行撤销 Token 按钮
- 全局概览: 总 token 数, 在线设备数
- 响应式内联 CSS
- 从 sessionStorage 读取 ADMIN_SECRET 带 `Authorization` header 调用 Admin API

**验收标准:**
- 返回合法 HTML 字符串
- 页面包含所有必需 UI 元素
- 无外部 CDN 依赖

**参考:** `plan.md § Step 4`

**实现摘要:** *(执行时填写)*

---

#### T-009 — 测试 admin-console.ts

**目标:** 管理控制台 HTML 生成的测试。

**需求:**
- 测试 HTML 输出包含预期元素 (登录表单, token 表格等)
- 测试 HTML 结构合法

**验收标准:**
- 所有测试通过

**参考:** `plan.md § Step 4`

**实现摘要:** *(执行时填写)*
