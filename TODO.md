# Lumina 未完成需求清单

> 作者：MarkCKB
> 更新日期：2026-08-02
> 项目目录：D:/Lumina
> 参考源码：./reference/WeFlow-5.1.0（WeFlow 业务逻辑）、./reference/Lumina（最新源码快照）

---

## 0. 当前已知问题（优先修复）

### 0.1 聊天 UI 无法正常显示
- **现象**：启动后聊天模块空白或报错
- **可能原因**：
  1. `electronAPI.chat.getSessions` 返回空数组（数据库未连接 / IPC 未真正注册到主进程）
  2. `ipcHandlers.ts` 中的 `chatService` / `wcdbService` 依赖未正确初始化
  3. `config.get('myWxid')` 返回 null（账号数据未迁移生效）
- **排查步骤**：
  1. 打开 DevTools (Ctrl+Shift+I) 查看 console 报错
  2. 在主进程 `ipcHandlers.ts` 的 `chat:getSessions` 中加 `console.log` 确认是否被调用
  3. 检查 `wcdb:open` 是否被前端调用过（若未调用，说明 onboarding 流程未走通）
- **临时方案**：若数据库未连接，ChatList 应显示「请在设置中连接微信数据库」空状态

### 0.2 Onboarding 流程缺失
- **缺失**：没有"添加账号"向导，用户无法走通「选数据库路径 → 输入密钥 → 连接」流程
- **需要**：新建 `OnboardingPage.tsx`，调用 `electronAPI.dbpath.autoDetect` + `wcdb.open`
- **参考**：WeFlow 的 Onboarding 实现（见 `reference/WeFlow-5.1.0`）

---

## 1. IPC 层 - 未注册的业务模块

以下 IPC 在 WeFlow 中已实现，Lumina 未注册（`electron/ipcHandlers.ts`）：

### 1.1 账号与认证 (auth)
- `auth:hello` - 验证主密码
- `auth:verifyEnabled` - 是否启用锁
- `auth:unlock` - 解锁
- `auth:enableLock` / `auth:disableLock` - 启用/关闭锁
- `auth:changePassword` - 修改密码
- `auth:setHelloSecret` / `auth:clearHelloSecret`
- `auth:isLockMode`

### 1.2 AI 服务 (ai)
- `aiChat:send` - 发送消息给 AI（流式响应）
- `aiChat:stop` - 中止生成
- `insight:generate` - 生成洞察
- `insight:list` / `insight:get` / `insight:delete` - 洞察记录管理
- `insight:profile:generate` / `insight:profile:status` - 人物画像
- `analytics:get` - 数据分析
- `groupSummary:generate` / `groupSummary:list` - 群聊总结
- **参考**：WeFlow `aiChatService.ts` / `insightService.ts`

### 1.3 备份与导出 (backup / export)
- `backup:create` / `backup:restore` / `backup:cancel`
- `exportContact:export` - 导出联系人
- `exportRecord:list` / `exportRecord:delete`
- `exportTask:start` / `exportTask:cancel` / `exportTask:status`

### 1.4 朋友圈 (sns)
- `sns:getFeed` / `sns:getDetail`
- `sns:getComments` / `sns:getLikes`
- `sns:blockUser` / `sns:unblockUser` / `sns:getBlockedUsers`

### 1.5 通知与日志 (notification / log / diagnostics)
- `notification:show` / `notification:close` / `notification:click`
- `log:read` / `log:clear` / `log:debug`
- `diagnostics:getExportCardLogs`

### 1.6 应用功能 (app)
- `app:getLaunchAtStartupStatus` / `app:setLaunchAtStartup` - 开机自启
- `app:checkForUpdates` / `app:downloadAndInstall` / `app:ignoreUpdate` - 自动更新
- `app:onDownloadProgress` / `app:onUpdateAvailable`

### 1.7 媒体处理
- `voice:transcribe` - 语音转文字
- `video:decode` - 视频解码
- `image:decrypt` - 图片解密（dat → jpg/png）
- `emoji:get` - 表情包获取

### 1.8 社交 (social)
- `social:validateWeiboUid`
- `social:saveWeiboCookie`

---

## 2. 渲染层 - 未对接的页面

### 2.1 侧栏导航对应的页面（目前多为 PlaceholderPage）
- [ ] **ContactsPage** - 通讯录（参考 WeFlow）
- [ ] **SnsPage** - 朋友圈（参考 WeFlow，含屏蔽用户功能）
- [ ] **AiChatPage** - AI 对话（参考 WeFlow aiChatService）
- [ ] **AnalyticsPage** - 数据分析（图表用 echarts-for-react）
- [ ] **ExportPage** - 导出中心

