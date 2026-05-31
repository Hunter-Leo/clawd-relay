# 008 — Auto Hook Injection

project_stage: pre-launch

## Spec

### Background

Currently, hooks for Claude Code must be manually installed via `node install.js`.
Bridge starts and stops independently — users must remember to install hooks separately.
This creates friction: Bridge is meaningless without hooks, so hooks should follow Bridge's lifecycle.

### Goal

Bridge automatically installs Claude Code hooks on startup and uninstalls them on shutdown.
No separate `node install.js` command needed.

## Requirements

1. At Bridge startup (after server starts listening), call `node install.js` to register hooks
2. At Bridge shutdown (before process exits), call `node install.js --uninstall` to remove hooks
3. Discovery of install.js path uses `__file__` relative lookup (no hardcoded paths)
4. Hook registration runs as a fire-and-forget subprocess — failure is non-fatal
5. Hook unregistration runs as a synchronous subprocess during shutdown sequence

## Plan (inline)

**File:** `bridge/src/clawd_relay_bridge/main.py`

```python
# Addition:
# 1. _install_script() helper — resolve install.js path via __file__
# 2. _install_hooks() — subprocess.run(["node", script]) on startup
# 3. _uninstall_hooks() — subprocess.run(["node", script, "--uninstall"]) on shutdown
```

**Changes:**
- Add `import subprocess` to imports
- Add `_install_script()` to resolve install.js path
- Add `_install_hooks()` / `_uninstall_hooks()` helper functions
- Call `_install_hooks()` between Token init and WS connect (in async_main)
- Call `_uninstall_hooks()` after WS disconnect, before server shutdown

**Test:** existing tests still pass (no new test — subprocess call to existing install.js)
