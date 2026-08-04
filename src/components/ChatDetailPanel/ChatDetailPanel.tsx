import { useEffect, useMemo, useState } from 'react'
import { X, Sparkles, Download, BarChart3, Shield, Image as ImageIcon, FileText, MapPin, Tag, MessageSquare } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import './ChatDetailPanel.scss'

interface ContactDetail {
  username?: string
  remark?: string
  nickname?: string
  region?: string
  labels?: string[]
  description?: string
  avatarUrl?: string
}

export function ChatDetailPanel() {
  const activeChatId = useUIStore((s) => s.activeChatId)
  const setDetailPanelOpen = useUIStore((s) => s.setDetailPanelOpen)
  const sessions = useChatStore((s) => s.sessions)
  const messagesBySession = useChatStore((s) => s.messagesBySession)

  const session = sessions.find((s) => s.id === activeChatId)
  const [contact, setContact] = useState<ContactDetail | null>(null)

  // 加载真实联系人资料（备注/昵称/地区/标签）
  useEffect(() => {
    setContact(null)
    if (!activeChatId || activeChatId.endsWith('@chatroom')) return
    let cancelled = false
    void window.electronAPI?.chat
      ?.getContact(activeChatId)
      .then((res: any) => {
        if (!cancelled && res) setContact(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeChatId])

  // 消息统计（基于已加载消息）
  const stats = useMemo(() => {
    const list = activeChatId ? messagesBySession[activeChatId] ?? [] : []
    const typeCounts: Record<string, number> = {}
    let sent = 0
    let received = 0
    const days = new Set<string>()
    for (const m of list) {
      typeCounts[m.type] = (typeCounts[m.type] || 0) + 1
      if (m.isMe) sent++
      else received++
      if (m.timestamp) {
        days.add(new Date(m.timestamp).toDateString())
      }
    }
    return { total: list.length, sent, received, activeDays: days.size, typeCounts }
  }, [activeChatId, messagesBySession])

  if (!session) {
    return null
  }

  const handleClose = () => setDetailPanelOpen(false)

  const typeRows: Array<[string, string]> = [
    ['text', '文本'],
    ['image', '图片'],
    ['voice', '语音'],
    ['video', '视频'],
    ['emoji', '表情'],
    ['file', '文件'],
    ['link', '链接'],
  ]

  return (
    <aside className="chat-detail">
      <header className="chat-detail__header">
        <h2 className="chat-detail__title">详情</h2>
        <button className="chat-detail__close" onClick={handleClose} aria-label="关闭">
          <X size={18} />
        </button>
      </header>

      <div className="chat-detail__body">
        {/* 联系人信息 */}
        <section className="chat-detail__section">
          <div className="chat-detail__profile">
            <div className="chat-detail__avatar" style={{ background: session.avatarColor }}>
              {session.avatarText}
            </div>
            <div className="chat-detail__profile-info">
              <div className="chat-detail__name">{session.name}</div>
              <div className="chat-detail__wxid">
                {session.isGroup
                  ? `群聊${session.memberCount ? ` · ${session.memberCount} 成员` : ''}`
                  : contact?.nickname || activeChatId}
              </div>
            </div>
          </div>
        </section>

        {/* 会话统计 */}
        <section className="chat-detail__section">
          <h3 className="chat-detail__section-title">会话统计（已加载）</h3>
          <div className="chat-detail__stats">
            <div className="chat-detail__stat">
              <MessageSquare size={16} />
              <span className="chat-detail__stat-label">消息总数</span>
              <span className="chat-detail__stat-value">{stats.total}</span>
            </div>
            <div className="chat-detail__stat">
              <FileText size={16} />
              <span className="chat-detail__stat-label">发送</span>
              <span className="chat-detail__stat-value">{stats.sent}</span>
            </div>
            <div className="chat-detail__stat">
              <ImageIcon size={16} />
              <span className="chat-detail__stat-label">接收</span>
              <span className="chat-detail__stat-value">{stats.received}</span>
            </div>
            <div className="chat-detail__stat">
              <BarChart3 size={16} />
              <span className="chat-detail__stat-label">活跃天数</span>
              <span className="chat-detail__stat-value">{stats.activeDays}</span>
            </div>
          </div>
          {/* 类型分布 */}
          <div className="chat-detail__type-dist">
            {typeRows.map(([key, label]) => (
              <div key={key} className="chat-detail__type-row">
                <span className="chat-detail__type-label">{label}</span>
                <div className="chat-detail__type-bar">
                  <span
                    className="chat-detail__type-bar-fill"
                    style={{
                      width: `${stats.total ? (stats.typeCounts[key] / stats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="chat-detail__type-count">{stats.typeCounts[key] || 0}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 基本信息 */}
        {!session.isGroup && (
          <section className="chat-detail__section">
            <h3 className="chat-detail__section-title">基本信息</h3>
            <div className="chat-detail__info-rows">
              <div className="chat-detail__info-row">
                <span className="chat-detail__info-label">备注</span>
                <span className="chat-detail__info-value">{contact?.remark || '—'}</span>
              </div>
              <div className="chat-detail__info-row">
                <span className="chat-detail__info-label">昵称</span>
                <span className="chat-detail__info-value">{contact?.nickname || '—'}</span>
              </div>
              <div className="chat-detail__info-row">
                <span className="chat-detail__info-label"><Tag size={12} /> 标签</span>
                <span className="chat-detail__info-value">
                  {contact?.labels?.length ? contact.labels.join('、') : '—'}
                </span>
              </div>
              <div className="chat-detail__info-row">
                <span className="chat-detail__info-label"><MapPin size={12} /> 地区</span>
                <span className="chat-detail__info-value">{contact?.region || '—'}</span>
              </div>
              {contact?.description && (
                <div className="chat-detail__info-row">
                  <span className="chat-detail__info-label">签名</span>
                  <span className="chat-detail__info-value">{contact.description}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 共同群聊 */}
        {!session.isGroup && (
          <section className="chat-detail__section">
            <h3 className="chat-detail__section-title">共同群聊</h3>
            <div className="chat-detail__info-rows">
              <span className="chat-detail__info-value">
                {session.commonGroupCount ? `${session.commonGroupCount} 个` : '—'}
              </span>
            </div>
          </section>
        )}

        {/* AI 分析入口 */}
        <section className="chat-detail__section">
          <h3 className="chat-detail__section-title">AI 分析</h3>
          <div className="chat-detail__actions">
            <button className="chat-detail__action-btn">
              <Sparkles size={18} />
              <span>生成画像</span>
            </button>
            <button className="chat-detail__action-btn">
              <BarChart3 size={18} />
              <span>对话分析</span>
            </button>
            <button className="chat-detail__action-btn">
              <Download size={18} />
              <span>导出记录</span>
            </button>
            <button className="chat-detail__action-btn">
              <Shield size={18} />
              <span>屏蔽会话</span>
            </button>
          </div>
        </section>
      </div>
    </aside>
  )
}
