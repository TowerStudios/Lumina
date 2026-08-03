# Lumina 开发计划

> 项目地址：https://github.com/TowerStudios/Lumina.git
> 设计参照：Telegram Desktop (G:\tdesktop-dev) + WeFlow 业务逻辑
> 更新日期：2026-08-03

---

## 0. 已完成 ✅

- [x] WCDB 数据库解密与连接（DLL 补丁绕过网络授权，wcdb_init 返回 0）
- [x] 微信密钥自动获取（koffi FFI + Hook 机制，提示文案明确"退出并重新登录"）
- [x] 数据库目录自动检测（扫描 C/D/E/F/G 盘所有 Documents 子目录）
- [x] 会话列表加载（300+ 会话，7578 个联系人）
- [x] Telegram 风格 UI 设计与配色
- [x] ErrorBoundary 错误边界保护（防止单组件错误导致整体崩溃）
- [x] ChatList 无限循环修复（useRef 防重复加载 + contextMenu 独立状态变量）
- [x] ChatView 空会话无限重载修复（loadedSessionsRef 跟踪）
- [x] 上拉加载更多历史消息（滚动位置保持 + 加载指示器）
- [x] 完整日志系统（主进程 + WCDB，同步写入文件）
- [x] 头像显示修复（HTTP→HTTPS 升级 + CSP 允许 http/https）
- [x] Onboarding 流程（数据库路径选择 + 密钥输入 + 连接测试）
- [x] 图片消息解密预览（chat:getImageData IPC + IntersectionObserver 懒加载 + 点击放大 lightbox）
- [x] 全局消息搜索（chat:searchMessages + 关键词高亮 + 内容片段截取）
- [x] 会话右键菜单功能对接（置顶/已读/静音/归档/清空/删除/查看资料，持久化到 config.sessionStates）
- [x] ContactsPage 通讯录页面（字母分组 + 类型筛选 + 搜索 + 详情面板 + 跳转聊天）
- [x] 核心 IPC 模块注册（媒体/日志/通知/应用功能/认证，共 22 个新 IPC handler）
- [x] 修复 wcdb:testConnection / wcdb:open 参数错配（通过 config.getAccountDir 解析 accountDir）
- [x] 代码已上传 GitHub

---

## 1. 高优先级 - 代码质量与稳定性

### 1.1 同步 electron.d.ts 类型声明
- [x] 添加 `key` 命名空间（autoGetDbKey / autoGetImageKey / onDbKeyStatus / onImageKeyStatus）
- [x] 修正 `dbpath.autoDetect` 返回类型为 `{ success, path?, error? }`
- [x] 修正 `chat.getSessions / getMessages` 返回包裹结构类型
- [x] 添加 `app.getLogPath` 声明
- [x] 添加 `ContactInfo / ContactsResult / ImageDataResult` 接口
- [x] 添加 `log / media / notification / appFeatures / auth` 命名空间声明
- [ ] 删除与 preload.ts 重复的全局声明，统一以 `preload.ts` 的 `typeof electronAPI` 为唯一类型来源

### 1.2 SettingsPage 业务字段对接
- [x] 显示当前解密密钥（脱敏展示，支持修改）
- [x] 添加"测试连接"按钮（调用 `wcdb.testConnection`）
- [x] 支持数据库路径手动编辑（不只能通过 Onboarding 重走流程）
- [ ] 实现应用锁设置（密码锁 + Windows Hello）- IPC 已注册，UI 待对接
- [ ] 实现多账号管理（扫描/切换/删除账号）
- [ ] 实现数据与缓存管理（缓存清理、数据备份）

---

## 2. 中优先级 - 聊天功能增强

### 2.1 消息搜索
- [x] 调用 `chat.searchMessages` 实现全局/会话内搜索（全局搜索已实现，会话内搜索待做）
- [x] 搜索结果高亮关键词（首个匹配高亮 + 内容片段截取）
- [ ] 点击搜索结果跳转到对应消息位置（当前仅跳转到会话，未定位具体消息，需 ChatView 支持 scrollToMessage）

