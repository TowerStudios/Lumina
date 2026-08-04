# Lumina 项目长期记忆

## 项目概览
- **项目**：Lumina - 微信聊天记录查看器（Electron + React + TypeScript + Vite）
- **设计参照**：Telegram Desktop (G:\tdesktop-dev) + WeFlow 业务逻辑
- **数据层**：WCDB 解密 + koffi FFI 提取微信密钥
- **UI 风格**：Telegram 风格（气泡圆角组合、时间嵌入气泡右下角、TG 配色变量）

## 关键工程约束（来自 TODO.md 第 7 节）
- Node.js v22.23.2（koffi FFI 兼容，v24 ABI 不兼容）
- koffi 2.16.3（3.x 在 Windows 有 segfault 回归）
- CSP img-src 必须含 'https:' 和 'http:'（wx.qlogo.cn 可能用 http）
- 头像 http→https 自动升级（parseGlobalConfig）
- wcdbWorker.ts 必须配置为独立 Vite entry
- 日志路径：C:\Users\Administrator\AppData\Roaming\Lumina\logs\main-YYYY-MM-DD.log

## 架构要点
- **类型源**：`src/types/electron.d.ts` 是渲染进程 window.electronAPI 的类型源（preload.ts 不在 web tsconfig include 范围内）。两者必须保持同步。
- **消息适配层**：`src/services/chatAdapter.ts` 把后端 `{success, data}` 包裹解包为 `RenderSession`/`RenderMessage`。`RenderMessage` 按类型选择性携带媒体元数据（videoMd5/emojiCdnUrl/fileName 等）供 ChatView 组件调 IPC。
- **消息分组**：`src/services/messageGrouping.ts` 实现 TG 风格分组（同发送者 15 分钟内 attached，跨日断组），位置 single/first/middle/last 决定圆角组合。
- **媒体 IPC 命名空间**：`media.decryptImage/decodeVideo/decodeVideoBatch/parseVideoMd5/transcribeVoice/onTranscribePartial/resolveVoiceCache/getEmoji`，均在 preload 的 `media` 命名空间下。

## 类型检查
- 渲染层：`npx tsc --noEmit -p tsconfig.web.json`
- electron 层：`npx tsc --noEmit -p tsconfig.node.json`（注意：多个 service 文件有历史遗留类型错误，非阻塞）
- 全量 `npm run typecheck` 会报 TS6305（stale .d.ts 构建产物），用上述分项目检查更准确

## 已完成阶段
- P0/P1：稳定性、IPC 注册、SettingsPage UI ✅
- P2：ChatView 媒体 UI（视频/语音/表情/文件卡片/链接/位置/名片）✅ 2026-08-03
- P3 部分：引用消息渲染 ✅ 2026-08-03

## 待办优先级
1. 文件消息下载/打开（需新增 file IPC）
2. @提及高亮、转发消息层级、搜索结果 scrollToMessage
3. P4 页面：SnsPage / AiChatPage / AnalyticsPage(echarts) / ExportPage
4. P5：ChatDetailPanel 联系人资料、多账号管理、缓存管理
5. P6：UI/UX 优化与打包发布
