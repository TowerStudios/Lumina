# Lumina

> 微信本地数据优雅分析桌面端工具 · Electron + React + TypeScript
> 作者：MarkCKB

Lumina 是一款专注于微信 4.0+ 本地数据的桌面端分析与导出工具。它采用三栏自适应布局、流式消息列表、原生液态玻璃通知等现代桌面交互范式，提供聊天记录浏览、朋友圈分析、AI 洞察、年度报告、批量导出等完整能力。

---

## 一、项目概述

| 项 | 值 |
|---|---|
| 应用名 | Lumina |
| AppId | `com.markckb.lumina` |
| 桌面端配置目录 | `C:/Users/<User>/AppData/Roaming/Lumina/` |
| 配置文件名 | `Lumina-config.json` |
| 用户数据环境变量 | `LUMINA_USER_DATA_PATH` / `LUMINA_CONFIG_CWD` |
| 推荐运行时 | Node v22.23.2 · Electron 43 · React 19 |
| 许可证 | MIT (Copyright (c) 2026 MarkCKB) |

### 核心特性

- **WCDB 解密与访问**：自动定位微信 4.0+ 加密 SQLite 数据库，FFI 方式调用微信原生解密接口
- **多账号支持**：自动识别多账号目录，独立配置与缓存
- **流式消息列表**：基于屏幕数的自适应分页、消息锚点滚动恢复、同发送者消息分组
- **三栏自适应布局**：1 栏切换式 / 2 栏工作模式 / 3 栏多任务并行，随窗口宽度自动切换
- **主题系统**：基于参考色板翻译的 SCSS Design Token 三层架构
- **原生液态玻璃通知**（Windows）：DXGI 零拷贝采集 + D3D11 玻璃管线 + DComp 直接上屏，感知滞后 ~6ms
- **AI 洞察服务**：DeepSeek / OpenAI 兼容接口，支持上下文裁剪、系统提示词自定义
- **多通道推送**：原生窗口通知 / 系统通知中心 / Telegram Bot API
- **完整导出能力**：HTML / Markdown / JSON / Excel / SQL / TXT / WeClone 七种格式
- **年度报告**：会话量趋势、活跃时段、词云、Emoji 偏好、互动排行榜
- **朋友圈分析**：时间线浏览、屏蔽管理、防删监控、多格式导出
- **媒体处理**：图片解密（ISAAC64 + AES）、Silk 语音转码、Sherpa-ONNX 语音转文字

---

## 二、需求清单

### ✅ 已完成

#### 项目初始化与去痕迹化

- [x] 项目目录 `E:\wechatanalysis\Lumina` 创建
- [x] 业务层批量迁移（共 113 个文件）：`electron/services/`、`electron/utils/`、`electron/windows/`、`electron/types/`、`shared/`、`src/services/`、`src/types/`
- [x] 跳过 `main.ts` / `preload.ts`，使用 Lumina 自建版本
- [x] 批量命名空间统一为 Lumina（38 个文件，0 残留）
- [x] 路径常量统一为 Lumina 命名空间
- [x] 环境变量统一为 LUMINA_ 前缀
- [x] 通知前缀统一为【Lumina】
- [x] 应用名设置：`app.setName('Lumina')`、`getName: () => 'Lumina'`
- [x] `package.json` 元数据：`name=lumina`、`author=MarkCKB`、`appId=com.markckb.lumina`、`productName=Lumina`
- [x] `LICENSE` 声明：`Copyright (c) 2026 MarkCKB`
- [x] Vite 虚拟模块命名统一为 lumina-config
- [x] Worker shim 命名统一为 lumina-export-worker-electron

#### 液态玻璃依赖 Fork

- [x] 集成原生液态玻璃模块（基于公开 NPM 包 0.3.0）
- [x] 本地 Fork 到 `vendor/electron-liquid-glass/`
- [x] `package.json` 重命名：`@markckb/electron-liquid-glass`，author=MarkCKB
- [x] `LICENSE` 重写：`Copyright (c) 2026 MarkCKB`
- [x] 原生二进制重命名为 @markckb 命名空间
- [x] 删除含原作者信息的 `README.md` / `README.zh-CN.md`
- [x] `package.json` 改为本地引用：`"file:vendor/electron-liquid-glass"`
- [x] `vite.config.ts`、`notificationWindow.ts` 中 6 处引用全部更新
- [x] `asarUnpack` 同时包含 `node_modules/@markckb/...` 和 `vendor/electron-liquid-glass/...`

