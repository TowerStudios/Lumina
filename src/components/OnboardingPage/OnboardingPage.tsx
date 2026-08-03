import { useEffect, useState } from 'react'
import {
  Database,
  FolderOpen,
  Users,
  Key,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Zap,
  FileText,
} from 'lucide-react'
import './OnboardingPage.scss'

// === 后端返回类型（与 dbPathService / ScanWxidsResult 对齐） ===
interface WxidInfo {
  wxid: string
  displayName?: string
  nickname?: string
  avatarUrl?: string
  accountDir: string
  lastModified?: number
}

interface OnboardingPageProps {
  /** 连接成功后回调，AppLayout 用于刷新 onboarding 状态 */
  onComplete?: () => void
}

type Step = 'path' | 'account' | 'key'

/**
 * Onboarding 引导页
 *
 * 流程（参考 WeFlow Onboarding + TG intro 简化）：
 *   1. 数据目录：autoDetect 自动填入，可手动选择
 *   2. 微信账号：scanWxids 扫描，列表选择
 *   3. 解密密钥：手动输入 hexKey → testConnection → wcdb.open
 *
 * 成功后 config.onboardingDone 会被主进程置为 true，并回调 onComplete。
 */
export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState<Step>('path')

  // 步骤 1 状态
  const [dbPath, setDbPath] = useState('')
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [pathError, setPathError] = useState('')

  // 步骤 2 状态
  const [wxids, setWxids] = useState<WxidInfo[]>([])
  const [scanning, setScanning] = useState(false)
  const [selectedWxid, setSelectedWxid] = useState<WxidInfo | null>(null)
  const [scanError, setScanError] = useState('')

  // 步骤 3 状态
  const [hexKey, setHexKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [testOk, setTestOk] = useState(false)
  // 自动获取密钥状态
  const [autoFetching, setAutoFetching] = useState(false)
  const [autoFetchLogs, setAutoFetchLogs] = useState<{ message: string; level: number }[]>([])

  // === 步骤 1：自动检测数据目录 ===
  useEffect(() => {
    void detectPath()
  }, [])

  async function detectPath() {
    setAutoDetecting(true)
    setPathError('')
    try {
      const result = await window.electronAPI?.dbpath?.autoDetect()
      if (result?.success && result.path) {
        setDbPath(result.path)
      } else if (result?.error) {
        setPathError(result.error)
      }
    } catch (e) {
      setPathError(e instanceof Error ? e.message : String(e))
    } finally {
      setAutoDetecting(false)
    }
  }

  async function choosePathManually() {
    setPathError('')
    try {
      const result = await window.electronAPI?.dialog?.openDirectory({
        title: '选择微信数据目录（xwechat_files）',
        properties: ['openDirectory'],
      })
      if (result && !result.canceled && result.filePaths.length > 0) {
        setDbPath(result.filePaths[0])
      }
    } catch (e) {
      setPathError(e instanceof Error ? e.message : String(e))
    }
  }

  // === 步骤 1 → 2：扫描 wxid ===
  async function goToAccountStep() {
    if (!dbPath.trim()) {
      setPathError('请先选择数据目录')
      return
    }
    setStep('account')
    await scanWxids(dbPath)
  }

  async function scanWxids(path: string) {
    setScanning(true)
    setScanError('')
    setWxids([])
    setSelectedWxid(null)
    try {
      const result = await window.electronAPI?.dbpath?.scanWxids(path)
      const list = result?.success ? (result.wxids ?? []) : []
      if (Array.isArray(list) && list.length > 0) {
        // 按修改时间倒序（最近使用的在前）
        const sorted = [...list].sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0))
        setWxids(sorted)
      } else {
        setScanError('未在该目录下扫描到微信账号，请确认目录正确')
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  // === 步骤 2 → 3：选择账号 ===
  function selectAccount(info: WxidInfo) {
    setSelectedWxid(info)
    setStep('key')
    setKeyError('')
    setTestOk(false)
  }

  // === 步骤 3：测试连接 ===
  async function testConnection() {
    if (!selectedWxid || !hexKey.trim()) {
      setKeyError('请输入解密密钥')
      return
    }
    setTesting(true)
    setKeyError('')
    setTestOk(false)
    try {
      const result = await window.electronAPI?.wcdb?.testConnection(
        dbPath,
        hexKey.trim(),
        selectedWxid.wxid
      )
      if (result?.success) {
        setTestOk(true)
      } else {
        setKeyError(result?.error || '连接测试失败，请检查密钥')
      }
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  // === 步骤 3：自动获取密钥 ===
  // 调用 keyService.autoGetDbKey，通过 hook 微信进程内存提取
  // 前置条件：微信已启动并登录
  async function autoFetchKey() {
    setAutoFetching(true)
    setAutoFetchLogs([])
    setKeyError('')
    setTestOk(false)
    // 订阅进度推送
    const unsubscribe = window.electronAPI?.key?.onDbKeyStatus((payload) => {
      setAutoFetchLogs((prev) => [...prev, payload])
    })
    try {
      const result = await window.electronAPI?.key?.autoGetDbKey()
      if (result?.success && result.key) {
        setHexKey(result.key)
        setKeyError('')
      } else {
        setKeyError(result?.error || '自动获取失败，请确认微信已启动并登录')
      }
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : String(e))
    } finally {
      unsubscribe?.()
      setAutoFetching(false)
    }
  }

  // 打开主进程日志文件（用系统默认编辑器）
  async function openLogFile() {
    try {
      const logPath = await window.electronAPI?.app?.getLogPath()
      if (logPath) {
        await window.electronAPI?.shell?.openPath(logPath)
      }
    } catch (e) {
      console.error('打开日志失败:', e)
    }
  }

  // === 步骤 3：确认连接 ===
  async function connect() {
    if (!selectedWxid) return
    if (!testOk) {
      setKeyError('请先测试连接')
      return
    }
    setConnecting(true)
    setKeyError('')
    try {
      const result = await window.electronAPI?.wcdb?.open(
        dbPath,
        hexKey.trim(),
        selectedWxid.wxid
      )
      if (result?.success) {
        onComplete?.()
      } else {
        setKeyError(result?.error || '连接失败')
      }
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : String(e))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <div className="onboarding__brand">
          <Database size={40} strokeWidth={1.5} />
          <h1 className="onboarding__title">Lumina</h1>
          <p className="onboarding__subtitle">连接微信本地数据库以开始</p>
        </div>

        <Stepper current={step} />

        {step === 'path' && (
          <PathStep
            dbPath={dbPath}
            autoDetecting={autoDetecting}
            pathError={pathError}
            onAutoDetect={detectPath}
            onChooseManually={choosePathManually}
            onDbPathChange={(v) => {
              setDbPath(v)
              setPathError('')
            }}
            onNext={goToAccountStep}
          />
        )}

        {step === 'account' && (
          <AccountStep
            wxids={wxids}
            scanning={scanning}
            scanError={scanError}
            selectedWxid={selectedWxid}
            onSelect={selectAccount}
            onRescan={() => scanWxids(dbPath)}
            onBack={() => setStep('path')}
          />
        )}

        {step === 'key' && selectedWxid && (
          <KeyStep
            hexKey={hexKey}
            onHexKeyChange={(v) => {
              setHexKey(v)
              setTestOk(false)
              setKeyError('')
            }}
            testing={testing}
            testOk={testOk}
            keyError={keyError}
            connecting={connecting}
            selectedWxid={selectedWxid}
            autoFetching={autoFetching}
            autoFetchLogs={autoFetchLogs}
            onAutoFetch={autoFetchKey}
            onOpenLog={openLogFile}
            onTest={testConnection}
            onConnect={connect}
            onBack={() => setStep('account')}
          />
        )}
      </div>
    </div>
  )
}

// === 步骤指示器 ===
function Stepper({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'path', label: '数据目录' },
    { key: 'account', label: '选择账号' },
    { key: 'key', label: '解密密钥' },
  ]
  const currentIdx = steps.findIndex((s) => s.key === current)
  return (
    <div className="onboarding__stepper">
      {steps.map((s, idx) => (
        <div
          key={s.key}
          className={`onboarding__step-dot ${
            idx < currentIdx
              ? 'onboarding__step-dot--done'
              : idx === currentIdx
              ? 'onboarding__step-dot--active'
              : ''
          }`}
        >
          <span className="onboarding__step-num">
            {idx < currentIdx ? <Check size={12} /> : idx + 1}
          </span>
          <span className="onboarding__step-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

// === 步骤 1：数据目录 ===
function PathStep({
  dbPath,
  autoDetecting,
  pathError,
  onAutoDetect,
  onChooseManually,
  onDbPathChange,
  onNext,
}: {
  dbPath: string
  autoDetecting: boolean
  pathError: string
  onAutoDetect: () => void
  onChooseManually: () => void
  onDbPathChange: (v: string) => void
  onNext: () => void
}) {
  return (
    <div className="onboarding__step">
      <label className="onboarding__field-label">微信数据目录</label>
      <div className="onboarding__input-row">
        <input
          className="onboarding__input"
          value={dbPath}
          onChange={(e) => onDbPathChange(e.target.value)}
          placeholder="可粘贴路径，例如：C:\Users\<用户名>\Documents\xwechat_files"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="onboarding__btn onboarding__btn--icon"
          onClick={onChooseManually}
          title="浏览选择目录"
        >
          <FolderOpen size={16} />
        </button>
      </div>

      {pathError && (
        <div className="onboarding__hint onboarding__hint--error">
          <AlertCircle size={13} />
          <span>{pathError}</span>
        </div>
      )}

      <button
        className="onboarding__btn onboarding__btn--ghost"
        onClick={onAutoDetect}
        disabled={autoDetecting}
      >
        {autoDetecting ? (
          <Loader2 size={14} className="onboarding__spinner" />
        ) : (
          <RefreshCw size={14} />
        )}
        <span>自动检测</span>
      </button>

      <div className="onboarding__actions">
        <button
          className="onboarding__btn onboarding__btn--primary"
          onClick={onNext}
          disabled={!dbPath.trim()}
        >
          <span>下一步</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

// === 步骤 2：选择账号 ===
function AccountStep({
  wxids,
  scanning,
  scanError,
  selectedWxid,
  onSelect,
  onRescan,
  onBack,
}: {
  wxids: WxidInfo[]
  scanning: boolean
  scanError: string
  selectedWxid: WxidInfo | null
  onSelect: (info: WxidInfo) => void
  onRescan: () => void
  onBack: () => void
}) {
  return (
    <div className="onboarding__step">
      <label className="onboarding__field-label">检测到的微信账号</label>

      {scanning && (
        <div className="onboarding__hint">
          <Loader2 size={13} className="onboarding__spinner" />
          <span>扫描中…</span>
        </div>
      )}

      {scanError && !scanning && (
        <div className="onboarding__hint onboarding__hint--error">
          <AlertCircle size={13} />
          <span>{scanError}</span>
        </div>
      )}

      <div className="onboarding__account-list">
        {wxids.map((info) => {
          const active = selectedWxid?.wxid === info.wxid
          return (
            <button
              key={info.wxid}
              className={`onboarding__account-item ${active ? 'onboarding__account-item--active' : ''}`}
              onClick={() => onSelect(info)}
            >
              <div className="onboarding__account-avatar">
                {info.avatarUrl ? (
                  <img src={info.avatarUrl} alt={info.nickname || info.wxid} />
                ) : (
                  <Users size={20} />
                )}
              </div>
              <div className="onboarding__account-info">
                <div className="onboarding__account-name">
                  {info.nickname || info.wxid}
                </div>
                <div className="onboarding__account-wxid">{info.wxid}</div>
              </div>
              {active && <Check size={16} className="onboarding__account-check" />}
            </button>
          )
        })}
      </div>

      <button
        className="onboarding__btn onboarding__btn--ghost"
        onClick={onRescan}
        disabled={scanning}
      >
        <RefreshCw size={14} />
        <span>重新扫描</span>
      </button>

      <div className="onboarding__actions onboarding__actions--between">
        <button className="onboarding__btn onboarding__btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>上一步</span>
        </button>
      </div>
    </div>
  )
}

// === 步骤 3：解密密钥 ===
function KeyStep({
  hexKey,
  onHexKeyChange,
  testing,
  testOk,
  keyError,
  connecting,
  selectedWxid,
  autoFetching,
  autoFetchLogs,
  onAutoFetch,
  onOpenLog,
  onTest,
  onConnect,
  onBack,
}: {
  hexKey: string
  onHexKeyChange: (v: string) => void
  testing: boolean
  testOk: boolean
  keyError: string
  connecting: boolean
  selectedWxid: WxidInfo
  autoFetching: boolean
  autoFetchLogs: { message: string; level: number }[]
  onAutoFetch: () => void
  onOpenLog: () => void
  onTest: () => void
  onConnect: () => void
  onBack: () => void
}) {
  return (
    <div className="onboarding__step">
      <div className="onboarding__account-summary">
        <Key size={14} />
        <span>为账号 </span>
        <strong>{selectedWxid.nickname || selectedWxid.wxid}</strong>
        <span> 输入或自动获取解密密钥</span>
      </div>

      <label className="onboarding__field-label">数据库解密密钥（64 位 Hex）</label>
      <input
        className="onboarding__input"
        type="text"
        value={hexKey}
        onChange={(e) => onHexKeyChange(e.target.value)}
        placeholder="可手动粘贴 64 位十六进制密钥，或点击下方自动获取"
        spellCheck={false}
        autoComplete="off"
      />

      {/* 自动获取按钮 */}
      <button
        className="onboarding__btn onboarding__btn--accent"
        onClick={onAutoFetch}
        disabled={autoFetching}
      >
        {autoFetching ? (
          <Loader2 size={14} className="onboarding__spinner" />
        ) : (
          <Zap size={14} />
        )}
        <span>{autoFetching ? '正在自动获取…' : '自动获取密钥（需微信已登录）'}</span>
      </button>

      {/* 自动获取进度日志 */}
      {autoFetchLogs.length > 0 && (
        <div className="onboarding__logs">
          {autoFetchLogs.map((log, idx) => (
            <div
              key={idx}
              className={`onboarding__log-line onboarding__log-line--level-${log.level}`}
            >
              {log.message}
            </div>
          ))}
        </div>
      )}

      <div className="onboarding__hint onboarding__hint--muted">
        自动获取需微信已启动并登录；也可手动粘贴已知密钥。
      </div>

      {keyError && (
        <div className="onboarding__hint onboarding__hint--error">
          <AlertCircle size={13} />
          <span>{keyError}</span>
          <button className="onboarding__log-btn" onClick={onOpenLog} title="打开主进程日志文件">
            <FileText size={12} />
            <span>查看日志</span>
          </button>
        </div>
      )}
      {testOk && !keyError && (
        <div className="onboarding__hint onboarding__hint--success">
          <Check size={13} />
          <span>连接测试成功</span>
        </div>
      )}

      <button
        className="onboarding__btn onboarding__btn--ghost"
        onClick={onTest}
        disabled={testing || !hexKey.trim()}
      >
        {testing ? (
          <Loader2 size={14} className="onboarding__spinner" />
        ) : (
          <Database size={14} />
        )}
        <span>测试连接</span>
      </button>

      <div className="onboarding__actions onboarding__actions--between">
        <button className="onboarding__btn onboarding__btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>上一步</span>
        </button>
        <button
          className="onboarding__btn onboarding__btn--primary"
          onClick={onConnect}
          disabled={!testOk || connecting}
        >
          {connecting ? (
            <Loader2 size={16} className="onboarding__spinner" />
          ) : (
            <Database size={16} />
          )}
          <span>连接数据库</span>
        </button>
      </div>
    </div>
  )
}
