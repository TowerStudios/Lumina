import { ipcMain, dialog, shell, app } from 'electron'
import { ConfigService } from './services/config'
import { dbPathService } from './services/dbPathService'
import { wcdbService } from './services/wcdbService'
import { chatService } from './services/chatService'
import { KeyService } from './services/keyService'
import { KeyServiceLinux } from './services/keyServiceLinux'
import { KeyServiceMac } from './services/keyServiceMac'
import { getLogPath, logInfo, logError } from './utils/logger'

// === 业务 IPC 注册器 ===
// 参考 WeFlow main.ts 中的 IPC 注册逻辑，迁移到 Lumina 命名空间
// 仅注册核心账号/数据库/聊天相关 handler，其余（AI/SNS/分析/导出）按需后续接入

// 按平台实例化 KeyService（与 WeFlow main.ts 一致）
const keyService =
  process.platform === 'darwin'
    ? new KeyServiceMac()
    : process.platform === 'linux'
    ? new KeyServiceLinux()
    : new KeyService()

export function registerBusinessIpcHandlers(): void {
  const config = ConfigService.getInstance()

  // === 配置 ===
  ipcMain.handle('config:get', async (_event, key: string) => {
    return config.get(key as any)
  })

  ipcMain.handle('config:set', async (_event, key: string, value: unknown) => {
    config.set(key as any, value as any)
  })

  ipcMain.handle('config:clear', async () => {
    config.clear()
    return true
  })

  // === 微信数据库路径自动检测 ===
  ipcMain.handle('dbpath:autoDetect', async () => {
    return dbPathService.autoDetect()
  })

  ipcMain.handle('dbpath:getDefault', async () => {
    return dbPathService.getDefaultPath()
  })

  // 扫描 wxid 列表（带昵称/头像，用于账号选择）
  ipcMain.handle('dbpath:scanWxids', async (_event, rootPath: string) => {
    return dbPathService.scanWxids(rootPath)
  })

  // 扫描 wxid 候选（仅按命名特征，用于手动选择）
  ipcMain.handle('dbpath:scanWxidCandidates', async (_event, rootPath: string) => {
    return dbPathService.scanWxidCandidates(rootPath)
  })

  // === 数据库连接 ===
  // 测试连接（不持久化）
  ipcMain.handle('wcdb:testConnection', async (_event, dbPath: string, hexKey: string, wxid: string) => {
    try {
      const ok = await wcdbService.testConnection(dbPath, hexKey, wxid)
      return { success: ok }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 打开数据库（持久化到 config）
  ipcMain.handle('wcdb:open', async (_event, dbPath: string, hexKey: string, wxid: string) => {
    try {
      const accountDir = config.getAccountDir(dbPath, wxid)
      if (!accountDir) {
        return { success: false, error: '未找到账号目录' }
      }
      await wcdbService.open(dbPath, hexKey, wxid)
      // 持久化到配置
      config.set('dbPath', dbPath)
      config.set('decryptKey', hexKey)
      config.set('myWxid', wxid)
      config.set('onboardingDone', true)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 关闭数据库
  ipcMain.handle('wcdb:close', async () => {
    await wcdbService.close()
    return { success: true }
  })

  // === 密钥获取（自动从微信进程内存提取） ===
  // autoGetDbKey 通过 hook 微信进程内存提取数据库解密密钥
  // 进度通过 event.sender.send('key:dbKeyStatus', payload) 实时推送给渲染进程
  ipcMain.handle('key:autoGetDbKey', async (event) => {
    logInfo('ipc', '收到 key:autoGetDbKey 请求，开始自动获取密钥')
    try {
      const result = await keyService.autoGetDbKey(180_000, (message: string, level: number) => {
        // level: 0=info 1=warn 2=error
        logInfo('keyService', `[status] ${message} (level=${level})`)
        event.sender.send('key:dbKeyStatus', { message, level })
      })
      logInfo('ipc', `key:autoGetDbKey 完成，success=${result.success}`)
      return result
    } catch (e: any) {
      logError('ipc', 'key:autoGetDbKey 异常:', e?.stack || e?.message || String(e))
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 返回主进程日志文件路径，供前端「打开日志」按钮使用
  ipcMain.handle('app:getLogPath', async () => {
    return getLogPath()
  })

  // autoGetImageKey 从微信目录提取图片解密密钥（XOR/AES）
  ipcMain.handle('key:autoGetImageKey', async (event, manualDir?: string, wxid?: string) => {
    return keyService.autoGetImageKey(manualDir, (message: string) => {
      event.sender.send('key:imageKeyStatus', { message })
    }, wxid)
  })

  // scanImageKeyFromMemory 通过内存扫描获取图片密钥（备用方案）
  ipcMain.handle('key:scanImageKeyFromMemory', async (event, userDir: string) => {
    return keyService.autoGetImageKeyByMemoryScan(userDir, (message: string) => {
      event.sender.send('key:imageKeyStatus', { message })
    })
  })

  // === 聊天业务 ===
  ipcMain.handle('chat:connect', async () => {
    await chatService.connect()
    return { success: true }
  })

  ipcMain.handle('chat:close', async () => {
    await chatService.close()
    return { success: true }
  })

  ipcMain.handle('chat:getSessions', async () => {
    try {
      const result = await chatService.getSessions()
      logInfo('chat', `getSessions 完成: success=${result?.success}, sessions=${result?.sessions?.length ?? 0}`)
      return result
    } catch (e: any) {
      logError('chat', 'getSessions 异常:', e?.stack || e?.message || String(e))
      return { success: false, error: e?.message ?? String(e), sessions: [] }
    }
  })

  ipcMain.handle('chat:getMessages', async (
    _event,
    sessionId: string,
    offset?: number,
    limit?: number,
    startTime?: number,
    endTime?: number,
    ascending?: boolean
  ) => {
    return chatService.getMessages(sessionId, offset, limit, startTime, endTime, ascending)
  })

  ipcMain.handle('chat:getLatestMessages', async (_event, sessionId: string, limit?: number) => {
    return chatService.getLatestMessages(sessionId, limit)
  })

  ipcMain.handle('chat:getSessionDetail', async (_event, sessionId: string) => {
    return chatService.getSessionDetail(sessionId)
  })

  ipcMain.handle('chat:getContact', async (_event, username: string) => {
    return chatService.getContact(username)
  })

  ipcMain.handle('chat:getContacts', async (_event, options?: { lite?: boolean }) => {
    return chatService.getContacts(options)
  })

  ipcMain.handle('chat:getContactAvatar', async (_event, username: string, chatroomId?: string) => {
    return chatService.getContactAvatar(username, chatroomId)
  })

  ipcMain.handle('chat:getMyAvatarUrl', async () => {
    return chatService.getMyAvatarUrl()
  })

  ipcMain.handle('chat:markAllSessionsRead', async () => {
    return chatService.markAllSessionsRead()
  })

  ipcMain.handle('chat:searchMessages', async (
    _event,
    keyword: string,
    sessionId?: string,
    limit?: number,
    offset?: number,
    beginTimestamp?: number,
    endTimestamp?: number
  ) => {
    return chatService.searchMessages(keyword, sessionId, limit, offset, beginTimestamp, endTimestamp)
  })

  // 解密并返回单条图片消息的 base64 数据（用于图片预览）
  ipcMain.handle('chat:getImageData', async (_event, sessionId: string, msgId: string) => {
    try {
      return await chatService.getImageData(sessionId, msgId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 对话框 ===
  ipcMain.handle('dialog:openFile', async (_event, options?: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog(options || {})
  })

  ipcMain.handle('dialog:openDirectory', async (_event, options?: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog({
      ...options,
      properties: ['openDirectory', ...(options?.properties || [])]
    })
  })

  ipcMain.handle('dialog:saveFile', async (_event, options?: Electron.SaveDialogOptions) => {
    return dialog.showSaveDialog(options || {})
  })

  // === Shell ===
  ipcMain.handle('shell:openPath', async (_event, path: string) => {
    return shell.openPath(path)
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('app:getDownloadsPath', async () => {
    return app.getPath('downloads')
  })
}

