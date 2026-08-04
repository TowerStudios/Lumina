import { useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import './TitleBar.scss'

interface TitleBarProps {
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export function TitleBar({ sidebarCollapsed, onToggleSidebar }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const isMac = window.electronAPI?.platform === 'darwin'

  useEffect(() => {
    window.electronAPI?.window?.isMaximized().then(setIsMaximized).catch(() => {})
    const unsub = window.electronAPI?.window?.onMaximizeChange(setIsMaximized)
    return () => unsub?.()
  }, [])

  return (
    <div className="titlebar" role="banner">
      <div className="titlebar__brand">
        {onToggleSidebar && (
          <button className="titlebar__toggle" onClick={onToggleSidebar} title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
        <span className="titlebar__app-name">Lumina</span>
      </div>

      <div className="titlebar__drag-spacer" />

      {!isMac && (
        <div className="titlebar__controls">
          <button className="titlebar__btn titlebar__btn--minimize" onClick={() => window.electronAPI?.window?.minimize()} aria-label="最小化">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="4.5" width="10" height="1" fill="currentColor" /></svg>
          </button>
          <button className="titlebar__btn titlebar__btn--maximize" onClick={() => window.electronAPI?.window?.toggleMaximize()} aria-label={isMaximized ? '还原' : '最大化'}>
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="0.5" width="7" height="7" stroke="currentColor" fill="none" strokeWidth="1" /><rect x="0.5" y="1.5" width="7" height="7" stroke="currentColor" fill="none" strokeWidth="1" /></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" fill="none" strokeWidth="1" /></svg>
            )}
          </button>
          <button className="titlebar__btn titlebar__btn--close" onClick={() => window.electronAPI?.window?.close()} aria-label="关闭">
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" strokeWidth="1" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
