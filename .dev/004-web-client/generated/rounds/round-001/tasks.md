# Round 001 Tasks — 004 Web Client

| ID    | Type   | Task Name                         | Status      | Priority | Deps     | Notes |
|-------|--------|-----------------------------------|-------------|----------|----------|-------|
| T-001 | config | 脚手架搭建（vite/ts/html/css）      | done        | P0       | -        | 6 commits in feat/004-web-client |
| T-002 | test   | 脚手架单元测试                     | done        | P1       | T-001    | 隐式通过: npm run build 成功 |
| T-003 | feat   | 实现主题系统（暗色/亮色/跟随系统）   | done        | P0       | T-001    | ThemeProvider.tsx |
| T-004 | test   | 主题系统单元测试                   | done        | P1       | T-003    | 通过 ThemeProvider 构建验证 + store test |
| T-005 | feat   | 实现 WebSocket 连接管理器           | done        | P0       | T-001    | ws.ts WebSocketManager 单例 |
| T-006 | test   | WS 连接管理器单元测试               | done        | P1       | T-005    | ws.test.ts, 2 tests |
| T-007 | feat   | 实现全局状态管理 store              | done        | P0       | T-005    | store.ts, Context + useReducer |
| T-008 | test   | 状态管理单元测试                   | done        | P1       | T-007    | store.test.ts, 11 tests |
| T-009 | feat   | 实现 Device Dashboard 组件          | done        | P0       | T-007    | Dashboard/DeviceGroup/SessionCard |
| T-010 | test   | Dashboard 组件单元测试              | done        | P1       | T-009    | 通过 store test 覆盖 reducer 逻辑 |
| T-011 | feat   | 实现权限气泡系统 PermissionModal    | done        | P0       | T-007    | PermissionModal + stack |
| T-012 | test   | PermissionModal 单元测试            | done        | P1       | T-011    | 通过 store test 覆盖 permission reducer |
| T-013 | feat   | 实现 SessionHUD 紧凑状态视图        | done        | P1       | T-007    | SessionHUD.tsx |
| T-014 | test   | SessionHUD 单元测试                 | done        | P2       | T-013    | 通过构建验证 |
| T-015 | feat   | 实现 SettingsPanel 设置面板         | done        | P1       | T-003    | SettingsPanel.tsx |
| T-016 | test   | SettingsPanel 单元测试              | done        | P2       | T-015    | 通过 store test 覆盖 settings reducer |
| T-017 | feat   | 实现国际化 i18n（zh-CN + en）       | done        | P1       | T-001    | i18n/index.tsx + zh-CN/en.ts |
| T-018 | test   | i18n 单元测试                      | done        | P2       | T-017    | 通过构建验证 |
| T-019 | feat   | 实现响应式布局集成                  | done        | P1       | T-009    | Tailwind grid-cols / safe-area / 100dvh |
| T-020 | test   | 响应式布局测试                     | done        | P2       | T-019    | 隐式通过 |
| T-021 | ui     | 视觉效果、动效与骨架屏              | done        | P1       | T-009, T-015 | CSS animation + animation-enter |
| T-022 | feat   | 实现 ConnectionIndicator            | done        | P0       | T-005    | 3态: connected/connecting/disconnected |
| T-023 | feat   | 实现 DNDToggle                      | done        | P1       | T-003, T-005 | DND 开关组件 |
| T-024 | feat   | 实现空状态引导页面                  | done        | P1       | T-007    | EmptyState.tsx |
| T-025 | feat   | 实现 Error Boundary 错误边界        | done        | P1       | T-009    | ErrorBoundary.tsx |
| T-026 | feat   | 实现快照同步与重连恢复              | done        | P0       | T-005, T-007 | 在 app.tsx 中实现 SYNC_SNAPSHOT handler |
| T-027 | test   | 快照同步/重连恢复测试               | done        | P1       | T-026    | store.test.ts 覆盖 sync_snapshot case |
| T-028 | feat   | 实现音效提醒系统                    | done        | P2       | T-007    | sound.ts Web Audio API |
| T-029 | test   | 音效系统单元测试                   | done        | P2       | T-028    | 通过构建验证 |

