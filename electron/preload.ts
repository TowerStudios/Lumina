import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// === preload 暴露给渲染进程的 API ===
// 通过 contextBridge 隔离，渲染进程只能访问显式暴露的方法

const electronAPI = {
  // 应用信息
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getName: () => ipcRenderer.invoke('app:getName'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
    getDownloadsPath: () => ipcRenderer.invoke('app:getDownloadsPath'),
    getLogPath: () => ipcRenderer.invoke('app:getLogPath') as Promise<string>
  },

  // 主题控制
  theme: {
    set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
    get: () => ipcRenderer.invoke('theme:get') as Promise<'light' | 'dark'>
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const listener = (_event: IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
      ipcRenderer.on('window:maximizeChanged', listener)
      return () => ipcRenderer.removeListener('window:maximizeChanged', listener)
    }
  },

  // 配置管理
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
    clear: () => ipcRenderer.invoke('config:clear') as Promise<boolean>
  },

  // 微信数据库路径检测
  dbpath: {
    autoDetect: () => ipcRenderer.invoke('dbpath:autoDetect'),
    getDefault: () => ipcRenderer.invoke('dbpath:getDefault'),
    scanWxids: (rootPath: string) => ipcRenderer.invoke('dbpath:scanWxids', rootPath),
    scanWxidCandidates: (rootPath: string) => ipcRenderer.invoke('dbpath:scanWxidCandidates', rootPath)
  },

  // 数据库连接
  wcdb: {
    testConnection: (dbPath: string, hexKey: string, wxid: string) =>
      ipcRenderer.invoke('wcdb:testConnection', dbPath, hexKey, wxid) as Promise<{ success: boolean; error?: string }>,
    open: (dbPath: string, hexKey: string, wxid: string) =>
      ipcRenderer.invoke('wcdb:open', dbPath, hexKey, wxid) as Promise<{ success: boolean; error?: string }>,
    close: () => ipcRenderer.invoke('wcdb:close') as Promise<{ success: boolean }>
  },

  // 密钥获取（自动从微信进程内存提取）
  key: {
    // 自动获取数据库解密密钥（hook 微信进程内存）
    autoGetDbKey: () =>
      ipcRenderer.invoke('key:autoGetDbKey') as Promise<{
        success: boolean
        key?: string
        error?: string
        logs?: string[]
      }>,
    // 自动获取图片解密密钥（从微信目录提取 XOR/AES）
    autoGetImageKey: (manualDir?: string, wxid?: string) =>
      ipcRenderer.invoke('key:autoGetImageKey', manualDir, wxid) as Promise<{
        success: boolean
        xorKey?: number
        aesKey?: string
        verified?: boolean
        error?: string
      }>,
    // 内存扫描获取图片密钥（备用方案）
    scanImageKeyFromMemory: (userDir: string) =>
      ipcRenderer.invoke('key:scanImageKeyFromMemory', userDir) as Promise<{
        success: boolean
        xorKey?: number
        aesKey?: string
        verified?: boolean
        error?: string
      }>,
    // 数据库密钥提取进度订阅（实时推送）
    // 返回取消订阅函数
    onDbKeyStatus: (callback: (payload: { message: string; level: number }) => void) => {
      const listener = (_event: IpcRendererEvent, payload: { message: string; level: number }) =>
        callback(payload)
      ipcRenderer.on('key:dbKeyStatus', listener)
      return () => ipcRenderer.removeAllListeners('key:dbKeyStatus')
    },
    // 图片密钥提取进度订阅
    onImageKeyStatus: (callback: (payload: { message: string }) => void) => {
      const listener = (_event: IpcRendererEvent, payload: { message: string }) => callback(payload)
      ipcRenderer.on('key:imageKeyStatus', listener)
      return () => ipcRenderer.removeAllListeners('key:imageKeyStatus')
    }
  },

  // 聊天业务
  chat: {
    connect: () => ipcRenderer.invoke('chat:connect') as Promise<{ success: boolean }>,
    close: () => ipcRenderer.invoke('chat:close') as Promise<{ success: boolean }>,
    getSessions: () => ipcRenderer.invoke('chat:getSessions'),
    getMessages: (
      sessionId: string,
      offset?: number,
      limit?: number,
      startTime?: number,
      endTime?: number,
      ascending?: boolean
    ) => ipcRenderer.invoke('chat:getMessages', sessionId, offset, limit, startTime, endTime, ascending),
    getLatestMessages: (sessionId: string, limit?: number) =>
      ipcRenderer.invoke('chat:getLatestMessages', sessionId, limit),
    getSessionDetail: (sessionId: string) => ipcRenderer.invoke('chat:getSessionDetail', sessionId),
    getContact: (username: string) => ipcRenderer.invoke('chat:getContact', username),
    getContacts: (options?: { lite?: boolean }) => ipcRenderer.invoke('chat:getContacts', options),
    getContactAvatar: (username: string, chatroomId?: string) =>
      ipcRenderer.invoke('chat:getContactAvatar', username, chatroomId),
    getMyAvatarUrl: () => ipcRenderer.invoke('chat:getMyAvatarUrl'),
    markAllSessionsRead: () => ipcRenderer.invoke('chat:markAllSessionsRead'),
    searchMessages: (
      keyword: string,
      sessionId?: string,
      limit?: number,
      offset?: number,
      beginTimestamp?: number,
      endTimestamp?: number
    ) =>
      ipcRenderer.invoke(
        'chat:searchMessages',
        keyword,
        sessionId,
        limit,
        offset,
        beginTimestamp,
        endTimestamp
      ),
    getImageData: (sessionId: string, msgId: string) =>
      ipcRenderer.invoke('chat:getImageData', sessionId, msgId)
  },

  // 系统对话框
  dialog: {
    openFile: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:openFile', options) as Promise<Electron.OpenDialogReturnValue>,
    openDirectory: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:openDirectory', options) as Promise<Electron.OpenDialogReturnValue>,
    saveFile: (options?: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke('dialog:saveFile', options) as Promise<Electron.SaveDialogReturnValue>
  },

  // Shell
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path) as Promise<string>,
    openExternal: (url: string) =>
      ipcRenderer.invoke('shell:openExternal', url) as Promise<{ success: boolean; error?: string }>
  },

  // === 日志 ===
  log: {
    getPath: () => ipcRenderer.invoke('log:getPath') as Promise<string>,
    read: () =>
      ipcRenderer.invoke('log:read') as Promise<{ success: boolean; content?: string; error?: string }>,
    clear: () => ipcRenderer.invoke('log:clear') as Promise<{ success: boolean; error?: string }>,
    debug: (data: unknown) => ipcRenderer.send('log:debug', data)
  },

  // === 媒体处理 ===
  media: {
    // 解密单张图片
    decryptImage: (payload: {
      sessionId?: string
      imageMd5?: string
      imageDatName?: string
      createTime?: number
      force?: boolean
      preferFilePath?: boolean
      hardlinkOnly?: boolean
    }) =>
      ipcRenderer.invoke('image:decrypt', payload) as Promise<{
        success: boolean
        path?: string
        dataUrl?: string
        error?: string
      }>,
    // 视频解码（获取视频信息）
    decodeVideo: (videoMd5: string, options?: { includePoster?: boolean; posterFormat?: 'dataUrl' | 'fileUrl' }) =>
      ipcRenderer.invoke('video:decode', videoMd5, options) as Promise<{
        success: boolean
        exists?: boolean
        path?: string
        poster?: string
        error?: string
      }>,
    // 批量视频信息
    decodeVideoBatch: (videoMd5List?: string[], options?: { includePoster?: boolean; posterFormat?: 'dataUrl' | 'fileUrl' }) =>
      ipcRenderer.invoke('video:decodeBatch', videoMd5List, options) as Promise<{
        success: boolean
        rows?: Array<{ index: number; md5: string; success: boolean; path?: string; poster?: string }>
        error?: string
      }>,
    // 解析视频 md5
    parseVideoMd5: (content: string) =>
      ipcRenderer.invoke('video:parseMd5', content) as Promise<{ success: boolean; md5?: string; error?: string }>,
    // 语音转文字（流式，partial 通过 onTranscribePartial 推送）
    transcribeVoice: (
      sessionId: string,
      msgId: string,
      createTime?: number,
      serverId?: string | number
    ) =>
      ipcRenderer.invoke('voice:transcribe', sessionId, msgId, createTime, serverId) as Promise<{
        success: boolean
        transcript?: string
        error?: string
      }>,
    // 语音转写进度订阅
    onTranscribePartial: (
      callback: (payload: { sessionId: string; msgId: string; text: string }) => void
    ) => {
      const listener = (_event: IpcRendererEvent, payload: { sessionId: string; msgId: string; text: string }) =>
        callback(payload)
      ipcRenderer.on('voice:transcribePartial', listener)
      return () => ipcRenderer.removeAllListeners('voice:transcribePartial')
    },
    // 解析语音缓存
    resolveVoiceCache: (sessionId: string, msgId: string) =>
      ipcRenderer.invoke('voice:resolveCache', sessionId, msgId) as Promise<{
        success: boolean
        hasCache?: boolean
        data?: string
        error?: string
      }>,
    // 下载表情包
    getEmoji: (cdnUrl: string, md5?: string) =>
      ipcRenderer.invoke('emoji:get', cdnUrl, md5) as Promise<{
        success: boolean
        localPath?: string
        error?: string
      }>
  },

  // === 系统通知 ===
  notification: {
    show: (data: { title: string; content: string; avatarUrl?: string; sessionId?: string; targetRoute?: string }) =>
      ipcRenderer.invoke('notification:show', data) as Promise<{ success: boolean; id?: number; error?: string }>,
    close: () => ipcRenderer.invoke('notification:close') as Promise<{ success: boolean }>
  },

  // === 应用功能 ===
  appFeatures: {
    getLaunchAtStartupStatus: () =>
      ipcRenderer.invoke('app:getLaunchAtStartupStatus') as Promise<{ openAtLogin: boolean; error?: string }>,
    setLaunchAtStartup: (enabled: boolean) =>
      ipcRenderer.invoke('app:setLaunchAtStartup', enabled) as Promise<{ success: boolean; error?: string }>,
    checkForUpdates: () =>
      ipcRenderer.invoke('app:checkForUpdates') as Promise<{ hasUpdate: boolean; version?: string; releaseNotes?: string }>,
    downloadAndInstall: () =>
      ipcRenderer.invoke('app:downloadAndInstall') as Promise<{ success: boolean; error?: string }>
  },

  // === 认证（应用锁） ===
  auth: {
    hello: (message?: string) =>
      ipcRenderer.invoke('auth:hello', message) as Promise<{ success: boolean; error?: string }>,
    verifyEnabled: () => ipcRenderer.invoke('auth:verifyEnabled') as Promise<boolean>,
    unlock: (password: string) =>
      ipcRenderer.invoke('auth:unlock', password) as Promise<{ success: boolean; error?: string }>,
    enableLock: (password: string) =>
      ipcRenderer.invoke('auth:enableLock', password) as Promise<{ success: boolean; error?: string }>,
    disableLock: (password: string) =>
      ipcRenderer.invoke('auth:disableLock', password) as Promise<{ success: boolean; error?: string }>,
    changePassword: (oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:changePassword', oldPassword, newPassword) as Promise<{
        success: boolean
        error?: string
      }>,
    isLockMode: () => ipcRenderer.invoke('auth:isLockMode') as Promise<boolean>
  },

  // 系统平台
  platform: process.platform
} as const

// 类型导出（用于渲染进程类型推导）
export type ElectronAPI = typeof electronAPI

// 通过 contextBridge 暴露
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 让 TypeScript 在渲染进程识别 window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
