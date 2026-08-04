import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Pin, ChevronLeft, BellOff, Loader2 } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore, useDisplaySessions } from '@/stores/chatStore'
import { formatSessionTime } from '@/services/timeFormat'
import { ChatListContextMenu } from './ChatListContextMenu'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { RenderMessage } from '@/services/chatAdapter'
import './ChatList.scss'

interface ChatListProps {
  showBackButton?: boolean
  onBack?: () => void
}

/** 关键词高亮：在文本中高亮首个匹配（大小写不敏感） */
function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text
  const lower = text.toLowerCase()
  const kwLower = keyword.toLowerCase()
  const idx = lower.indexOf(kwLower)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="chat-list__hit-mark">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  )
}

/** 截取关键词周围片段，避免长文本撑爆搜索结果项 */
function snippet(text: string, keyword: string, radius = 30): string {
  if (!text) return ''
  const lower = text.toLowerCase()
  const kwLower = keyword.toLowerCase()
  const idx = lower.indexOf(kwLower)
  if (idx < 0) {
    return text.length > radius * 2 ? text.slice(0, radius * 2) + '…' : text
  }
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + keyword.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
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
  const setPendingTargetMessage = useUIStore((s) => s.setPendingTargetMessage)

  // === 全局消息搜索 ===
  const searchResults = useChatStore((s) => s.searchResults)
  const searchLoading = useChatStore((s) => s.searchLoading)
  const searchError = useChatStore((s) => s.searchError)
  const runSearch = useChatStore((s) => s.runSearch)
  const clearSearch = useChatStore((s) => s.clearSearch)

  // 初始化加载（仅在组件挂载时加载一次）
  // 使用 ref 防止 StrictMode 双调用 + 错误重试导致的重复请求
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadSessions()
  }, [loadSessions])

  // debounce 搜索：输入停止 300ms 后触发全局消息搜索
  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) {
      clearSearch()
      return
    }
    const t = setTimeout(() => {
      runSearch(query)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, runSearch, clearSearch])

  // 关闭搜索时清空
  useEffect(() => {
    if (!searchVisible) {
      setSearchQuery('')
      clearSearch()
    }
  }, [searchVisible, clearSearch])

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

  // 搜索结果按会话名查找（用于显示归属会话）
  const sessionNameMap = useMemo(() => {
    const m = new Map<string, { name: string; avatarUrl?: string; avatarColor: string; avatarText: string }>()
    for (const s of sessions) {
      m.set(s.id, { name: s.name, avatarUrl: s.avatarUrl, avatarColor: s.avatarColor, avatarText: s.avatarText })
    }
    return m
  }, [sessions])

  const hasQuery = searchQuery.trim().length > 0

  const handleSelect = (sessionId: string) => {
    setActiveChatId(sessionId)
    markSessionRead(sessionId)
  }

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    openContextMenu(e.clientX, e.clientY, sessionId)
  }

  const handleSelectSearchHit = (msg: RenderMessage) => {
    if (msg.sessionId) {
      handleSelect(msg.sessionId)
      // 记录待定位消息，ChatView 加载完成后滚动到该消息并高亮
      setPendingTargetMessage({ sessionId: msg.sessionId, messageKey: msg.id })
    }
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
            placeholder="搜索会话或消息"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="chat-list__search-clear"
              onClick={() => {
                setSearchQuery('')
                clearSearch()
              }}
              aria-label="清空"
            >
              ×
            </button>
          )}
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

        {/* 会话匹配分区 */}
        {!sessionsLoading && !sessionsError && hasQuery && sortedSessions.length === 0 && (
          <div className="chat-list__section-empty">无匹配会话</div>
        )}
        {sortedSessions.length > 0 && (
          <>
            {hasQuery && <div className="chat-list__section-label">会话</div>}
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
                      {hasQuery ? highlightKeyword(session.name, searchQuery.trim()) : session.name}
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
          </>
        )}

        {/* 消息搜索结果分区 */}
        {hasQuery && (
          <>
            <div className="chat-list__section-label">
              消息
              {searchLoading && <Loader2 size={11} className="chat-list__section-spinner" />}
            </div>
            {searchError && (
              <div className="chat-list__section-empty chat-list__section-empty--error">
                搜索失败：{searchError}
              </div>
            )}
            {!searchLoading && !searchError && searchResults.length === 0 && (
              <div className="chat-list__section-empty">无匹配消息</div>
            )}
            {searchResults.map((msg) => {
              const meta = msg.sessionId ? sessionNameMap.get(msg.sessionId) : undefined
              const name = meta?.name || msg.sessionId || '未知会话'
              const preview = snippet(msg.content, searchQuery.trim())
              return (
                <button
                  key={msg.id + msg.sessionId}
                  className="chat-list__item chat-list__item--search"
                  onClick={() => handleSelectSearchHit(msg)}
                  role="option"
                >
                  <div className="chat-list__avatar-wrap">
                    {meta?.avatarUrl ? (
                      <img className="chat-list__avatar-img" src={meta.avatarUrl} alt={name} />
                    ) : (
                      <div
                        className="chat-list__avatar chat-list__avatar--text"
                        style={{ background: meta?.avatarColor || '#9aa66b' }}
                      >
                        {meta?.avatarText || '#'}
                      </div>
                    )}
                  </div>
                  <div className="chat-list__content">
                    <div className="chat-list__row">
                      <span className="chat-list__name">{highlightKeyword(name, searchQuery.trim())}</span>
                      <span className="chat-list__time">{formatSessionTime(msg.timestamp)}</span>
                    </div>
                    <div className="chat-list__row">
                      <span className="chat-list__preview">
                        {highlightKeyword(preview, searchQuery.trim())}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {!sessionsLoading && !sessionsError && !hasQuery && sortedSessions.length === 0 && (
          <div className="chat-list__empty">
            {sessions.length === 0 ? '暂无会话数据，请在设置中连接微信数据库' : '无匹配会话'}
          </div>
        )}
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
