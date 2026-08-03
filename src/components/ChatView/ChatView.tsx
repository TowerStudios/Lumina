import { useEffect, useMemo, useRef } from 'react'
import {
  ChevronLeft,
  MoreVertical,
  PanelRightOpen,
  CheckCheck,
  Check,
  Clock,
  Loader2,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { groupMessages, type GroupedMessage } from '@/services/messageGrouping'
import { formatMessageTime, formatDateSeparator } from '@/services/timeFormat'
import type { RenderMessage, RenderSession } from '@/services/chatAdapter'
import './ChatView.scss'

interface ChatViewProps {
  showBackButton?: boolean
  onBack?: () => void
}

export function ChatView({ showBackButton, onBack }: ChatViewProps) {
  const activeChatId = useUIStore((s) => s.activeChatId)
  const setActiveChatId = useUIStore((s) => s.setActiveChatId)
  const setDetailPanelOpen = useUIStore((s) => s.setDetailPanelOpen)

  const sessions = useChatStore((s) => s.sessions)
  const messagesBySession = useChatStore((s) => s.messagesBySession)
  const messagesLoading = useChatStore((s) =>
    activeChatId ? s.messagesLoading[activeChatId] : false
  )
  const messagesError = useChatStore((s) =>
    activeChatId ? s.messagesError[activeChatId] : ''
  )
  const loadMessages = useChatStore((s) => s.loadMessages)
  const hasMore = useChatStore((s) =>
    activeChatId ? s.hasMoreBySession[activeChatId] ?? false : false
  )
  const loadingMore = useChatStore((s) =>
    activeChatId ? s.loadingMoreBySession[activeChatId] ?? false : false
  )
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // 跟踪已加载过的会话，防止空会话（0 条消息）触发无限重载
  const loadedSessionsRef = useRef<Set<string>>(new Set())
  // 防止上拉加载重复触发
  const loadingMoreRef = useRef(false)
  // 加载更多前保存 scrollHeight，用于加载后恢复滚动位置
  const prevScrollHeightRef = useRef(0)

  const session: RenderSession | undefined = useMemo(
    () => sessions.find((s) => s.id === activeChatId),
    [sessions, activeChatId]
  )

  const messages: RenderMessage[] = useMemo(
    () => (activeChatId ? messagesBySession[activeChatId] ?? [] : []),
    [messagesBySession, activeChatId]
  )

  // 按时间升序（最早在上，最新在下 - TG 风格）
  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  )

  const grouped = useMemo(
    () => groupMessages(orderedMessages, formatDateSeparator),
    [orderedMessages]
  )

  // 切换会话或首次进入：加载消息
  // 使用 ref 跟踪已加载会话，避免空会话（消息数为 0）时 messages.length===0
  // 条件持续成立导致无限重载。重试由用户点击重试按钮触发，不经过此 effect。
  useEffect(() => {
    if (!activeChatId || messagesLoading || messagesError) return
    if (loadedSessionsRef.current.has(activeChatId)) return
    loadedSessionsRef.current.add(activeChatId)
    loadMessages(activeChatId, 50)
  }, [activeChatId, messagesLoading, messagesError, loadMessages])

  // 滚动到底部（仅切换会话时，加载更多不触发）
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChatId])

  // 上拉加载更多：检测滚动到顶部时加载历史消息
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !activeChatId) return

    const handleScroll = async () => {
      // 距离顶部 50px 以内、还有更多、未在加载中
      if (container.scrollTop < 50 && hasMore && !loadingMoreRef.current) {
        loadingMoreRef.current = true
        prevScrollHeightRef.current = container.scrollHeight
        await loadMoreMessages(activeChatId, messages.length, 50)
        loadingMoreRef.current = false
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activeChatId, hasMore, messages.length, loadMoreMessages])

  // 加载更多完成后恢复滚动位置（避免跳到底部）
  useEffect(() => {
    if (!loadingMore && prevScrollHeightRef.current > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      const newScrollHeight = container.scrollHeight
      const diff = newScrollHeight - prevScrollHeightRef.current
      if (diff > 0) {
        container.scrollTop = diff
      }
      prevScrollHeightRef.current = 0
    }
  }, [loadingMore, messages.length])

  if (!session || !activeChatId) {
    return (
      <div className="chat-view chat-view--empty">
        <div className="chat-view__empty-content">
          <p>选择一个会话开始查看消息</p>
        </div>
      </div>
    )
  }

  const handleBack = () => {
    setActiveChatId(null)
    onBack?.()
  }

  return (
    <div className="chat-view">
      <header className="chat-view__header">
        {showBackButton && (
          <button className="chat-view__back" onClick={handleBack} aria-label="返回">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="chat-view__avatar-wrap">
          {session.avatarUrl ? (
            <img className="chat-view__avatar-img" src={session.avatarUrl} alt={session.name} />
          ) : (
            <div
              className="chat-view__avatar chat-view__avatar--text"
              style={{ background: session.avatarColor }}
            >
              {session.avatarText}
            </div>
          )}
        </div>
        <div className="chat-view__info">
          <div className="chat-view__name">{session.name}</div>
          <div className="chat-view__status">
            {session.isGroup ? `${session.memberCount ?? 0} 名成员` : '最后在线'}
          </div>
        </div>
        <button
          className="chat-view__action"
          onClick={() => setDetailPanelOpen(true)}
          aria-label="详情"
          title="详情面板"
        >
          <PanelRightOpen size={18} />
        </button>
        <button className="chat-view__action" aria-label="更多">
          <MoreVertical size={18} />
        </button>
      </header>

      <div className="chat-view__messages" ref={messagesContainerRef}>
        {loadingMore && (
          <div className="chat-view__load-more">
            <Loader2 size={16} className="chat-view__spinner" />
            <span>加载更多…</span>
          </div>
        )}
        {messagesLoading && messages.length === 0 && (
          <div className="chat-view__loading">
            <Loader2 size={24} className="chat-view__spinner" />
            <span>加载消息中…</span>
          </div>
        )}
        {messagesError && messages.length === 0 && (
          <div className="chat-view__loading chat-view__loading--error">
            <span>消息加载失败</span>
            <button onClick={() => loadMessages(activeChatId, 50)}>重试</button>
          </div>
        )}
        <MessageList grouped={grouped} session={session} />
        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-view__input-bar">
        <div className="chat-view__input-hint">
          只读模式 · 此工具用于查看历史消息，不支持发送
        </div>
      </footer>
    </div>
  )
}

// === 消息列表 ===
function MessageList({
  grouped,
  session,
}: {
  grouped: GroupedMessage[]
  session: RenderSession
}) {
  return (
    <div className="message-list">
      {grouped.map((item, idx) => (
        <MessageRow
          key={`${item.message.id}-${idx}`}
          item={item}
          sessionAvatarColor={session.avatarColor}
          sessionAvatarText={session.avatarText}
          sessionAvatarUrl={session.avatarUrl}
        />
      ))}
    </div>
  )
}

// === 单条消息行 ===
function MessageRow({
  item,
  sessionAvatarColor,
  sessionAvatarText,
  sessionAvatarUrl,
}: {
  item: GroupedMessage
  sessionAvatarColor: string
  sessionAvatarText: string
  sessionAvatarUrl?: string
}) {
  const {
    message: msg,
    position,
    showSender,
    showAvatar,
    showDateSeparator,
    dateSeparatorText,
  } = item

  // 自己撤回：不展示
  if (msg.isRecalled && msg.isMe) return null

  // 对方撤回：居中显示
  if (msg.isRecalled && !msg.isMe) {
    return (
      <>
        {showDateSeparator && (
          <div className="message-list__date-sep">
            <span>{dateSeparatorText}</span>
          </div>
        )}
        <div className="message-item message-item--recall">
          <span className="message-item__recall-text">
            {msg.senderName} 撤回了一条消息
          </span>
        </div>
      </>
    )
  }

  // 系统消息：居中
  if (msg.type === 'system') {
    return (
      <>
        {showDateSeparator && (
          <div className="message-list__date-sep">
            <span>{dateSeparatorText}</span>
          </div>
        )}
        <div className="message-item message-item--system">
          <span className="message-item__system-text">{msg.content}</span>
        </div>
      </>
    )
  }

  const isOut = msg.isMe
  const positionClass = `message-item--pos-${position}`

  return (
    <>
      {showDateSeparator && (
        <div className="message-list__date-sep">
          <span>{dateSeparatorText}</span>
        </div>
      )}
      <div
        className={`message-item ${isOut ? 'message-item--out' : 'message-item--in'} ${positionClass}`}
      >
        {/* 对方消息：头像在左（仅组末条显示）*/}
        {!isOut && (
          <div
            className={`message-item__avatar message-item__avatar--other ${
              showAvatar ? 'message-item__avatar--visible' : 'message-item__avatar--placeholder'
            }`}
            aria-hidden={!showAvatar}
          >
            {showAvatar ? (
              msg.avatarUrl ? (
                <img src={msg.avatarUrl} alt={msg.senderName} className="message-item__avatar-img" />
              ) : sessionAvatarUrl ? (
                <img src={sessionAvatarUrl} alt={msg.senderName} className="message-item__avatar-img" />
              ) : (
                <div
                  className="message-item__avatar-fallback"
                  style={{ background: sessionAvatarColor }}
                >
                  {(msg.senderName || sessionAvatarText).charAt(0)}
                </div>
              )
            ) : null}
          </div>
        )}

        <div className="message-item__body">
          {/* 对方组首条：显示发送者名 */}
          {!isOut && showSender && (
            <div className="message-item__sender">{msg.senderName}</div>
          )}
          <div
            className={`message-item__bubble message-item__bubble--${isOut ? 'out' : 'in'} message-item__bubble--${position}`}
          >
            <MessageContent message={msg} />
            {/* 时间与状态：组末条或独立消息显示，嵌入气泡右下角（TG 风格） */}
            {(position === 'last' || position === 'single') && (
              <div className="message-item__meta">
                <span className="message-item__time">
                  {formatMessageTime(msg.timestamp)}
                </span>
                {isOut && <MessageStatus status={msg.status} />}
              </div>
            )}
          </div>
        </div>
        {/* 自己消息不显示头像 - Telegram 风格 */}
      </div>
    </>
  )
}

// === 消息内容（按类型渲染）===
function MessageContent({ message }: { message: RenderMessage }) {
  switch (message.type) {
    case 'text':
      return <span className="message-item__text">{message.content}</span>
    case 'image':
      return (
        <div className="message-item__placeholder message-item__placeholder--media">
          <span>[图片]</span>
        </div>
      )
    case 'voice':
      return (
        <div className="message-item__voice">
          <span>🎤 语音 {message.duration ?? 0}"</span>
        </div>
      )
    case 'video':
      return (
        <div className="message-item__placeholder message-item__placeholder--media">
          <span>[视频]</span>
        </div>
      )
    case 'emoji':
      return <span className="message-item__text">{message.content}</span>
    case 'file':
      return (
        <div className="message-item__placeholder">
          <span>[文件] {message.content}</span>
        </div>
      )
    case 'link':
      return (
        <div className="message-item__link-card">
          <div className="message-item__link-title">{message.content}</div>
        </div>
      )
    case 'location':
      return (
        <div className="message-item__placeholder">
          <span>[位置] {message.content}</span>
        </div>
      )
    case 'card':
      return (
        <div className="message-item__placeholder">
          <span>[名片] {message.content}</span>
        </div>
      )
    case 'recall':
      return <span className="message-item__text">{message.content}</span>
    default:
      return <span className="message-item__text">{message.content}</span>
  }
}

// === 消息状态图标 ===
function MessageStatus({ status }: { status?: 'sending' | 'sent' | 'read' }) {
  if (status === 'sending') {
    return (
      <span className="message-item__status message-item__status--sending">
        <Clock size={13} />
      </span>
    )
  }
  if (status === 'sent') {
    return (
      <span className="message-item__status message-item__status--sent">
        <Check size={14} />
      </span>
    )
  }
  // read（历史消息默认）
  return (
    <span className="message-item__status message-item__status--read">
      <CheckCheck size={14} />
    </span>
  )
}
