# TC-Connect 后端待实现清单

> 基于前端代码（`App.jsx` / `TranslatePage.jsx`）与现有后端（`platform/web/`、`agent/copilot/`、`core/`）的对照分析。

---

## 一、已实现

| 接口 | 位置 | 说明 |
|------|------|------|
| `WebSocket /ws` | `platform/web/web.go` | 接收消息、转发给 agent、推送响应 |
| `GET /api/models` | `platform/web/web.go` | 尝试 `gh copilot models` / `gh api /models`，失败则返回硬编码列表 |
| `gh copilot -p <prompt> [--model <m>]` | `agent/copilot/session.go` | 解析前端 JSON，提取 `user_prompt` + `model`，用 PTY 执行命令 |

---

## 二、待实现（按优先级排序）

### P0 — 核心功能缺失，当前逻辑跑不通

#### 1. `system_instruction` 未被使用

**现状：** 前端每条消息都携带 `system_instruction`（默认值：`"始终使用中文并以 Markdown 格式回复"`），`session.go` 里 `incomingMsg` 已定义该字段，但 `runCommand` 完全忽略它，没有拼入最终 prompt。

**需实现：** 在构建 `gh copilot` 的 prompt 时，将 system instruction 前置：

```go
// session.go - runCommand
if msg.SystemInstruction != "" {
    prompt = msg.SystemInstruction + "\n\n" + msg.UserPrompt
} else {
    prompt = msg.UserPrompt
}
```

---

#### 2. Stop 按钮无法真正终止生成

**现状：** 前端 `generating=true` 时显示 Stop 按钮（`<StopIcon>`），但点击后没有任何效果——按钮没有绑定发送取消信号的逻辑，后端也没有终止 PTY 进程的机制。

**需实现（两部分）：**

- **前端**：点击 Stop 时通过 WebSocket 发送特殊消息 `{"__cmd": "stop"}`
- **后端**：
  - `Session` 增加 `cancel context.CancelFunc` 字段
  - `runCommand` 改用带 cancel 的 `exec.CommandContext`
  - WebSocket 读取到 `__cmd: stop` 时调用对应 session 的 cancel

---

#### 3. `gh copilot -p` 命令的 `--model` 标志有效性待确认

**现状：** `session.go` 拼接了 `--model <model>` 参数，但 `gh copilot` 的 `-p` 子命令是否支持该标志尚未验证。若 `gh copilot suggest/explain` 支持而 `-p` 不支持，需要调整命令结构。

**需实现：** 确认实际可用的命令格式，可能需要改为：

```bash
gh copilot suggest --model gpt-4o -p "..."
# 或
gh copilot explain --model gpt-4o -p "..."
```

---

#### 4. `GET /api/models` 返回的模型列表不准确

**现状：**
- `gh copilot models` 子命令不确定是否存在
- `gh api /models` 返回的是 GitHub Marketplace 全量模型，不一定都被 Copilot CLI 支持
- 硬编码兜底列表可能已过时

**需实现：** 明确 Copilot CLI 获取可用模型的正确命令，例如：

```bash
gh api /copilot/models          # Copilot 专用端点（待验证）
gh copilot config list-models   # 如果存在
```

并根据实际输出格式调整解析逻辑。

---

### P1 — 重要功能，影响实用性

#### 5. 翻译页面未携带 model 字段

**现状：** `TranslatePage.jsx` 发送的 WebSocket 消息为：
```json
{ "user_prompt": "请将...翻译为..." }
```
没有 `model` 字段，导致翻译请求总是使用默认模型（空字符串，不传 `--model`）。

**需实现：** 在 `TranslatePage` 接收 `selectedModel` prop，并在发送时携带：
```json
{ "user_prompt": "...", "model": "gpt-4o" }
```

---

#### 6. Session ID 依赖 RemoteAddr，断线重连后上下文丢失