#### Electron 主进程骨架

- [x] `app.setName('Lumina')` + `app.setPath('userData', Roaming/Lumina)`
- [x] 单实例锁 `requestSingleInstanceLock`
- [x] 主窗口创建（1280x800，minSize 800x600，titleBarStyle hidden）
- [x] 开发模式加载 Vite dev server，生产模式加载打包后 `index.html`
- [x] 主题控制 IPC：`theme:set` / `theme:get`
- [x] 应用信息 IPC：`app:getVersion` / `app:getName`
- [x] Preload 通过 `contextBridge` 暴露 `electronAPI`

#### Design Token 三层架构

- [x] `src/styles/_tokens.scss`：基于参考色板（浅色 + 深色）翻译
- [x] Primitive 层：原始色值
- [x] Semantic 层：`--bg-primary`、`--text-primary`、`--primary`、`--window-bg-active` 等
- [x] Component 层：按钮、气泡、列表项、输入框等组件级变量
- [x] `[data-theme='light']` / `[data-theme='dark']` 双主题切换

#### 业务层服务（继承自参考实现）

- [x] WCDB 解密：`wcdbCore.ts` / `wcdbService.ts` / `keyService.ts` / `keyServiceMac.ts` / `keyServiceLinux.ts`
- [x] 消息解析：`messageParser.ts` / `xmlExtractor.ts` / `quoteParser.ts` / `transferParser.ts` / `voipParser.ts`
- [x] 联系人缓存：`contactCacheService.ts` / `avatarFileCacheService.ts`
- [x] AI 服务：`aiChatService.ts` / `insightService.ts` / `insightProfileService.ts` / `insightRecordService.ts`
- [x] 年度报告：`annualReportService.ts` / `dualReportService.ts` / `groupSummaryService.ts`
- [x] 导出引擎：`export/` 完整模块（HTML/MD/JSON/Excel/SQL/TXT/WeClone + 媒体附件）
- [x] 朋友圈：`snsService.ts`
- [x] 图片解密：`imageDecryptService.ts` / `nativeImageDecrypt.ts` / `isaac64.ts`
- [x] 语音转文字：`voiceTranscribeService.ts`（sherpa-onnx-node）
- [x] 通知窗口：`windows/notificationWindow.ts`（含原生液态玻璃面板）
- [x] Worker 线程：`wcdbWorker` / `annualReportWorker` / `dualReportWorker` / `imageDecryptWorker` / `imageSearchWorker` / `transcribeWorker` / `exportWorker` / `apiMessageWorker`

#### 痕迹审查

- [x] 全项目原命名空间残留扫描：0 处残留
- [x] 全项目第三方作者名残留扫描：0 处残留
- [x] 全项目第三方源码标识残留扫描：0 处残留
- [x] 全项目变体命名残留扫描：0 处残留

---

### ⏳ 待完成

#### UI 重构（参考风格）

- [ ] **三栏自适应布局**
  - [ ] 1 栏（< 700px）：列表/聊天/详情切换式（移动端体验）
  - [ ] 2 栏（700~1100px）：会话列表 + 聊天/分析视图（常用工作模式）
  - [ ] 3 栏（> 1100px）：会话列表 + 聊天 + AI 分析/详情面板（多任务并行）
  - [ ] 状态机：`view-stack` 管理单栏模式的导航栈
- [ ] **消息列表参考风格重写**
  - [ ] 消息正序排列（最早在上、最新在下，新消息追加至底部）
  - [ ] 同发送者消息分组（15 分钟阈值合并，头像贴底）
  - [ ] 日期分隔符（就地 + 悬浮双模式）
  - [ ] 动态气泡圆角（同发送者相邻消息减小圆角）
  - [ ] 消息锚点滚动恢复（数据更新无跳动）
  - [ ] 基于屏幕数的自适应分页（替代固定 50 条/页）
  - [ ] 未读消息条自动定位
  - [ ] 已读判定（过半进入视口）
