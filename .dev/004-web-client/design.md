# 004 — Web Client UI/UX Design

> Design Read: AI Agent 远程监控仪表盘，面向开发者，dark-first，Tailwind + daisyUI 紧凑布局
> DIALS: DESIGN_VARIANCE=3 · MOTION_INTENSITY=4 · VISUAL_DENSITY=6

## 1. 设计原则

### 信息层级优先
仪表盘的首要任务是让用户**一目了然**。视觉装饰不干扰信息传达。每个 UI 元素必须服务于一个明确的信息目的。

### 状态即界面
Agent 的状态（thinking / working / idle / error / offline）是核心信息载体。状态通过颜色、图标、动画三重编码，确保色盲用户和快速扫视都能识别。

### Dark by Default
开发者工具类的产品天然适配暗色主题。默认暗色模式，同时支持亮色和跟随系统。暗色不是「黑色背景加白色字」——使用分层暗色来建立深度层级。

### 紧凑但不拥挤
信息密集是仪表盘的天性，但每个区块保留足够的内间距。卡片之间用负空间而非边框来分隔，只有需要强调层级时才使用卡片容器。

## 2. 色彩系统

### 主色调

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--color-accent` | #6366F1 (Indigo-500) | #818CF8 (Indigo-400) | 品牌色、活动状态、链接 |
| `--color-accent-hover` | #4F46E5 (Indigo-600) | #6366F1 (Indigo-500) | 悬停状态 |
| `--color-accent-soft` | #EEF2FF | #1E1B4B | 淡色背景 |

选择 Indigo 而非紫色（规避 AI-purple cliché）。Indigo 兼具蓝色（可信、技术）和紫色的少许个性。非品牌元素使用 daisyUI 的 zinc/slate 中性色系。

### 状态色

| 状态 | 颜色 | HEX (Dark) | HEX (Light) | 含义 |
|------|------|------------|------------|------|
| Idle | Gray | #6B7280 | #9CA3AF | 无活动 |
| Working | Green | #22C55E | #16A34A | Agent 正在工作 |
| Thinking | Yellow | #EAB308 | #CA8A04 | Agent 在推理 |
| Error | Red | #EF4444 | #DC2626 | 错误/异常 |
| Notification | Blue | #3B82F6 | #2563EB | 需要用户注意 |
| Sleeping | Purple | #A855F7 | #9333EA | 休眠状态 |
| Online | Green | #22C55E | #16A34A | 设备在线 |
| Offline | Gray | #4B5563 | #D1D5DB | 设备离线 |

### Agent 类型色（引用 `AGENT_META`）

| Agent | Color | HEX |
|-------|-------|-----|
| claude-code | 紫色 | #8B5CF6 |
| codex | 蓝色 | #3B82F6 |
| copilot | 绿色 | #22C55E |
| gemini-cli | 琥珀 | #F59E0B |
| cursor | 青色 | #06B6D4 |
| opencode | 紫罗兰 | #A855F7 |

Agent 色用于卡片左侧色条、代理图标背景，不用于页面级大面积色块。

### Agent 类型图标

使用 emoji 图标（协议中 `AGENT_META` 定义）作为 Agent 类型标识。不在 Web 端单独维护图标映射 —— 直接从 `@clawd-relay/types` 引入 `AGENT_META`。

### 暗色层级

| 层级 | Token | 用途 |
|------|-------|------|
| 背景 | `bg-zinc-950` | 页面主背景 |
| 表面 1 | `bg-zinc-900` | 卡片、面板 |
| 表面 2 | `bg-zinc-800` | 输入框、代码块 |
| 边框 | `border-zinc-800` | 分隔线 |
| 文字主 | `text-zinc-100` | 主要文字 |
| 文字次 | `text-zinc-400` | 次要文字 |
| 文字弱 | `text-zinc-600` | 占位、禁用 |

### 亮色层级

| 层级 | Token | 用途 |
|------|-------|------|
| 背景 | `bg-zinc-50` | 页面主背景 |
| 表面 1 | `bg-white` | 卡片、面板 |
| 表面 2 | `bg-zinc-100` | 输入框、代码块 |
| 边框 | `border-zinc-200` | 分隔线 |
| 文字主 | `text-zinc-900` | 主要文字 |
| 文字次 | `text-zinc-500` | 次要文字 |
| 文字弱 | `text-zinc-300` | 占位、禁用 |

### 色彩一致性锁定

- 全页面只有一个强调色（Indigo）
- Agent 类型色仅在对应 Agent 卡片区域使用，不污染页面级元素
- 状态色严格绑定到状态值 —— 同一状态在 Dashboard、HUD、Permission Modal 中使用相同的颜色
- 暗色/亮色之间不做独立配色偏移（中性色跟随层级变化，强调色仅微调亮度）

## 3. 排版

| 层级 | Class | 用途 |
|------|-------|------|
| 页面标题 | `text-2xl font-semibold tracking-tight` | 页面/面板标题 |
| 卡片标题 | `text-base font-medium` | Session 卡片标题 |
| 正文 | `text-sm leading-relaxed` | 描述性文本 |
| 代码/状态 | `text-xs font-mono` | toolName、toolInput、cwd、时间戳 |
| 状态标签 | `text-xs font-medium uppercase tracking-wide` | 状态指示标签 |
| 设备名 | `text-lg font-semibold` | 设备标题 |
| 次要信息 | `text-xs text-zinc-400` | 元信息、时间戳、来源 |

选择字体：
- **UI 字体**：系统字体栈（`-apple-system, BlinkMacSystemFont, "Segoe UI"`），无自定义字体加载
- **等宽字体**：`ui-monospace, SFMono-Regular`，用于 toolInput、路径等技术信息

不使用 Inter、Geist 等自定义字体 —— 仪表盘优先考虑加载速度和系统一致性。

### 排版规则

- 不将代码/技术信息自动截断为全大写 —— `toolName` 保持原始大小写
- 长 toolInput 使用 `truncate` 配合悬念号，点击展开查看全文
- CWD 路径使用 `truncate` 保留末尾目录名

## 4. 间距与布局

### 间距系统

| Token | 值 | 用途 |
|-------|-----|------|
| 页面间距 | `p-4 md:p-6 lg:p-8` | 页面边距 |
| 卡片间距 | `gap-3 md:gap-4` | 卡片网格间距 |
| 卡片内间距 | `p-3 md:p-4` | 卡片内部 padding |
| 分组间距 | `mb-6 md:mb-8` | 设备分组间距 |
| 内容间距 | `space-y-2` | 卡片内元素间距 |
| 小间距 | `gap-2`、`gap-1.5` | 内联元素间距 |

### 布局网格

```
Desktop (lg, ≥1024px):    max-w-7xl mx-auto, 3-4 列网格
Tablet (md, 768-1023px):  px-6, 2 列网格
Mobile (sm, <768px):      px-4, 1 列堆叠
```

不搞「三张等宽的 feature card」——信息卡片使用 CSS Grid 混合尺寸，主卡片占 2 列，次要卡片占 1 列。

## 5. 组件交互状态

所有交互组件必须实现完整状态周期：

### 按钮
- `:hover` → 色深/背景加深（`hover:bg-indigo-500`）
- `:active` → `scale-[0.97]` 模拟物理按压
- `:focus-visible` → daisyUI 默认 focus ring
- `disabled` → `opacity-50 cursor-not-allowed`
- **不允许白色按钮 + 白色文字**，**不允许透明按钮 + 页面背景同色**

### 卡片
- 可交互卡片（点击展开、跳转）→ `hover:border-zinc-700 cursor-pointer transition-colors`
- 纯展示卡片 → 无 hover 效果

### 权限气泡模态框
- 弹出时带 `opacity + scale` 过渡（motion:spring）
- 背景遮罩使用 `bg-black/60` + `backdrop-blur-sm`
- 关闭按钮始终可见

### 骨架屏
- 页面加载时显示 daisyUI `skeleton` 组件
- 卡片列表使用与最终布局形状匹配的骨架（圆形+矩形组合），不是通用 spinner

## 6. 状态指示器设计

状态指示器是产品的视觉核心。每个 Session 卡片左上角显示状态圆点：

```
[●] Working    — 绿色脉冲（2s 周期）
[●] Thinking   — 黄色脉冲（2s 周期）
[●] Idle       — 灰色静态
[●] Error      — 红色静态 + 卡片红色左边框
[●] Sleeping   — 紫色微脉冲
```

- 脉冲动画使用 CSS `@keyframes`（`opacity: 1 → 0.5 → 1`）
- `prefers-reduced-motion: reduce` 时降级为静态纯色圆点

## 7. 骨架屏与加载态

### 骨架屏设计

每个主要容器组件有对应的骨架屏变体，形状与最终内容匹配：

```
ConnectionIndicator skeleton:   [————— 社交图标 —————] + 文字骨架 120px
DeviceGroup skeleton:           [●] + 标题骨架 200px
  SessionCard skeleton × 3:    [■—■—■—■] 状态色条 + 标题 60% + 文字 40% + 文字 30%
