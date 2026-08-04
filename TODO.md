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
- 图片解密预览（image:decrypt 主路径 + getImageData fallback 双路径）
- 视频消息（封面 + shell.openPath 播放）、语音消息（波形 + 时长 + 转文字）
- 表情包（dataUrl 缓存 + 懒加载）、文本内表情码（75 个微信表情 PNG）
- 文件消息（getFileInfo 本地路径探测 + 打开按钮）
- 头像高清化（/132/ → /0/ 全局替换）

### 页面（全部已实现）
- 聊天模块（ChatList + ChatView + ChatDetailPanel）
- 通讯录（ContactsPage：字母分组 + 类型筛选 + 详情 + 跳转）
- 设置（SettingsPage：密钥管理 + 路径编辑 + 测试连接 + 日志查看）
- 朋友圈（SnsPage：时间线 + proxyImage + key 参数解密 + 统计 + 删除）
- AI 对话（AiChatPage：会话列表 + 流式 + 中止）
- 数据分析（AnalyticsPage：echarts 图表 + 联系人排行）
- 导出中心（ExportPage：联系人 JSON/CSV/VCF 导出）
- 聊天分析枢纽（ChatAnalyticsHubPage：个人分析 + 群聊分析入口）
- 群聊分析（GroupAnalyticsPage：群列表 + 成员排行 + 24h 活跃图）
- 年度报告（AnnualReportPage：年份选择 + 报告生成 + KPI）
- 我的足迹（MyFootprintPage：日期预设 + KPI + CSV/JSON 导出）
- 资源浏览（ResourcesPage：图片/视频网格 + 分页加载）
- 灵感信箱（InsightInboxPage：见解搜索 + 详情面板）
- 备份（BackupPage：创建/检查/恢复 + 进度条）
- 账号管理（AccountManagementPage：扫描 wxid + 切换/删除）

### WeFlow 对标
- Sidebar 可折叠（展开 68px / 收起 50px）+ 底部头像（用户名+微信号+菜单）
- TitleBar WeFlow 风格（折叠按钮 + drag-spacer + 窗口三按钮）
- 群聊消息每成员独立头像（getContactAvatar(sender, sessionId)）
- TG 深色主题默认（_tokens.scss 三层架构）
- 去原作者标记

### IPC 注册（全部就绪）
- aiChat:*（11）、insight:*（14）、analytics:*（8）、groupSummary:*（4）
- backup:*（3+onProgress）、sns:*（6）、export:*（2）、chat:getFileInfo/getMyFootprintStats/exportMyFootprint/getMediaStream
- groupAnalytics:*（5）、annualReport:*（4）
- media/image/video/voice/emoji、notification/log/app/auth

---

## ⏳ 待完成

### 功能增强
- [ ] Onboarding 图片密钥自动获取步骤（key:imageKeyStatus IPC 已就绪）
- [ ] 撤回消息真实数据测试
- [ ] 跳转到日期（JumpToDateDialog）
- [ ] 语音转写独立对话框
- [ ] ChatDetailPanel 共同群聊列表（需新 IPC）
- [ ] 锁屏 UI（密码 + Windows Hello，auth IPC 已就绪）
- [ ] 消息导出批量任务（exportWorker.js）

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
- zustand selector 必须返回稳定引用，不可在 selector 内创建新对象/Map