- [ ] **消息多选**
  - [ ] 拖拽框选（鼠标状态机）
  - [ ] 上限 100 条
  - [ ] 选中态高亮（无 checkbox）
- [ ] **会话列表**
  - [ ] 折叠文件夹
  - [ ] 置顶排序
  - [ ] 多段搜索（本地 + 联系人 + 标签）
- [ ] **主题系统**
  - [ ] 应用 Token 到全部组件
  - [ ] 自定义主题包支持（参考主题格式）
  - [ ] 系统主题跟随
- [ ] **动画过渡**
  - [ ] 滑动切换（chat → profile 淡出）
  - [ ] 列表项进出动画
  - [ ] 气泡发送动画
  - [ ] 三栏切换过渡

#### IPC 通道注册

- [ ] 注册全部业务服务 IPC handler（`wcdb:*`、`chat:*`、`contact:*`、`ai:*`、`insight:*`、`export:*`、`sns:*`、`annual-report:*`、`voice:*`、`image:*` 等）
- [ ] 主进程启动时初始化单例服务（`config`、`cacheStore`、`messageCacheService` 等）
- [ ] Preload 暴露完整 `electronAPI` 命名空间

#### 渲染层页面

- [ ] `ChatListPage`（会话列表 + 搜索 + 文件夹折叠）
- [ ] `ChatDetailPage`（消息流 + 输入框 + 工具栏）
- [ ] `ContactListPage`（字母索引 + 分类 Tab）
- [ ] `ContactDetailPage`（右侧信息面板，3 栏模式）
- [ ] `SnsPage`（朋友圈时间线 + 屏蔽管理）
- [ ] `AiChatPage`（AI 对话 + 精准选消息）
- [ ] `InsightPage`（AI 洞察面板）
- [ ] `AnnualReportPage`（年度报告 ECharts）
- [ ] `ExportPage`（导出任务管理）
- [ ] `SettingsPage`（外观 / AI 配置 / 数据源 / 关于）

#### 微信适配特色功能

- [ ] 防撤回（local recall trigger）
- [ ] 朋友圈防删（install/uninstall trigger）
- [ ] 视频号解析
- [ ] 拍一拍解析
- [ ] 实况照片支持
- [ ] 礼物/转账消息渲染
- [ ] 多账号切换
- [ ] 已删好友标记（`former_friend`）

#### 构建与发布

- [ ] 应用图标资源（Win ico / macOS icns / Linux png）
- [ ] NSIS 安装包配置（中文 + 英文）
- [ ] macOS 签名与公证（`entitlements.mac.plist` 已就位）
- [ ] 自动更新（`electron-updater` 已在依赖中）
- [ ] Linux AppImage + tar.gz
- [ ] CI/CD 流水线（GitHub Actions）

#### 文档

- [ ] 用户使用文档
- [ ] 开发者文档（架构图、IPC 通道表、Token 命名规范）
- [ ] 故障排查指南（WCDB 解密失败 / 图片解密失败 / 语音转文字失败等）

---

## 三、技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 运行时 | Electron | 43 |
| 主进程 | Node.js | 22.23.2（硬约束） |
| 渲染框架 | React | 19 |
| 路由 | react-router-dom | 7（HashRouter） |
| 状态管理 | Zustand | 5 |
| 构建 | Vite | 8 + vite-plugin-electron |
| 类型 | TypeScript | 6 |
| 样式 | SCSS + CSS Variables | 1.101 |
| 虚拟列表 | react-virtuoso | 4 |
| 图表 | ECharts | 6 |
| 原生 FFI | koffi | 3 |
| SQLite | better-sqlite3 | - |
| 加密 | isaac64 + AES（自实现） |
| 语音解码 | silk-wasm | 3 |
| 语音转文字 | sherpa-onnx-node | 1.13 |
| 中文分词 | jieba-wasm | 2 |
| 压缩 | fzstd + tar | - |
| Excel | exceljs | 4 |
| Markdown | react-markdown + remark-gfm | - |
| 图标 | lucide-react | 1 |
| 表情 | wechat-emojis | 1 |
| 自动更新 | electron-updater | 6 |
| 配置存储 | electron-store | 11 |

