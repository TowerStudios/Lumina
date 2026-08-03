// 必须最先 import：将 resources 目录加入 PATH，确保 native DLL 依赖优先从本地加载
import './preload-env'
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { registerBusinessIpcHandlers } from './ipcHandlers'
import { initLogger, attachCrashHandlers, logInfo, logError } from './utils/logger'
import { wcdbService } from './services/wcdbService'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

// === 应用名与数据目录设置 ===
// 显式设置应用名为 Lumina，确保 userData 路径与产品名一致
app.setName('Lumina')

// 修正 userData 路径：默认 Electron 会基于 name 生成，但生产构建下可能错乱
const expectedUserDataPath = join(app.getPath('appData'), 'Lumina')
if (!existsSync(expectedUserDataPath)) {
  try {
    mkdirSync(expectedUserDataPath, { recursive: true })
  } catch {
    // 忽略创建失败（可能权限不足）
  }
}
app.setPath('userData', expectedUserDataPath)

// === 初始化日志（必须在 app ready 之前，捕获后续所有 console/异常） ===
initLogger()
logInfo('main', `Lumina 主进程启动，Node ${process.version}，Electron ${process.versions.electron}`)
logInfo('main', `userData 路径: ${app.getPath('userData')}`)
logInfo('main', `进程 argv0=${process.argv0}, execPath=${process.execPath}, WEFLOW_SNAPSHOT_V1=${process.env.WEFLOW_SNAPSHOT_V1 || ''}`)

// 在 app ready 后注册崩溃处理器
app.whenReady().then(() => {
  attachCrashHandlers()
  logInfo('main', 'app ready，崩溃处理器已注册')
})

// === 单实例锁 ===
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// === 主窗口引用 ===
let mainWindow: BrowserWindow | null = null

// === 创建主窗口 ===
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Lumina',
    // 透明窗口 + 全透明背景：让外层 CSS 容器自行绘制圆角与阴影
    transparent: true,
    backgroundColor: '#00000000',
    // 关闭系统阴影，由 CSS box-shadow 接管（避免圆角外出现方角阴影）
    hasShadow: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#f5f5f5',
      height: 32
    },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false
    }
  })

  // 启动后显示窗口（避免白屏闪烁）
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 捕获渲染进程控制台消息（用于诊断渲染层错误）
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = ['LOG', 'WARN', 'ERROR'][level] || 'LOG'
    logInfo('renderer', `[${levelStr}] ${message} (${sourceId}:${line})`)
  })

  // 捕获渲染进程崩溃
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logError('main', `渲染进程崩溃: reason=${details?.reason} exitCode=${details?.exitCode}`)
  })

  // 最大化状态变化时通知渲染进程
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizeChanged', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizeChanged', false)
  })

  // 加载渲染器
  // vite-plugin-electron@1.x 在 dev 模式下注入 VITE_DEV_SERVER_URL
  const devServerUrl = process.env['VITE_DEV_SERVER_URL'] || process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    // 开发模式：加载 Vite dev server
    mainWindow.loadURL(devServerUrl)
  } else {
    // 生产模式：加载打包后的 index.html
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// === 应用就绪 ===
app.whenReady().then(() => {
  // 设置主题（默认跟随系统）
  nativeTheme.themeSource = 'system'

  // === 初始化 WCDB 资源路径 ===
  // 必须在业务 IPC 之前完成，否则 chatService 调用时 WCDB 未初始化
  try {
    const candidateResources = app.isPackaged
      ? join(process.resourcesPath, 'resources')
      : join(app.getAppPath(), 'resources')
    const fallbackResources = join(process.cwd(), 'resources')
    const resourcesPath = existsSync(candidateResources) ? candidateResources : fallbackResources
    const userDataPath = app.getPath('userData')
    logInfo('main', `WCDB 资源路径: ${resourcesPath}, userData: ${userDataPath}`)
    wcdbService.setPaths(resourcesPath, userDataPath)
  } catch (e) {
    logError('main', 'WCDB setPaths 失败:', e instanceof Error ? e.message : String(e))
  }

  // 注册基础 IPC 通道
  registerBasicIpcHandlers()

  // 注册业务 IPC 通道（账号/数据库/聊天等）
  try {
    registerBusinessIpcHandlers()
  } catch (e) {
    console.error('业务 IPC 注册失败:', e)
  }

  // 创建主窗口
  createMainWindow()

  // macOS 激活时重建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// === 所有窗口关闭时退出（除 macOS） ===
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// === 第二实例启动时聚焦主窗口 ===
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// === 基础 IPC 处理器 ===
function registerBasicIpcHandlers() {
  // 获取应用版本
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // 获取应用名
  ipcMain.handle('app:getName', () => app.getName())

  // 获取 userData 路径
  ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'))

  // 主题切换
  ipcMain.handle('theme:set', (_event, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme
    return true
  })

  // 获取当前主题
  ipcMain.handle('theme:get', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  // === 窗口控制 ===
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false
  })
}