### 2.2 会话右键菜单功能对接
- [x] 置顶/取消置顶（持久化到 config.sessionStates，不回写微信）
- [x] 标记已读/未读（markedUnread 状态持久化）
- [x] 静音/取消静音（持久化）
- [x] 归档/取消归档（持久化）
- [x] 清空聊天记录（清空内存消息，不删除数据库原始记录）
- [x] 删除会话（清空内存消息 + 取消选中）
- [x] 查看资料（打开详情面板）

### 2.3 媒体消息预览
- [x] 图片消息解密与预览（注册 chat:getImageData IPC，IntersectionObserver 懒加载，点击放大 lightbox）
- [x] 视频消息解码 IPC（注册 video:decode / video:decodeBatch / video:parseMd5，对接 videoService）
- [x] 语音消息转文字 IPC（注册 voice:transcribe + voice:resolveCache，流式 partial 推送）
- [x] 表情包获取 IPC（注册 emoji:get，对接 chatService.downloadEmoji）
- [x] 图片解密通用 IPC（注册 image:decrypt，对接 imageDecryptService，用于导出/批量预览）
- [ ] 视频消息 UI 渲染（IPC 已就绪，ChatView 视频组件待实现）
- [ ] 语音消息 UI 渲染（IPC 已就绪，ChatView 语音组件 + 转写按钮待实现）
- [ ] 文件消息下载与打开
- [ ] 表情包 UI 渲染（IPC 已就绪，ChatView 表情组件待实现）

### 2.4 特殊消息类型渲染
- [ ] 引用消息（quotedContent 字段渲染）
- [ ] @提及高亮（群聊消息）
- [ ] 文件/链接/名片/位置/转账等卡片式渲染
- [ ] 撤回消息显示（已实现基础，需测试真实数据）
- [ ] 转发消息层级展示

---

## 3. 中优先级 - 核心模块注册

### 3.1 IPC 模块注册（electron/ipcHandlers.ts）
- [ ] AI 服务（aiChat:send/stop, insight:generate/list/get/delete, analytics:get, groupSummary:generate/list）
- [ ] 备份与导出（backup:create/restore/cancel, exportContact:export, exportTask:start/cancel/status）
- [ ] 朋友圈（sns:getFeed/getDetail/getComments/getLikes, sns:blockUser/unblockUser/getBlockedUsers）
- [x] 通知与日志（notification:show/close, log:getPath/read/clear/debug）
- [x] 应用功能（app:getLaunchAtStartupStatus/setLaunchAtStartup, app:checkForUpdates/downloadAndInstall 占位）
- [x] 媒体处理（image:decrypt, video:decode/decodeBatch/parseMd5, voice:transcribe/resolveCache, emoji:get）
- [x] 认证（auth:hello/verifyEnabled/unlock/enableLock/disableLock/changePassword/isLockMode）

### 3.2 页面实现
- [x] ContactsPage - 通讯录（字母分组 + 类型筛选 + 详情面板 + 跳转聊天）
- [ ] SnsPage - 朋友圈（含屏蔽用户功能）
- [ ] AiChatPage - AI 对话
- [ ] AnalyticsPage - 数据分析（echarts-for-react）
- [ ] ExportPage - 导出中心
- [ ] SettingsPage 应用锁 UI（IPC 已就绪，需对接 auth.* 设置面板）
- [ ] SettingsPage 开机自启 UI（IPC 已就绪，需对接 appFeatures.setLaunchAtStartup 开关）
- [ ] SettingsPage 日志查看 UI（IPC 已就绪，需对接 log.read 显示日志内容）

---

## 4. 低优先级 - UI/UX 优化