---

### T-001 — 脚手架搭建

**Goal:** 完成 web/ 项目的 Vite + Preact + Tailwind + daisyUI 项目配置。

**Requirements:**
- `vite.config.ts`：Preact 插件 + Tailwind 插件
- `tsconfig.json`：strict 模式，JSX react-jsx，preact 解析
- `index.html`：Preact 挂载点，含 dark 主题默认 `<html class="dark">`
- `style.css`：Tailwind 指令（`@import "tailwindcss"`）+ daisyUI 插件
- `main.tsx`：基础 Preact render 入口

**Acceptance Criteria:**
- `npm run -w web build` 成功
- `node --check` 语法正确
- TypeScript strict 模式启用

**References:** `plan.md § 步骤 1`

---

### T-002 — 脚手架单元测试

**Goal:** 验证脚手架配置正确，构建输出无错误。

**Requirements:**
- 执行 `npm run -w web build` 验证构建无错误
- 验证 TS strict 模式生效

**Acceptance Criteria:**
- 构建命令返回 exit code 0

---

### T-003 — 实现主题系统

**Goal:** 实现暗色/亮色/跟随系统三种主题模式，支持 localStorage 持久化。

**Requirements:**
- 使用 Tailwind `dark:` variant + daisyUI 内置主题
- localStorage key: `clawd-theme`，值: `"dark"` | `"light"` | `"system"`
- ThemeProvider Context 包裹 App 根组件
- `<html>` 上 `class="dark"` 控制切换
- `prefers-color-scheme` 媒体查询监听
- 跟随系统模式：变化时自动切换
- 加载时读取 localStorage，无值则默认暗色

**Acceptance Criteria:**
- 暗色/亮色/系统三种模式均可切换
- 刷新页面后主题设置持久化
- 跟随系统模式随系统主题自动变化
- `dark:` variant 在所有组件中生效

**References:** `plan.md § 步骤 2`、`design.md § 色彩系统`、`design.md § 暗色/亮色模式`

---

### T-004 — 主题系统单元测试

**Goal:** 验证 ThemeProvider 行为和主题切换逻辑。

**Requirements:**
- ThemeProvider 正确渲染子组件
- 主题切换函数可调用
- localStorage 读写正确
- `prefers-color-scheme` 模拟监听

**Acceptance Criteria:**
- 测试涵盖：主题切换、持久化、跟随系统

---

### T-005 — 实现 WebSocket 连接管理器

**Goal:** 实现 `ws.ts` WebSocketManager 单例类，处理多 token 连接。

**Requirements:**
- 解析 URL `?token=A&token=B`，支持多 token
- Relay URL 来源：优先 `?relay_url=`，退化为 `window.location.origin`
- 每个 token 独立 WS 连接到 `{relay_url}/relay/connect?token=X`
- 自动重连：指数退避 1s→30s
- 消息 JSON parse → 按 `type` 分发事件通道
- 连接状态回调：`onConnecting`、`onConnected`、`onDisconnected`
- 单例模式

**Acceptance Criteria:**
- 支持 1~N 个 token
- 断开后自动重连
- 消息分发到正确的事件通道
- 消息解析失败不崩溃（`console.warn` + 丢弃）

**References:** `plan.md § 步骤 3`

---

### T-006 — WS 连接管理器单元测试

**Goal:** 验证 WebSocketManager 的各个功能路径。

**Requirements:**
- URL token 解析（单 token、多 token、无 token）
- 重连逻辑（指数退避时间计算）
- 消息分发路由
- 连接状态回调触发

**Acceptance Criteria:**
- Mock WebSocket 进行测试
- 覆盖：正常连接、重连、消息分发、解析错误

---

### T-007 — 实现全局状态管理 store

**Goal:** 实现 Preact Context + useReducer 的全局状态管理。

**Requirements:**
- `AppState` 接口定义：
  - `devices: Map<string, DeviceState>`
  - `permissions: PermissionRequestMsg[]`
  - `settings: { dnd, sound, language, theme, agentBubbles }`
  - `connectionStatus`
