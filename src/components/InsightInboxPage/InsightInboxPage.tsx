import { useState, useEffect, useCallback, useMemo } from 'react'
import { Sparkles, Search, MessageSquare, Loader2, ChevronRight, Filter, X } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import './InsightInboxPage.scss'

interface InsightRecord {
  id: string
  sessionId?: string
  sessionName?: string
  body?: string
  source?: string
  sentiment?: string
  intent?: string
  createdAt?: string
  read?: boolean
  metadata?: Record<string, unknown>
}

function formatTime(ts?: string | number): string {
  if (!ts) return ''
  const d = new Date(typeof ts === 'string' ? ts : ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

export function InsightInboxPage() {
  const [records, setRecords] = useState<InsightRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<InsightRecord | null>(null)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await window.electronAPI?.insight?.listRecords?.({ keyword: query || undefined })
      if (Array.isArray(res)) setRecords(res as InsightRecord[])
      else if ((res as any)?.success && Array.isArray((res as any)?.data)) setRecords((res as any).data)
      else setRecords([])
    } catch { setError('加载失败') }
    finally { setLoading(false) }
  }, [query])

  useEffect(() => { void loadRecords() }, [loadRecords])

  useEffect(() => {
    if (!detailId) { setDetail(null); return }
    window.electronAPI?.insight?.getRecord?.(detailId).then((res: any) => {
      if (res) { setDetail(res); void window.electronAPI?.insight?.markRecordRead?.(detailId) }
    }).catch(() => {})
  }, [detailId])

  // 注意：selector 必须返回稳定引用（sessions 数组本身），否则 zustand 每次
  // 渲染都产生新 Map → 无限重渲染（Maximum update depth exceeded）
  const sessions = useChatStore((s) => s.sessions)
  const sessionNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const sess of sessions) m.set(sess.id, sess.name)
    return m
  }, [sessions])

  return (
    <div className="insight-inbox">
      <header className="insight-inbox__header">
        <h2><Sparkles size={20} /> 灵感信箱</h2>
        <p>AI 自动生成的聊天见解与摘要</p>
      </header>

      <div className="insight-inbox__body">
        {/* 列表 */}
        <div className="insight-inbox__list">
          <div className="insight-inbox__search">
            <Search size={15} />
            <input
              placeholder="搜索见解…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void loadRecords()}
            />
            {query && <button onClick={() => { setQuery(''); void loadRecords() }}><X size={14} /></button>}
          </div>

          {loading ? (
            <div className="insight-inbox__loading"><Loader2 size={22} className="insight-inbox__spin" /> 加载中…</div>
          ) : error ? (
            <div className="insight-inbox__error">{error}</div>
          ) : records.length === 0 ? (
            <div className="insight-inbox__empty">暂无见解，AI 会定期为您的聊天生成洞察</div>
          ) : (
            records.map((r) => (
              <button
                key={r.id}
                className={`insight-inbox__card ${detailId === r.id ? 'insight-inbox__card--active' : ''} ${r.read ? '' : 'insight-inbox__card--unread'}`}
                onClick={() => setDetailId(r.id)}
              >
                <div className="insight-inbox__card-header">
                  <span className="insight-inbox__card-source">{r.source || 'AI 见解'}</span>
                  <span className="insight-inbox__card-time">{formatTime(r.createdAt)}</span>
                </div>
                <div className="insight-inbox__card-body">
                  {(r.body || '无内容').slice(0, 120)}
                </div>
                <div className="insight-inbox__card-foot">
                  {r.sessionId && (
                    <span className="insight-inbox__card-session">
                      <MessageSquare size={11} /> {sessionNameMap.get(r.sessionId) || r.sessionId}
                    </span>
                  )}
                  {r.sentiment && <span className={`insight-inbox__tag insight-inbox__tag--${r.sentiment}`}>{r.sentiment}</span>}
                  {r.intent && <span className="insight-inbox__tag">{r.intent}</span>}
                  <ChevronRight size={14} className="insight-inbox__card-arrow" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* 详情 */}
        {detail && (
          <div className="insight-inbox__detail">
            <div className="insight-inbox__detail-header">
              <h3>{detail.source || 'AI 见解详情'}</h3>
              <button onClick={() => setDetailId(null)}><X size={18} /></button>
            </div>
            <div className="insight-inbox__detail-body">
              <div className="insight-inbox__detail-meta">
                {detail.sentiment && <span className={`insight-inbox__tag insight-inbox__tag--${detail.sentiment}`}>{detail.sentiment}</span>}
                {detail.intent && <span className="insight-inbox__tag">{detail.intent}</span>}
                <span>{formatTime(detail.createdAt)}</span>
              </div>
              <div className="insight-inbox__detail-content">{detail.body || '无内容'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
