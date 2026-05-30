# Clawd Relay — 云端事件中继提案

将 clawd-on-desk 的 AI Agent 事件流推送到云端，通过 Cloudflare Workers + Durable Objects 实现多设备实时订阅与远程交互。

## 动机

clawd-on-desk 是一个桌面宠物应用，通过 Claude Code / Codex 等 AI Agent 的 hook 事件实时反映 Agent 的工作状态。目前它只能在本地桌面查看和交互。

本项目的目标是将这个事件流推到云端，让任何设备（手机、平板、其他电脑）通过网页就能：
- 实时查看 Agent 的工作状态（思考中、写代码、完成等）
- 查看完整的 session 信息和事件历史
- 远程批准或拒绝权限请求（allow/deny）
- 支持同时连接多台设备

## 参考项目

- **clawd-on-desk** — 桌面宠物应用，接收 Agent hook 事件并驱动动画/权限气泡
  - 本地路径: `/Users/leoluo/Documents/code/clawd-on-desk`
  - 仓库: `https://github.com/rullerzhou-afk/clawd-on-desk`

- **clawstick** — 硬件 BLE 桥接运行时，提供独立的状态推送和硬件权限回复能力
  - 本地路径: `/Users/leoluo/Documents/code/clawstick`
  - 仓库: `https://github.com/rullerzhou-afk/clawstick`

## 核心架构
```
远程服务器 / Mac 本地
┌─────────────────────────────────────┐
│ Claude Code / Codex / 其他 Agent    │
│   │                                 │
│   ▼ hook 事件                        │
│ clawd-hook.js (改造版或不做改动)     │
│   │                                 │
│   ├── POST /state  (~1ms)          │
│   └── POST /permission (阻塞, 等回复)│
│         │                           │
│         ▼                           │
│  ┌─ Bridge 进程 ──────────────────┐ │
│  │ HTTP Server (127.0.0.1)        │ │
│  │   /state                       │ │
│  │     ← hook 事件, 即时返回      │ │
│  │   /permission                  │ │
│  │     ← 阻塞等待云端决策         │ │
│  │                                │ │
│  │ WebSocket Client ────┐         │ │
│  └──────────────────────┘         │ │
└───────────────────────────────────┘ │
                                      │
          Cloudflare WebSocket        │
          连接 (持久, 带 token)        │
                                      │
          ▼                           │
┌───────────────────────────────────────┐
│        Cloudflare Workers             │
│                                       │
│  ┌─ Durable Object ────────────────┐  │
│  │  房间 (按 token 隔离)           │  │
│  │                                 │  │
│  │  输入: Bridge WebSocket 连接    │  │
│  │  输入: 网页 WebSocket 连接      │  │
│  │                                 │  │
│  │  Bridge ──► 广播 session 事件   │  │
│  │  Bridge ──► 广播 permission     │  │
│  │              请求               │  │
│  │                                 │  │
│  │  网页 ──► 转发 permission 回复  │  │
│  │              到 Bridge          │  │
│  │                                 │  │
│  │  离线: 最近事件缓冲区           │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─ 健康/状态端点 ─────────────────┐ │
│  │ POST /relay/connect             │ │
│  │   { token }                     │ │
│  │   → WebSocket 升级              │ │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
              │
              │ WebSocket
              │
              ▼
┌───────────────────────────────────────┐
│          网页客户端                   │
│                                       │
│  URL: ?token=A&token=B                │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ 🖥️ my-dev-server · claude-code │  │
│  │  ├─ 重构数据库连接池           │  │
│  │  │   working · claude-sonnet   │  │
│  │  │   Bash: npm test            │  │
│  │  └─ 修复 CI 流水线             │  │
│  │      idle · 完成               │  │
│  │                                │  │
│  │ 💻 MacBook · codex             │  │
│  │  └─ Agent 思考中...            │  │
│  │                                │  │
│  │ ┌── 权限请求 ──────────────┐   │  │
│  │ │ Bash: git push origin main│   │  │
│  │ │ 来自: my-dev-server       │   │  │
│  │ │ [Allow] [Deny]           │   │  │
│  │ └──────────────────────────┘   │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

## 架构决策说明

采用本地 Bridge 进程方案而非 Hook 直连云端的理由：

| 维度 | Hook 直连 Cloudflare | 本地 Bridge 进程 |
|---|---|---|
| 双向交互 | ❌ Hook 是瞬时的,无法维持 WebSocket | ✅ 持久连接支持双向 |
| Permission 阻塞 | ❌ 无法持有 HTTP 连接等云端回复 | ✅ 天然支持 |
| Hook 延迟 | 100-500ms (公网) | ~1ms (本地) |
| 离线容错 | ❌ 丢事件或阻塞 Agent | ✅ 缓冲后补发 |
| 免费额度 | 每日 10万请求(易耗尽) | WebSocket 每日 1000万分钟 |
| 本地基础设施 | 零 | 一个 Node.js 进程(无界面) |

## 数据流

### 事件 (session_state)

```
Hook 脚本 → POST /state → Bridge HTTP Server → Bridge WS → Cloudflare DO → WebSocket → 网页
```

### 权限请求 (permission)

```
Hook 脚本 → POST /permission → Bridge HTTP Server
                                     │
                               Bridge WS → Cloudflare DO → 网页
                                                            │
                                                     用户点击 Allow/Deny
                                                            │
                               Bridge WS ← Cloudflare DO ← 网页
                                     │
                              HTTP 回复 (200) → Hook 脚本 exit
