# 数据模型设计 (Data Model Design)

## 概述

本文档定义 Clawd Relay 全系统的数据实体、关系、约束和持久化方案。所有数据模型遵循 Pydantic 设计原则：类型安全、显式校验、不可变优先。

本文档为跨需求规范，所有需求的 plan.md 和代码应遵循此处定义的数据模型。

---

## 1. 实体关系总览

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│   Token  │1──N │  Device  │1──N  │ Session  │
│          │      │          │      │          │
│ 邀请码/   │      │ 物理或    │      │ Agent 的  │
│ 配对凭证   │      │ 虚拟机器   │      │ 工作会话   │
└──────────┘      └──────────┘      └──────────┘
                       │
                       │
                  ┌────┴────┐
                  │ Permission│
                  │          │
                  │ 权限审批  │
                  │ 请求/回复  │
                  └─────────┘
```

### 关键关系

- **Token → Device**: 一个 Token 在同一时刻最多关联一个活跃 Device（Bridge 连接）
- **Device → Session**: 一个 Device 可以有 N 个 Session（Claude Code 的多分支会话）
- **Device → Permission**: 一个 Device 可以有 N 个待处理的 Permission 请求
- Token 和 Device 之间无持久化关联——Device 信息只在 Bridge 连接时通过 `HelloMsg` 传递

---

## 2. 核心实体定义

### 2.1 DeviceInfo

设备标识信息。由 Bridge 在连接握手时提供，作为所有上行消息的固定字段。

```python
class DeviceInfo(BaseModel):
    id: str                           # 设备标识，如 "my-mac"
    host: str                         # 主机名，如 "my-mac.local"
    platform: Literal["darwin", "linux", "win32"]
    bridge_version: str               # 语义化版本，如 "0.1.0"
```

**约束：**
- `id` 长度 1-64 字符，由主机名截取
- `platform` 为固定枚举，不扩展
- `bridge_version` 遵循 semver

### 2.2 SessionInfo

Agent 一次工作会话的状态快照。每次状态变化都会生成新的 SessionInfo。

```python
class SessionInfo(BaseModel):
    id: str                           # session ID，由 Agent 生成
    agent_id: str                     # Agent 类型标识
    state: str                        # 当前状态
    title: str | None = None          # 会话标题（用户 prompt）
    cwd: str | None = None            # 工作目录
    model: str | None = None          # 模型名
    tool_name: str | None = None      # 当前工具名
    tool_input: dict | None = None    # 当前工具输入（已脱敏）
    updated_at: int                   # 更新时间戳（epoch ms）
```

**约束：**
- `id` 长度 1-128 字符
- `agent_id` 标准值：`claude-code`、`codex`、`copilot`、`gemini-cli`、`cursor-agent`、`opencode`
- `state` 标准值：`thinking`、`working`、`idle`、`error`、`notification`、`sleeping`、`attention`
- `title` 最大 80 字符，自动截断
- `tool_input` 会经过敏感信息脱敏（API key、token 正则匹配）

### 2.3 TokenRecord

配对凭证。用于 Bridge 和网页客户端的身份验证和房间隔离。

```python
class TokenRecord(BaseModel):
    id: str                           # token 值，32 位 hex 字符串
    label: str = ""                   # 人类可读备注
    created_at: int                   # 创建时间（epoch ms）
    expires_at: int | None = None     # 过期时间，None 表示永不过期
```

**约束：**
- `id` 通过 `secrets.token_hex(16)` 生成（32 hex 字符，128 bit 熵）
- `label` 最大 256 字符
- `created_at` 和 `expires_at` 均为 epoch ms
- `expires_at` < `created_at` → 校验失败
- **Phase 1 行为**：`expires_at` 仅用于 Admin UI 显示和 WebSocket 连接时的过期拒绝检查。自动清理过期 token 推迟到 Phase 2。

### 2.4 PermissionRecord

一次权限审批请求的全生命周期记录。

```python
class PermissionRecord(BaseModel):
    permission_id: str                # UUID v4
    device_id: str                    # 发起设备 ID
    session_id: str | None = None     # 关联会话 ID（可选）
    prompt: str                       # 用户可见的审批提示
    tool_name: str                    # 请求权限的工具名
    tool_input: dict                  # 工具输入（未脱敏原始数据）
    status: Literal["pending", "approved", "denied", "timed_out"]
    created_at: int                   # 创建时间（epoch ms）
    responded_at: int | None = None   # 回复时间
