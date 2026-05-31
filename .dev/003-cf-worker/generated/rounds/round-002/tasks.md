# 任务列表 — 003 cf-worker, Round 2 (Token Registry)

## 状态表

| ID    | 类型   | 任务名称                                | 状态        | 优先级 | 依赖 | 备注 |
|-------|--------|-----------------------------------------|-------------|--------|------|------|
| T-001 | feat   | 向 RelayRoom fetch handler 添加注册表路由 | done        | P0     | -    | 类型检查通过 |
| T-002 | feat   | 更新 index.ts 使用注册表 DO             | in-progress | P0     | T-001 |      |
| T-003 | test   | 测试注册表 DO 功能                      | not-started | P0     | T-002 |      |

---

#### T-001 — 向 RelayRoom fetch handler 添加注册表路由

**目标:** 在 RelayRoom.fetch() 中添加 `/registry/list`, `/registry/add`, `/registry/remove` 路由。

**需求:**
- `/registry/list` (GET) — 从 storage 读取 `token_ids` 列表并返回
- `/registry/add` (POST) — 添加 token ID 到 `token_ids` 列表
- `/registry/remove` (POST) — 从 `token_ids` 列表移除指定 ID

**验收标准:**
- 注册表操作通过 DO stub.fetch() 可调用
- 列表去重、删除存在性检查

**参考:** `plan.md § 修改范围`

---

#### T-002 — 更新 index.ts 使用注册表 DO

**目标:** 创建 token 时写入注册表，列出 tokens 时从注册表读取。

**需求:**
- POST /admin/token 创建 token 后，向注册表 DO 添加 ID
- GET /admin/tokens 从注册表 DO 获取所有 ID，逐个查询并合并结果
- 使用固定 DO 名称 `idFromName("__relay_registry__")`
- 每个 token 查询包含在线状态

**验收标准:**
- 创建 token 后可在列表中看到
- 列表返回正确的 token 记录和在线状态

**参考:** `plan.md § 数据流`

---

#### T-003 — 测试注册表 DO 功能

**目标:** 测试注册表路由和完整流程。

**需求:**
- 测试 registry/list 返回正确列表
- 测试 registry/add 添加上限
- 测试 registry/remove 删除
- 测试完整创建→列出流程

**验收标准:**
- 所有测试通过

**参考:** `plan.md § 数据流`
