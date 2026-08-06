# Lumina 开发计划

> 设计参照：Telegram Desktop + WeFlow 5.1.0
> 更新日期：2026-08-06（对话页面对标阶段计划 S1–S6 已排入）

---

## ✅ 已完成

### 基础设施
- WCDB 解密连接、密钥自动获取（koffi FFI）、数据库目录自动检测
- 完整日志系统、Onboarding 流程、CSP 配置、头像 HTTP→HTTPS 升级
- 渲染层 + Electron 层类型检查通过

### 聊天核心
- 会话列表（300+ 会话）、消息加载（最新优先 + 分页 + 上拉加载更多）
- TG 风格气泡圆角、消息分组（15 分钟规则）、浮动头像吸附、快速到底按钮
- @提及高亮、引用消息块渲染（点击跳转见 S2）
- 全局消息搜索（高亮 + 点击定位；跨页定位缺陷见「已知风险」）
- 会话右键菜单（置顶/已读/静音/归档/清空/删除）+ 持久化
- 转发聊天记录单层列表卡片（多重折叠独立窗口见 S4）

### 媒体消息
- 图片解密预览（image:decrypt 主路径 + getImageData fallback 双路径）
- 视频消息（封面 + 系统播放器打开；独立窗口播放见 S4）
- 语音消息（伪波形 + 时长 + 流式转文字；真实 silk 播放见 S4）
- 表情包（dataUrl 缓存 + 懒加载；本地回退链见 S4）、文本内表情码（75 个微信表情 PNG）
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
- Sidebar 可折叠 + 底部头像菜单、TitleBar WeFlow 风格
- 群聊消息每成员独立头像、TG 深色主题（_tokens.scss 三层架构）

### IPC 注册（全部就绪）
- aiChat:*（11）、insight:*（14）、analytics:*（8）、groupSummary:*（4）
- backup:*（3+onProgress）、sns:*（6）、export:*（2）
- groupAnalytics:*（5）、annualReport:*（4）
- media/image/video/voice/emoji、notification/log/app/auth
- chatService.getMessagesAround 后端已实现（IPC/preload 未接线 → S2-T5）

---

## ⚠️ 待验证 / 已知风险

> 以下项目代码路径存在，但未充分联调或疑似有 BUG，需在对应阶段验证：

1. **全局搜索定位静默失败**（已知缺陷）：pendingTargetMessage 只在「当前已加载的 50 条」里 querySelector，目标消息不在窗口内时静默丢弃。→ S2 用 getMessagesAround 锚点加载修复
2. **撤回消息渲染**：己方隐藏/对方居中提示代码已写，但真实数据库 type=10002 字段未联调 → S6 验证
3. **上拉加载游标稳定性**：chatService 内有大段「游标跳过异常兜底」逻辑（说明历史上有 BUG），极端分页场景可能仍不稳定 → 回归验证
4. **群聊合成头像**：getGroupAvatar 日志显示部分成员头像获取失败走警告路径 → 验证失败率
5. **图片解密 hardlinkOnly**：硬链接不存在时是否可靠 fallback 到 getImageData → 验证
6. **详情面板 AI 分析按钮未接线**（半成品）→ S6 决定接线或隐藏
7. **顶栏「最后在线」为占位文本**（私聊无真实在线状态数据）→ S1 移除占位
8. **顶栏「更多」按钮无菜单**（半成品）→ S1 补齐

---

## ⏳ 对话页面对标阶段计划（S1–S6）

> 来源：2026-08-06 对照 tdesktop-dev + WeFlow 5.1.0 的差距分析（A/B/C 三组）。
> 用户已拍板：C1 复用详情面板｜C2 独立媒体窗口｜C3 独立转发窗口（可并排对照）｜C4 做｜C5 排 P4｜C6 不做（保持只读）｜C7 做

### S1 · 对话页交互基础（纯渲染层，无新 IPC）
- [ ] T1（A1）消息右键菜单：复制文本 / 复制链接 / 复制图片 / 多选入口 / 定位入口
- [ ] T2（A8）链接卡片点击 shell.openExternal 打开；位置卡片点击打开地图链接
- [ ] T3（A9）顶栏「更多」菜单（回到最新/标记已读/打开详情）+ 移除「最后在线」占位
- [ ] T4（A7）图片/视频按宽高比铺满气泡、贴合圆角、时间戳浮层

### S2 · 定位与导航（接线已有后端能力）
- [ ] T5 接线 chat:getMessagesAround（ipcHandlers + preload + electron.d.ts；后端已存在）
- [ ] T6（A3）引用消息点击跳转原消息（锚点加载 + 滚动高亮）
- [ ] T7 修复全局搜索定位：目标不在已加载窗口时走 getMessagesAround 加载上下文
- [ ] T8（A5）跳转日期弹层（日历选择 → 定位当日首条消息）
- [ ] T9（A4）消息内搜索条（会话内 searchMessages + 上一条/下一条跳转）
- [ ] T10（A6）未读分隔线（进入会话标记未读起点）

### S3 · 选择与批量操作
- [ ] T11（A2）消息多选模式：选择态勾选框 + 底部操作栏（批量复制文本/导出预备）

### S4 · 媒体体验升级（B 组 + C2/C3/C4）
- [ ] T12（B1）语音真实播放：Media 库 silk → silk-wasm 解码 → WAV 缓存 IPC + 气泡内播放进度条
- [ ] T13（C2-b，含 B2）独立媒体查看器窗口：图片缩放/前后切换、视频应用内播放（Electron BrowserWindow）
- [ ] T14（C3-a，含 B4）转发消息独立查看窗口：多重折叠层级递归展开，与主窗口并排
- [ ] T15（C4）语音转写独立对话框（完整结果 + 复制）
- [ ] T16（B3）表情本地回退链（CDN 失败 → 本地表情库/缓存）

### S5 · 联系人联动（C1-a）
- [ ] T17 ChatDetailPanel 联系人模式：名片/头像/@提及点击 → 面板显示联系人资料

### S6 · 收尾与回归
- [ ] T18（A10）撤回消息真实数据联调
- [ ] T19（C7）设置项扩展：对话展示偏好（气泡布局等）写入 config 并生效
- [ ] T20 TG 风格细节回归（圆角/时间浮动/长文本换行）
- [ ] T21 详情面板 AI 分析按钮接线或隐藏
- [ ] T22 「待验证/已知风险」清单逐项回归

---

## ⏳ 其他模块待完成

### 功能增强
- [ ] Onboarding 图片密钥自动获取步骤（key:imageKeyStatus IPC 已就绪）
- [ ] ChatDetailPanel 共同群聊列表（需新 IPC）
- [ ] 锁屏 UI（密码 + Windows Hello，auth IPC 已就绪）
- [ ] 消息导出批量任务（exportWorker.js）
- [ ] SNS 朋友圈入口进联系人详情（原 C5，随 P4 页面阶段一起做）

### UI/UX
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
- 类型源：src/types/electron.d.ts 与 electron/preload.ts 必须同步修改
