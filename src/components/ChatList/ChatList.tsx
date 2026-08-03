import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Pin, ChevronLeft, BellOff, Loader2 } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore, useDisplaySessions } from '@/stores/chatStore'
import { formatSessionTime } from '@/services/timeFormat'
import { ChatListContextMenu } from './ChatListContextMenu'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './ChatList.scss'

interface ChatListProps {
  showBackButton?: boolean
  onBack?: () => void
}

function ChatListInner({ showBackButton, onBack }: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const activeChatId = useUIStore((s) => s.activeChatId)
  const setActiveChatId = useUIStore((s) => s.setActiveChatId)
  const openContextMenu = useUIStore((s) => s.openContextMenu)

  // === 真实数据 ===
  const sessions = useDisplaySessions()
  const sessionsLoading = useChatStore((s) => s.sessionsLoading)
  const sessionsError = useChatStore((s) => s.sessionsError)
  const loadSessions = useChatStore((s) => s.loadSessions)
  const markSessionRead = useChatStore((s) => s.markSessionRead)

  // 初始化加载（仅在组件挂载时加载一次）
  // 使用 ref 防止 StrictMode 双调用 + 错误重试导致的重复请求
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadSessions()
  }, [loadSessions])

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    let list = sessions
    if (query) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      )
    }
    // 已归档不在主列表显示
    return list.filter((s) => !s.isArchived)
  }, [searchQuery, sessions])

  // 置顶在前
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return b.lastMessageTime - a.lastMessageTime
    })
  }, [filteredSessions])

  const handleSelect = (sessionId: string) => {
    setActiveChatId(sessionId)
    markSessionRead(sessionId)
  }

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    openContextMenu(e.clientX, e.clientY, sessionId)
  }

  return (
    <div className="chat-list">
      <header className="chat-list__header">
        {showBackButton && (
          <button className="chat-list__back" onClick={onBack} aria-label="返回">
            <ChevronLeft size={20} />
          </button>
        )}
        <h1 className="chat-list__title">聊天</h1>
        <button
          className="chat-list__search-btn"
          onClick={() => setSearchVisible((v) => !v)}
          aria-label="搜索"
        >
          <Search size={18} />
        </button>
      </header>

      {searchVisible && (
        <div className="chat-list__search">
          <Search size={14} className="chat-list__search-icon" />
          <input
            className="chat-list__search-input"
            placeholder="搜索会话"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <div className="chat-list__items" role="listbox">
        {sessionsLoading && sessions.length === 0 && (
          <div className="chat-list__state">
            <Loader2 size={20} className="chat-list__spinner" />
            <span>加载中…</span>
          </div>
        )}
        {sessionsError && (
          <div className="chat-list__state chat-list__state--error">
            <span>加载失败</span>
            <button onClick={() => loadSessions()}>重试</button>
          </div>
        )}
        {!sessionsLoading && !sessionsError && sortedSessions.length === 0 && (
          <div className="chat-list__empty">
            {sessions.length === 0 ? '暂无会话数据，请在设置中连接微信数据库' : '无匹配会话'}
          </div>
        )}
        {sortedSessions.map((session) => (
          <button
            key={session.id}
            className={`chat-list__item ${activeChatId === session.id ? 'chat-list__item--active' : ''}`}
            onClick={() => handleSelect(session.id)}
            onContextMenu={(e) => handleContextMenu(e, session.id)}
            role="option"
            aria-selected={activeChatId === session.id}
          >
            <div className="chat-list__avatar-wrap">
              {session.avatarUrl ? (
                <img className="chat-list__avatar-img" src={session.avatarUrl} alt={session.name} />
              ) : (
                <div
                  className="chat-list__avatar chat-list__avatar--text"
                  style={{ background: session.avatarColor }}
                >
                  {session.avatarText}
                </div>
              )}
              {session.isMuted && (
                <span className="chat-list__avatar-muted" title="已静音">
                  <BellOff size={10} />
                </span>
              )}
            </div>
            <div className="chat-list__content">
              <div className="chat-list__row">
                <span className="chat-list__name">
                  {session.name}
                  {session.isGroup && session.memberCount && (
                    <span className="chat-list__member-count">
                      ({session.memberCount})
                    </span>
                  )}
                </span>
                <span className="chat-list__time">
                  {formatSessionTime(session.lastMessageTime)}
                </span>
              </div>
              <div className="chat-list__row">
                <span className="chat-list__preview">{session.lastMessage || ' '}</span>
                <span className="chat-list__badges">
                  {session.isPinned && (
                    <Pin size={12} className="chat-list__pin-icon" />
                  )}
                  {session.unreadCount > 0 && (
                    <span className={`chat-list__unread ${session.isMuted ? 'chat-list__unread--muted' : ''}`}>
                      {session.unreadCount > 99 ? '99+' : session.unreadCount}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <ChatListContextMenu />
    </div>
  )
}

export function ChatList(props: ChatListProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="chat-list">
          <div className="chat-list__state chat-list__state--error">
            <span>会话列表渲染失败</span>
          </div>
        </div>
      }
    >
      <ChatListInner {...props} />
    </ErrorBoundary>
  )
}