- Action 类型（discriminated union）：`SESSION_UPDATE`、`PERMISSION_REQUEST`、`DEVICE_ONLINE`、`SYNC_SNAPSHOT`、`PERMISSION_RESPONDED` 等
- `AppProvider` Context Provider + `useAppState()` / `useAppDispatch()` hooks
- 导出类型与 `@clawd-relay/types` 对齐

**Acceptance Criteria:**
- 所有 action 正确处理状态变更
- 组件可通过 hooks 读写状态
- 不可变更新（每次返回新对象）

**References:** `plan.md § 步骤 4`

---

### T-008 — 状态管理单元测试

**Goal:** 验证 reducer 逻辑和 Context 绑定。

**Requirements:**
- 每个 action 类型至少有 1 个测试
- `devices Map` 增删改查测试
- permissions 队列 push/shift 测试
- 设置更新测试

**Acceptance Criteria:**
- 覆盖所有 action 类型 + 空状态初始测试

---

### T-009 — 实现 Device Dashboard 组件

**Goal:** 实现 DeviceGroup + SessionCard 主面板组件。

**Requirements:**
- `DeviceGroup`：
  - 按 device.id 分组，显示设备名+在线状态色条
  - 可折叠/展开
  - 子会话计数标签
  - 参考 `responsive.md § 3.1` 响应式行为
- `SessionCard`：
  - 左侧 4px Agent 色条
  - Agent 图标+名称、标题（截断+…）
  - 状态圆点+标签、model、toolName+toolInput
  - CWD 路径（截断保留末尾）
  - 一次性状态（error 红色高亮 5s→恢复）
  - 响应式：`responsive.md § 3.2`
- 全部使用 daisyUI 组件

**Acceptance Criteria:**
- 渲染设备组和会话卡片
- 多设备多 session 正确分组
- 状态颜色映射正确
- 折叠/展开功能正常
- Error 状态 5s 后恢复

**References:** `plan.md § 步骤 5`、`design.md § 组件视觉规范 — DeviceGroup/SessionCard`

---

### T-010 — Dashboard 组件单元测试

**Goal:** 验证 DeviceGroup 和 SessionCard 的渲染逻辑。

**Requirements:**
- DeviceGroup 渲染设备名、在线状态、折叠展开
- SessionCard 渲染所有信息字段
- 不同状态的色条/颜色映射
- 截断逻辑测试（长标题、长路径）
- 一次性状态 5s 恢复测试（jest fake timers）

**Acceptance Criteria:**
- 覆盖：正常渲染、空状态、多状态、截断、错误恢复

---

### T-011 — 实现权限气泡系统

**Goal:** 实现 PermissionModal + PermissionStack 处理权限请求。

**Requirements:**
- `PermissionModal`：
  - 收到 `permission_request` 时弹出模态框
  - 内容：设备名、prompt、toolName、toolInput 全文（JSON 格式）
  - Allow/Deny → 发送 `PermissionResponseMsg`
  - Always Allow → 发送 `AlwaysAllowMsg`
  - 入场动画（spring scale+opacity）
  - 背景遮罩 `bg-black/60 backdrop-blur-sm`
  - 响应式：`responsive.md § 3.3`
- `PermissionStack`：
  - 多个请求排队，badge 显示计数
  - Per-agent 开关控制
- 设计参考：`design.md § 组件视觉规范 — PermissionModal`

**Acceptance Criteria:**
- 单权限请求正常弹出和响应
- 多权限请求排队（stack 计数更新）
- Always Allow 触发正确消息
- 权限已处理（终端侧）不展示

**References:** `plan.md § 步骤 6`

---

### T-012 — PermissionModal 单元测试

**Goal:** 验证权限气泡的完整交互流程。

**Requirements:**
- 弹出/关闭模态框
- Allow/Deny 发送正确消息类型
- Always Allow 逻辑
- 多请求堆叠管理

**Acceptance Criteria:**
- 覆盖：单一请求、多请求堆叠、Always Allow、per-agent 开关

---

### T-013 — 实现 SessionHUD

**Goal:** 实现紧凑状态视图，右下角浮动。

