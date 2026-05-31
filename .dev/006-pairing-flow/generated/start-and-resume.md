# Start and Resume Guide — 006-pairing-flow
**Current Round:** 1

## Quick Start
1. Read `.dev/blueprint.md` — project-wide status across all requirements
2. Read `init.md` — this requirement's scope
3. Read `generated/rounds/round-001/plan.md` — technical approach
4. Read `generated/rounds/round-001/tasks.md` — find the next `not-started` task
5. Review the standards sections below before writing any code

## Resuming After Interruption
1. Read `00-agent-execution.md § Handling Project Overview Queries` — use this format to present the full project status when asked
2. Read `.dev/blueprint.md` — see all requirements, their phases, and overall project status
3. Check `issues.md` for open issues from previous rounds
4. Open `generated/rounds/round-001/tasks.md` for the active requirement and find the first task not in `done`
5. If a task is `in-progress`, read its Notes for context before continuing
6. If a task is `blocked`, read the Notes and address the blocker first
7. Review the standards sections below before continuing

## Session Bootstrap (new agent session on existing project)
When entering an existing project that already has `.dev/` content, bootstrap the session before any work:

1. **Check `.dev/blueprint.md`** — if missing, scan `.dev/` directories to reconstruct it from existing `init.md` files, then inform the user

2. **Read** the blueprint and for each ▶ active or ⏸ blocked requirement, read `tasks.md` for current task detail

3. **Present** the full status to the user proactively (don't wait to be asked):

4. **Ask** the user which requirement to focus on, or proceed with the active one
5. **Open** `issues.md` for open issues (if round > 1)
6. **Open** `generated/rounds/round-[NNN]/tasks.md` for the chosen requirement and find the next unstarted task

## Key Documents
- Requirement: `.dev/006-pairing-flow/init.md`
- Issues (cross-round): `.dev/006-pairing-flow/issues.md`
- Current plan: `.dev/006-pairing-flow/generated/rounds/round-001/plan.md`
- Current tasks: `.dev/006-pairing-flow/generated/rounds/round-001/tasks.md`

## Round History
**Current Round:** 1

---

## Constitution

### 适用语言
- Python 3.12+（Bridge 端）、TypeScript（Worker 端 `/join` 路由）
- 所有文档、注释、提交信息使用英文（参见 `init.md § 适用语言`）

### 架构原则
- Token 生成放在 `token.py`，不散落在其他模块
- 二维码输出策略通过 `qr_output.py` 封装，支持 ASCII / IMAGE / NONE 三种模式
- Worker 的 `/join` 路由是纯粹的重定向，不包含任何业务逻辑

### 依赖管理
- `qrcode` 作为 Bridge 的可选依赖（`bridge[qr]`），不影响核心功能
- Worker 端的 `/join` 路由不需要额外依赖

### OOP & SOLID
- `QrOutput` 类遵循 SRP（单一职责——仅负责二维码输出）
- 策略模式：输出模式（ASCII / IMAGE / NONE）通过参数控制，无 if/elif 链
- 类型注解 — 所有函数/方法参数和返回值
- Docstrings — 每个公共类、函数、文件

### 测试
- T-004（正常用况）+ 边界情况 + 错误情况
- 模拟 `qrcode` 导入失败测试优雅降级

### 无硬编码凭据
- 使用环境变量或 CLI 参数

### Git Workflow
Branch: `feat/006-pairing-flow`

Commit format:
```
[006] T-XXX <type>: <imperative summary ≤ 72 chars>
```
Types: `feat` · `fix` · `refactor` · `test` · `docs` · `style` · `perf` · `ci` · `build` · `chore`

## Round History
**Current Round:** 1

### Round 1 (complete)
- **Status:** ✅ done
- **Location:** `generated/rounds/round-001/`
- **Tasks:** 6 planned, 6 completed, 0 deferred
- **New issues:** none
- **Open issues:** none
- **Summary:** Implemented pairing flow: qrcode optional dep + CLI args, QR output module (ASCII/image/none), enhanced pairing link box output, Worker `/join/:token` redirect, and full test coverage (96 bridge + 28 worker tests).
