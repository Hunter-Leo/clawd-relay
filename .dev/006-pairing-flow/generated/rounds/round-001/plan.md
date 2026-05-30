# 006 — 配对流程与二维码 — 实现计划

## 项目结构

### Bridge 侧（基于 REQ-002 已完成的 token.py 增量更新）

```
bridge/src/bridge/
├── token.py                  # [REQ-002 已创建] 增加 --regenerate-token 支持 + 二维码输出
└── main.py                   # [REQ-002 已创建] 增加配对链接输出逻辑
```

> 说明：`token.py` 的生成/持久化/读取核心功能在 REQ-002 中完成。REQ-006 在此基础上增加：
> - `--regenerate-token` CLI 参数
> - 配对 URL 格式化输出
> - 二维码生成（可选依赖）

### Worker 侧
```
worker/src/
└── index.ts                  # 添加 /join/:token 重定向路由
```

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 二维码库 | `qrcode[pil]` | Python 生态标准方案，ASCII + 图片双模式 |
| 类型标注 | `qrcode` 为可选依赖 | 不影响核心功能 |

## 实现路径

### 步骤 1 — Token 生成与持久化（更新 `token.py`）
- 生成：`secrets.token_hex(16)` → 32 位 hex 字符串
- 也可支持可选的更短格式 `secrets.token_urlsafe(8)` → 11 位 Base64 URL 安全字符
- 持久化：`~/.clawd-relay/token.json` 文件
  - 格式：`{"token": "...", "created_at": 1710000000000}`
  - 原子写入：写入临时文件后 rename
- 启动时优先读取已有 token（保持稳定，不随重启变化）
- `--regenerate-token`：删除已有 token 文件，生成新的

### 步骤 2 — 配对链接输出（更新 `main.py`）
- Bridge 启动时 stdout 输出：
  - 带颜色（ANSI 绿色）打印配对链接
  - 如配置了 Relay URL，打印完整 URL
  - 如未配置 Relay URL，仅打印 "Token: <token>"
  - 输出格式示例：
    ```
    ┌─────────────────────────────────┐
    │  🔗 配对链接:                    │
    │  https://relay.xxx.workers.dev  │
    │             /join/abc123def456   │
    │                                 │
    │  或手动输入 Token:               │
    │  abc123def456                   │
    └─────────────────────────────────┘
    ```

### 步骤 3 — 二维码生成
- 使用 `qrcode` 库生成配对 URL 的 QR 码
- 默认模式：在终端输出 ASCII QR 码
  ```python
  import qrcode
  qr = qrcode.QRCode(box_size=1, border=1)
  qr.add_data(pair_url)
  qr.print_ascii()  # 终端输出
  ```
- 可选模式：`--show-qr` 打开系统图片预览
  - 生成 PNG 图片到临时目录
  - macOS 执行 `open <tempfile>`，Linux 执行 `xdg-open <tempfile>`
- 二维码内容为完整配对 URL

### 步骤 4 — Worker 端重定向路由 (`/join/:token`)
```typescript
// 在 worker/src/index.ts 添加
app.get("/join/:token", (c) => {
  const token = c.req.param("token");
  return c.redirect(`/?token=${token}`, 302);
});
```

## 关键技术要点

### 可选依赖声明
`bridge/pyproject.toml` 中的可选依赖组：
```toml
[project.optional-dependencies]
qr = ["qrcode[pil]>=7.4"]
```
安装时：`uv tool install bridge[qr]` 或 `uvx --with bridge[qr] relay`

### 二维码输出策略
```python
class QrOutput:
    ASCII = "ascii"    # 终端 ASCII QR（默认）
    IMAGE = "image"    # 打开图片预览
    NONE = "none"      # 不输出二维码
```
通过 `--qr-output` CLI 参数控制。

## 不做范围
- 手机 App 扫码配对（PWA 或原生封装是 Phase 3）
- 自动打开浏览器配对页面
