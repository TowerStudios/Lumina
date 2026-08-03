import { X, Sparkles, Download, BarChart3, Shield, Image as ImageIcon, FileText } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import './ChatDetailPanel.scss'

export function ChatDetailPanel() {
  const activeChatId = useUIStore((s) => s.activeChatId)
  const setDetailPanelOpen = useUIStore((s) => s.setDetailPanelOpen)
  const sessions = useChatStore((s) => s.sessions)

  const session = sessions.find((s) => s.id === activeChatId)

  if (!session) {
    return null
  }

  const handleClose = () => setDetailPanelOpen(false)

  return (
    <aside className="chat-detail">
      <header className="chat-detail__header">
        <h2 className="chat-detail__title">详情</h2>
        <button
          className="chat-detail__close"
          onClick={handleClose}
          aria-label="关闭"
        >
          <X size={18} />
        </button>
      </header>

      <div className="chat-detail__body">
        {/* 联系人信息 */}
        <section className="chat-detail__section">
          <div className="chat-detail__profile">
            <div
              className="chat-detail__avatar"
              style={{ background: session.avatarColor }}
            >
              {session.avatarText}
            </div>
            <div className="chat-detail__profile-info">
              <div className="chat-detail__name">{session.name}</div>
              <div className="chat-detail__wxid">
                {session.isGroup ? `群聊 · ${session.memberCount} 成员` : 'wxid_xxxx'}
              </div>
            </div>
          </div>
        </section>

        {/* 会话统计 */}
        <section className="chat-detail__section">
          <h3 className="chat-detail__section-title">会话统计</h3>
          <div className="chat-detail__stats">
            <div className="chat-detail__stat">
              <FileText size={16} />
              <span className="chat-detail__stat-label">消息总数</span>
              <span className="chat-detail__stat-value">{session.messageCount}</span>
            </div>
            <div className="chat-detail__stat">
              <ImageIcon size={16} />
              <span className="chat-detail__stat-label">媒体</span>
              <span className="chat-detail__stat-value">—</span>
            </div>
          </div>
        </section>

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

        {/* 基本信息占位 */}
        <section className="chat-detail__section">
          <h3 className="chat-detail__section-title">基本信息</h3>
          <div className="chat-detail__info-rows">
            <div className="chat-detail__info-row">
              <span className="chat-detail__info-label">备注</span>
              <span className="chat-detail__info-value">—</span>
            </div>
            <div className="chat-detail__info-row">
              <span className="chat-detail__info-label">标签</span>
              <span className="chat-detail__info-value">—</span>
            </div>
            <div className="chat-detail__info-row">
              <span className="chat-detail__info-label">地区</span>
              <span className="chat-detail__info-value">—</span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  )
}
