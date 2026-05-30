# 004 — 网页客户端 (Preact + Vite) — 实现计划

## 项目结构

```
web/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx                    # 应用入口 + render
    ├── app.tsx                     # 主 App 组件（路由、全局状态）
    ├── style.css                   # Tailwind 入口 + daisyUI
    ├── ws.ts                       # WebSocket 连接管理器
    ├── i18n/
    │   ├── zh-CN.ts                # 简体中文翻译
    │   └── en.ts                   # 英文翻译
    ├── components/
    │   ├── ConnectionIndicator.tsx  # 连接状态指示器
    │   ├── DeviceGroup.tsx          # 设备分组容器
    │   ├── SessionCard.tsx          # 会话状态卡片
    │   ├── Dashboard.tsx            # 设备面板主页
    │   ├── SessionHUD.tsx           # 紧凑状态条
    │   ├── PermissionModal.tsx      # 权限请求模态框
    │   ├── PermissionStack.tsx      # 权限请求堆叠管理
    │   ├── SettingsPanel.tsx        # 设置面板
    │   └── DNDToggle.tsx            # DND 开关
    └── state/
        └── store.ts                # 全局状态管理
```

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| UI 框架 | Preact 10.x | 轻量（3KB），React 兼容 API |
| 构建工具 | Vite 6.x | 快速 HMR，原生 ESM |
| CSS 框架 | Tailwind 4.x + daisyUI 5.x | 零手写 CSS，即用美观组件 |
| 状态管理 | Preact Context + useReducer | 轻量，无需 Redux |
| 国际化 | JSON key-value + Intl API | 零依赖，按需加载 |
| 部署 | CF Pages | 与 CF Worker 同一生态，自动部署 |

## 实现路径

### 步骤 1 — 脚手架与配置
- `vite.config.ts`：Preact 插件 + Tailwind 插件
- `tsconfig.json`：strict 模式，JSX react-jsx，preact 解析
- `index.html`：Preact 挂载点
- `style.css`：Tailwind 指令 + daisyUI 插件

### 步骤 2 — WebSocket 连接管理器 (`ws.ts`)
- `WebSocketManager` 类：
  - 解析 URL `?token=A&token=B`，支持多个 token
  - **Relay URL 来源**：优先从 URL query 参数 `?relay_url=` 获取；若不存在，则使用 `window.location.origin` 自动推断（与 Worker 同一域名部署时生效）
  - 每个 token 创建独立的 WebSocket 连接到 `{relay_url}/relay/connect?token=X`
  - 自动重连：指数退避 1s→30s
  - 消息分发：收到消息 → JSON parse → 按 `type` 分发到不同事件通道
  - 连接状态回调：`onConnecting`、`onConnected`、`onDisconnected`
  - 单例模式，全局使用

### 步骤 3 — 设备管理面板 (`Dashboard`)
- 全局状态 `store.ts`：使用 Preact Context + useReducer
  - 状态：`devices: Map<deviceId, DeviceState>`
  - Action：`SESSION_UPDATE`、`PERMISSION_REQUEST`、`DEVICE_ONLINE`、`SYNC_SNAPSHOT`
- `DeviceGroup` 组件：
  - 按 device.id 分组
  - 显示设备名、在线状态、连接时间
  - 展开/折叠功能
- `SessionCard` 组件：
  - 显示 agentId（带颜色/图标标识）、state（带颜色指示器）
  - 标题（自动截断 80 字符）、model、toolName、toolInput 摘要
  - CWD 路径（截断显示）
  - 子会话计数：1→"working"、2→"groove"、3+→"building"
  - 一次性状态（error/notification）用特殊样式，5 秒后恢复

### 步骤 4 — 权限气泡系统 (`PermissionModal`)
- 收到 `permission_request` 时触发模态弹出
- 内容：设备名、prompt、tool name、tool input 全文
- Allow / Deny 按钮 → 发送 `PermissionResponseMsg`
- "Always allow" 选项：用户确认后发送 `AlwaysAllowMsg` 到 DO，DO 存储匹配规则到 `state.storage` 并转发给 Bridge 记录
- 堆叠管理 (`PermissionStack`)：
  - 多个请求排队显示
  - 当前排队的请求数 badge
  - Per-agent 开关控制

### 步骤 5 — Session HUD
- 页面角落紧凑状态条
- 每设备一行：绿点/灰点 + 设备名 + 当前 session 摘要
- 点击展开详细 Dashboard
- 权限气泡弹出时自动置顶

### 步骤 6 — 设置面板 (`SettingsPanel`)
- 独立的模态设置面板
- 设置项：Agent 启用/禁用、per-agent 权限气泡开关
- DND 模式切换
- 音效开关 + 音量
- 语言选择
- 暗色/亮色/跟随系统
- 全部使用 daisyUI 表单组件

### 步骤 7 — 国际化
- `i18n/zh-CN.ts` + `i18n/en.ts`：JSON key-value 格式
- `useI18n()` hook：按当前语言返回翻译函数
- 初始语言：浏览器语言自动检测，可手动切换
- 所有 UI 文本统一通过翻译 key 输出

### 步骤 8 — 视觉效果
- **Agent 类型颜色/图标**：引用 `@clawd-relay/types` 中定义的 `AGENT_META` 映射表（claude-code=紫、codex=蓝、copilot=绿等），不自行维护映射
- 状态指示器：圆形 + 颜色（thinking=黄、working=绿、error=红、idle=灰）
- 卡片过渡动画（daisyUI `transition` 类）
- 骨架屏加载（daisyUI `skeleton` 组件）

### 步骤 9 — 快照同步与重连恢复
- 连接后收到 `sync_snapshot` → 初始化全量状态
- 断线重连后重新接收快照 → 原子替换全局状态
- 设备离线 → 保持最后状态 + 灰色标记
- 不丢失已存在的 session 历史

## 关键技术要点

### 多 Token 连接
```
URL: ?token=abc123&token=def456
  → 创建两个 WS 连接：
    ws://relay/connect?token=abc123
    ws://relay/connect?token=def456
  → 统一事件处理，按 device 分组展示
```

### 全局状态设计
```typescript
interface AppState {
  devices: Map<string, DeviceState>;  // deviceId → 设备状态
  permissions: PermissionRequestMsg[]; // 待处理权限队列
  settings: {
    dnd: boolean;
    sound: boolean;
    language: "zh-CN" | "en";
    theme: "light" | "dark" | "system";
    agentBubbles: Record<string, boolean>; // agentId → 气泡开关
  };
  connectionStatus: "connecting" | "connected" | "disconnected";
}
```

## 不做范围
- 桌面像素动画、眼球追踪、窗口拖拽（Electron 专有能力）
- Mini Mode、睡眠序列
- 远程 SSH 部署
- 主题系统（clawd-on-desk 可导入主题，网页端不显示动画）
