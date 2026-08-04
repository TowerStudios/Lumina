import { ThemeSettings } from './ThemeSettings'
import { useEffect, useState } from 'react'
import {
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  FlaskConical,
  Check,
  AlertCircle,
  Lock,
  Unlock,
  Fingerprint,
  Power,
  FileText,
  Trash2,
  FolderOpen,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
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

  // === 应用锁状态 ===
  const [lockEnabled, setLockEnabled] = useState(false)
  const [lockBusy, setLockBusy] = useState(false)
  const [lockError, setLockError] = useState('')
  const [lockMode, setLockMode] = useState<'idle' | 'enable' | 'disable' | 'change'>('idle')
  const [lockPassword, setLockPassword] = useState('')
  const [lockPasswordConfirm, setLockPasswordConfirm] = useState('')
  const [lockOldPassword, setLockOldPassword] = useState('')
  const [showLockPassword, setShowLockPassword] = useState(false)
  const [helloSupported, setHelloSupported] = useState(false)

  // === 开机自启 ===
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [launchBusy, setLaunchBusy] = useState(false)

  // === 日志查看 ===
  const [logContent, setLogContent] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logExpanded, setLogExpanded] = useState(false)
  const [logPath, setLogPath] = useState('')

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

    // 加载应用锁状态
    window.electronAPI?.auth?.verifyEnabled().then(setLockEnabled).catch(() => {})

    // 加载开机自启状态
    window.electronAPI?.appFeatures?.getLaunchAtStartupStatus().then((r) => {
      setLaunchAtStartup(!!r?.openAtLogin)
    }).catch(() => {})

    // 加载日志路径
    window.electronAPI?.log?.getPath().then(setLogPath).catch(() => {})

    // 检测 Windows Hello 是否可用（Windows 平台）
    setHelloSupported(window.electronAPI?.platform === 'win32')
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

  // === 应用锁操作 ===
  const resetLockForm = () => {
    setLockMode('idle')
    setLockPassword('')
    setLockPasswordConfirm('')
    setLockOldPassword('')
    setLockError('')
    setShowLockPassword(false)
  }

  const handleEnableLock = async () => {
    setLockError('')
    if (!lockPassword) {
      setLockError('请输入密码')
      return
    }
    if (lockPassword.length < 4) {
      setLockError('密码至少 4 位')
      return
    }
    if (lockPassword !== lockPasswordConfirm) {
      setLockError('两次输入的密码不一致')
      return
    }
    setLockBusy(true)
    try {
      const r = await window.electronAPI?.auth?.enableLock(lockPassword)
      if (r?.success) {
        setLockEnabled(true)
        resetLockForm()
      } else {
        setLockError(r?.error || '启用失败')
      }
    } catch (e) {
      setLockError(e instanceof Error ? e.message : String(e))
    } finally {
      setLockBusy(false)
    }
  }

  const handleDisableLock = async () => {
    setLockError('')
    if (!lockPassword) {
      setLockError('请输入密码以关闭应用锁')
      return
    }
    setLockBusy(true)
    try {
      const r = await window.electronAPI?.auth?.disableLock(lockPassword)
      if (r?.success) {
        setLockEnabled(false)
        resetLockForm()
      } else {
        setLockError(r?.error || '密码错误')
      }
    } catch (e) {
      setLockError(e instanceof Error ? e.message : String(e))
    } finally {
      setLockBusy(false)
    }
  }

  const handleChangePassword = async () => {
    setLockError('')
    if (!lockOldPassword || !lockPassword) {
      setLockError('请填写旧密码和新密码')
      return
    }
    if (lockPassword !== lockPasswordConfirm) {
      setLockError('两次输入的新密码不一致')
      return
    }
    setLockBusy(true)
    try {
      const r = await window.electronAPI?.auth?.changePassword(lockOldPassword, lockPassword)
      if (r?.success) {
        resetLockForm()
      } else {
        setLockError(r?.error || '修改失败，旧密码可能不正确')
      }
    } catch (e) {
      setLockError(e instanceof Error ? e.message : String(e))
    } finally {
      setLockBusy(false)
    }
  }

  const handleHelloUnlock = async () => {
    setLockError('')
    setLockBusy(true)
    try {
      const r = await window.electronAPI?.auth?.hello('通过 Windows Hello 解锁应用锁设置')
      if (!r?.success) {
        setLockError(r?.error || 'Windows Hello 验证失败')
      }
    } catch (e) {
      setLockError(e instanceof Error ? e.message : String(e))
    } finally {
      setLockBusy(false)
    }
  }

  // === 开机自启切换 ===
  const handleToggleLaunchAtStartup = async () => {
    setLaunchBusy(true)
    try {
      const r = await window.electronAPI?.appFeatures?.setLaunchAtStartup(!launchAtStartup)
      if (r?.success) {
        setLaunchAtStartup(!launchAtStartup)
      }
    } catch {
      // ignore
    } finally {
      setLaunchBusy(false)
    }
  }

  // === 日志操作 ===
  const handleLoadLog = async () => {
    setLogLoading(true)
    try {
      const r = await window.electronAPI?.log?.read()
      if (r?.success) {
        setLogContent(r.content || '(空)')
      } else {
        setLogContent(`加载失败: ${r?.error || '未知错误'}`)
      }
    } catch (e) {
      setLogContent(`加载异常: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLogLoading(false)
    }
  }

  const handleClearLog = async () => {
    if (!confirm('确定清空当前日志文件？此操作不可撤销。')) return
    try {
      const r = await window.electronAPI?.log?.clear()
      if (r?.success) {
        setLogContent('(已清空)')
      }
    } catch {
      // ignore
    }
  }

  const handleOpenLogFolder = async () => {
    if (!logPath) return
    // 提取目录部分
    const dir = logPath.includes('\\') ? logPath.substring(0, logPath.lastIndexOf('\\')) : logPath
    await window.electronAPI?.shell?.openPath(dir)
  }

  // 展开/收起日志时自动加载
  useEffect(() => {
    if (logExpanded && !logContent) {
      handleLoadLog()
    }
  }, [logExpanded])

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
                    <FlaskConical size={14} />
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

        {/* 应用锁 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">应用锁</h3>
          <div className="settings-page__lock">
            <div className="settings-page__lock-status-row">
              <span className="settings-page__datasource-label">状态</span>
              <span
                className={`settings-page__datasource-status ${
                  lockEnabled
                    ? 'settings-page__datasource-status--ok'
                    : 'settings-page__datasource-status--off'
                }`}
              >
                {lockEnabled ? '已启用' : '未启用'}
              </span>
            </div>

            {/* 未启用：显示启用表单 */}
            {!lockEnabled && lockMode === 'idle' && (
              <button
                className="settings-page__lock-btn settings-page__lock-btn--primary"
                onClick={() => setLockMode('enable')}
              >
                <Lock size={14} />
                <span>启用应用锁</span>
              </button>
            )}

            {/* 已启用：显示关闭/修改密码按钮 */}
            {lockEnabled && lockMode === 'idle' && (
              <div className="settings-page__lock-actions">
                <button
                  className="settings-page__lock-btn"
                  onClick={() => setLockMode('disable')}
                >
                  <Unlock size={14} />
                  <span>关闭应用锁</span>
                </button>
                <button
                  className="settings-page__lock-btn"
                  onClick={() => setLockMode('change')}
                >
                  <RefreshCw size={14} />
                  <span>修改密码</span>
                </button>
                {helloSupported && (
                  <button
                    className="settings-page__lock-btn"
                    onClick={handleHelloUnlock}
                    disabled={lockBusy}
                  >
                    <Fingerprint size={14} />
                    <span>Windows Hello 验证</span>
                  </button>
                )}
              </div>
            )}

            {/* 启用表单 */}
            {lockMode === 'enable' && (
              <div className="settings-page__lock-form">
                <div className="settings-page__lock-input-row">
                  <input
                    type={showLockPassword ? 'text' : 'password'}
                    className="settings-page__lock-input"
                    placeholder="设置密码（至少 4 位）"
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="settings-page__icon-btn"
                    onClick={() => setShowLockPassword((v) => !v)}
                  >
                    {showLockPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="settings-page__lock-input-row">
                  <input
                    type={showLockPassword ? 'text' : 'password'}
                    className="settings-page__lock-input"
                    placeholder="确认密码"
                    value={lockPasswordConfirm}
                    onChange={(e) => setLockPasswordConfirm(e.target.value)}
                  />
                </div>
                {lockError && (
                  <span className="settings-page__lock-error">
                    <AlertCircle size={12} />
                    {lockError}
                  </span>
                )}
                <div className="settings-page__lock-form-actions">
                  <button
                    className="settings-page__path-btn settings-page__path-btn--primary"
                    onClick={handleEnableLock}
                    disabled={lockBusy}
                  >
                    {lockBusy ? <Loader2 size={12} className="settings-page__spinner" /> : '启用'}
                  </button>
                  <button className="settings-page__path-btn" onClick={resetLockForm}>
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 关闭表单 */}
            {lockMode === 'disable' && (
              <div className="settings-page__lock-form">
                <div className="settings-page__lock-input-row">
                  <input
                    type={showLockPassword ? 'text' : 'password'}
                    className="settings-page__lock-input"
                    placeholder="输入当前密码以关闭应用锁"
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="settings-page__icon-btn"
                    onClick={() => setShowLockPassword((v) => !v)}
                  >
                    {showLockPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {lockError && (
                  <span className="settings-page__lock-error">
                    <AlertCircle size={12} />
                    {lockError}
                  </span>
                )}
                <div className="settings-page__lock-form-actions">
                  <button
                    className="settings-page__path-btn"
                    onClick={handleDisableLock}
                    disabled={lockBusy}
                  >
                    {lockBusy ? <Loader2 size={12} className="settings-page__spinner" /> : '确认关闭'}
                  </button>
                  <button className="settings-page__path-btn" onClick={resetLockForm}>
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 修改密码表单 */}
            {lockMode === 'change' && (
              <div className="settings-page__lock-form">
                <div className="settings-page__lock-input-row">
                  <input
                    type={showLockPassword ? 'text' : 'password'}
                    className="settings-page__lock-input"
                    placeholder="旧密码"
                    value={lockOldPassword}
                    onChange={(e) => setLockOldPassword(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="settings-page__lock-input-row">
                  <input
                    type={showLockPassword ? 'text' : 'password'}
                    className="settings-page__lock-input"
                    placeholder="新密码（至少 4 位）"
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                  />
                  <button
                    className="settings-page__icon-btn"
                    onClick={() => setShowLockPassword((v) => !v)}
                  >
                    {showLockPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="settings-page__lock-input-row">
                  <input
                    type={showLockPassword ? 'text' : 'password'}
                    className="settings-page__lock-input"
                    placeholder="确认新密码"
                    value={lockPasswordConfirm}
                    onChange={(e) => setLockPasswordConfirm(e.target.value)}
                  />
                </div>
                {lockError && (
                  <span className="settings-page__lock-error">
                    <AlertCircle size={12} />
                    {lockError}
                  </span>
                )}
                <div className="settings-page__lock-form-actions">
                  <button
                    className="settings-page__path-btn settings-page__path-btn--primary"
                    onClick={handleChangePassword}
                    disabled={lockBusy}
                  >
                    {lockBusy ? <Loader2 size={12} className="settings-page__spinner" /> : '修改'}
                  </button>
                  <button className="settings-page__path-btn" onClick={resetLockForm}>
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 通用 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">通用</h3>
          <div className="settings-page__general">
            {/* 开机自启 */}
            <div className="settings-page__toggle-row">
              <div className="settings-page__toggle-info">
                <Power size={16} />
                <div className="settings-page__toggle-text">
                  <span className="settings-page__toggle-title">开机自启</span>
                  <span className="settings-page__toggle-desc">系统启动时自动运行 Lumina</span>
                </div>
              </div>
              <button
                className={`settings-page__switch ${launchAtStartup ? 'settings-page__switch--on' : ''}`}
                onClick={handleToggleLaunchAtStartup}
                disabled={launchBusy}
                role="switch"
                aria-checked={launchAtStartup}
              >
                <span className="settings-page__switch-knob" />
              </button>
            </div>
          </div>
        </section>

        {/* 日志 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">日志</h3>
          <div className="settings-page__log">
            <button
              className="settings-page__log-header"
              onClick={() => setLogExpanded((v) => !v)}
            >
              {logExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FileText size={14} />
              <span>主进程日志</span>
              {logPath && <span className="settings-page__log-path" title={logPath}>{logPath}</span>}
            </button>
            {logExpanded && (
              <div className="settings-page__log-body">
                <div className="settings-page__log-actions">
                  <button
                    className="settings-page__path-btn"
                    onClick={handleLoadLog}
                    disabled={logLoading}
                  >
                    {logLoading ? <Loader2 size={12} className="settings-page__spinner" /> : <RefreshCw size={12} />}
                    刷新
                  </button>
                  <button className="settings-page__path-btn" onClick={handleClearLog}>
                    <Trash2 size={12} />
                    清空
                  </button>
                  <button
                    className="settings-page__path-btn"
                    onClick={handleOpenLogFolder}
                    disabled={!logPath}
                  >
                    <FolderOpen size={12} />
                    打开目录
                  </button>
                </div>
                <pre className="settings-page__log-content">{logContent || '(点击"刷新"加载日志)'}</pre>
              </div>
            )}
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

        {/* 应用锁 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">应用锁</h3>
          <div className="settings-page__placeholder-row">
            <span className="settings-page__placeholder-text">密码锁 + Windows Hello（auth IPC 已就绪，UI 待对接）</span>
          </div>
        </section>

        {/* 关于 */}
        <section className="settings-page__section">
          <h3 className="settings-page__section-title">关于</h3>
          <div className="settings-page__about">
            <div className="settings-page__about-row">
              <span>项目</span>
              <span>Lumina - 微信聊天记录查看器</span>
            </div>
            <div className="settings-page__about-row">
              <span>版本</span>
              <span>{version}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