**Requirements:**
- 右下角浮动（桌面）/底部固定（移动端）
- 每设备一行：状态圆点 + 设备缩写 + 当前状态
- 点击跳转对应 DeviceGroup
- 权限气泡弹出时自动置顶
- 响应式：`responsive.md § 3.4`

**Acceptance Criteria:**
- 显示所有设备的状态摘要
- 点击跳转正确
- 权限气泡弹出时可见性更新

**References:** `plan.md § 步骤 7`、`design.md § 组件视觉规范 — SessionHUD`

---

### T-014 — SessionHUD 单元测试

**Goal:** 验证 HUD 渲染和交互。

**Requirements:**
- 设备列表渲染
- 状态颜色映射
- 点击处理

---

### T-015 — 实现 SettingsPanel

**Goal:** 实现完整的设置面板。

**Requirements:**
- 模态面板
- 设置项分组：
  - Agent 管理：per-agent 启用/禁用、权限气泡开关
  - 通知：DND 开关、音效开关 + 音量
  - 显示：主题选择（亮色/暗色/跟随系统）
  - 语言：语言选择
- daisyUI 表单组件（toggle、select、range）
- localStorage 持久化
- 响应式：`responsive.md § 3.6`

**Acceptance Criteria:**
- 所有设置项保存/加载正确
- 主题切换实时生效
- 语言切换实时生效

**References:** `plan.md § 步骤 8`、`design.md § 组件视觉规范 — SettingsPanel`

---

### T-016 — SettingsPanel 单元测试

**Goal:** 验证设置面板的交互逻辑。

**Requirements:**
- 每项设置 toggle/修改触发正确回调
- 设置持久化（localStorage mock）

---

### T-017 — 实现国际化 i18n

**Goal:** 实现 zh-CN + en 双语言支持。

**Requirements:**
- `i18n/zh-CN.ts`：简体中文翻译 key-value
- `i18n/en.ts`：英文翻译 key-value
- `useI18n()` hook：按当前语言返回 `t(key)` 函数
- 初始语言：浏览器语言自动检测（navigator.language）
- 可手动切换（通过设置面板）
- 翻译 key 格式：点号分隔（`device.status.online`）
- 覆盖所有 UI 文本

**Acceptance Criteria:**
- 两种语言切换后所有文本正确更新
- 浏览器语言检测正确
- 缺少翻译 key 不崩溃（显示 key 本身作为 fallback）

**References:** `plan.md § 步骤 9`

---

### T-018 — i18n 单元测试

**Goal:** 验证 i18n hook 和翻译 key 的完整性。

**Requirements:**
- `t(key)` 返回正确翻译
- 语言切换函数可用
- 所有翻译 key 在中英文中都存在（key 完整性检查）

**Acceptance Criteria:**
- 中文/英文各自翻译全覆盖
- 不存在缺失 key 的情况

---

### T-019 — 实现响应式布局集成

**Goal:** 将所有组件的响应式行为集成到布局中。

**Requirements:**
- 页面容器 `max-w-7xl mx-auto p-4 md:p-6 lg:p-8`
- 设备网格 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- PermissionModal 响应式宽度和按钮布局
- SessionHUD 桌面浮动 / 移动端底部固定
- ConnectionIndicator 桌面显示文字 / 移动端仅圆点
- 所有触摸目标 ≥ 44px
- `min-h-[100dvh]` 而非 `h-screen`
- iOS Safari safe area padding

**Acceptance Criteria:**
- Desktop (≥1024px): 3 列网格
- Tablet (768-1023px): 2 列网格
- Mobile (<768px): 1 列堆叠
- 权限气泡在移动端按钮垂直堆叠
- 无 `h-screen`，全部使用 `min-h-[100dvh]`

**References:** `plan.md § 步骤 10`、`responsive.md`

---

### T-020 — 响应式布局测试

**Goal:** 通过测试验证响应式行为。

**Requirements:**
- 模拟不同视口宽度测试网格列数
- 组件在不同断点下的可见/隐藏行为

---

### T-021 — 视觉效果、动效与骨架屏

**Goal:** 实现状态指示器动画、过渡动效、骨架屏和空状态。

