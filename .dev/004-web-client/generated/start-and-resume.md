# Start and Resume Guide — 004-web-client
**Current Round:** 1

## Quick Start
1. Read `.dev/blueprint.md` — project-wide status across all requirements
2. Read `init.md` — this requirement's scope
3. Read `generated/rounds/round-001/plan.md` — technical approach
4. Read `generated/rounds/round-001/tasks.md` — find the next `not-started` task
5. Review the constitution and standards below before writing any code

## Key Documents
- Requirement: `.dev/004-web-client/init.md`
- Design: `.dev/004-web-client/design.md`
- Responsive: `.dev/004-web-client/responsive.md`
- Issues (cross-round): `.dev/004-web-client/issues.md`
- Current plan: `.dev/004-web-client/generated/rounds/round-001/plan.md`
- Current tasks: `.dev/004-web-client/generated/rounds/round-001/tasks.md`

## Resuming After Interruption
1. Read `.dev/blueprint.md` — see all requirements, their phases, and overall project status
2. Check `issues.md` for open issues from previous rounds
3. Open `generated/rounds/round-001/tasks.md` and find the first task not in `done`
4. If a task is `in-progress`, read its Notes for context before continuing
5. If a task is `blocked`, read the Notes and address the blocker first
6. Review the standards sections below before continuing

---

## Round History
**Current Round:** 1

### Round 1 (in-progress)
- **Status:** ▶ in-progress
- **Location:** `generated/rounds/round-001/`
- **Tasks:** 29 planned, 0 completed, 0 deferred

---

## Constitution

### Applicable Stack
- Preact 10.x + Vite 6.x + Tailwind 4.x + daisyUI 5.x
- TypeScript strict mode
- `@clawd-relay/types` for shared protocol types

### Architecture Principles
- **Component tree** defined in `init.md § 架构原则`
- **State management**: Preact Context + useReducer, no Redux
- **WebSocket**: `ws.ts` single manager class, event-driven dispatch
- **Dependency**: `@clawd-relay/types` for all protocol types, browser types extended locally

### Design Reference
- **Visual design**: `design.md` — color system, typography, spacing, component specs
- **Responsive**: `responsive.md` — 5 breakpoints, component deformation rules
- **Dark/Light mode**: Tailwind `dark:` variant, localStorage persistence, 3 modes

### Type Safety
- All messages use TypeScript discriminated unions from `@clawd-relay/types`
- Message parsing validates `type` field existence
- Component props typed with interfaces

### Error Handling
- WS connection errors: auto-reconnect, UI display "reconnecting..."
- Message parse failures: `console.warn`, drop silently, never crash UI
- Component render errors: Error Boundary fallback
- Permission handling errors: friendly error toast, other features unaffected

### Testing
- Component logic unit tests (vitest)
- WS connection manager tests (mock WebSocket)
- State reducer tests (pure function tests)
- Theme persistence tests (mock localStorage)

### Responsiveness
- Mobile-first CSS Grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- Safe area handling for iOS Safari
- Touch targets ≥ 44px
- `min-h-[100dvh]` instead of `h-screen`

### Motion & Accessibility
- Animate only `transform` and `opacity` for performance
- `prefers-reduced-motion` respected on all animations
- Color + icon + text triple encoding for state indicators
- WCAG AA contrast on all text

### Git Workflow
- Branch: `feat/004-web-client`
- Commit format: `[004] T-XXX <type>: <imperative summary ≤ 72 chars>`
- Types: `feat` · `fix` · `refactor` · `test` · `docs` · `style` · `perf` · `ci` · `build` · `chore`
- Pre-commit: all tests pass, no lint errors, no secrets
- Project stage: `pre-launch` — breaking changes allowed

---

## Execution Mode

Auto mode: proceed through all 29 tasks sequentially without pausing.
After all tasks complete: run acceptance verification.
