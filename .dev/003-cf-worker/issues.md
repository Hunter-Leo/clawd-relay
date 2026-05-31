# Issues — 003 cf-worker

## ISS-001: GET /admin/tokens 缺少注册表 DO

**类型:** plan-deviation
**严重度:** Medium
**状态:** resolved

**描述:**
plan.md 要求 `GET /admin/tokens` 返回所有 token 列表，但需要一个独立的 "token registry" DO 实例来维护 token ID 索引。当前实现因依赖跨 DO 查询，返回空数组占位。

**影响:**
- 管理控制台 token 列表功能不可用
- 不影响核心 WebSocket 中继功能

**建议修复:**
- 方法 A（推荐）：在 durable-object.ts 中增加一个注册表 DO（TokenRegistry），维护全局 token ID 列表
- 方法 B：在现有 DO fetch handler 中用 `state.storage.list()` 前缀扫描

**参考:** `plan.md § Admin API Token 存储`
