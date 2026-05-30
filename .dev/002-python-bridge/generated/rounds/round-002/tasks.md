# tasks.md — Round 2 — 002 Python Bridge

## Task Table

| ID    | Type | Task Name                                  | Status      | Priority | Deps       | Notes |
|-------|------|--------------------------------------------|-------------|----------|------------|-------|
| T-009 | refactor | 提取 RetryStrategy Protocol 和 ExponentialBackoff 实现 | done        | P0       | -          | RetryStrategy Protocol + ExponentialBackoff class |
| T-010 | test | RetryStrategy 单元测试                     | done        | P0       | T-009      | 7 tests: delay values, cap, custom params |
| T-011 | refactor | 重构 _reconnect_loop 委托给策略           | in-progress | P0       | T-009      |       |
| T-012 | test | 自定义策略注入测试                         | not-started | P0       | T-011      |       |
| T-013 | refactor | 更新 main.py 中的 WebSocketClient 构造调用 | done        | P0       | T-011      | 无需修改，新 retry_strategy=None 默认参数兼容 |

**Status:** `not-started` · `in-progress` · `done` · `blocked`

---

## Task Details

#### T-009 — 提取 RetryStrategy Protocol 和 ExponentialBackoff 实现

**Goal:** 在 `ws_client.py` 中定义 `RetryStrategy` Protocol，提供 `ExponentialBackoff` 默认实现。

**Requirements:**
- `RetryStrategy` Protocol 包含 `next_delay(attempt: int) -> float`
- `ExponentialBackoff` 类：`initial_delay=1.0`, `max_delay=30.0`, `factor=2.0`
- `next_delay(0)` 返回 1.0, `next_delay(5)` 返回 30.0（cap）

**Acceptance Criteria:**
- Protocol 定义正确
- 指数退避值序列正确：1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0, ...

**References:** `round-002/plan.md`, `ws_client.py`

---

#### T-010 — RetryStrategy 单元测试

**Goal:** 测试 `ExponentialBackoff.next_delay()` 的完整退避序列。

**Acceptance Criteria:**
- 正常：0→5 次尝试的正确延迟值
- 边界：0 次尝试返回 initial_delay
- 边界：很大次数后 cap 到 max_delay
- 初始化：自定义 initial_delay、max_delay、factor 参数

---

#### T-011 — 重构 _reconnect_loop 委托给策略

**Goal:** 修改 `WebSocketClient.__init__` 接受 `retry_strategy`，`_reconnect_loop` 委托调用。

**Requirements:**
- `__init__` 新增 `retry_strategy: RetryStrategy | None = None`，None 时默认 `ExponentialBackoff()`
- 移除 `max_backoff` 参数（由策略管理）
- `_reconnect_loop` 使用 `self._retry_strategy.next_delay(attempt)`

**Acceptance Criteria:**
- 不传策略时行为与 Round 1 完全一致
- 传入自定义策略时使用自定义延迟

---

#### T-012 — 自定义策略注入测试

**Goal:** 验证 `WebSocketClient` 接受自定义策略并正确调用。

**Acceptance Criteria:**
- 自定义 `FixedDelayStrategy(1.0)` 每次返回 1.0
- WebSocketClient 使用该策略时重连延迟===1.0

---

#### T-013 — 更新 main.py 中的 WebSocketClient 构造调用

**Goal:** `main.py` 中不需要传 `max_backoff` 参数，确认构造调用一致。

**Acceptance Criteria:**
- `main.py` 编译/类型检查通过
- 所有测试通过