```

## 消息协议

### Bridge → Cloudflare (上行)

```
session_state     Agent 状态变更
permission_request  权限请求, 需用户决策
hello             连接建立时发送设备信息 (token, host, platform, bridgeVersion)
keepalive         心跳
sync_request      网页端请求当前全量状态
sync_snapshot     Bridge 回复全量 session 列表
```

### Cloudflare → Bridge (下行)

```
permission_response  用户对权限请求的 allow/deny
```

### Cloudflare → 网页 (下行)

```
session_state         Agent 状态变更 (携带 device.id)
permission_request    权限请求
device_online         设备上线/离线
sync_snapshot         全量状态快照
```

### 网页 → Cloudflare (上行)

```
permission_response   allow/deny 回复
subscribe             ?token=A&token=B 加入多个房间
```

## Session 上下文信息

每次事件携带完整的上下文, 网页端按 device + session 分组展示。

```
{
  "type": "session_state",
  "device": {
    "id": "my-dev-server",
    "host": "my-dev-server.local",
    "platform": "linux",
    "bridgeVersion": "0.1.0"
  },
  "session": {
    "id": "cmZ8kX2a",
    "agentId": "claude-code",
    "state": "working",
    "title": "重构数据库连接池",
    "cwd": "/home/user/my-project",
    "model": "claude-sonnet-4-6",
    "toolName": "Bash",
    "toolInput": { "command": "npm test" },
    "updatedAt": 1710000000000,
    "eventHistory": [
      { "event": "UserPromptSubmit", "at": 1710000000000 },
      { "event": "PreToolUse", "at": 1710000000001 }
    ]
  }
}
```

## 配对流程 (Token)

```
1. Bridge 启动, 生成随机 token (如 abc123)
2. Bridge 输出:
     配对链接: https://relay.example.com/join/abc123
   或生成二维码
3. 用户打开链接/扫码 → 网页通过 WebSocket 连到对应 DO 房间
4. 可同时使用多个 token:
      https://relay.example.com?token=abc123&token=def456
5. 无需注册、无需账号、纯 Token 配对
```

## 实现规划

### Phase 1: 核心能力 (MVP)

**Cloudflare Worker + Durable Object**

- [ ] Worker 入口: WebSocket 升级端点 `/relay/connect`
- [ ] DO 房间: 管理 WebSocket 连接, 事件广播, 离线缓冲
- [ ] 消息协议: session_state, permission_request, permission_response, hello, sync
- [ ] Token 路由: 按 token 分配到不同 DO 房间

**Bridge 进程 (Node.js)**

- [ ] HTTP 服务器: `/state`, `/permission` 端点, 复用 clawd-on-desk server-config 端口发现机制
- [ ] WebSocket 客户端: 连接到 Cloudflare Worker, 自动重连
- [ ] Token 生成: 启动时生成随机 token, 打印配对链接
- [ ] Hook 适配: 事件→结构化消息, Permission 阻塞转发
- [ ] 进程管理: 日志输出, 优雅退出

**网页客户端**

- [ ] 单页 HTML (纯静态, 部署到 CF Pages)
- [ ] WebSocket 连接, 支持 `?token=A&token=B` 多房间
- [ ] 按 device 分组的 session 列表
- [ ] 实时状态卡片: session title, state, tool, model
- [ ] 权限请求气泡: Allow / Deny 按钮
- [ ] 二维码生成 (将配对链接编码为 QR)

### Phase 2: 增强

- [ ] 事件历史缓冲 (网页端重连后拉取最近事件)
- [ ] 设备离线检测和通知
- [ ] 离线事件补发 (Bridge 重连后回放)
- [ ] 简单认证: Token 有效期或令牌轮换

### Phase 3: 可选扩展

- [ ] 手机 App 封装 (PWA 或原生)
- [ ] 多设备同时订阅管理 (自定义 dashboard)
- [ ] 权限策略 (记住选择、定时允许等)
- [ ] 统计页面 (Agent 使用量、耗时等)

## 免费额度评估

Cloudflare Workers 免费版:

| 资源 | 免费额度 | 预期用量 |
|---|---|---|
| Workers 请求 | 10万/天 | Bridge WebSocket 建立 + 偶尔 HTTP |
| Durable Objects | 1000万分钟/天 | 每个 Bridge 一个 DO(24h=1440min) |
| Durable Objects 请求 | 100万/天 | 事件广播 |
| Durable Objects 存储 | 1GB | 事件缓冲 < 1MB |
| Workers Subrequests | 5万/天 | 不涉及 |
| WebSocket 时间 | 无单独限制 | DO 内建支持 |

结论: 个人使用绰绰有余。一个 Bridge 一天消耗约 1440 DO 分钟 (24h), 免费额度 1000万分钟。即使 10 台设备同时在线也只占 0.014%。

## 目录结构 (供新建项目参考)

```
clawd-relay/
├── bridge/                  # 本地 Bridge 进程 (Node.js)
│   ├── index.js             # 入口: HTTP Server + WS Client
│   ├── server.js            # HTTP 端点 /state, /permission
│   ├── ws-client.js         # Cloudflare WebSocket 客户端
│   └── token.js             # Token 生成和持久化
├── worker/                  # Cloudflare Worker
│   ├── src/
│   │   ├── index.js         # Worker 入口
│   │   ├── durable-object.js # DO 房间实现
│   │   └── protocol.js      # 消息类型定义
│   └── wrangler.toml
├── web/                     # 网页客户端 (静态, 部署 CF Pages)
│   ├── index.html
│   ├── app.js
│   └── style.css
└── docs/
    └── proposal.md          # 本文件
```
