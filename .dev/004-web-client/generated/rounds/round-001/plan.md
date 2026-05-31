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
- `index.html`：Preact 挂载点，含 dark 主题 `<html>` class
- `style.css`：Tailwind 指令 + daisyUI 插件

### 步骤 2 — 主题系统（暗色/亮色模式）
- 使用 Tailwind `dark:` variant + daisyUI 内置主题
- 设置 localStorage 持久化（key: `clawd-theme`）
- 主题选择器：亮色 / 暗色 / 跟随系统三种模式
- ThemeProvider Context 包裹 App 根组件
- `prefers-color-scheme` 监听 + 系统主题自动切换
- 页面 `<html>` 添加 `class="dark"` 控制
- 设计参考：`design.md § 色彩系统`、`design.md § 暗色/亮色模式`

### 步骤 3 — WebSocket 连接管理器 (`ws.ts`)
- `WebSocketManager` 类：
  - 解析 URL `?token=A&token=B`，支持多个 token
  - **Relay URL 来源**：优先从 URL query 参数 `?relay_url=` 获取；若不存在，则使用 `window.location.origin` 自动推断（与 Worker 同一域名部署时生效）
  - 每个 token 创建独立的 WebSocket 连接到 `{relay_url}/relay/connect?token=X`
  - 自动重连：指数退避 1s→30s
  - 消息分发：收到消息 → JSON parse → 按 `type` 分发到不同事件通道
  - 连接状态回调：`onConnecting`、`onConnected`、`onDisconnected`
  - 单例模式，全局使用

### 步骤 4 — 全局状态管理 (`store.ts`)
- 使用 Preact Context + useReducer
  - 状态：`devices: Map<deviceId, DeviceState>`
  - Action：`SESSION_UPDATE`、`PERMISSION_REQUEST`、`DEVICE_ONLINE`、`SYNC_SNAPSHOT`
- 提供 `useAppState()` / `useAppDispatch()` hooks
- 状态类型定义与 `@clawd-relay/types` 对齐

### 步骤 5 — 设备管理面板 (`Dashboard`)
- `DeviceGroup` 组件（见 `design.md § 组件视觉规范 — DeviceGroup`）
- `SessionCard` 组件（见 `design.md § 组件视觉规范 — SessionCard`）
- 响应式：`responsive.md § 3.1`、`§ 3.2`

### 步骤 6 — 权限气泡系统 (`PermissionModal`)
- 收到 `permission_request` 时触发模态弹出
- 内容：设备名、prompt、tool name、tool input 全文
- Allow / Deny 按钮 → 发送 `PermissionResponseMsg`
- "Always allow" 选项：用户确认后发送 `AlwaysAllowMsg` 到 DO，DO 存储匹配规则到 `state.storage` 并转发给 Bridge 记录
- 堆叠管理 (`PermissionStack`)：
  - 多个请求排队显示
  - 当前排队的请求数 badge
  - Per-agent 开关控制

### 步骤 7 — Session HUD (`SessionHUD`)
- 页面角落紧凑状态条（右下角浮动）
- 每设备一行：绿点/灰点 + 设备名 + 当前 session 摘要
- 点击展开详细 Dashboard
- 权限气泡弹出时自动置顶
- 响应式：`responsive.md § 3.4`

### 步骤 8 — 设置面板 (`SettingsPanel`)
- 独立的模态设置面板
- 设置项：Agent 启用/禁用、per-agent 权限气泡开关
- DND 模式切换
- 音效开关 + 音量
- 语言选择
- 暗色/亮色/跟随系统
- 全部使用 daisyUI 表单组件
- 响应式：`responsive.md § 3.6`

### 步骤 9 — 国际化
- `i18n/zh-CN.ts` + `i18n/en.ts`：JSON key-value 格式
- `useI18n()` hook：按当前语言返回翻译函数
- 初始语言：浏览器语言自动检测，可手动切换
- 所有 UI 文本统一通过翻译 key 输出

### 步骤 10 — 响应式布局集成
- 页面级容器：`max-w-7xl mx-auto p-4 md:p-6 lg:p-8`
- DeviceGroup 网格：`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- PermissionModal 响应式宽度：`design.md § 响应式行为 — PermissionModal`
- SessionHUD 浮动定位 vs 移动端底部固定
- ConnectionIndicator 移动端仅显示圆点
- `min-h-[100dvh]` 而非 `h-screen`
- iOS Safari safe area (`env(safe-area-inset-*)`)
- 所有触摸目标 ≥ 44px
- 参考：`responsive.md` 全部规范

### 步骤 11 — 视觉效果与动效
- Agent 类型颜色/图标引用 `AGENT_META`（`@clawd-relay/types`）
- 状态指示器：圆形 + 颜色 + 脉冲/静态
- 卡片过渡动画（CSS transition / motion:spring）
- 骨架屏加载（首次连接时）：
  - Dashboard 骨架屏：3-4 个 DeviceGroup 形状
  - SessionCard 骨架屏：色条 + 标题 + 文字
  - PermissionModal 骨架屏：居中矩形 + 内容骨架
- 空状态引导（无 token 时）
- Error Boundary 兜底
- `prefers-reduced-motion` 尊重
- 动效规范参考：`design.md § 动效规范`

### 步骤 12 — 快照同步与重连恢复
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
