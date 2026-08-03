// === 主进程文件日志（同步写入） ===
// 写入固定路径，便于诊断闪退/崩溃问题。
// 日志路径： userData/logs/main-YYYY-MM-DD.log
//
// 关键：使用 appendFileSync 同步写入，确保 native 崩溃（segfault）
// 前日志已落盘。createWriteStream 是异步缓冲，进程崩溃时缓冲数据会丢失。
//
// 自动捕获：
//   - console.log / console.warn / console.error（原行为保留）
//   - process 未捕获异常
//   - process 未处理的 Promise rejection
//   - Electron GPU 崩溃 / 渲染进程崩溃

import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync, existsSync } from 'fs'

let logPath = ''

/** 返回当前日志文件路径（未初始化时返回空串） */
export function getLogPath(): string {
  return logPath
}

/** 初始化日志文件。应在 app.whenReady 之前调用。 */
export function initLogger(): void {
  try {
    const logsDir = join(app.getPath('userData'), 'logs')
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }
    const today = new Date().toISOString().slice(0, 10)
    logPath = join(logsDir, `main-${today}.log`)
    // 同步写入启动标记
    appendFileSync(logPath, `\n========== Lumina 启动 ${new Date().toISOString()} ==========\n`, 'utf8')
  } catch (e) {
    // 日志初始化失败不应阻塞启动
    console.error('[logger] 初始化失败:', e)
  }

  // === 捕获 console ===
  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error

  console.log = (...args: unknown[]) => {
    origLog(...args)
    writeLineSync('LOG', args)
  }
  console.warn = (...args: unknown[]) => {
    origWarn(...args)
    writeLineSync('WARN', args)
  }
  console.error = (...args: unknown[]) => {
    origError(...args)
    writeLineSync('ERROR', args)
  }

  // === 捕获未处理异常 ===
  process.on('uncaughtException', (err) => {
    writeLineSync('FATAL', [`未捕获异常: ${err.stack || err.message}`])
  })

  process.on('unhandledRejection', (reason) => {
    writeLineSync('FATAL', [`未处理的 Promise rejection:`, reason])
  })
}

/** 显式写入一条日志（供业务代码使用） */
export function logError(tag: string, ...args: unknown[]): void {
  writeLineSync('ERROR', [`[${tag}]`, ...args])
}

export function logInfo(tag: string, ...args: unknown[]): void {
  writeLineSync('LOG', [`[${tag}]`, ...args])
}

// === 内部：同步写入，确保崩溃前数据落盘 ===
function writeLineSync(level: string, args: unknown[]): void {
  if (!logPath) return
  try {
    const ts = new Date().toISOString()
    const text = args
      .map((a) => {
        if (a instanceof Error) return a.stack || a.message
        if (typeof a === 'object') {
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        }
        return String(a)
      })
      .join(' ')
    appendFileSync(logPath, `[${ts}] [${level}] ${text}\n`, 'utf8')
  } catch {
    // 静默失败，避免日志本身导致崩溃
  }
}

// === Electron 进程崩溃捕获（需要在 app ready 后注册） ===
export function attachCrashHandlers(): void {
  try {
    const { app } = require('electron')
    app.on('gpu-process-crashed', (event) => {
      writeLineSync('FATAL', [`GPU 进程崩溃:`, event])
    })
    app.on('render-process-gone', (_event, webContents, details) => {
      writeLineSync('FATAL', [`渲染进程崩溃: reason=${details?.reason} exitCode=${details?.exitCode}`])
    })
    app.on('child-process-gone', (_event, details) => {
      writeLineSync('FATAL', [`子进程退出: type=${details?.type} reason=${details?.reason} exitCode=${details?.exitCode}`])
    })
  } catch (e) {
    writeLineSync('ERROR', ['attachCrashHandlers 失败:', e])
  }
}
