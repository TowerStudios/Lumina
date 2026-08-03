// === Lumina 渲染进程可用的 Electron API 类型 ===
// 与 preload.ts 暴露的 electronAPI 保持一致

export interface ElectronAPI {
  app: {
    getVersion: () => Promise<string>
    getName: () => Promise<string>
    getUserDataPath: () => Promise<string>
    getDownloadsPath: () => Promise<string>
  }
  theme: {
    set: (theme: 'light' | 'dark' | 'system') => Promise<boolean>
    get: () => Promise<'light' | 'dark'>
  }
  window: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
  }
  config: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    clear: () => Promise<boolean>
  }
  dbpath: {
    autoDetect: () => Promise<string | null>
    getDefault: () => Promise<string>
    scanWxids: (rootPath: string) => Promise<
      Array<{ wxid: string; displayName?: string; avatarUrl?: string; accountDir: string }>
    >
    scanWxidCandidates: (rootPath: string) => Promise<Array<{ wxid: string; accountDir: string }>>
  }
  wcdb: {
    testConnection: (
      dbPath: string,
      hexKey: string,
      wxid: string
    ) => Promise<{ success: boolean; error?: string }>
    open: (
      dbPath: string,
      hexKey: string,
      wxid: string
    ) => Promise<{ success: boolean; error?: string }>
    close: () => Promise<{ success: boolean }>
  }
  chat: {
    connect: () => Promise<{ success: boolean }>
    close: () => Promise<{ success: boolean }>
    getSessions: () => Promise<unknown[]>
    getMessages: (
      sessionId: string,
      offset?: number,
      limit?: number,
      startTime?: number,
      endTime?: number,
      ascending?: boolean
    ) => Promise<unknown[]>
    getLatestMessages: (sessionId: string, limit?: number) => Promise<unknown[]>
    getSessionDetail: (sessionId: string) => Promise<unknown | null>
    getContact: (username: string) => Promise<unknown | null>
    getContacts: (options?: { lite?: boolean }) => Promise<unknown[]>
    getContactAvatar: (username: string, chatroomId?: string) => Promise<string | null>
    getMyAvatarUrl: () => Promise<string | null>
    markAllSessionsRead: () => Promise<unknown>
    searchMessages: (
      keyword: string,
      sessionId?: string,
      limit?: number,
      offset?: number,
      beginTimestamp?: number,
      endTimestamp?: number
    ) => Promise<unknown[]>
  }
  dialog: {
    openFile: (
      options?: Electron.OpenDialogOptions
    ) => Promise<Electron.OpenDialogReturnValue>
    openDirectory: (
      options?: Electron.OpenDialogOptions
    ) => Promise<Electron.OpenDialogReturnValue>
    saveFile: (options?: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
  }
  shell: {
    openPath: (path: string) => Promise<string>
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
  }
  platform: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
