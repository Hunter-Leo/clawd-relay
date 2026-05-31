# Start and Resume Guide — 005-hook-scripts
**Current Round:** 1

## Quick Start
1. 读取 `.dev/blueprint.md` — 项目整体状态
2. 读取 `init.md` — 本需求范围
3. 读取 `generated/rounds/round-001/plan.md` — 技术方案
4. 读取 `generated/rounds/round-001/tasks.md` — 找下一个 `not-started` 任务
5. 写代码前回顾下文的标准章节

## Resuming After Interruption
1. 读取 `.dev/blueprint.md` — 整体状态
2. 检查 `issues.md` 是否有未关闭的问题
3. 打开 `generated/rounds/round-001/tasks.md`，找第一个非 `done` 的任务
4. 若有 `in-progress` 任务，读 Notes 了解上下文
5. 若有 `blocked` 任务，先处理阻塞原因
6. 回顾下文标准章节再继续

## Session Bootstrap
见 `00-agent-execution.md § Handling Project Overview Queries`

## Key Documents
- Requirement: `.dev/005-hook-scripts/init.md`
- Issues: `.dev/005-hook-scripts/issues.md`
- Current plan: `.dev/005-hook-scripts/generated/rounds/round-001/plan.md`
- Current tasks: `.dev/005-hook-scripts/generated/rounds/round-001/tasks.md`

## Round History

**Current Round:** 1

### Round 1 (complete)
- **Status:** ✅ done
- **Location:** `generated/rounds/round-001/`
- **Tasks:** 7 planned, 7 completed, 0 deferred
- **New issues:** none
- **Open issues:** none
- **Summary:** 完整实现了 Hook 脚本系统：端口发现（server-config.js）、事件采集+权限处理（clawd-hook.js）、安装/卸载（install.js）。36 测试全通过。

## Constitution

See `init.md § Constitution` for this requirement's design rules.

Hook 脚本（JavaScript，仅 Node.js 内置模块）：
- **零外部依赖** — 只能使用 Node.js 内置模块（`http`、`fs`、`path`、`os`、`crypto`）
- **不能使用 `import` / `require`** — Claude Code hook runner 无模块系统，使用 CommonJS `require`
- **入口** — `process.stdin` + `JSON.parse`
- **SRP** — 每个文件一个职责
- **Silent fail** — 所有操作 `try/catch`，出错不可阻塞 Agent
- **DRY** — 端口发现集中在 `server-config.js`

Install 脚本：
- 幂等（重复安装不重复追加）
- `--uninstall` 支持撤销

## Git Workflow

Branch: `feat/005-hook-scripts`

Commit format:
```
[005] T-XXX <type>: <imperative summary ≤ 72 chars>
```
Types: `feat` · `test`

## Execution Mode Recommendation

**Step 1 — 执行技能检查：**

可用执行类技能：
- `oh-my-claudecode:ultrawork` — 并行执行引擎，适合高通量任务完成
- `oh-my-claudecode:autopilot` — 自主执行

**Step 2 — tasks.md 分析：**
7 个任务：4 个 feat + 3 个 test，链式依赖（T-001→T-002, T-003→T-004→T-005, T-006→T-007）。

**推荐：单线程顺序执行。** 本需求的任务体量适中、依赖关系清晰，没有需要并行加速的瓶颈。按 `T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-007` 顺序逐个实现，每个任务后验证+提交。
