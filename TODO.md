# Lumina 开发计划

> 设计参照：Telegram Desktop + WeFlow 5.1.0
> 更新日期：2026-08-04

---

## ✅ 已完成

### 基础设施
- WCDB 解密连接、密钥自动获取（koffi FFI）、数据库目录自动检测
- 完整日志系统、Onboarding 流程、CSP 配置、头像 HTTP→HTTPS 升级
- 渲染层 + Electron 层类型检查通过

### 聊天核心
- 会话列表（300+ 会话）、消息加载（最新优先 + 分页 + 上拉加载更多）
- TG 风格气泡圆角、快速到底按钮、引用消息、@提及高亮
- 全局消息搜索（高亮 + 点击定位到具体消息滚动高亮闪烁）
- 会话右键菜单（置顶/已读/静音/归档/清空/删除）+ 持久化
- 转发聊天记录层级展示（chatRecordList 卡片）

### 媒体消息
- 图片解密预览（image:decrypt 主路径 + getImageData fallback 双路径，懒加载 + lightbox）
- 视频消息（封面 + shell.openPath 播放）、语音消息（波形 + 时长 + 转文字）
- 表情包（dataUrl 缓存 + 懒加载）、文本内表情码（75 个微信表情 PNG）
- 文件消息（getFileInfo 本地路径探测 + 打开按钮）

### 页面
- 聊天模块（ChatList + ChatView + ChatDetailPanel）
- 通讯录（ContactsPage：字母分组 + 类型筛选 + 详情 + 跳转）
- 设置（SettingsPage：密钥管理 + 路径编辑 + 测试连接 + 锁屏 + 开机自启 + 日志查看）
- 朋友圈（SnsPage：时间线 + proxyImage 缩略图 + 统计 + 删除）
- AI 对话（AiChatPage：会话列表 + 流式 + 中止）
- 数据分析（AnalyticsPage：echarts 图表 + 联系人排行）
- 导出中心（ExportPage：联系人 JSON/CSV/VCF 导出）

### WeFlow 对标（新搬入）
- ChatAnalyticsHubPage（聊天分析枢纽）
- BackupPage（数据库备份/恢复 + onProgress 进度）
- InsightInboxPage（灵感信箱：见解搜索 + 详情面板）
- Sidebar 重写（底部头像展开账号管理/设置 + 11 导航项）
- backup.onProgress IPC、NavSection 扩展、AppLayout 路由注册

### IPC 注册
- aiChat:*（11 个）、insight:*（14 个）、analytics:*（8 个）
- groupSummary:*（4 个）、backup:*（3 个 + onProgress）
- sns:*（6 个）、export:*（2 个）、chat:getFileInfo
- media/image/video/voice/emoji、notification/log/app/auth

---

## ⏳ 进行中 / 高优先级

### Onboarding 增强（对齐 WeFlow）
- [ ] 图片密钥自动获取步骤（key:imageKeyStatus IPC 已就绪，UI 待对接）
- [ ] 密钥钩子状态消息实时显示

### 图片/头像
- [x] 头像高清化：avatarUrl /132/ → /0/（chatAdapter 统一处理）2026-08-04
- [x] 群聊头像简化：单张 avatarUrl 2026-08-04
- [x] 底部头像增强：头像+用户名+微信号 2026-08-04
- [ ] 图片解密双路径验证

### UI
- [x] TG 配色系统（_tokens.scss 三层架构，浅色/深色）2026-08-04
- [x] 主题默认深色（TG Desktop 风格）2026-08-04
- [x] SettingsPage 增加应用锁占位 + 去作者标记 2026-08-04

---

## 📋 待完成（P4~P6）

### 页面补全（目前为 PlaceholderPage）
| 页面 | 阻塞项 |
|------|--------|
| ResourcesPage（资源浏览）| 需 media stream IPC + virtuoso grid |
| AnnualReportPage（年度报告）| 需注册 annualReport:* IPC |
| MyFootprintPage（我的足迹）| 需注册 chat:getMyFootprintStats IPC |
| GroupAnalyticsPage（群聊分析）| 需注册群组统计 IPC |
| AccountManagementPage（账号管理）| IPC 已有，UI 待写 |

### 聊天功能增强
- [ ] 撤回消息真实数据测试
- [ ] 跳转到日期（JumpToDateDialog）
- [ ] 语音转写独立对话框
- [ ] ChatDetailPanel 共同群聊列表

### 系统能力
- [ ] 多账号管理（扫描/切换/删除）
- [ ] 数据与缓存管理（清理、备份）
- [ ] 锁屏（密码 + Windows Hello，auth IPC 已就绪）
- [ ] 应用更新（electron-updater 对接）
- [ ] 消息导出批量任务（exportWorker.js）

### 数据层
- [ ] 消息日期索引（JumpToDate 前置）
- [ ] 词云/热力图（analytics 扩展）
- [ ] 头像高清化（/132/ → /0/）

### UI/UX
- [ ] TG 风格细节（气泡圆角验证、时间浮动、长文本换行）
- [ ] 图片/视频消息铺满气泡、选中/多选消息 UI
- [ ] 窗口布局（透明圆角、3 栏自适应动画、拖宽过渡）
- [ ] 主题（浅色/深色验证、跟随系统、液态玻璃）

### 打包发布
- [ ] NSIS 安装包、应用图标、代码签名、自动更新

---

## 🔧 工程约束

- Node.js v22.23.2 | koffi 2.16.3 | VC++ 运行时
- 日志路径：`C:\Users\Administrator\AppData\Roaming\Lumina\logs\main-YYYY-MM-DD.log`
- CSP img-src：必须含 `https:` `http:` `data:` `blob:` `file:`
- wcdbWorker.ts 独立 Vite entry → dist-electron/wcdbWorker.js
- 数据库自动检测所有盘符（C/D/E/F/G）Documents 子目录
- Hook 提示文案："退出微信并重新登录"
