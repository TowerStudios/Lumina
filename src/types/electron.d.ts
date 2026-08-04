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

export interface ImageDataResult {
  success: boolean
  /** base64 编码的图片数据（不含 data: 前缀） */
  data?: string
  error?: string
}

export interface ContactInfo {
  username: string
  displayName?: string
  remark?: string
  nickname?: string
  alias?: string
  labels?: string[]
  description?: string
  detailDescription?: string
  region?: string
  avatarUrl?: string
  type: 'friend' | 'group' | 'official' | 'former_friend' | 'blocked' | 'other'
  officialAccountKind?: 'subscription' | 'service' | 'enterprise' | 'unknown'
  officialAccountType?: number
}

export interface ContactsResult {
  success: boolean
  contacts?: ContactInfo[]
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
    getContacts: (options?: { lite?: boolean }) => Promise<ContactsResult>
    getContactAvatar: (username: string, chatroomId?: string) => Promise<AvatarResult | string | null>
    getMyAvatarUrl: () => Promise<AvatarResult | null>
    getGroupMemberCounts: (
      chatroomIds: string[]
    ) => Promise<{ success: boolean; map?: Record<string, number>; error?: string }>
    getGroupAvatar: (
      chatroomId: string
    ) => Promise<{ success: boolean; avatars?: string[]; error?: string }>
    markAllSessionsRead: () => Promise<unknown>
    searchMessages: (
      keyword: string,
      sessionId?: string,
      limit?: number,
      offset?: number,
      beginTimestamp?: number,
      endTimestamp?: number
    ) => Promise<SearchMessagesResult>
    getImageData: (sessionId: string, msgId: string) => Promise<ImageDataResult>
    getFileInfo: (
      sessionId: string,
      msgId: string
    ) => Promise<{
      success: boolean
      fileName?: string
      fileSize?: number
      fileExt?: string
      fileMd5?: string
      localPath?: string
      error?: string
    }>
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

  // === 日志 ===
  log: {
    getPath: () => Promise<string>
    read: () => Promise<{ success: boolean; content?: string; error?: string }>
    clear: () => Promise<{ success: boolean; error?: string }>
    debug: (data: unknown) => void
  }

  // === 媒体处理 ===
  media: {
    decryptImage: (payload: {
      sessionId?: string
      imageMd5?: string
      imageDatName?: string
      createTime?: number
      force?: boolean
      preferFilePath?: boolean
      hardlinkOnly?: boolean
    }) => Promise<{ success: boolean; path?: string; dataUrl?: string; error?: string }>
    decodeVideo: (
      videoMd5: string,
      options?: { includePoster?: boolean; posterFormat?: 'dataUrl' | 'fileUrl' }
    ) => Promise<{
      success: boolean
      exists?: boolean
      videoUrl?: string
      coverUrl?: string
      thumbUrl?: string
      error?: string
    }>
    decodeVideoBatch: (
      videoMd5List?: string[],
      options?: { includePoster?: boolean; posterFormat?: 'dataUrl' | 'fileUrl' }
    ) => Promise<{
      success: boolean
      rows?: Array<{
        index: number
        md5: string
        info?: { exists: boolean; videoUrl?: string; coverUrl?: string; thumbUrl?: string }
      }>
      error?: string
    }>
    parseVideoMd5: (content: string) => Promise<{ success: boolean; md5?: string; error?: string }>
    transcribeVoice: (
      sessionId: string,
      msgId: string,
      createTime?: number,
      serverId?: string | number
    ) => Promise<{ success: boolean; transcript?: string; error?: string }>
    onTranscribePartial: (
      callback: (payload: { sessionId: string; msgId: string; text: string }) => void
    ) => () => void
    resolveVoiceCache: (
      sessionId: string,
      msgId: string
    ) => Promise<{ success: boolean; hasCache?: boolean; data?: string; error?: string }>
    getEmoji: (
      cdnUrl: string,
      md5?: string
    ) => Promise<{ success: boolean; localPath?: string; dataUrl?: string; error?: string }>
  }

  // === 系统通知 ===
  notification: {
    show: (data: {
      title: string
      content: string
      avatarUrl?: string
      sessionId?: string
      targetRoute?: string
    }) => Promise<{ success: boolean; id?: number; error?: string }>
    close: () => Promise<{ success: boolean }>
  }

  // === 应用功能 ===
  appFeatures: {
    getLaunchAtStartupStatus: () => Promise<{ openAtLogin: boolean; error?: string }>
    setLaunchAtStartup: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
    checkForUpdates: () => Promise<{
      hasUpdate: boolean
      version?: string
      releaseNotes?: string
    }>
    downloadAndInstall: () => Promise<{ success: boolean; error?: string }>
  }

