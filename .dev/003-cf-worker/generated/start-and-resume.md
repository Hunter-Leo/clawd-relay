# 启动与恢复指南 — 003 cf-worker
**当前轮次:** 2

## 快速开始
1. 读取 `.dev/blueprint.md` — 项目整体状态
2. 读取 `init.md` — 003 需求范围
3. 读取 `rounds/round-001/plan.md` — 技术方案
4. 读取 `rounds/round-001/tasks.md` — 找下一个 `not-started` 任务
5. 在执行前阅读下方的 Constitution 和 Coding Standards

## 中断后恢复
1. 读取 `00-agent-execution.md § Handling Project Overview Queries` — 用其中格式展示完整项目状态
2. 读取 `.dev/blueprint.md` — 查看所有需求、阶段和整体状态
3. 检查 `issues.md` 中的遗留未解决问题
4. 打开 `rounds/round-001/tasks.md`，找到第一个非 `done` 的任务
5. 如果有 `in-progress` 的任务，阅读其 Notes 获取上下文后再继续
6. 如果有 `blocked` 的任务，阅读 Notes 并先解决阻塞原因
7. 继续前阅读下方的 Constitution 和 Coding Standards

## 关键文档
- 需求定义: `.dev/003-cf-worker/init.md`
- 跨轮次问题: `.dev/003-cf-worker/issues.md`
- 当前计划: `.dev/003-cf-worker/generated/rounds/round-002/plan.md`
- 当前任务: `.dev/003-cf-worker/generated/rounds/round-002/tasks.md`

---

## Round History
**当前轮次:** 1

### Round 2 (完成)
- **状态:** ✅ done
- **位置:** `generated/rounds/round-002/`
- **任务:** 3 planned, 3 completed, 0 deferred
- **新问题:** ISS-001 resolved
- **未解决问题:** 0
- **概要:** 实现 TokenRegistry DO，`GET /admin/tokens` 现可正确返回所有 token 列表和在线状态。

**当前轮次:** 2

### Round 1 (完成)
- **状态:** ✅ done
- **位置:** `generated/rounds/round-001/`
- **任务:** 9 planned, 9 completed, 0 deferred
- **新问题:** ISS-001 — GET /admin/tokens 缺少注册表 DO (open)
- **未解决问题:** 1
- **概要:** 实现 CF Worker 完整功能: Worker 入口路由 + WS 升级转发、RelayRoom DO 消息路由 + 心跳检测 + 离线缓冲、Admin API 和管理控制台页面。22 项测试全部通过。

---

## Constitution

### 适用语言
TypeScript 5.x, `strict: true`

### 架构原则
- **单一职责**: index.ts(路由), durable-object.ts(DO), admin-console.ts(HTML), types.ts(类型)
- **使用标准 CF DO WebSocket 模式**: DO.fetch() + WebSocketPair, 非 Hono 的 upgradeWebSocket
- **DO 内部使用 `state.storage` 持久化**, 不依赖外部数据库
- **所有广播操作需要 try/catch**, 单个 client 断开不影响其他

### 类型安全
- `strict: true` 启用
- 消息类型用 discriminated union（`type` 字段区分）
- 不使用 `any` 逃逸
- 所有函数参数和返回值显式标注

### 错误处理
- WebSocket upgrade 时 token 无效 → 返回 401 JSON
- DO 内 WS 发送失败 → 从 clients 集合移除该 socket, 继续
- Admin API 的 `ADMIN_SECRET` 不匹配 → 返回 403, 不泄露信息
- Admin 控制台页面内 API 请求失败 → 页面内显示友好错误提示
- 所有未预期异常捕获并返回 500

### 测试
- DO 房间逻辑单元测试 (vitest + `miniflare`)
- 消息路由正确性: Bridge → Client, Client → Bridge, 广播
- Token 鉴权流程
- Admin API 端点测试

### 通用标准
- **OOP & SOLID** — 封装、单一职责、OCP（无 if/elif 链条）、DIP（依赖抽象接口）
- **类型注解** — 所有函数/方法的参数和返回值都需标注
- **Docstrings** — 每个公开的类、函数和文件都要有文档注释
- **测试** — 覆盖正常情况 + 边界情况 + 错误情况
- **不要硬编码密钥** — 使用环境变量
- **导入规则** — 不要延迟导入; 重构避免循环依赖

---

## Git Workflow

分支: `feat/003-cf-worker`

Commit 格式:
```
[003] T-XXX <type>: <imperative summary ≤ 72 chars>
```
Types: `feat` · `fix` · `refactor` · `test` · `docs` · `style` · `perf` · `ci` · `build` · `chore`

---

## 执行模式推荐

分析 tasks.md（9 个任务: 4 feat + 4 test + 1 config，线性依赖链），使用默认的单 agent 串行执行模式。各任务间依赖性强（feat → test 循环），不适合并行。

---

## Deviation Protocol

参见 `00-start-and-resume.md § Deviation Protocol`。
