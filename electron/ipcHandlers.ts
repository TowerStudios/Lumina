import { ipcMain, dialog, shell, app, BrowserWindow, Notification } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { ConfigService } from './services/config'
import { dbPathService } from './services/dbPathService'
import { wcdbService } from './services/wcdbService'
import { chatService } from './services/chatService'
import { KeyService } from './services/keyService'
import { KeyServiceLinux } from './services/keyServiceLinux'
import { KeyServiceMac } from './services/keyServiceMac'
import { imageDecryptService } from './services/imageDecryptService'
import { videoService } from './services/videoService'
import { windowsHelloService } from './services/windowsHelloService'
import { showSystemNotification } from './services/systemNotificationService'
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
  // 后端 wcdbService.testConnection 签名为 (accountDir, hexKey)，
  // 这里通过 config.getAccountDir 将 dbPath + wxid 解析为账号目录
  ipcMain.handle('wcdb:testConnection', async (_event, dbPath: string, hexKey: string, wxid: string) => {
    try {
      const accountDir = config.getAccountDir(dbPath, wxid)
      if (!accountDir) {
        return { success: false, error: '未找到账号目录' }
      }
      const ok = await wcdbService.testConnection(accountDir, hexKey)
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
      await wcdbService.open(accountDir, hexKey)
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

  // === 日志 ===
  // 返回主进程日志文件路径（与 app:getLogPath 重复但保留兼容 WeFlow 命名）
  ipcMain.handle('log:getPath', async () => {
    return getLogPath()
  })

  // 读取当前日志文件内容（用于设置页"查看日志"功能）
  ipcMain.handle('log:read', async () => {
    try {
      const p = getLogPath()
      if (!p || !existsSync(p)) return { success: true, content: '' }
      const content = readFileSync(p, 'utf8')
      return { success: true, content }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 清空当前日志文件
  ipcMain.handle('log:clear', async () => {
    try {
      const p = getLogPath()
      if (!p) return { success: false, error: '日志路径未初始化' }
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, '', 'utf8')
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 渲染进程主动写入调试日志（单向消息，无返回）
  ipcMain.on('log:debug', (_event, data: unknown) => {
    logInfo('renderer', '[debug]', data)
  })

  // === 媒体处理 ===
  // 解密单张图片（用于图片预览、导出）
  // payload 与 imageDecryptService.decryptImage 对齐
  ipcMain.handle('image:decrypt', async (_event, payload: any) => {
    try {
      return await imageDecryptService.decryptImage(payload)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 视频解码：通过 videoService 获取视频信息（含 poster/路径）
  // 参数：videoMd5, options?: { includePoster?, posterFormat?: 'dataUrl' | 'fileUrl' }
  ipcMain.handle('video:decode', async (_event, videoMd5: string, options?: any) => {
    try {
      const result = await videoService.getVideoInfo(videoMd5, options)
      return { success: true, ...result }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e), exists: false }
    }
  })

  // 批量查询视频信息
  ipcMain.handle('video:decodeBatch', async (_event, videoMd5List?: string[], options?: any) => {
    try {
      const list = Array.isArray(videoMd5List) ? videoMd5List : []
      const result = await videoService.getVideoInfoBatch(list, options)
      return { success: true, rows: result }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 解析消息内容中的 videoMd5
  ipcMain.handle('video:parseMd5', async (_event, content: string) => {
    try {
      const md5 = videoService.parseVideoMd5(content)
      return { success: true, md5: md5 || '' }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 语音转文字（流式：partial 通过事件推送）
  // 参数：sessionId, msgId, createTime?, serverId?
  // 返回：{ success, transcript?, error? }
  ipcMain.handle('voice:transcribe', async (event, sessionId: string, msgId: string, createTime?: number, serverId?: string | number) => {
    try {
      const result = await chatService.getVoiceTranscript(
        sessionId,
        msgId,
        createTime,
        (partial: string) => {
          event.sender.send('voice:transcribePartial', { sessionId, msgId, text: partial })
        },
        undefined,
        serverId
      )
      return result
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 解析语音缓存（避免重复转写）
  ipcMain.handle('voice:resolveCache', async (_event, sessionId: string, msgId: string) => {
    try {
      return await chatService.resolveVoiceCache(sessionId, msgId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 下载表情包（cdnUrl + md5 → 本地路径）
  ipcMain.handle('emoji:get', async (_event, cdnUrl: string, md5?: string) => {
    try {
      return await chatService.downloadEmoji(cdnUrl, md5)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 系统通知 ===
  // 显示系统通知（Linux/macOS 走系统通知中心，Windows 走 Electron Notification）
  // data: { title, content, avatarUrl?, sessionId?, targetRoute? }
  ipcMain.handle('notification:show', async (_event, data: any) => {
    try {
      if (process.platform === 'win32') {
        // Windows 直接使用 Electron Notification（与 WeFlow 的玻璃窗口方案不同，简化实现）
        if (!Notification.isSupported()) return { success: false, error: '系统不支持通知' }
        const n = new Notification({
          title: data?.title || 'Lumina',
          body: data?.content || '',
          silent: false,
        })
        n.show()
        return { success: true }
      }
      const id = await showSystemNotification({
        title: data?.title || 'Lumina',
        content: data?.content || '',
        avatarUrl: data?.avatarUrl,
        sessionId: data?.sessionId,
        targetRoute: data?.targetRoute,
      })
      return { success: !!id, id }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 关闭通知（Windows 占位，Linux/macOS 由系统管理）
  ipcMain.handle('notification:close', async () => {
    return { success: true }
  })

  // === 应用功能 ===
  // 查询开机自启状态
  ipcMain.handle('app:getLaunchAtStartupStatus', async () => {
    try {
      const settings = app.getLoginItemSettings()
      return { openAtLogin: settings.openAtLogin }
    } catch (e: any) {
      return { openAtLogin: false, error: e?.message ?? String(e) }
    }
  })

  // 设置/取消开机自启
  ipcMain.handle('app:setLaunchAtStartup', async (_event, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled === true,
        args: ['--hidden'],
      })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 检查更新（暂未接入 autoUpdater，返回无更新）
  // TODO: 接入 electron-updater 后实现真实检查逻辑
  ipcMain.handle('app:checkForUpdates', async () => {
    return { hasUpdate: false }
  })

  // 下载并安装更新（占位）
  ipcMain.handle('app:downloadAndInstall', async () => {
    return { success: false, error: '自动更新尚未配置，请前往 GitHub Releases 手动下载最新版本' }
  })

  // === 认证（应用锁） ===
  // Windows Hello 生物识别验证
  // 验证成功后若处于锁模式且存在 helloSecret，自动解锁配置
  ipcMain.handle('auth:hello', async (event, message?: string) => {
    try {
      const targetWin = BrowserWindow.fromWebContents(event.sender) || undefined
      const result = await windowsHelloService.verify(message || '请验证您的身份以解锁 Lumina', targetWin)
      if (result.success && config.isLockMode() && config.getHelloSecret()) {
        const unlockResult = config.unlock(config.getHelloSecret())
        if (!unlockResult.success) {
          logError('auth', 'Windows Hello 验证成功但配置解锁失败:', unlockResult.error)
        }
      }
      return result
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 检查是否已启用应用锁
  ipcMain.handle('auth:verifyEnabled', async () => {
    try {
      return config.verifyAuthEnabled()
    } catch {
      return false
    }
  })

  // 密码解锁
  ipcMain.handle('auth:unlock', async (_event, password: string) => {
    try {
      return config.unlock(password)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 启用应用锁（设置密码）
  ipcMain.handle('auth:enableLock', async (_event, password: string) => {
    try {
      return config.enableLock(password)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 关闭应用锁（验证密码后关闭）
  ipcMain.handle('auth:disableLock', async (_event, password: string) => {
    try {
      return config.disableLock(password)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 修改应用锁密码
  ipcMain.handle('auth:changePassword', async (_event, oldPassword: string, newPassword: string) => {
    try {
      return config.changePassword(oldPassword, newPassword)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 查询当前是否处于锁定状态
  ipcMain.handle('auth:isLockMode', async () => {
    try {
      return config.isLockMode()
    } catch {
      return false
    }
  })
}

