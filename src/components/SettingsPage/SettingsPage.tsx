import { ThemeSettings } from './ThemeSettings'
import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, Eye, EyeOff, FlaskTube, Check, AlertCircle } from 'lucide-react'
import './SettingsPage.scss'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export function SettingsPage() {
  const [version, setVersion] = useState<string>('0.1.0')
  const [appName, setAppName] = useState<string>('Lumina')

  // 数据源信息
  const [dbPath, setDbPath] = useState<string>('')
  const [myWxid, setMyWxid] = useState<string>('')
  const [decryptKey, setDecryptKey] = useState<string>('')
  const [reconnecting, setReconnecting] = useState(false)

  // 密钥展示控制
  const [showKey, setShowKey] = useState(false)

  // 测试连接状态
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 路径编辑
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState('')

  useEffect(() => {
    window.electronAPI?.app?.getVersion().then(setVersion).catch(() => {})
    window.electronAPI?.app?.getName().then(setAppName).catch(() => {})
    // 加载数据源配置
    window.electronAPI?.config
      ?.get('dbPath')
      .then((v) => setDbPath((v as string) || ''))
      .catch(() => {})
    window.electronAPI?.config
      ?.get('myWxid')
      .then((v) => setMyWxid((v as string) || ''))
      .catch(() => {})
    window.electronAPI?.config
      ?.get('decryptKey')
      .then((v) => setDecryptKey((v as string) || ''))
      .catch(() => {})
  }, [])

  // 脱敏展示密钥：只显示前 4 和后 4 位
  const maskedKey = decryptKey
    ? `${decryptKey.slice(0, 4)}${'•'.repeat(Math.max(0, decryptKey.length - 8))}${decryptKey.slice(-4)}`
    : ''

  // 重新连接：清空 onboardingDone，AppLayout 会切换回 OnboardingPage
  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      await window.electronAPI?.config?.set('onboardingDone', false)
      window.location.reload()
    } catch {
      setReconnecting(false)
    }
  }

  // 测试连接
  const handleTestConnection = async () => {
    if (!dbPath || !decryptKey || !myWxid) return
    setTestState('testing')
    setTestMessage('')
    try {
      const result = await window.electronAPI?.wcdb?.testConnection(dbPath, decryptKey, myWxid)
      if (result?.success) {
        setTestState('ok')
        setTestMessage('连接成功')
      } else {
        setTestState('fail')
        setTestMessage(result?.error || '连接失败')
      }
    } catch (e) {
      setTestState('fail')
      setTestMessage(e instanceof Error ? e.message : String(e))
    }
  }

  // 保存路径编辑
  const handleSavePath = async () => {
    const trimmed = pathInput.trim()
    if (!trimmed) return
    await window.electronAPI?.config?.set('dbPath', trimmed)
    setDbPath(trimmed)
    setEditingPath(false)
    setTestState('idle')
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
              {editingPath ? (
                <div className="settings-page__path-edit">
                  <input
                    className="settings-page__path-input"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    autoFocus
                  />
                  <button className="settings-page__path-btn settings-page__path-btn--primary" onClick={handleSavePath}>
                    保存
                  </button>
                  <button
                    className="settings-page__path-btn"
                    onClick={() => {
                      setEditingPath(false)
                      setPathInput('')
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="settings-page__datasource-value-wrap">
                  <span className="settings-page__datasource-value" title={dbPath}>
                    {dbPath || '未连接'}
                  </span>
                  {dbPath && (
                    <button
                      className="settings-page__link-btn"
                      onClick={() => {
                        setPathInput(dbPath)
                        setEditingPath(true)
                      }}
                    >
                      编辑
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="settings-page__datasource-row">
              <span className="settings-page__datasource-label">当前账号</span>
              <span className="settings-page__datasource-value">{myWxid || '未连接'}</span>
            </div>
            <div className="settings-page__datasource-row">
              <span className="settings-page__datasource-label">解密密钥</span>
              <div className="settings-page__key-wrap">
                <span className="settings-page__datasource-value settings-page__key-value">
                  {decryptKey ? (showKey ? decryptKey : maskedKey) : '未设置'}
                </span>
                {decryptKey && (
                  <button
                    className="settings-page__icon-btn"
                    onClick={() => setShowKey((v) => !v)}
                    title={showKey ? '隐藏' : '显示'}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
            <div className="settings-page__datasource-row">
              <span className="settings-page__datasource-label">连接状态</span>
              <span
                className={`settings-page__datasource-status ${
                  dbPath && myWxid
                    ? 'settings-page__datasource-status--ok'
                    : 'settings-page__datasource-status--off'
                }`}
              >
                {dbPath && myWxid ? '已连接' : '未连接'}
              </span>
            </div>

            {/* 测试连接 */}
            {dbPath && decryptKey && myWxid && (
              <div className="settings-page__test-row">
                <button
                  className="settings-page__test-btn"
                  onClick={handleTestConnection}
                  disabled={testState === 'testing'}
                >
                  {testState === 'testing' ? (
                    <Loader2 size={14} className="settings-page__spinner" />
                  ) : (
                    <FlaskTube size={14} />
                  )}
                  <span>测试连接</span>
                </button>
                {testState === 'ok' && (
                  <span className="settings-page__test-result settings-page__test-result--ok">
                    <Check size={14} />
                    {testMessage}
                  </span>
                )}
                {testState === 'fail' && (
                  <span className="settings-page__test-result settings-page__test-result--fail">
                    <AlertCircle size={14} />
                    {testMessage}
                  </span>
                )}
              </div>
            )}

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
