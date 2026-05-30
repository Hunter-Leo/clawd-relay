# Round 2 Plan — ISS-001: 重连策略提取为 Strategy 模式

## 变更范围

仅修改 `bridge/src/clawd_relay_bridge/ws_client.py`，新增 Strategy Protocol，不影响其他模块。

## 设计方案

### RetryStrategy Protocol

```python
from typing import Protocol

class RetryStrategy(Protocol):
    """Strategy for computing reconnection delays."""

    def next_delay(self, attempt: int) -> float:
        """Return the delay in seconds before the *attempt*-th retry."""
        ...
```

### ExponentialBackoff（默认实现）

注入到 `WebSocketClient.__init__`，替换原有的硬编码退避逻辑。

### 对 WsClient 的修改
- `__init__` 新增参数 `retry_strategy: RetryStrategy | None = None`
- 移除 `max_backoff` 参数（由策略管理）
- `_reconnect_loop()` 委托给 `self._retry_strategy.next_delay(attempt)`

### 不修改范围
- 不改 plan.md（Round 1 的 plan.md 保持不变）
- 不改 init.md
- 不改 server.py、token.py、main.py

## 测试策略
- 新增 `FixedDelayStrategy` 测试用实现
- 测试 `ExponentialBackoff.next_delay()` 各次尝试值
- 测试 `WebSocketClient` 使用自定义策略时的重连行为
