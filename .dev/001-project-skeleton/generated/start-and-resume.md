# Start and Resume Guide — 001-project-skeleton
**Current Round:** 1

## Quick Start
1. Read `.dev/blueprint.md` — project-wide status across all requirements
2. Read `init.md` — this requirement's scope
3. Read `rounds/round-001/plan.md` — technical approach
4. Read `rounds/round-001/tasks.md` — find the next `not-started` task
5. Review the Constitution in `init.md` before writing any code

## Resuming After Interruption
1. Read `.dev/blueprint.md` — see all requirements, their phases, and overall project status
2. Check `issues.md` for open issues from previous rounds
3. Open `rounds/round-001/tasks.md` and find the first task not in `done`
4. If a task is `in-progress`, read its Notes for context before continuing
5. Review `init.md § Constitution` before continuing — strict type annotations, no circular imports

## Session Bootstrap (new agent session)
1. Read `.dev/blueprint.md`
2. Read `init.md § Constitution`
3. Open `rounds/round-001/tasks.md` for the active requirement
4. Proceed with the next not-started task

## Execution Rules
- Implementation task and its unit tests are **separate tasks**
- Run `uv sync` / `npm install` before first implementation task
- Verify TypeScript compiles (`npx tsc --noEmit`) after each TS task
- Verify Python type checks (`mypy --strict` or `pyright`) after each Python task
- All generated `.dev/` documents are committed to git alongside implementation

## Round History
**Current Round:** 1

### Round 1 (complete)
- **Status:** ✅ done
- **Location:** `generated/rounds/round-001/`
- **Tasks:** 11 planned, 11 completed, 0 deferred
- **New issues:** ISS-001 (resolved)
- **Open issues:** 0
- **Summary:** REQ-001 项目骨架与消息协议定义完成。uv/npm workspace 配置、共享 TS 类型包(@clawd-relay/types)、Worker/Web 脚手架、Pydantic 消息模型(含枚举类型和全部 10 种消息)、TS 17 项 + Python 44 项测试全部通过。