Dashboard skeleton:            3-4 个 DeviceGroup skeleton 堆叠
PermissionModal skeleton:      居中矩形 480px，内部标题 + 文字 × 4 + 两个按钮骨架
SessionHUD skeleton:           [● 文字 100px | ● 文字 80px | ● 文字 120px]
```

- 骨架屏只出现在**首次加载**（WebSocket 连接未就绪时）
- 通过 WebSocket 接收到 `sync_snapshot` 后立即替换为真实内容
- 断线重连期间**保持现有 UI**，不回到骨架屏

### 空状态

- 无 token 时，显示空状态引导页面：
  - 标题: "连接到您的 Agent"
  - 说明: "在 URL 中添加 `?token=<your_token>` 来连接您的设备"
  - Action: 输入框 + 连接按钮（方便直接输入 token）
- 有 token 但设备全部离线：显示 "设备离线" 提示 + 最后已知状态

### 错误态

- WebSocket 连接失败：页面顶部 toast "连接失败，正在重试..." + 重连计数
- 消息解析失败：静默丢弃，`console.warn`，不崩溃 UI
- 组件渲染异常：Error Boundary 兜底，显示友好降级 UI

## 8. 暗色/亮色模式

### 策略

使用 Tailwind `dark:` variant + daisyUI 内置主题系统。

### 默认模式

- **默认暗色**（开发者工具受众偏好）
- 支持用户手动切换（亮色/暗色/跟随系统）
- `prefers-color-scheme` 用于初始检测

### 切换方式

- 设置面板中的主题选择器（Segmented Control: 亮色 / 暗色 / 系统）
- 选择存储到 localStorage，下次加载自动恢复

### 锁定规则

一页只有一个主题。不允许在某些 section 突然翻转模式。

## 9. 动效规范

### 原则

- 动效必须有**动机**（传达状态变化/层级/反馈），不为动而动
- 只动 `transform` 和 `opacity`（性能保障）
- 动效时长：150-300ms（入场快、出场略慢）

### 出场动效

| 场景 | 动效 | 参数 |
|------|------|------|
| 权限气泡弹出 | scale + opacity | spring: stiffness=300, damping=25 |
| Session 卡片更新 | opacity flash 或 subtle scale | 200ms ease-out |
| 连接状态变化 | 颜色过渡 | 300ms ease |
| 卡片列表入场 | stagger fade | 每个 150ms, delay 30ms |
| 错误状态闪烁 | 红色高亮 5s → fade 恢复 | 5s delay + 500ms fade |

### 减少动效

所有动效必须挂 `prefers-reduced-motion` 检测。用户开启减少动效时，全部降级为 `duration: 0` 或 `animation: none`。

### 不使用

- 页面滚动叙事（ScrollTrigger、GSAP）
- 磁吸鼠标效果
- 无限循环动画（除状态指示器脉冲外）
- 视差滚动
- 粒子效果

## 10. 多语言下的 UI 约束

- 中文文案比英文短，英文比中文长
- 所有固定宽度容器在英文下校验：按钮文字是否换行
  - 例如 "Always Allow"（11 字符）→ 按钮需预留足够宽度
  - 阈值：英文最长翻译 key 不超过按钮的 90% 宽度
- CTA 按钮文字必须一行显示，不允许换行
- 翻译 key 名使用英文点号分隔（`permission.title`、`device.status.online`）

## 11. 具体组件视觉规范

### ConnectionIndicator
- 三态：绿圆点 + "已连接" / 黄圆点 + "重连中..." / 红圆点 + "已断开"
- 位置：页面右上角固定
- 尺寸：圆点 8px，文字 12px
- 连接态圆点有脉冲动画

### DeviceGroup
- 设备名 + 在线状态色条（绿=在线 / 灰=离线）
- 连接时间（相对时间 "2m ago"）
- 可折叠/展开：点击设备名行切换
- 子会话计数显示在右侧

### SessionCard
- 左侧 4px Agent 色条
- 左上：Agent 图标 + Agent 名
- 标题区域：会话标题（单行截断 + `…`）
- 状态行：状态圆点 + 状态标签
- 技术信息行：model（等宽/灰色）
- 动作行：toolName + toolInput 摘要（等宽/单行截断）
- 底部：CWD 路径（等宽/灰色/截断保留末尾）
- 一次性状态（error/notification）→ 卡片叠加色条/边框高亮，5s 后恢复

### PermissionModal
- 居中模态框，最大宽度 560px
- 头部：权限请求图标 + "权限请求" + 关闭按钮
- 提示文字区域：完整显示 prompt 文本
- tool 信息：toolName badge + toolInput 代码块（max-h-48 overflow-y-auto，JSON 格式化）
- 底部按钮行：Deny（ghost）| 分隔 | Always Allow（ghost）| Allow（primary）
- Multi-permission stack：左下角显示堆叠计数 badge
- 背景遮罩：`bg-black/60 backdrop-blur-sm`

### SessionHUD
- 固定在页面右下角（或侧边栏底部）
- 紧凑的单行列表：每设备 [● Agent图标 设备名 当前状态缩写]
- 点击跳转到对应 DeviceGroup
- 权限气泡弹出时 HUD 自动置顶

### SettingsPanel
- 模态面板或独立页面
- 分组设置项：Agent 管理 / 通知 / 显示 / 语言
- daisyUI 原生表单组件：toggle、select、range
- 设置保存到 localStorage