**现状：** `web.go` 用 `r.RemoteAddr`（IP:Port）作为 session key。客户端断线重连后端口变化，引擎会创建新 Session，Copilot CLI 进程重新启动，对话上下文全部丢失。

**需实现：** 改为客户端生成的稳定 UUID：
- 前端 `wsConnect()` 在 URL 上附加 `?session_id=<uuid>`（首次随机生成并存 `localStorage`）
- 后端从 query string 读取并作为 session key

---

#### 7. 聊天历史仅存内存，刷新即丢

**现状：** `history` 数组是 React state，页面刷新即清空。侧边栏"搜索聊天"按钮也没有实际功能。

**需实现（两个层次，任选其一）：**

- **轻量方案**：前端将 history 存 `localStorage`，无需后端改动
- **完整方案**：
  - `GET /api/history` — 返回会话列表
  - `POST /api/history` — 保存/更新一条会话（传标题 + 消息列表）
  - `DELETE /api/history/:id` — 删除一条会话
  - 后端用 SQLite 或 JSON 文件持久化

---

#### 8. Settings 保存无持久化

**现状：** Settings 弹窗的"保存"按钮只是关闭对话框，`sysInst` 存于 React state，刷新后恢复默认值 `"始终使用中文并以 Markdown 格式回复"`。

**需实现（任选其一）：**
- **前端**：`setSysInst` 后同步写 `localStorage.setItem('sysInst', value)`，启动时读取
- **后端**：`GET/POST /api/settings` 存储用户配置

---

### P2 — 体验提升

#### 9. 响应为全量输出，无流式推送

**现状：** `session.go` 等待 `gh copilot` 进程结束后，一次性把完整输出写入 channel，前端只能看到加载动画直到全部完成。

**需实现（可选，难度较高）：**
- 每读到一批 PTY 输出就立即通过 WebSocket 推送（chunked streaming）
- 前端将 assistant 消息改为追加模式（`setMessages` 更新最后一条而非 append）
- 需区分"增量 chunk"和"消息结束"两种事件类型

---

#### 10. 附件按钮（`+`）无功能

**现状：** 聊天输入框左侧的 `+` 按钮只有 Tooltip 提示"附件"，没有 `onClick` 处理，后端也没有文件上传接口。

**需实现（如果需要文件上下文）：**
- `POST /api/upload` 接收文件，返回文件内容摘要或路径
- 前端将文件内容拼入 `user_prompt`

---

#### 11. 侧边栏"搜索聊天"无功能

**现状：** `ListItemButton` 没有绑定任何事件，点击无反应。

**需实现：**
- 前端：对 `history` 数组做客户端过滤（无需后端，如果历史数据在前端）
- 或后端：`GET /api/history?q=<keyword>` 全文搜索

---

## 三、架构层面的问题

| 问题 | 当前状态 | 建议 |
|------|----------|------|
| `core/interfaces.go` 的 `Message` 只有 `SessionKey` 和 `Content`，model / system_instruction 不在接口层 | 由 session.go 自行解析 JSON | 可在 `Message` 加 `Model` 字段，由 engine 传递，保持 agent 无关 |
| `engine.go` 按 sessionKey 缓存 Session，但 Session 一旦创建 model 就固定 | 切换模型需要新建对话 | 可接受；或在 Send 时动态传 model 参数 |
| PTY 在 Windows 上依赖 `creack/pty`，兼容性有限 | 当前因网络问题未能下载依赖 | 优先解决 GOPROXY 配置（`go env -w GOPROXY=https://goproxy.cn,direct`） |

---

## 四、启动前置条件

```bash
# 1. 配置 Go 国内代理（一次性）
go env -w GOPROXY=https://goproxy.cn,direct

# 2. 下载依赖
cd d:/Resposity/tc-connect && go mod download

# 3. 构建前端
cd ui && npm run build

# 4. 启动后端
WEB_PORT=8080 go run ./cmd/tc-connect/main.go
```

---

*文档生成时间：2026-03-19*
