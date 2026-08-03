import { useEffect, useState } from 'react'
import './TitleBar.scss'

/**
 * 自定义标题栏（Telegram 风格）
 * - 整条可拖动，按钮区域 no-drag
 * - macOS 不显示窗口控制按钮（使用系统红绿灯）
 */
export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const isMac = window.electronAPI?.platform === 'darwin'

  useEffect(() => {
    // 初始化最大化状态
    window.electronAPI?.window?.isMaximized().then(setIsMaximized).catch(() => {})

    // 订阅最大化状态变化
    const unsubscribe = window.electronAPI?.window?.onMaximizeChange(setIsMaximized)
    return () => {
      unsubscribe?.()
    }
  }, [])

  const handleMinimize = () => window.electronAPI?.window?.minimize()
  const handleToggleMaximize = () => window.electronAPI?.window?.toggleMaximize()
  const handleClose = () => window.electronAPI?.window?.close()

  return (
    <div className="titlebar" role="banner">
      <div className="titlebar__left">
        <span className="titlebar__app-name">Lumina</span>
      </div>

      <div className="titlebar__center">
        {/* 中间区域预留，可放当前会话名等 */}
      </div>

      {!isMac && (
        <div className="titlebar__controls">
          <button
            className="titlebar__btn titlebar__btn--minimize"
            onClick={handleMinimize}
            aria-label="最小化"
            title="最小化"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="titlebar__btn titlebar__btn--maximize"
            onClick={handleToggleMaximize}
            aria-label={isMaximized ? '还原' : '最大化'}
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1.5" y="0.5" width="7" height="7" stroke="currentColor" fill="none" strokeWidth="1" />
                <rect x="0.5" y="1.5" width="7" height="7" stroke="currentColor" fill="none" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" fill="none" strokeWidth="1" />
              </svg>
            )}
          </button>
          <button
            className="titlebar__btn titlebar__btn--close"
            onClick={handleClose}
            aria-label="关闭"
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