  // === 认证（应用锁） ===
  auth: {
    hello: (message?: string) => Promise<{ success: boolean; error?: string }>
    verifyEnabled: () => Promise<boolean>
    unlock: (password: string) => Promise<{ success: boolean; error?: string }>
    enableLock: (password: string) => Promise<{ success: boolean; error?: string }>
    disableLock: (password: string) => Promise<{ success: boolean; error?: string }>
    changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
    isLockMode: () => Promise<boolean>
  }

  // === AI 对话 ===
  aiChat: {
    chatWithContext: (requestId: string, context: unknown, userMessage: string) => Promise<unknown>
    abortRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>
    listSessions: () => Promise<unknown>
    getSession: (sessionId: string, displayName?: string) => Promise<unknown>
    clearSessionMessages: (sessionId: string) => Promise<unknown>
    deleteSession: (sessionId: string) => Promise<unknown>
    listProviderPresets: () => Promise<unknown>
    applyProviderPreset: (providerId: string) => Promise<unknown>
    cleanupExpiredSessions: () => Promise<unknown>
    onChatChunk: (callback: (requestId: string, chunk: string) => void) => () => void
  }

  // === AI 见解（Insight） ===
  insight: {
    testConnection: () => Promise<unknown>
    getTodayStats: () => Promise<unknown>
    listRecords: (filters?: unknown) => Promise<unknown>
    getRecord: (id: string) => Promise<unknown>
    markRecordRead: (id: string) => Promise<unknown>
    clearRecords: (filters?: unknown) => Promise<unknown>
    triggerTest: () => Promise<unknown>
    triggerSessionInsight: (payload: unknown) => Promise<unknown>
    listProfileStatuses: (sessionIds: string[]) => Promise<unknown>
    generateProfile: (payload: unknown) => Promise<unknown>
    cancelProfile: (sessionId?: string) => Promise<unknown>
    generateFootprintInsight: (payload: unknown) => Promise<unknown>
    generateMessageInsight: (payload: unknown) => Promise<unknown>
  }

  // === 数据分析（Analytics） ===
  analytics: {
    getOverallStatistics: (force?: boolean) => Promise<unknown>
    getContactRankings: (limit?: number, beginTimestamp?: number, endTimestamp?: number) => Promise<unknown>
    getTimeDistribution: () => Promise<unknown>
    getSelfSentDailyDistribution: (beginTimestamp?: number, endTimestamp?: number, force?: boolean) => Promise<unknown>
    getExcludedUsernames: () => Promise<unknown>
    setExcludedUsernames: (usernames: string[]) => Promise<unknown>
    getExcludeCandidates: () => Promise<unknown>
    clearCache: () => Promise<unknown>
  }

  // === 群摘要（GroupSummary） ===
  groupSummary: {
    listRecords: (filters?: unknown) => Promise<unknown>
    getRecord: (id: string) => Promise<unknown>
    triggerManual: (payload: unknown) => Promise<unknown>
    triggerDay: (payload: unknown) => Promise<unknown>
  }

  // === 备份与恢复（Backup） ===
  backup: {
    create: (payload: { outputPath: string; options?: unknown }) => Promise<unknown>
    inspect: (payload: { archivePath: string }) => Promise<unknown>
    restore: (payload: { archivePath: string }) => Promise<unknown>
    onProgress: (callback: (progress: { phase?: string; percent?: number; message?: string }) => void) => () => void
  }

  // === 导出中心（Export） ===
  export: {
    contacts: (
      outputDir: string,
      options: unknown
    ) => Promise<{ success: boolean; successCount?: number; error?: string }>
    getLatestRecord: (
      sessionId?: string,
      format?: string
    ) => Promise<{
      success: boolean
      record?: { sessionId?: string; format?: string; path?: string; createdAt?: number } | null
      error?: string
    }>
  }

  // === 朋友圈（SNS） ===
  sns: {
    getTimeline: (
      limit?: number,
      offset?: number,
      usernames?: string[],
      keyword?: string,
      startTime?: number,
      endTime?: number
    ) => Promise<unknown>
    getSnsUsernames: () => Promise<unknown>
    getExportStats: () => Promise<unknown>
    proxyImage: (url: string, key?: string | number) => Promise<unknown>
    deleteSnsPost: (postId: string) => Promise<unknown>
    checkBlockDeleteTrigger: () => Promise<unknown>
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