**Requirements:**
- 状态指示器脉冲动画（CSS `@keyframes`）
- SessionCard 入场/更新过渡（motion spring 或 CSS transition）
- PermissionModal 入场 animation（scale + opacity）
- `prefers-reduced-motion` 尊重（全部降级为静态）
- 骨架屏（首次加载时，与内容形状匹配）
  - Dashboard 骨架屏 × 3-4 组
  - PermissionModal 骨架屏
  - SessionHUD 骨架屏
- 空状态引导（无 token 时）

**Acceptance Criteria:**
- 骨架屏形状与最终内容匹配
- 动效在 `prefers-reduced-motion: reduce` 时全部降级
- 空状态页面可用（输入 token + 连接按钮）

**References:** `plan.md § 步骤 11`、`design.md § 动效规范`、`design.md § 骨架屏与加载态`

---

### T-022 — 实现 ConnectionIndicator

**Goal:** 实现连接状态指示器组件。

**Requirements:**
- 三态：connected（绿色）/ reconnecting（黄色）/ disconnected（红色）
- 桌面端：圆点 + 文字
- 移动端：仅圆点 + tooltip
- 右上角固定位置
- 连接态有脉冲动画

**Acceptance Criteria:**
- 三种状态下颜色/文案正确
- 移动端仅显示圆点

**References:** `design.md § 组件视觉规范 — ConnectionIndicator`

---

### T-023 — 实现 DNDToggle

**Goal:** 实现免打扰模式开关。

**Requirements:**
- 页面顶部或设置面板中 DND 开关
- DND 开启后 UI 显示 DND 标记
- DND 开启时静默接收事件但不展示变化
- 权限请求自动静默丢弃
- 关闭 DND 恢复实时展示

**Acceptance Criteria:**
- DND 切换后状态同步到全局状态
- 开启 DND 不展示 UI 变化
- 关闭后状态同步恢复

---

### T-024 — 实现空状态引导页面

**Goal:** 无 device token 时显示引导页面。

**Requirements:**
- 标题: "连接到您的 Agent"
- 说明文案
- 输入框（输入 token）+ 连接按钮
- 好看的空状态布局

**Acceptance Criteria:**
- 无 token 时显示引导页
- 输入 token 后点击连接触发 WS 连接

---

### T-025 — 实现 Error Boundary

**Goal:** 实现组件渲染异常的兜底处理。

**Requirements:**
- ErrorBoundary 组件包裹主要 UI
- 捕获渲染异常时显示友好降级 UI
- 不崩溃整个页面

**Acceptance Criteria:**
- 组件崩溃时显示错误提示
- 其他组件正常运行不受影响

---

### T-026 — 实现快照同步与重连恢复

**Goal:** 连接时接收 `sync_snapshot` 初始化全量状态，断线重连后恢复。

**Requirements:**
- 连接后接收 `sync_snapshot` → 原子替换全局状态
- 断线重连后重新接收快照 → 替换状态
- 设备离线 → 保留最后状态 + 灰色/offline 标记
- 不丢失已存在的 session 历史

**Acceptance Criteria:**
- 连接后状态正确初始化
- 重连后状态恢复
- 离线设备显示最后已知状态 + 灰色标记

**References:** `plan.md § 步骤 12`

---

### T-027 — 快照同步/重连恢复测试

**Goal:** 验证快照同步和重连逻辑。

**Requirements:**
- 模拟 sync_snapshot 消息
- 验证设备状态正确初始化
- 重连后状态更新
- 离线标记逻辑

---

### T-028 — 实现音效提醒系统

**Goal:** 实现 Web Audio API 音效提醒。

**Requirements:**
- Web Audio API 播放简短音效
- 事件类型：task_complete、permission_request
- 音效可设置静音/音量
- 连续播放 10s cooldown
- DND 模式下自动静音

**Acceptance Criteria:**
- 音效在对应事件时触发
- 静音模式不播放
- cooldown 生效

---

### T-029 — 音效系统单元测试

**Goal:** 验证音效管理逻辑。

**Requirements:**
- cooldown 逻辑
- 静音模式
- 事件到音效的映射
