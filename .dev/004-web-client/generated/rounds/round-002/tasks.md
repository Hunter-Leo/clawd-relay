# Round 002 Tasks — 004 Web Client 视觉精化

| ID    | Type | Task Name                     | Status      | Priority | Deps     | Notes |
|-------|------|-------------------------------|-------------|----------|----------|-------|
| T-031 | ui   | 改进全局基础样式（scroll/selection/focus） | done        | P1       | -        | Terminal Native 设计系统：全局 mono font, CRT 黑底 #0c0c0c, 琥珀 accent #f59e0b |
| T-032 | ui   | 精化 SessionCard 视觉效果       | done        | P1       | -        | 改为三行紧凑布局：状态tag+标题 / agent+model+tool / cwd |
| T-033 | ui   | 精化 DeviceGroup 视觉效果       | done        | P1       | -        | flat 布局替代卡片，方形状态点替代圆点，`[online]` 文字标签 |
| T-034 | ui   | 精化 PermissionModal 交互动效   | done        | P1       | -        | 纯边框方框模态，终端 prompt 箭头，`[allow]`/`[deny]` 文字按钮 |
| T-035 | ui   | 精化 SessionHUD 样式            | done        | P2       | -        | 左侧边栏文字列表，方形点+agent 图标 |
| T-036 | ui   | 精化 EmptyState 视觉效果        | done        | P2       | -        | 终端 prompt `~ $ clawd relay` + 方框输入 |
| T-037 | ui   | 精化 TopBar/DND 样式            | done        | P2       | -        | `[dnd]`/`[bell]` 文字按钮替代滑动 toggle |
| T-038 | ui   | 精化 SettingsPanel 样式         | done        | P2       | -        | 纯文字设置面板，原生 checkbox+range |
| T-039 | ui   | 精化 ConnectionIndicator 动画   | done        | P2       | -        | `[connected]`/`[connecting]`/`[disconnected]` 文字颜色标签 |
| T-040 | ui   | 综合验证（构建+测试）           | done        | P0       | T-031~T-039 | 构建成功，13 tests 通过 |