### 2.2 SettingsPage 业务字段对接
- [ ] 数据库路径选择（调用 `dbpath.autoDetect` + `dbpath.scanWxids`）
- [ ] 密钥输入与连接测试（调用 `wcdb.testConnection` + `wcdb.open`）
- [ ] 账号切换
- [ ] AI 配置（DeepSeek API Key、baseUrl、model）
- [ ] 应用锁设置
- [ ] 开机自启
- [ ] 检查更新

### 2.3 ChatModule 高级功能
- [ ] **消息搜索** - 调用 `chat.searchMessages`
- [ ] **无限滚动** - 使用 Virtuoso 加载更早消息（`loadMoreMessages` 已封装）
- [ ] **消息右键菜单** - 复制、转发、引用、删除
- [ ] **精准选消息** - 拖拽框选（参考 user_profile 偏好）
- [ ] **图片/视频/语音预览** - 调用解密 IPC
- [ ] **撤回消息显示** - 已实现基础，需测试真实数据
- [ ] **引用消息** - `quotedContent` 字段渲染
- [ ] **@提及** - 群聊消息中的高亮
- [ ] **文件/链接/名片/位置/转账等特殊消息** - 按 `type` 渲染卡片

### 2.4 ChatDetailPanel
- [ ] 联系人资料展示（头像、昵称、微信号、地区、备注）
- [ ] 共同群聊
- [ ] 消息统计

---

## 3. UI/UX 细节优化

### 3.1 TG 风格聊天视图
- [ ] 验证气泡圆角组合在真实数据下的效果
- [ ] 时间嵌入气泡右下角的 float 布局在不同消息长度下的稳定性
- [ ] 长文本换行处理（避免时间被挤到下一行）
- [ ] 图片/视频消息应铺满气泡（去掉内边距）
- [ ] 选中消息高亮样式
- [ ] 多选消息时的 UI（参考 user_profile：高亮代替复选框）

### 3.2 窗口与布局
- [ ] 透明窗口圆角在 Windows 11 下的表现
- [ ] 最大化时圆角移除（已实现，需验证）
- [ ] 1/2/3 栏自适应切换动画（参考 TG）
- [ ] 会话列表拖宽过渡动画

### 3.3 右键菜单
- [ ] 会话右键菜单功能对接（置顶/已读/静音/归档/清空/删除/查看资料）
- [ ] 目前仅前端状态变更，未持久化到后端

### 3.4 主题
- [ ] TG 风格浅色/深色主题验证
- [ ] 跟随系统主题切换
- [ ] 液态玻璃效果（@markckb/electron-liquid-glass）集成

---

## 4. 数据层与工程

- [ ] **配置文件迁移验证** - `Lumina-config.json` 中 `safe:` 加密字段能否被 `ConfigService` 正确解密
- [ ] **ChatSession.isPinned 持久化** - 目前仅前端 useState，需后端支持
- [ ] **ChatSession.isMuted/isArchived 持久化**
- [ ] **消息状态同步** - 历史消息默认 read，新消息需有 sending/sent/read 流程
- [ ] **mockChatData.ts 清理** - 确认无引用后删除
- [ ] **ChatListContextMenu** - 确认状态变更正确反映到 UI

---

## 5. 打包与发布

- [ ] Windows NSIS 安装包测试
- [ ] 应用图标（public/icon.ico）
- [ ] 代码签名
- [ ] 自动更新流程验证

---

## 6. 开发环境注意事项

- **Node**: v22.23.2（C:/Users/MarkCKB/AppData/Roaming/fnm/node-versions/v22.23.2/installation），需显式设 PATH
- **Electron 镜像**: `npm install` 设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
- **启动**: `npm run electron:dev`（桌面端），`npm run dev`（仅网页）
- **-webkit-app-region 改动需重启 Electron**（HMR 不生效）
- **D:/Lumina 在工作目录外**，直接 Write/Edit 可能被沙箱拒绝，需用 .NET `[IO.File]::WriteAllText` 绕过
- **GitHub**: https://github.com/TowerStudios/Lumina.git

---

## 7. 下次开发优先级建议

1. **修复 UI 显示问题**（见 0.1）- 先看 DevTools console 报错
2. **实现 Onboarding**（见 0.2）- 让用户能连接数据库
3. **注册核心 IPC**（见 1.1-1.4）- 让渲染层能调用真实业务
4. **对接 SettingsPage**（见 2.2）- 完成数据库连接 UI
5. **验证聊天 UI** - 真实数据下的 TG 风格排版
