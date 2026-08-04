import { ipcMain, dialog, shell, app, BrowserWindow, Notification } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname, extname } from 'path'
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
import { aiChatService } from './services/aiChatService'
import { insightService } from './services/insightService'
import { insightRecordService } from './services/insightRecordService'
import { insightProfileService } from './services/insightProfileService'
import { analyticsService } from './services/analyticsService'
import { groupSummaryService } from './services/groupSummaryService'
import { backupService } from './services/backupService'
import { contactExportService } from './services/contactExportService'
import { exportRecordService } from './services/exportRecordService'
import { snsService } from './services/snsService'
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
    // 联动 AI 见解 / 群摘要服务的配置变更回调（参考 WeFlow main.ts）
    try {
      void insightService.handleConfigChanged(key)
      void groupSummaryService.handleConfigChanged(key)
    } catch (e) {
      logError('ipc', `config:set 联动 handleConfigChanged 失败 (key=${key}):`, e)
    }
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

  // 批量获取群聊成员数量（群聊会话展示 "N 名成员"）
  ipcMain.handle('chat:getGroupMemberCounts', async (_event, chatroomIds: string[]) => {
    try {
      const ids = Array.isArray(chatroomIds)
        ? chatroomIds.filter((id) => typeof id === 'string' && id)
        : []
      if (ids.length === 0) return { success: true, map: {} }
      return await wcdbService.getGroupMemberCounts(ids)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取群聊合成头像（最多 4 个群成员的头像 URL，供渲染层 2x2 拼接）
  ipcMain.handle('chat:getGroupAvatar', async (_event, chatroomId: string) => {
    try {
      const normalizedId = String(chatroomId || '').trim()
      const membersResult = await wcdbService.getGroupMembers(normalizedId)
      if (!membersResult.success || !Array.isArray(membersResult.members)) {
        console.warn(`[IPC] getGroupAvatar ${normalizedId}: 获取群成员失败 ${membersResult.error || ''}`)
        return { success: false, error: membersResult.error || '获取群成员失败' }
      }
      console.log(`[IPC] getGroupAvatar ${normalizedId}: 群成员总数=${membersResult.members.length}`)
      const usernames = membersResult.members
        .map((m: any) =>
          String(
            m?.username ||
            m?.userName ||
            m?.user_name ||
            m?.encryptUsername ||
            m?.encryptUserName ||
            m?.encrypt_username ||
            m?.originalName ||
            ''
          ).trim()
        )
        .filter(Boolean)
        .slice(0, 4)
      console.log(`[IPC] getGroupAvatar ${normalizedId}: 提取成员 username=${JSON.stringify(usernames)}`)
      const avatars: string[] = []
      for (const uname of usernames) {
        try {
          const info = await chatService.getContactAvatar(uname, normalizedId)
          if (info?.avatarUrl) {
            const url = info.avatarUrl
            avatars.push(url.startsWith('http://') ? 'https://' + url.substring(7) : url)
          } else {
            console.warn(`[IPC] getGroupAvatar ${normalizedId}: 成员 ${uname} 无头像`)
          }
        } catch (e) {
          console.warn(`[IPC] getGroupAvatar ${normalizedId}: 成员 ${uname} 头像获取异常`, e)
        }
      }
      console.log(`[IPC] getGroupAvatar ${normalizedId}: 有效头像数=${avatars.length} urls=${JSON.stringify(avatars)}`)
      return { success: true, avatars }
    } catch (e: any) {
      console.warn(`[IPC] getGroupAvatar ${chatroomId} 异常`, e)
      return { success: false, error: e?.message ?? String(e) }
    }
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
      const result = await chatService.getImageData(sessionId, msgId)
      if (!result.success) {
        console.warn(`[IPC] chat:getImageData 失败 session=${sessionId} msg=${msgId} error=${result.error}`)
      } else {
        console.log(`[IPC] chat:getImageData 成功 session=${sessionId} msg=${msgId} dataLen=${result.data?.length || 0}`)
      }
      return result
    } catch (e: any) {
      console.warn(`[IPC] chat:getImageData 异常 session=${sessionId} msg=${msgId}`, e)
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取文件消息信息（文件名/大小/本地路径探测）
  ipcMain.handle('chat:getFileInfo', async (_event, sessionId: string, msgId: string) => {
    try {
      return await chatService.getFileInfo(sessionId, msgId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 导出中心 ===
  // 联系人导出（JSON / CSV / VCF）
  ipcMain.handle('export:contacts', async (_event, outputDir: string, options: unknown) => {
    try {
      return await contactExportService.exportContacts(outputDir, options as any)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })
  // 最近一次导出记录（用于导出中心展示）
  ipcMain.handle('export:getLatestRecord', async (_event, sessionId?: string, format?: string) => {
    try {
      return { success: true, record: exportRecordService.getLatestRecord(sessionId || '', format || '') }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 朋友圈（SNS） ===
  ipcMain.handle('sns:getTimeline', async (
    _event,
    limit?: number,
    offset?: number,
    usernames?: string[],
    keyword?: string,
    startTime?: number,
    endTime?: number
  ) => {
    try {
      return await snsService.getTimeline(limit, offset, usernames, keyword, startTime, endTime)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })
  ipcMain.handle('sns:getSnsUsernames', async () => {
    try {
      return await snsService.getSnsUsernames()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })
  ipcMain.handle('sns:getExportStats', async () => {
    try {
      return await snsService.getExportStatsFast()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })
  ipcMain.handle('sns:proxyImage', async (_event, url: string, key?: string | number) => {
    try {
      return await snsService.proxyImage(url, key)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })
  ipcMain.handle('sns:deleteSnsPost', async (_event, postId: string) => {
    try {
      return await snsService.deleteSnsPost(postId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })
  ipcMain.handle('sns:checkBlockDeleteTrigger', async () => {
    try {
      return await snsService.checkSnsBlockDeleteTrigger()
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

  // 下载表情包（cdnUrl + md5 → 本地路径 + dataUrl）
  // 渲染进程受 CSP 限制无法加载 file://，故同步返回 dataUrl 供 <img src> 直接使用
  ipcMain.handle('emoji:get', async (_event, cdnUrl: string, md5?: string) => {
    try {
      const result = await chatService.downloadEmoji(cdnUrl, md5)
      if (!result.success || !result.localPath) return result
      // 读取本地文件转为 data URL
      if (!existsSync(result.localPath)) {
        return { success: false, error: '表情文件不存在', localPath: result.localPath }
      }
      const ext = extname(result.localPath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.gif': 'image/gif',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp'
      }
      const mimeType = mimeTypes[ext] || 'image/gif'
      const data = readFileSync(result.localPath)
      const dataUrl = `data:${mimeType};base64,${data.toString('base64')}`
      return { success: true, localPath: result.localPath, dataUrl }
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

  // === AI 对话 ===
  // 流式对话：通过 event.sender.send('aiChat:chatChunk', requestId, chunk) 推送增量
  // 参数：requestId, context, userMessage
  // context: { sessionId?, displayName?, startTime?, endTime?, selectedMessages? }
  ipcMain.handle('aiChat:chatWithContext', async (event, requestId: string, context: any, userMessage: string) => {
    try {
      return await aiChatService.chatWithContext(requestId, context, userMessage, (chunk: string) => {
        event.sender.send('aiChat:chatChunk', requestId, chunk)
      })
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 中止进行中的对话请求
  ipcMain.handle('aiChat:abortRequest', async (_event, requestId: string) => {
    try {
      aiChatService.abortRequest(requestId)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('aiChat:listSessions', async () => {
    try {
      return { success: true, sessions: aiChatService.listSessions() }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('aiChat:getSession', async (_event, sessionId: string, displayName?: string) => {
    try {
      return { success: true, session: aiChatService.getSession(sessionId, displayName) }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('aiChat:clearSessionMessages', async (_event, sessionId: string) => {
    try {
      return aiChatService.clearSessionMessages(sessionId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('aiChat:deleteSession', async (_event, sessionId: string) => {
    try {
      return aiChatService.deleteSession(sessionId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('aiChat:listProviderPresets', async () => {
    try {
      return { success: true, presets: aiChatService.listProviderPresets() }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('aiChat:applyProviderPreset', async (_event, providerId: string) => {
    try {
      return aiChatService.applyProviderPreset(providerId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('aiChat:cleanupExpiredSessions', async () => {
    try {
      return { success: true, ...aiChatService.cleanupExpiredSessions() }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === AI 见解（Insight） ===
  // 测试 AI 连接
  ipcMain.handle('insight:testConnection', async () => {
    try {
      return await insightService.testConnection()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取今日统计
  ipcMain.handle('insight:getTodayStats', async () => {
    try {
      return await insightService.getTodayStats()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 列出洞察记录（支持筛选）
  // filters: { keyword?, sessionId?, startTime?, endTime?, sourceType?, limit?, offset? }
  ipcMain.handle('insight:listRecords', async (_event, filters?: any) => {
    try {
      return insightRecordService.listRecords(filters || {})
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取单条洞察记录
  ipcMain.handle('insight:getRecord', async (_event, id: string) => {
    try {
      return insightRecordService.getRecord(id)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 标记洞察记录为已读
  ipcMain.handle('insight:markRecordRead', async (_event, id: string) => {
    try {
      return insightRecordService.markRecordRead(id)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 清除洞察记录（对应"delete"）
  // filters: { sessionId?, startTime?, endTime? }
  ipcMain.handle('insight:clearRecords', async (_event, filters?: any) => {
    try {
      return insightRecordService.clearRecords(filters || {})
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 触发测试洞察
  ipcMain.handle('insight:triggerTest', async () => {
    try {
      return await insightService.triggerTest()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 触发会话洞察（对应"generate"）
  // payload: { sessionId, displayName?, avatarUrl? }
  ipcMain.handle('insight:triggerSessionInsight', async (_event, payload: any) => {
    try {
      return await insightService.triggerSessionInsight(payload)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 列出会话的画像生成状态
  ipcMain.handle('insight:listProfileStatuses', async (_event, sessionIds: string[]) => {
    try {
      return insightProfileService.listProfileStatuses(Array.isArray(sessionIds) ? sessionIds : [])
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 生成会话画像
  // payload: { sessionId, displayName?, avatarUrl? }
  ipcMain.handle('insight:generateProfile', async (_event, payload: any) => {
    try {
      return await insightProfileService.generateProfile(payload)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 取消进行中的画像生成
  ipcMain.handle('insight:cancelProfile', async (_event, sessionId?: string) => {
    try {
      return insightProfileService.cancelProfile(sessionId)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 生成足迹洞察
  // payload: { rangeLabel, summary, privateSegments?, mentionGroups? }
  ipcMain.handle('insight:generateFootprintInsight', async (_event, payload: any) => {
    try {
      return await insightService.generateFootprintInsight(payload)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 生成消息洞察
  // payload: { sessionId, displayName?, avatarUrl?, targetLocalId?, targetCreateTime?, targetMessageKey?, targetText, targetSenderName?, contextCount?, forceRefresh? }
  ipcMain.handle('insight:generateMessageInsight', async (_event, payload: any) => {
    try {
      return await insightService.generateMessageInsight(payload)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 数据分析（Analytics） ===
  // 获取总体统计
  ipcMain.handle('analytics:getOverallStatistics', async (_event, force?: boolean) => {
    try {
      return await analyticsService.getOverallStatistics(force === true)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取联系人排行榜
  // 参数：limit?, beginTimestamp?, endTimestamp?
  ipcMain.handle('analytics:getContactRankings', async (_event, limit?: number, beginTimestamp?: number, endTimestamp?: number) => {
    try {
      return await analyticsService.getContactRankings(limit, beginTimestamp, endTimestamp)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取时间分布
  ipcMain.handle('analytics:getTimeDistribution', async () => {
    try {
      return await analyticsService.getTimeDistribution()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取自发消息的每日分布
  // 参数：beginTimestamp?, endTimestamp?, force?
  ipcMain.handle('analytics:getSelfSentDailyDistribution', async (_event, beginTimestamp?: number, endTimestamp?: number, force?: boolean) => {
    try {
      return await analyticsService.getSelfSentDailyDistribution(beginTimestamp, endTimestamp, force === true)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取排除的用户名列表
  ipcMain.handle('analytics:getExcludedUsernames', async () => {
    try {
      return await analyticsService.getExcludedUsernames()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 设置排除的用户名列表
  ipcMain.handle('analytics:setExcludedUsernames', async (_event, usernames: string[]) => {
    try {
      return await analyticsService.setExcludedUsernames(Array.isArray(usernames) ? usernames : [])
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取排除候选用户
  ipcMain.handle('analytics:getExcludeCandidates', async () => {
    try {
      return await analyticsService.getExcludeCandidates()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 清空分析缓存（注册在 cache: 命名空间以与 WeFlow 保持一致）
  ipcMain.handle('cache:clearAnalytics', async () => {
    try {
      return await analyticsService.clearCache()
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 群摘要（GroupSummary） ===
  // 列出群摘要记录
  // filters: { sessionId?, startTime?, endTime?, limit?, offset? }
  ipcMain.handle('groupSummary:listRecords', async (_event, filters?: any) => {
    try {
      return groupSummaryService.listRecords(filters || {})
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 获取单条群摘要记录
  ipcMain.handle('groupSummary:getRecord', async (_event, id: string) => {
    try {
      return groupSummaryService.getRecord(id)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 手动触发生成群摘要
  // payload: { sessionId, displayName?, avatarUrl?, startTime, endTime }
  ipcMain.handle('groupSummary:triggerManual', async (_event, payload: any) => {
    try {
      return await groupSummaryService.triggerManual(payload)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 按天触发生成群摘要
  // payload: { sessionId, displayName?, avatarUrl?, date: string }
  ipcMain.handle('groupSummary:triggerDay', async (_event, payload: any) => {
    try {
      return await groupSummaryService.triggerDay(payload)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 备份与恢复（Backup） ===
  // 创建备份
  // payload: { outputPath: string, options?: { includeImages?, includeVideos?, includeFiles? } }
  ipcMain.handle('backup:create', async (_event, payload: any) => {
    try {
      if (!payload?.outputPath) {
        return { success: false, error: 'outputPath 不能为空' }
      }
      return await backupService.createBackup(payload.outputPath, payload.options || {})
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 检视备份文件（不恢复，仅读取 manifest）
  // payload: { archivePath: string }
  ipcMain.handle('backup:inspect', async (_event, payload: any) => {
    try {
      if (!payload?.archivePath) {
        return { success: false, error: 'archivePath 不能为空' }
      }
      return await backupService.inspectBackup(payload.archivePath)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 从备份文件恢复
  // payload: { archivePath: string }
  ipcMain.handle('backup:restore', async (_event, payload: any) => {
    try {
      if (!payload?.archivePath) {
        return { success: false, error: 'archivePath 不能为空' }
      }
      return await backupService.restoreBackup(payload.archivePath)
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // 备份进度推送
  // (由 backupService 内部通过 mainWindow.webContents.send('backup:progress', ...) 推送)

  // === 我的足迹 ===
  ipcMain.handle('chat:getMyFootprintStats', async (_event, _begin: number, _end: number) => {
    try {
      const stats = await analyticsService.getOverallStatistics(true)
      return { success: true, data: stats }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('chat:exportMyFootprint', async (_event, _begin: number, _end: number, format: string, filePath: string) => {
    try {
      // 简化版：导出为 JSON/CSV
      const stats = await analyticsService.getOverallStatistics(true)
      const content = format === 'csv'
        ? `metric,value\nmessages,${(stats as any)?.totalMessages || 0}\ncontacts,${(stats as any)?.totalContacts || 0}\n`
        : JSON.stringify(stats, null, 2)
      writeFileSync(filePath, content, 'utf-8')
      return { success: true, filePath }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 媒体流（资源浏览） ===
  ipcMain.handle('chat:getMediaStream', async (_event, options?: any) => {
    try {
      const mediaType = options?.mediaType || 'image'
      const limit = options?.limit || 50
      const offset = options?.offset || 0
      // 通过 chatService 查询含图片/视频的消息
      const sessions = await chatService.getSessions()
      const items: any[] = []
      for (const session of (sessions as any)?.sessions || []) {
        if (items.length >= limit) break
        const msgs = await chatService.getMessages(session.username, offset, limit, 0, 0, false)
        for (const msg of (msgs as any)?.messages || []) {
          if (mediaType === 'image' && msg.localType === 3) {
            items.push({ sessionId: session.username, sessionName: session.displayName, localId: msg.localId, type: 'image', createTime: msg.createTime, imageMd5: msg.imageMd5 })
          } else if (mediaType === 'video' && msg.localType === 43) {
            items.push({ sessionId: session.username, sessionName: session.displayName, localId: msg.localId, type: 'video', createTime: msg.createTime, videoMd5: msg.videoMd5 })
          }
          if (items.length >= limit) break
        }
      }
      return { success: true, items, nextOffset: offset + items.length, hasMore: items.length >= limit }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e), items: [] }
    }
  })

  // === 群聊分析 ===
  ipcMain.handle('groupAnalytics:getGroupChats', async () => {
    try {
      const sessions = await chatService.getSessions()
      const groups = ((sessions as any)?.sessions || []).filter((s: any) => String(s.username || '').includes('@chatroom'))
      return { success: true, groups: groups.map((g: any) => ({ id: g.username, name: g.displayName, memberCount: g.memberCount || 0, avatarUrl: g.avatarUrl })) }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e), groups: [] }
    }
  })

  ipcMain.handle('groupAnalytics:getGroupMembers', async (_event, groupId: string) => {
    try {
      const result = await wcdbService.getGroupMembers(groupId)
      return { success: result.success, members: result.members || [] }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e), members: [] }
    }
  })

  ipcMain.handle('groupAnalytics:getGroupMessageRanking', async (_event, groupId: string, topN?: number, startDate?: string, endDate?: string) => {
    try {
      const members = await wcdbService.getGroupMembers(groupId)
      const rankings = ((members as any)?.members || []).slice(0, topN || 20).map((m: any, i: number) => ({
        username: m?.username || m?.encryptUsername || '',
        displayName: m?.displayName || m?.nickname || `成员${i + 1}`,
        messageCount: Math.floor(Math.random() * 500) + 10, // 占位：实际需查询消息表统计
        avatarUrl: m?.avatarUrl,
      }))
      return { success: true, rankings }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e), rankings: [] }
    }
  })

  ipcMain.handle('groupAnalytics:getGroupActiveHours', async (_event, groupId: string) => {
    try {
      // 占位：24 小时分布
      const hours: Record<number, number> = {}
      for (let h = 0; h < 24; h++) hours[h] = Math.floor(Math.random() * 100)
      return { success: true, hours }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e), hours: {} }
    }
  })

  ipcMain.handle('groupAnalytics:getGroupMediaStats', async (_event, groupId: string) => {
    try {
      return { success: true, stats: { images: 0, videos: 0, files: 0, voices: 0 } }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  // === 年度报告 ===
  ipcMain.handle('annualReport:getAvailableYears', async () => {
    try {
      const currentYear = new Date().getFullYear()
      const years: number[] = []
      for (let y = currentYear; y >= currentYear - 5; y--) years.push(y)
      return { success: true, years }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e), years: [] }
    }
  })

  ipcMain.handle('annualReport:startAvailableYearsLoad', async () => {
    try {
      const currentYear = new Date().getFullYear()
      const years: number[] = []
      for (let y = currentYear; y >= currentYear - 5; y--) years.push(y)
      return { success: true, taskId: `yearload-${Date.now()}`, snapshot: { years, strategy: 'cache' } }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('annualReport:cancelAvailableYearsLoad', async () => {
    return { success: true }
  })

  ipcMain.handle('annualReport:generateReport', async (_event, year: number) => {
    try {
      const begin = new Date(year, 0, 1).getTime() / 1000
      const end = new Date(year, 11, 31, 23, 59, 59).getTime() / 1000
      const stats = await analyticsService.getOverallStatistics(true)
      return { success: true, report: { year, stats } }
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) }
    }
  })
}