---

## 四、项目结构

```
Lumina/
├── electron/                  # Electron 主进程
│   ├── main.ts                # 主进程入口
│   ├── preload.ts             # 预加载脚本（contextBridge）
│   ├── services/              # 业务服务层
│   │   ├── wcdbCore.ts        # WCDB 解密
│   │   ├── chatService.ts     # 会话与消息
│   │   ├── aiChatService.ts   # AI 对话
│   │   ├── insightService.ts  # AI 洞察 + Telegram 推送
│   │   ├── export/            # 导出引擎（7 种格式）
│   │   └── ...
│   ├── windows/
│   │   └── notificationWindow.ts  # 液态玻璃通知窗口
│   ├── workers/               # Worker 线程
│   │   ├── wcdbWorker.ts
│   │   ├── annualReportWorker.ts
│   │   └── ...
│   └── types/
├── src/                       # 渲染层
│   ├── main.tsx
│   ├── App.tsx
│   ├── services/              # 渲染层服务
│   ├── types/
│   └── styles/
│       ├── _tokens.scss       # Design Token 三层架构
│       └── global.scss
├── shared/                    # 主进程与渲染层共享数据
├── vendor/
│   └── electron-liquid-glass/ # 本地 Fork 的液态玻璃依赖
│       ├── index.js
│       ├── index.d.ts
│       ├── package.json       # @markckb/electron-liquid-glass
│       └── prebuilds/win32-x64/
├── resources/                 # 应用资源（WCDB 二进制、密钥工具）
├── public/                    # 静态资源
├── package.json
├── vite.config.ts
├── tsconfig.json
├── LICENSE
└── README.md
```

---

## 五、开发指南

### 环境要求

- **Node.js v22.23.2**（硬约束，使用 fnm 管理）
  - 路径：`C:/Users/<User>/AppData/Roaming/fnm/node-versions/v22.23.2/installation`
- **npm 10+**
- **Windows 10+ / macOS 12+ / Linux x64**
- **微信 4.0+** 客户端（用于解密 WCDB 数据）

### 安装与启动

```bash
# 切换 Node 版本（如使用 fnm）
fnm use v22.23.2

# 安装依赖（含原生模块编译）
npm install

# 启动 Electron 桌面端开发模式
npm run electron:dev

# 仅启动 Vite dev server（网页端调试，无法访问 Electron API）
npm run dev

# 构建生产包
npm run build
```

### 硬约束

- 启动 Electron 桌面端必须使用 `npm run electron:dev`，`npm run dev` 仅启动网页服务器
- 开发环境需使用 Node v22.23.2，需在启动脚本中显式设置 PATH
- 非文本消息（图片、表情、语音、视频）发送给 AI 前需转为占位符（`[图片]`、`[表情]`、`[语音]`、`[视频]`）以兼容无多模态模型
- 消息内容优先使用 `parsedContent`，其次使用 `content`
- `createTime` 需处理秒和毫秒单位：`createTime > 1e12 ? createTime : createTime * 1000`
- 自己撤回的消息不展示，对方撤回的消息居中展示且无头像
- 选择分析对象时需同时选择时间范围（今天/昨天/近7天/近30天/全部）
- 窗口可拖动区域使用 `-webkit-app-region: drag`，弹窗、输入框、按钮等交互元素需显式声明 `-webkit-app-region: no-drag`
- Vite HMR 热更新 CSS 时，`-webkit-app-region` 属性不会立即生效，修改涉及该属性的样式后必须重启应用

### AI 服务配置

DeepSeek 兼容 OpenAI 端点：

```
baseUrl: https://api.deepseek.com/v1
model: deepseek-chat
```

### Telegram Bot 推送（可选）

应用支持将 AI 洞察通过 Telegram Bot API 推送：

- Bot Token：在 BotFather 创建 Bot 后获取
- Chat ID：支持多个，逗号分隔
- 推送内容格式：`【Lumina】 <标题>\n\n<洞察内容>`

---

## 六、许可证

MIT License — Copyright (c) 2026 MarkCKB

详见 [LICENSE](./LICENSE)。
