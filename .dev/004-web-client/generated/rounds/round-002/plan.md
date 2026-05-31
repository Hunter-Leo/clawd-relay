# Round 002 — 004 Web Client 视觉精化

## 目标
在保持信息密度和布局不变的前提下，通过 CSS 细节、过渡动效、微交互和视觉层次提升整体精致感。

## 改进维度

### 1. 基础细节（style.css）
- 自定义滚动条（暗色匹配）
- `::selection` 颜色匹配 accent
- focus-visible 统一环
- 流畅的全局过渡

### 2. SessionCard
- hover 提起效果（`-translate-y-0.5` + shadow 加深）
- 状态色条的过渡动画
- 状态圆点脉冲呼吸更平滑
- 卡片内部间距微调

### 3. DeviceGroup
- 分组头 hover 微亮
- 折叠/展开动画（max-height transition）
- session 列表项之间的分隔线更加柔和

### 4. Dashboard 布局
- 响应式间距精细化
- 设备间更好的呼吸感

### 5. PermissionModal
- 入场动画更加流畅
- backdrop 模糊效果
- 按钮的按压反馈（active 态）
- 移动端按钮垂直布局时的间距

### 6. SessionHUD
- 更精致的浮动面板
- 设备条目 hover 微交互
- 移动端底部横条样式提升

### 7. EmptyState
- 内容居中改进
- 入场动画
- 输入框聚焦效果

### 8. TopBar
- DNDToggle 样式改进（图标+颜色）
- 设置按钮 hover 旋转
- 整体更紧凑

### 9. SettingsPanel
- 更好的分组间距
- 选项 hover 效果
- 关闭动画

### 10. 连接指示器
- 圆点脉冲 CSS 动画更自然
- 三种状态的过渡动画

## 技术方案
- 纯 CSS 改进（Tailwind utility + style.css @layer）
- 不引入额外依赖
- 不影响现有功能逻辑
- 不影响测试
