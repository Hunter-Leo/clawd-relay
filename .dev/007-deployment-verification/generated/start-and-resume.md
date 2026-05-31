# Start and Resume Guide — 007-deployment-verification
**Current Round:** 1

## Quick Start
1. Read `.dev/blueprint.md` — project-wide status
2. Read `init.md` — this requirement's scope
3. Read `generated/rounds/round-001/plan.md` — verification approach
4. Read `generated/rounds/round-001/tasks.md` — find the next `not-started` task

## Key Documents
- Requirement: `.dev/007-deployment-verification/init.md`
- Current plan: `.dev/007-deployment-verification/generated/rounds/round-001/plan.md`
- Current tasks: `.dev/007-deployment-verification/generated/rounds/round-001/tasks.md`

## Execution Setup

All 3 components run simultaneously in separate terminals:

```
Terminal 1: cd worker && npm run dev        # wrangler dev :8787
Terminal 2: cd web && npm run dev            # vite dev :5173
Terminal 3: cd bridge && uv run relay --relay-url http://localhost:8787
Terminal 4: curl for test requests
```

## Known Constraints

- wrangler dev requires fresh `npm install` at project root
- Bridge token is auto-generated on first run (stored in ~/.clawd-relay/token.json)
- Web Client needs `?token=<token>&relay_url=http://localhost:8787` in URL
- All verification is local (127.0.0.1)

## Constitution

### Languages
- Python 3.12+ (Bridge), TypeScript (Worker / Web)
- All docs and commits in English

### Architecture Principles
- All 3 components on 127.0.0.1, no external dependencies
- Verification is manual — observe and record

## Round History
**Current Round:** 1
