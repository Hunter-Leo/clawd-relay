# 004 — 网页客户端 (Preact + Vite)

project_stage: pre-launch

> **参考项目**: [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) — 本地桌面宠物应用，本网页客户端旨在复现其所有核心功能和设计理念（桌面像素动画等 Electron 专有能力除外），并提供远程访问能力。

## Spec

### 背景与动机

网页客户端是 Clawd Relay 的消费端。用户通过浏览器访问页面，可以实时查看 AI Agent 的工作状态、会话历史和权限请求。网页端通过 WebSocket 直接连接到 CF Worker 的 DO 房间。

### 核心目标

实现 clawd-on-desk 在浏览器端的完整功能复刻——包括实时状态展示、多会话管理、权限审批系统、设置面板和国际化——同时支持远程访问和多设备连接。

### 使用场景

- 开发者手机上打开配对链接，远程查看台式机上的 Claude Code 工作状态
- 多设备同时连接（`?token=A&token=B`），在同一页面管理多台机器的 Agent
- 网页端收到权限请求时弹出气泡，远程点击 Allow/Deny
- 查看完整 session 历史和 event timeline
- 管理 DND 模式、切换语言、配置通知

## 需求

### 功能需求

**1. WebSocket 连接管理**
- 通过 URL query `?token=<token>` 解析 token
- 支持 `?token=A&token=B` 多 token（连接到多个 DO 房间）
- 自动重连（指数退避，最大 30s 间隔）
- 连接状态指示器：已连接（绿）、重连中（黄）、断开（红）

**2. Devices Dashboard（设备管理面板）**
- 按设备（device）分组展示所有 session
- 每张 session 卡片展示：
  - Agent 类型标识（claude-code / codex / copilot 等，带图标和颜色）
  - 实时状态指示：thinking / working / idle / error / notification / sleeping
  - 会话标题（自动截断 + 悬念号）
  - 当前 tool 名称和 tool input（Bash: npm run build）
  - 模型名称（claude-sonnet-4-6）
  - CWD 路径
  - 设备状态：在线/离线（绿点/灰点）
- 子会话感知：1 个 session → "working"，2 个 → "groove"，3+ → "building"
- 一次性状态展示：error / notification / attention 等用特殊样式标记
- 错误状态用红色高亮，持续 5s 后恢复
- session event history 展示（最近事件时间线）

**3. Permission Bubble（权限气泡系统）**
- 收到 `permission_request` 时弹出模态气泡
- 气泡内容：发送请求的设备名、tool name、tool input/command 全文
- Allow / Deny 按钮，点击后发送 `permission_response` 到 DO
- "Always allow" 选项（在本次 token 生命周期内记住选择）
- 多权限请求堆叠：后续请求排队显示（左下角 stack 计数）
- 全局快捷键提示（网页端不支持，但展示对应桌面快捷键信息）
- 自动关闭：如果在终端侧已处理，不再展示
- Per-agent 开关：可在设置中关闭特定 agent 的权限气泡

**4. Session HUD（紧凑状态视图）**
- 页面右下角或侧边栏展示紧凑的设备状态汇总
- 每台设备一行：设备名 + 状态圆点 + 当前会话摘要
- 点击跳转到对应设备的详细视图
- 在权限气泡弹出时自动置顶

**5. 快照同步与恢复**
- 连接时接收 `sync_snapshot`，恢复当前全量状态
- 断线重连后自动拉取最新快照
- 设备离线后保留最后状态并标记为离线（非清除）

**6. Do Not Disturb 模式**
- 页面顶部或设置面板中切换 DND
- DND 开启后：
  - 所有 session 状态更新静默接收但不展示变化
  - 权限请求自动 fallback 到 Agent 原生提示（silent drop）
  - UI 显示 DND 标记
- 关闭 DND 后恢复实时展示

**7. 音效提醒**
- 使用 Web Audio API 播放简短音效
- 事件类型：task_complete（完成）、permission_request（请求）
- 音效可设置静音/音量
- 连续播放有 10s cooldown
- DND 模式下自动静音

**8. i18n 多语言**
- 支持语言：中文（简体）、English
- 语言切换通过 UI 设置或浏览器语言自动检测
- 所有 UI 文本通过 i18n key 管理

