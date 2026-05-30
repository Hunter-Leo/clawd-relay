# Start and Resume Guide — 002-python-bridge
**Current Round:** 2

## Quick Start
1. 读取 `.dev/blueprint.md` — 项目整体状态
2. 读取 `init.md` — 需求范围
3. 读取 `rounds/round-001/plan.md` — 技术方案
4. 读取 `rounds/round-001/tasks.md` — 找下一个 `not-started` 任务
5. 在执行前阅读下方的 Constitution 和 Coding Standards

## Resuming After Interruption
1. 读取 `00-agent-execution.md § Handling Project Overview Queries` — 用其中格式展示完整项目状态
2. 读取 `.dev/blueprint.md` — 查看所有需求、阶段和整体状态
3. 检查 `issues.md` 中的遗留未解决问题
4. 打开 `rounds/round-001/tasks.md`，找到第一个非 `done` 的任务
5. 如果有 `in-progress` 的任务，阅读其 Notes 获取上下文后再继续
6. 如果有 `blocked` 的任务，阅读 Notes 并先解决阻塞原因
7. 继续前阅读下方的 Constitution 和 Coding Standards

## Key Documents
- 需求定义：`.dev/002-python-bridge/init.md`
- 跨轮次问题：`.dev/002-python-bridge/issues.md`
- 当前计划：`.dev/002-python-bridge/generated/rounds/round-001/plan.md`
- 当前任务：`.dev/002-python-bridge/generated/rounds/round-001/tasks.md`

---

## Round History
**Current Round:** 2

### Round 2 (complete)
- **Status:** ✅ done
- **Location:** `generated/rounds/round-002/`
- **Tasks:** 5 planned, 5 completed, 0 deferred
- **New issues:** ISS-001 resolved
- **Open issues:** 0
- **Summary:** 提取 RetryStrategy Protocol + ExponentialBackoff，重构 _reconnect_loop 委托给策略。90 项测试全部通过。

### Round 1 (complete)
- **Status:** ✅ done
- **Location:** `generated/rounds/round-001/`
- **Tasks:** 8 planned, 8 completed, 0 deferred
- **New issues:** ISS-001
- **Open issues:** 1
- **Summary:** 全部模块（token / ws_client / server / main）实现完成，82 项测试通过。Dual-Axis Review 发现的 P1-P5 在本轮修复，P6 延到下一轮。

---

## Constitution

参见 `init.md § Constitution` 中定义的设计规则，以及 `../constitution/01-oop-principles.md` / `../constitution/02-coding-standards.md` 中的完整标准。

每个任务都需遵循的关键原则：
- **OOP & SOLID** — 封装、单一职责、开闭原则（无 if/elif 链条）、依赖倒置（依赖抽象接口）
- **类型注解** — 所有函数/方法的参数和返回值都需标注
- **Docstrings** — 每个公开的类、函数和文件都要有文档注释（中文或英文均可，保持一致）
- **测试** — 覆盖正常情况 + 边界情况 + 错误情况
- **不要硬编码密钥** — 使用环境变量或配置文件
- **导入规则** — 不要使用延迟导入；重构避免循环依赖

---

## Git Workflow

参见 `../constitution/03-git-workflow.md`。

分支：`feat/002-python-bridge`

Commit 格式：
```
[002] T-XXX <type>: <imperative summary ≤ 72 chars>
```
Types: `feat` · `fix` · `refactor` · `test` · `docs` · `style` · `perf` · `ci` · `build` · `chore`

---

## Execution Mode Recommendation

根据 tasks.md 分析（8 个任务：4 个 feat + 4 个 test，线性依赖链），使用默认的单 agent 串行执行模式。

---

## Deviation Protocol

参见 `00-start-and-resume.md § Deviation Protocol`。
