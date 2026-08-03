import { ThemeSettings } from './ThemeSettings'
import { useEffect, useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import './SettingsPage.scss'

export function SettingsPage() {
  const [version, setVersion] = useState<string>('0.1.0')
  const [appName, setAppName] = useState<string>('Lumina')

  // 数据源信息
  const [dbPath, setDbPath] = useState<string>('')
  const [myWxid, setMyWxid] = useState<string>('')
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    window.electronAPI?.app?.getVersion().then(setVersion).catch(() => {})
    window.electronAPI?.app?.getName().then(setAppName).catch(() => {})
    // 加载数据源配置
    window.electronAPI?.config?.get('dbPath').then((v) => setDbPath((v as string) || '')).catch(() => {})
    window.electronAPI?.config?.get('myWxid').then((v) => setMyWxid((v as string) || '')).catch(() => {})
  }, [])

  // 重新连接：清空 onboardingDone，AppLayout 会切换回 OnboardingPage
  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      await window.electronAPI?.config?.set('onboardingDone', false)
      // 通知 AppLayout 重新检测（通过 location reload 触发 AppLayout 重新挂载）
      window.location.reload()
    } catch {
      setReconnecting(false)
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">设置</h1>
      </header>

      <div className="settings-page__body">
        {/* 数据源 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">数据源</h3>
          <div className="settings-page__datasource">
            <div className="settings-page__datasource-row">
              <span className="settings-page__datasource-label">数据库路径</span>
              <span className="settings-page__datasource-value" title={dbPath}>
                {dbPath || '未连接'}
              </span>
            </div>
            <div className="settings-page__datasource-row">
              <span className="settings-page__datasource-label">当前账号</span>
              <span className="settings-page__datasource-value">{myWxid || '未连接'}</span>
            </div>
            <div className="settings-page__datasource-row">
              <span className="settings-page__datasource-label">连接状态</span>
              <span
                className={`settings-page__datasource-status ${
                  dbPath && myWxid ? 'settings-page__datasource-status--ok' : 'settings-page__datasource-status--off'
                }`}
              >
                {dbPath && myWxid ? '已连接' : '未连接'}
              </span>
            </div>
            <button
              className="settings-page__reconnect-btn"
              onClick={handleReconnect}
              disabled={reconnecting}
            >
              {reconnecting ? (
                <Loader2 size={14} className="settings-page__spinner" />
              ) : (
                <RefreshCw size={14} />
              )}
              <span>重新连接 / 切换账号</span>
            </button>
          </div>
        </section>

        {/* 主题 */}
        <ThemeSettings />

        {/* 应用锁 - 占位 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">应用锁</h3>
          <div className="settings-page__placeholder-row">
            <span className="settings-page__placeholder-text">密码锁与 Windows Hello（开发中）</span>
          </div>
        </section>

        {/* 多账号管理 - 占位 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">多账号管理</h3>
          <div className="settings-page__placeholder-row">
            <span className="settings-page__placeholder-text">扫描、切换、删除账号（开发中）</span>
          </div>
        </section>

        {/* 数据与缓存 - 占位 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">数据与缓存</h3>
          <div className="settings-page__placeholder-row">
            <span className="settings-page__placeholder-text">缓存管理、数据备份（开发中）</span>
          </div>
        </section>

        {/* 关于 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">关于</h3>
          <div className="settings-page__about">
            <div className="settings-page__about-row">
              <span>应用名称</span>
              <span>{appName}</span>
            </div>
            <div className="settings-page__about-row">
              <span>版本</span>
              <span>{version}</span>
            </div>
            <div className="settings-page__about-row">
              <span>作者</span>
              <span>MarkCKB</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