**9. 设置面板**
- 独立的设置页面/模态框
- 设置项：
  - Agent 开关：per-agent 启用/禁用、per-agent 权限气泡开关
  - DND 模式开关
  - 音效开关和音量
  - 语言选择
  - 暗色/亮色/跟随系统模式
  - 主题选择（网页 UI 主题）

**10. 设备离线检测**
- WebSocket 心跳检测（通过 DO 的 keepalive）
- 设备 35 秒无响应标记为离线
- 离线设备显示灰色 + "offline" 标记
- 重新上线时自动恢复

**11. 视觉效果**
- daisyUI 组件主题，美观且无需手写 CSS
- 响应式布局：手机端单列堆叠、桌面端多栏网格
- 暗色/亮色模式（支持跟随系统 + 手动切换）
- Agent 类型对应的主题色条/图标
- 状态过渡动画（卡片进出、气泡弹出/消失）
- 页面加载时的骨架屏（skeleton loading）

### 非功能需求

- 不需要桌面像素动画、眼球追踪、窗口拖拽、Mini Mode、睡眠序列等 Electron/桌面专有功能
- 页面加载时间 < 2s（首屏）
- WebSocket 重连不影响 UI 状态

### 技术需求

- Preact + Vite
- Tailwind CSS + daisyUI
- 原生 WebSocket API
- 部署到 CF Pages
- i18n 使用轻量方案（JSON key-value，`Intl` API 辅助）
- 类型包 workspace 引用：`@clawd-relay/types`

### 接口定义

客户端接收消息类型（按 `type` 区分）：

- `session_state` — 更新设备/会话状态
- `permission_request` — 展示权限请求
- `permission_response` — 本地权限决策确认
- `device_online` — 设备上下线通知
- `sync_snapshot` — 全量状态快照

客户端发送消息类型：

- `permission_response` — 用户决策回复
- `dnd_change` — DND 状态变更通知 Bridge

### 预期产出

- `web/index.html`
- `web/src/app.tsx` — 主应用组件
- `web/src/ws.ts` — WebSocket 连接管理器
- `web/src/components/` — 设备面板、Session 卡片、权限气泡、Dashboard、HUD、设置面板
- `web/src/i18n/` — 多语言翻译文件
- `web/src/style.css` — Tailwind 入口
- `web/vite.config.ts`、`web/tsconfig.json`、`web/package.json`

## Action Items

**Required documents** (always, in order):
- [ ] `generated/rounds/round-001/plan.md` — Phase 04
- [ ] `generated/rounds/round-001/tasks.md` — Phase 05
- [ ] `generated/start-and-resume.md` — Phase 06

**Round artifacts**:
- [ ] `issues.md`

## Constitution

### 适用语言

TypeScript + JSX（Preact），CSS（Tailwind + daisyUI）

### 架构原则

- **组件树**：
  - `App` — WS 管理、全局状态、路由
  - `Dashboard` — 设备面板主页
  - `DeviceGroup` — 单设备分组容器
  - `SessionCard` — 单个 session 卡片（多种状态渲染）
  - `PermissionModal` — 权限请求模态框（含堆叠管理）
  - `SessionHUD` — 紧凑状态条
  - `SettingsPanel` — 设置面板
  - `ConnectionIndicator` — 连接状态指示器
  - `DNDToggle` — DND 开关
- **状态管理**：Preact 内置 hooks（`useState`、`useReducer`）+ Context，不引入 Redux
- **单一职责**：`ws.ts` 只管理 WS 连接，`DeviceGroup` 只渲染设备分组

### 类型安全

- 浏览器端消息类型用 TypeScript discriminated union
- 消息解析做基本校验（`type` 字段存在性 + 必要字段检查）
- 消息类型定义从 `@clawd-relay/types` 引入，若浏览器端需要额外类型则本地扩展

### 错误处理

- WS 连接异常：自动重连，UI 显示 "连接中断，正在重连..."
- 消息解析失败：`console.warn` 丢弃，不崩溃 UI
- 组件渲染异常：Error Boundary 兜底
- Permission 处理异常：显示友好错误提示，不影响其他功能

### 测试

- 组件逻辑单元测试（vitest）
- WS 连接管理测试
- 多语言切换测试
