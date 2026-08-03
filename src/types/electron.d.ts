// === Lumina 渲染进程可用的 Electron API 类型 ===
// 此文件为渲染进程提供 window.electronAPI 的类型声明
// 必须与 electron/preload.ts 暴露的 electronAPI 保持一致
// preload.ts 在 electron/ 目录，不在渲染进程 tsconfig.web.json 的 include 范围内
// 因此需要此文件作为渲染进程的类型来源

export interface DbKeyResult {
  success: boolean
  key?: string
  error?: string
  logs?: string[]
}

export interface ImageKeyResult {
  success: boolean
  xorKey?: number
  aesKey?: string
  verified?: boolean
  error?: string
}

export interface WcdbResult {
  success: boolean
  error?: string
}

export interface SessionsResult {
  success: boolean
  sessions?: unknown[]
  error?: string
}

export interface MessagesResult {
  success: boolean
  messages?: unknown[]
  hasMore?: boolean
  nextOffset?: number
  error?: string
}

export interface AvatarResult {
  success: boolean
  avatarUrl?: string
  error?: string
}

export interface AutoDetectResult {
  success: boolean
  path?: string
  error?: string
}

export interface ScanWxidsResult {
  success: boolean
  wxids?: Array<{
    wxid: string
    displayName?: string
    avatarUrl?: string
    accountDir: string
    lastModified?: number
  }>
  error?: string
}

export interface ScanWxidCandidatesResult {
  success: boolean
  candidates?: Array<{ wxid: string; accountDir: string }>
  error?: string
}

export interface SearchMessagesResult {
  success: boolean
  messages?: unknown[]
  total?: number
  error?: string
}

export interface ElectronAPI {
  // 应用信息
  app: {
    getVersion: () => Promise<string>
    getName: () => Promise<string>
    getUserDataPath: () => Promise<string>
    getDownloadsPath: () => Promise<string>
    getLogPath: () => Promise<string>
  }

  // 主题控制
  theme: {
    set: (theme: 'light' | 'dark' | 'system') => Promise<boolean>
    get: () => Promise<'light' | 'dark'>
  }

  // 窗口控制
  window: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
  }

  // 配置管理
  config: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    clear: () => Promise<boolean>
  }

  // 微信数据库路径检测
  dbpath: {
    autoDetect: () => Promise<AutoDetectResult>
    getDefault: () => Promise<string>
    scanWxids: (rootPath: string) => Promise<ScanWxidsResult>
    scanWxidCandidates: (rootPath: string) => Promise<ScanWxidCandidatesResult>
  }

  // 数据库连接
  wcdb: {
    testConnection: (dbPath: string, hexKey: string, wxid: string) => Promise<WcdbResult>
    open: (dbPath: string, hexKey: string, wxid: string) => Promise<WcdbResult>
    close: () => Promise<{ success: boolean }>
  }

  // 密钥获取（自动从微信进程内存提取）
  key: {
    // 自动获取数据库解密密钥（hook 微信进程内存）
    autoGetDbKey: () => Promise<DbKeyResult>
    // 自动获取图片解密密钥（从微信目录提取 XOR/AES）
    autoGetImageKey: (manualDir?: string, wxid?: string) => Promise<ImageKeyResult>
    // 内存扫描获取图片密钥（备用方案）
    scanImageKeyFromMemory: (userDir: string) => Promise<ImageKeyResult>
    // 数据库密钥提取进度订阅（实时推送），返回取消订阅函数
    onDbKeyStatus: (callback: (payload: { message: string; level: number }) => void) => () => void
    // 图片密钥提取进度订阅
    onImageKeyStatus: (callback: (payload: { message: string }) => void) => () => void
  }

  // 聊天业务
  chat: {
    connect: () => Promise<{ success: boolean }>
    close: () => Promise<{ success: boolean }>
    getSessions: () => Promise<SessionsResult>
    getMessages: (
      sessionId: string,
      offset?: number,
      limit?: number,
      startTime?: number,
      endTime?: number,
      ascending?: boolean
    ) => Promise<MessagesResult>
    getLatestMessages: (sessionId: string, limit?: number) => Promise<MessagesResult>
    getSessionDetail: (sessionId: string) => Promise<unknown | null>
    getContact: (username: string) => Promise<unknown | null>
    getContacts: (options?: { lite?: boolean }) => Promise<unknown[]>
    getContactAvatar: (username: string, chatroomId?: string) => Promise<AvatarResult | string | null>
    getMyAvatarUrl: () => Promise<AvatarResult | null>
    markAllSessionsRead: () => Promise<unknown>
    searchMessages: (
      keyword: string,
      sessionId?: string,
      limit?: number,
      offset?: number,
      beginTimestamp?: number,
      endTimestamp?: number
    ) => Promise<SearchMessagesResult>
  }

  // 系统对话框
  dialog: {
    openFile: (options?: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
    openDirectory: (options?: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
    saveFile: (options?: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
  }

  // Shell
  shell: {
    openPath: (path: string) => Promise<string>
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
  }

  // 系统平台
  platform: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
