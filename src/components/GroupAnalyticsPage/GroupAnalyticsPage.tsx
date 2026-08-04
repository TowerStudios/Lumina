import { useState, useEffect, useCallback } from 'react'
import { Users, Search, BarChart3, Clock, Loader2, RefreshCw } from 'lucide-react'
import './GroupAnalyticsPage.scss'

interface GroupChat {
  id: string
  name?: string
  roomId?: string
  memberCount?: number
}

interface MemberRanking {
  wxid?: string
  memberId?: string
  displayName?: string
  nickname?: string
  messageCount?: number
}

interface ActiveHours {
  hourlyDistribution?: Record<number, number>
  [k: string]: unknown
}

export function GroupAnalyticsPage() {
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRanking[]>([])
  const [activeHours, setActiveHours] = useState<ActiveHours | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await window.electronAPI?.groupAnalytics?.getGroupChats?.()
      const list = (res as any)?.groups ?? (res as any)?.data ?? (Array.isArray(res) ? res : [])
      setGroups(list as GroupChat[])
    } catch {
      setError('加载群聊列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const loadDetail = useCallback(async (groupId: string) => {
    setDetailLoading(true)
    try {
      const [m, h] = await Promise.all([
        window.electronAPI?.groupAnalytics?.getGroupMembers?.(groupId),
        window.electronAPI?.groupAnalytics?.getGroupActiveHours?.(groupId),
      ])
      const mRes = m as any
      setMembers(mRes?.members ?? mRes?.data ?? (Array.isArray(mRes) ? mRes : []))
      const hRes = h as any
      setActiveHours(hRes?.data ?? hRes ?? null)
    } catch {
      setMembers([])
      setActiveHours(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const filtered = groups.filter(
    (g) => (g.name || g.roomId || '').toLowerCase().includes(query.toLowerCase()),
  )

  const maxMemberCount = Math.max(1, ...members.map((m) => m.messageCount ?? 0))
  const maxHourCount = Math.max(1, ...Object.values(activeHours?.hourlyDistribution ?? {}))
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="group-analytics">
      <header className="group-analytics__header">
        <h2><Users size={20} /> 群聊分析</h2>
        <button onClick={() => void loadGroups()} title="刷新">
          <RefreshCw size={15} /> 刷新
        </button>
      </header>

      <div className="group-analytics__body">
        <aside className="group-analytics__sidebar">
          <div className="group-analytics__search">
            <Search size={15} />
            <input
              placeholder="搜索群聊…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="group-analytics__loading"><Loader2 size={20} className="group-analytics__spin" /> 加载中…</div>
          ) : error ? (
            <div className="group-analytics__error">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="group-analytics__empty">暂无群聊</div>
          ) : (
            <div className="group-analytics__group-list">
              {filtered.map((g) => (
                <button
                  key={g.id || g.roomId}
                  className={`group-analytics__group-item ${selectedId === (g.id || g.roomId) ? 'group-analytics__group-item--active' : ''}`}
                  onClick={() => setSelectedId(g.id || g.roomId || null)}
                >
                  <span className="group-analytics__group-name">{g.name || g.roomId || '未命名群'}</span>
                  {g.memberCount != null && (
                    <span className="group-analytics__group-count">{g.memberCount}人</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="group-analytics__main">
          {!selectedId ? (
            <div className="group-analytics__placeholder">请选择左侧群聊查看分析</div>
          ) : detailLoading ? (
            <div className="group-analytics__loading"><Loader2 size={22} className="group-analytics__spin" /> 加载中…</div>
          ) : (
            <>
              <section className="group-analytics__section">
                <h3><BarChart3 size={15} /> 成员发言排行 Top 20</h3>
                {members.length === 0 ? (
                  <div className="group-analytics__empty">暂无数据</div>
                ) : (
                  <div className="group-analytics__ranking">
                    {members.slice(0, 20).map((m, i) => {
                      const count = m.messageCount ?? 0
                      return (
                        <div key={m.wxid || m.memberId || i} className="group-analytics__rank-row">
                          <span className="group-analytics__rank-no">#{i + 1}</span>
                          <span className="group-analytics__rank-name">{m.displayName || m.nickname || m.wxid || '未知'}</span>
                          <span className="group-analytics__rank-bar">
                            <span
                              className="group-analytics__rank-bar-fill"
                              style={{ width: `${(count / maxMemberCount) * 100}%` }}
                            />
                          </span>
                          <span className="group-analytics__rank-count">{count.toLocaleString()}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="group-analytics__section">
                <h3><Clock size={15} /> 24 小时活跃时段</h3>
                <div className="group-analytics__hours">
                  {hours.map((h) => {
                    const count = activeHours?.hourlyDistribution?.[h] ?? 0
                    return (
                      <div key={h} className="group-analytics__hour-cell" title={`${h}:00 · ${count}条`}>
                        <div className="group-analytics__hour-bar">
                          <span
                            className="group-analytics__hour-bar-fill"
                            style={{ height: `${(count / maxHourCount) * 100}%` }}
                          />
                        </div>
                        <span className="group-analytics__hour-label">{h}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
