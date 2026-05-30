# Issues — 001 项目骨架与消息协议定义

Cross-round issue tracker. Open issues drive the next round's planning.

| ID | Round | Type | Severity | Summary | Status |
|-----|-------|------|----------|---------|--------|
| ISS-001 | 1 | plan-deviation | medium | schemas.py 与 data-model.md 数据模型定义不一致 | resolved |

### ISS-001 — schemas.py 与 data-model.md 数据模型不对齐

- **Round:** 1
- **Type:** plan-deviation
- **Severity:** medium
- **Found in:** T-009
- **Description:** plan.md § 步骤 6 只描述「Pydantic BaseModel，与 TypeScript 类型语义对齐」，未引用 data-model.md 中的完整实体定义。
- **Status:** resolved
- **Resolution:** plan.md 已更新步骤 6 和数据对齐规则；schemas.py 已补充 TokenRecord、PermissionRecord、AlwaysAllowRule.created_at、Literal 枚举类型；44 个 pytest 测试通过。