```

**约束：**
- `permission_id` 使用 UUID v4，不可预测
- `status` 状态转换：`pending` → `approved` | `denied` | `timed_out`
- 超时时间：10 分钟（600,000 ms），超时后不主动拒绝，**退回终端原生审批提示**
- 当 DO 检测到无任何 Client 在线时，立即通知 Bridge 返回 204，让 Agent 退回终端

### 2.5 AlwaysAllowRule

"Always Allow" 自动审批规则。用于在 token 生命周期内记住用户的审批偏好，对匹配的权限请求自动批准。

```python
class AlwaysAllowRule(BaseModel):
    device_id: str                    # 目标设备 ID（"*" 表示通配）
    tool_name: str                    # 目标工具名（"*" 表示通配）
    pattern: str                      # tool_input 匹配模式
    created_at: int                   # 创建时间（epoch ms）
```

**约束：**
- `device_id="*"` 表示匹配所有设备
- `tool_name="*"` 表示匹配所有工具
- 匹配优先级：精确匹配 > 通配匹配
- 存储位置：网页客户端内存 + DO storage（通过 `always_allow_rules` 消息同步到 Bridge/DO）
- 作用域：当前 token 房间内所有设备

### 2.6 DeviceState

网页客户端内存中维护的设备运行时状态（非序列化，不持久化）。

```python
class DeviceState(BaseModel):
    device: DeviceInfo                # 设备信息
    online: bool = True               # 是否在线
    sessions: list[SessionInfo] = []  # 活跃会话列表
    pending_permissions: list[PermissionRecord] = []
    last_seen: int = 0                # 最后一次活跃时间（epoch ms）
    connected_at: int = 0             # 连接建立时间
```

**约束：**
- `sessions` 按 `updated_at` 降序排列，最大保留 100 条
- `pending_permissions` 按 `created_at` 升序排列
- `last_seen` 由 DO 心跳更新，超过 35s 未更新 → `online = False`

### 2.7 AppState

网页客户端全局状态。

```typescript
interface AppState {
  devices: Map<string, DeviceState>;   // deviceId → 运行时状态
  permissions: PermissionRecord[];      // 待处理权限队列（跨设备全局）
  settings: {
    dnd: boolean;                       // Do Not Disturb
    sound: boolean;                     // 音效开关
    language: "zh-CN" | "en";
    theme: "light" | "dark" | "system";
    agentBubbles: Record<string, boolean>;  // agentId → 权限气泡开关
  };
  connectionStatus: "connecting" | "connected" | "disconnected";
}
```

---

## 3. 消息协议数据模型

### 3.1 消息信封

所有消息使用统一信封格式：

```python
class Envelope(BaseModel):
    type: str                         # 消息类型标识
    # 其余字段按 type 动态决定
```

服务端按 `type` 分发，消费者不需要 switch on 消息体结构。

### 3.2 上行消息（Bridge → Worker → Client）

| 消息 | type | 发送者 | 接收者 | 描述 |
|------|------|--------|--------|------|
| `SessionStateMsg` | `session_state` | Bridge | Client | Agent 状态更新 |
| `PermissionRequestMsg` | `permission_request` | Bridge | Client | 权限请求 |
| `HelloMsg` | `hello` | Bridge | Worker | 连接握手（含 token） |
| `KeepaliveMsg` | `keepalive` | Bridge | Worker | 心跳 |

### 3.3 下行/控制消息（Client → Worker → Bridge/DO，以及 DO → Bridge 内部消息）

| 消息 | type | 发送者 | 接收者 | 描述 |
|------|------|--------|--------|------|
| `PermissionResponseMsg` | `permission_response` | Client | Bridge | 用户权限决策 |
| `DNDChangeMsg` | `dnd_change` | Client | Bridge/DO | DND 状态变更通知 |
| `AlwaysAllowMsg` | `always_allow` | Client | Bridge/DO | 设置自动审批规则 |
| `NoClientsMsg` | `no_clients` | DO | Bridge | 无可用的客户端在线，退回终端 |

**下行消息定义：**
```python
class DNDChangeMsg(BaseModel):
    type: Literal["dnd_change"] = "dnd_change"
    dnd: bool                         # true=开启 DND, false=关闭

