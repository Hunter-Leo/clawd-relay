# Issues — 002-python-bridge

Cross-round issue tracker. Open issues drive the next round's planning.

| ID | Round | Type | Severity | Summary | Status |
|-----|-------|------|----------|---------|--------|
| ISS-001 | 1 | plan-deviation | medium | 重连策略未使用 Strategy 模式 | open |

### ISS-001 — 重连策略未使用 Strategy 模式

- **Round:** 1
- **Type:** plan-deviation
- **Severity:** medium
- **Found in:** T-003
- **Description:** init.md Constitution 要求 WS 重连策略通过策略模式实现，使不同策略可替换。当前实现在 `_reconnect_loop()` 中硬编码指数退避逻辑。
- **Evidence:** `ws_client.py` 第 166-184 行，`_reconnect_loop()` 方法中退避延迟 `.1s→.2s→.4s→...→30s` 为内联循环，没有 `RetryStrategy` 抽象层。
- **Suggested fix:** 提取 `RetryStrategy` Protocol/ABC，至少包含 `next_delay(attempt: int) -> float` 方法，注入到 `WebSocketClient.__init__`，在 `_reconnect_loop()` 中委托调用。
- **Status:** open
