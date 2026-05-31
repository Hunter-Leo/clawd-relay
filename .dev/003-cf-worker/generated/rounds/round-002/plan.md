# Round 2 计划 — 003 cf-worker (Token Registry)

## 背景

Round 1 的 ISS-001 问题：`GET /admin/tokens` 返回空数组，因为每个 DO 实例存储独立，无法全局列出 token。

**修复方案：** 使用一个固定名称的 DO 单例作为 TokenRegistry，维护全局 token ID 列表。

## 修改范围

### 1. `durable-object.ts` — RelayRoom.fetch() 增加注册表操作

在现有 `fetch()` handler 中新增路由：
- `GET /registry/list` — 返回所有已注册 token ID 列表
- `POST /registry/add` — 添加 token ID 到注册表
- `POST /registry/remove` — 从注册表移除 token ID

使用固定 DO 名称 `idFromName("__relay_registry__")` 访问注册表单例。

### 2. `index.ts` — POST /admin/token 写入注册表

创建 token 时，额外向注册表 DO 发送 `/registry/add` 请求。

### 3. `index.ts` — GET /admin/tokens 从注册表读取

从注册表 DO 获取所有 token ID，逐个查询每个 DO token 记录和状态。

## 数据流

```
创建 token:
  POST /admin/token → 生成 tokenId
    → 写入 token DO (admin/register)
    → 写入 registry DO (registry/add)

列出 tokens:
  GET /admin/tokens → registry DO (registry/list) → token ID 列表
    → 遍历每个 token DO (admin/token/:id) → 合并结果
```