class NoClientsMsg(BaseModel):
    type: Literal["no_clients"] = "no_clients"
    permission_id: str                # 关联的 permission 请求 ID
```

**消息路由规则：**
- `permission_response` → DO 转发给 Bridge
- `always_allow` → DO 存储规则到 `state.storage`，并转发给 Bridge 记录
- `dnd_change` → DO 转发给 Bridge（Bridge 将其 flag 传递给 hook 调用）
- `no_clients` → DO 内部发出（不在 WS 间转发），Bridge 收到后返回 204

### 3.4 广播消息（Worker → Client only）

| 消息 | type | 发送者 | 接收者 | 描述 |
|------|------|--------|--------|------|
| `DeviceOnlineMsg` | `device_online` | Worker | Client | 设备上下线 |
| `SyncSnapshotMsg` | `sync_snapshot` | Worker | Client | 全量状态快照 |

---

## 4. 本地持久化模型

Bridge 在 `~/.clawd-relay/` 目录下维护本地状态文件：

```
~/.clawd-relay/
├── token.json         # Token 持久化
├── port.json          # 当前监听端口
```

### 4.1 token.json

```json
{
  "token": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "created_at": 1710000000000
}
```

### 4.2 port.json

```json
{
  "port": 23555,
  "updated_at": 1710000000000
}
```

---

## 5. DO 持久化模型

每个 Token 对应一个 DO 实例（`RelayRoom`），使用 `state.storage` 持久化：

```
storage key: "token_record"  →  TokenRecord JSON
storage key: "bridge_id"     →  string (当前连接的 device.id)
```

无外部数据库依赖。

---

## 6. 约束与边界

### 6.1 值约束

| 字段 | 最小值 | 最大值 | 说明 |
|------|--------|--------|------|
| Token 长度 | 11 chars（urlsafe 模式） | 128 chars | hex 默认 32 chars |
| Session title | 0 | 80 chars | 超出截断 + 省略号 |
| Permission 超时 | 10s | 600s | 默认 600s（10 分钟）超时后退回终端原生审批 |
| 事件 body 大小 | — | 4 KB | `/state` 限制 |
| Permission body 大小 | — | 256 KB | `/permission` 限制 |
| 事件历史缓冲 | 10 | 200 | 默认 50 条 |
| 网页端 sessions | — | 100 | 超出清除最旧 |
| 端口扫描超时 | — | 500ms | 全部 5 个端口 |
| Device idle 超时 | — | 35s | 超过标记离线 |

### 6.2 必填字段

- 所有消息必须有 `type` 字段
- `DeviceInfo` 的所有字段为必填
- `SessionInfo` 仅 `id`、`agent_id`、`state`、`updated_at` 为必填

### 6.3 唯一性约束

- `token.id` 全局唯一（由熵长度保证）
- `permission_id` 全局唯一（UUID v4）
- `device.id` 按 token 房间唯一（同一 token 内不允许重复 device id）

---

## 7. 枚举与常量

### 7.1 Agent IDs

```python
AGENT_IDS = Literal[
    "claude-code",    # Claude Code CLI
    "codex",          # Codex CLI
    "copilot",        # Copilot CLI
    "gemini-cli",     # Gemini CLI
    "cursor-agent",   # Cursor Agent
    "opencode",       # opencode
    "pi",             # Pi Agent
    "unknown",        # 未知/未来 Agent
]
```

### 7.2 Session States

```python
SESSION_STATES = Literal[
    "thinking",       # 模型思考/处理中
    "working",        # 使用工具
    "idle",           # 空闲
    "error",          # 错误
    "notification",   # 通知（一次性）
    "sleeping",       # 无活动
    "attention",      # 等待用户输入（一次性）
]
```

### 7.3 Permission Status

```python
PERMISSION_STATUS = Literal[
    "pending",
    "approved",
    "denied",
    "timed_out",
]
```

---

## 8. 数据流中的序列化约定

| 层面 | 格式 | 说明 |
|------|------|------|
| Bridge↔Worker 消息 | JSON | 标准 JSON，utf-8 |
| Bridge 本地持久化 | JSON | `~/.clawd-relay/*.json` |
| DO storage | JSON serialized | `state.storage.put()` 自动处理 |
| Web 端内存 | TypeScript 对象 | 从 JSON.parse 还原 |

字段命名统一使用 **camelCase**（Web 端原生格式，Python 端通过 `Field(alias=...)` 适配）。