### 4.1 ChatDetailPanel
- [ ] 联系人资料展示（头像、昵称、微信号、地区、备注）
- [ ] 共同群聊列表
- [ ] 消息统计（总数、时段分布、类型分布）

### 4.2 TG 风格细节
- [ ] 验证气泡圆角组合在真实数据下的效果
- [ ] 时间嵌入气泡右下角的 float 布局稳定性
- [ ] 长文本换行处理（避免时间被挤到下一行）
- [ ] 图片/视频消息铺满气泡（去掉内边距）
- [ ] 选中消息高亮样式
- [ ] 多选消息 UI（高亮代替复选框）

### 4.3 窗口与布局
- [ ] 透明窗口圆角在 Windows 11 下的表现
- [ ] 最大化时圆角移除验证
- [ ] 1/2/3 栏自适应切换动画
- [ ] 会话列表拖宽过渡动画

### 4.4 主题
- [ ] TG 风格浅色/深色主题验证
- [ ] 跟随系统主题切换
- [ ] 液态玻璃效果（@markckb/electron-liquid-glass）集成

---

## 5. 数据层与工程

- [ ] 配置文件迁移验证（Lumina-config.json 中 safe: 加密字段解密）
- [x] ChatSession.isPinned/isMuted/isArchived/markedUnread 持久化到 config.sessionStates
- [ ] 消息状态同步（sending/sent/read 流程）
- [ ] mockChatData.ts 清理（确认无引用后删除）

---

## 6. 打包与发布

- [ ] Windows NSIS 安装包测试
- [ ] 应用图标（public/icon.ico）
- [ ] 代码签名
- [ ] 自动更新流程验证（app:checkForUpdates 占位 → 接入 electron-updater）

---

## 7. 工程约束（必须遵守）

- **Node.js**: v22.23.2（koffi FFI 兼容，v24 有 ABI 不兼容）
- **koffi**: 2.16.3（3.x 在 Windows 有 segfault 回归）
- **VC++ 运行时**: msvcp140.dll, vcruntime140.dll 必须在 electron/dist、wx_key.dll 目录、resources/runtime/win32/
- **日志路径**: C:\Users\Administrator\AppData\Roaming\Lumina\logs\main-YYYY-MM-DD.log
- **CSP img-src**: 必须包含 'https:' 和 'http:'（wx.qlogo.cn 可能用 http）
- **HTTP 头像**: 必须在 parseGlobalConfig 中自动升级为 HTTPS
- **wcdbWorker.ts**: 必须配置为独立 Vite entry，生成 dist-electron/wcdbWorker.js
- **Hook 提示文案**: 必须明确"退出微信并重新登录"（不是"登录微信"）
- **数据库自动检测**: 必须扫描所有盘符根目录（C/D/E/F/G）及其 Documents 子目录
- **IPC 处理器**: 关键服务必须包含进度状态更新（如 key:dbKeyStatus）
- **错误消息**: 必须区分实际登录状态和 Hook 时机限制

---

## 8. 开发优先级建议

1. ~~同步 electron.d.ts~~（见 1.1）✅
2. ~~SettingsPage 业务字段~~（见 1.2）✅ 密钥/路径/测试连接已完成
3. ~~消息搜索~~（见 2.1）✅
4. ~~会话右键菜单持久化~~（见 2.2）✅
5. ~~媒体消息预览~~（见 2.3）✅ IPC 全部就绪，UI 待对接
6. ~~核心 IPC 注册~~（见 3.1）✅ 媒体/日志/通知/应用/认证已完成，AI/备份/朋友圈待做
7. ~~页面实现~~（见 3.2）- ContactsPage ✅，朋友圈/AI/分析/导出待做
8. **SettingsPage UI 对接**（应用锁/开机自启/日志查看）- IPC 已就绪，UI 待实现
9. **ChatView 媒体 UI**（视频/语音/表情组件）- IPC 已就绪，UI 待实现
10. **AI/备份/朋友圈 IPC + 页面** - 待开发
