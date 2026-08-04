import { useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw, ArrowRightLeft, Trash2, Database, CheckCircle2 } from 'lucide-react'
import './AccountManagementPage.scss'

interface WxidInfo {
  wxid: string
  displayName?: string
  avatarUrl?: string
  accountDir: string
  lastModified?: number
  current?: boolean
}

export function AccountManagementPage() {
  const [dbPath, setDbPath] = useState('')
  const [myWxid, setMyWxid] = useState('')
  const [accounts, setAccounts] = useState<WxidInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const path = (await window.electronAPI?.config?.get?.('dbPath')) as string | undefined
      const wxid = (await window.electronAPI?.config?.get?.('myWxid')) as string | undefined
      setDbPath(path || '')
      setMyWxid(wxid || '')
      if (path) {
        const res = await window.electronAPI?.dbpath?.scanWxids?.(path)
        const list = ((res as any)?.wxids ?? []) as WxidInfo[]
        setAccounts(list.map((a) => ({ ...a, current: a.wxid === wxid })))
      } else {
        setAccounts([])
      }
    } catch {
      setError('加载账号信息失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSwitch = useCallback(async (wxid: string) => {
    setActioning(wxid)
    try {
      await window.electronAPI?.chat?.close?.()
      await window.electronAPI?.config?.set?.('myWxid', wxid)
      // 切换后重新加载页面以重新初始化数据库连接
      window.location.reload()
    } catch {
      setError('切换账号失败')
      setActioning(null)
    }
  }, [])

  const handleDelete = useCallback(async (wxid: string) => {
    if (!wxid) return
    const ok = window.confirm(`确定要删除账号配置「${wxid}」吗？此操作不会删除本地数据文件。`)
    if (!ok) return
    setActioning(wxid)
    try {
      // 清除当前 myWxid 配置（保留 dbPath）
      await window.electronAPI?.config?.set?.('myWxid', '')
      await load()
    } catch {
      setError('删除配置失败')
    } finally {
      setActioning(null)
    }
  }, [load])

  return (
    <div className="account-mgmt">
      <header className="account-mgmt__header">
        <h2><Users size={20} /> 账号管理</h2>
        <button onClick={() => void load()} title="刷新">
          <RefreshCw size={15} /> 刷新
        </button>
      </header>

      <section className="account-mgmt__info">
        <div className="account-mgmt__info-row">
          <Database size={14} />
          <span className="account-mgmt__info-label">数据库路径</span>
          <span className="account-mgmt__info-value">{dbPath || '未配置'}</span>
        </div>
        <div className="account-mgmt__info-row">
          <CheckCircle2 size={14} />
          <span className="account-mgmt__info-label">当前账号</span>
          <span className="account-mgmt__info-value">{myWxid || '未选择'}</span>
        </div>
      </section>

      {error && <div className="account-mgmt__error">{error}</div>}

      {loading ? (
        <div className="account-mgmt__loading">加载中…</div>
      ) : accounts.length === 0 ? (
        <div className="account-mgmt__empty">{dbPath ? '未扫描到账号' : '请先在设置中配置数据库路径'}</div>
      ) : (
        <div className="account-mgmt__cards">
          {accounts.map((acc) => (
            <div key={acc.wxid} className={`account-mgmt__card ${acc.current ? 'account-mgmt__card--current' : ''}`}>
              <div className="account-mgmt__card-avatar">
                {acc.avatarUrl ? (
                  <img src={acc.avatarUrl} alt="" />
                ) : (
                  <Users size={22} />
                )}
              </div>
              <div className="account-mgmt__card-info">
                <span className="account-mgmt__card-name">{acc.displayName || acc.wxid}</span>
                <span className="account-mgmt__card-wxid">{acc.wxid}</span>
                {acc.current && <span className="account-mgmt__card-badge">当前</span>}
              </div>
              <div className="account-mgmt__card-actions">
                {!acc.current && (
                  <button
                    onClick={() => void handleSwitch(acc.wxid)}
                    disabled={actioning === acc.wxid}
                    title="切换到此账号"
                  >
                    <ArrowRightLeft size={13} /> 切换
                  </button>
                )}
                <button
                  className="account-mgmt__card-delete"
                  onClick={() => void handleDelete(acc.wxid)}
                  disabled={actioning === acc.wxid}
                  title="删除账号配置"
                >
                  <Trash2 size={13} /> 删除配置
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
