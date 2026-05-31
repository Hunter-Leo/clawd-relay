# Issues — Round 001

Issues discovered during Round 001 execution.

| ID | Type | Severity | Summary | Status |
|-----|------|----------|---------|--------|
| ISS-001 | plan-deviation | high | WS URL scheme not converted from http to ws | resolved |

### ISS-001 — WS URL scheme not converted from http to ws

- **Type:** plan-deviation
- **Severity:** high
- **Found in:** T-003
- **Description:** `_connect_impl` used relay_url directly (`http://.../relay/connect`) to construct WebSocket URL, but `websockets.connect` requires `ws://` or `wss://`. This caused the Bridge to fail connecting to Worker entirely.
- **Fix:** Added `https://` → `wss://` and `http://` → `ws://` replacement in `_connect_impl`.
- **Status:** resolved
