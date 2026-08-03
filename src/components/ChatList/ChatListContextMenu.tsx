import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Pin,
  PinOff,
  CheckCheck,
  BellOff,
  Bell,
  Archive,
  Trash2,
  Eraser,
  Info,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import './ChatListContextMenu.scss'

// === 会话列表右键菜单 ===
// 菜单项设计参考 Telegram Desktop + WeFlow Portal 模式
// 实现渲染层 mock 操作，真实业务数据接入后由 IPC 替换

interface MenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  /** 危险操作（红色高亮） */
  danger?: boolean
  /** 分隔符之后的项 */
  divider?: boolean
  onClick: () => void
}

export function ChatListContextMenu() {
  // 选择个别字段而非整个 contextMenu 对象，避免 Zustand v5 + React 19 的
  // getSnapshot should be cached 警告
  const visible = useUIStore((s) => s.contextMenu.visible)
  const x = useUIStore((s) => s.contextMenu.x)
  const y = useUIStore((s) => s.contextMenu.y)
  const sessionId = useUIStore((s) => s.contextMenu.sessionId)
  const closeContextMenu = useUIStore((s) => s.closeContextMenu)
  const setActiveChatId = useUIStore((s) => s.setActiveChatId)
  const setDetailPanelOpen = useUIStore((s) => s.setDetailPanelOpen)

  // === 从 chatStore 读取会话与持久化 actions ===
  const sessions = useChatStore((s) => s.sessions)
  const pinnedMap = useChatStore((s) => s.pinnedMap)
  const mutedMap = useChatStore((s) => s.mutedMap)
  const archivedMap = useChatStore((s) => s.archivedMap)
  const markedUnreadMap = useChatStore((s) => s.markedUnreadMap)
  const markSessionRead = useChatStore((s) => s.markSessionRead)
  const markSessionUnread = useChatStore((s) => s.markSessionUnread)
  const togglePinAction = useChatStore((s) => s.togglePin)
  const toggleMuteAction = useChatStore((s) => s.toggleMute)
  const toggleArchiveAction = useChatStore((s) => s.toggleArchive)
  const clearSessionMessages = useChatStore((s) => s.clearSessionMessages)

  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 })

  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId),
    [sessions, sessionId]
  )

  // 边界检测：菜单不能超出视口
  useEffect(() => {
    if (!visible) return
    const menuW = 220
    const menuH = 360 // 估算
    const padding = 8
    let nx = x
    let ny = y
    if (x + menuW + padding > window.innerWidth) {
      nx = window.innerWidth - menuW - padding
    }
    if (y + menuH + padding > window.innerHeight) {
      ny = window.innerHeight - menuH - padding
    }
    if (nx < padding) nx = padding
    if (ny < padding) ny = padding
    setAdjustedPos({ x: nx, y: ny })
  }, [visible, x, y])

  // ESC 关闭
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, closeContextMenu])

  if (!visible || !session) return null

  // 合并本地状态覆盖（持久化在 chatStore 中完成）
  const isPinned = pinnedMap[session.id] ?? session.isPinned
  const isMuted = mutedMap[session.id] ?? session.isMuted
  const isArchived = archivedMap[session.id] ?? false
  const markedUnread = markedUnreadMap[session.id] ?? false
  const isUnread = markedUnread || session.unreadCount > 0

  const togglePin = () => {
    togglePinAction(session.id)
    closeContextMenu()
  }

  const markAsRead = () => {
    markSessionRead(session.id)
    closeContextMenu()
  }

  const markAsUnread = () => {
    markSessionUnread(session.id)
    closeContextMenu()
  }

  const toggleMute = () => {
    toggleMuteAction(session.id)
    closeContextMenu()
  }

  const toggleArchive = () => {
    toggleArchiveAction(session.id)
    closeContextMenu()
  }

  const clearHistory = () => {
    if (window.confirm(`确定要清空 "${session.name}" 的聊天记录吗？此操作不可恢复。`)) {
      // 清空当前已加载的内存消息（不删除数据库原始记录）
      clearSessionMessages(session.id)
    }
    closeContextMenu()
  }

  const deleteChat = () => {
    if (window.confirm(`确定要删除会话 "${session.name}" 吗？聊天记录将被清空。`)) {
      // 仅清空内存消息并取消选中（不删除数据库原始记录）
      clearSessionMessages(session.id)
      setActiveChatId(null)
    }
    closeContextMenu()
  }

  const showInfo = () => {
    setActiveChatId(session.id)
    setDetailPanelOpen(true)
    closeContextMenu()
  }

  const items: MenuItem[] = [
    {
      id: 'pin',
      label: isPinned ? '取消置顶' : '置顶',
      icon: isPinned ? <PinOff size={16} /> : <Pin size={16} />,
      onClick: togglePin,
    },
    {
      id: 'read',
      label: isUnread ? '标记为已读' : '标记为未读',
      icon: <CheckCheck size={16} />,
      onClick: isUnread ? markAsRead : markAsUnread,
    },
    {
      id: 'mute',
      label: isMuted ? '取消静音' : '静音',
      icon: isMuted ? <Bell size={16} /> : <BellOff size={16} />,
      onClick: toggleMute,
    },
    {
      id: 'archive',
      label: isArchived ? '取消归档' : '归档',
      icon: <Archive size={16} />,
      onClick: toggleArchive,
    },
    {
      id: 'divider1',
      label: '',
      divider: true,
      onClick: () => {},
    },
    {
      id: 'clear',
      label: '清空聊天记录',
      icon: <Eraser size={16} />,
      onClick: clearHistory,
    },
    {
      id: 'delete',
      label: '删除会话',
      icon: <Trash2 size={16} />,
      danger: true,
      onClick: deleteChat,
    },
    {
      id: 'divider2',
      label: '',
      divider: true,
      onClick: () => {},
    },
    {
      id: 'info',
      label: '查看资料',
      icon: <Info size={16} />,
      onClick: showInfo,
    },
  ]

  return createPortal(
    <>
      {/* 透明遮罩：点击外部关闭 */}
      <div
        className="chat-context-menu__overlay"
        onClick={closeContextMenu}
        onContextMenu={(e) => {
          e.preventDefault()
          closeContextMenu()
        }}
      />
      <div
        className="chat-context-menu"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
      >
        {/* 顶部标题：会话名 */}
        <div className="chat-context-menu__header">
          <span className="chat-context-menu__title">{session.name}</span>
        </div>
        <div className="chat-context-menu__items">
          {items.map((item, idx) =>
            item.divider ? (
              <div
                key={`div-${idx}`}
                className="chat-context-menu__divider"
                role="separator"
              />
            ) : (
              <button
                key={item.id}
                className={`chat-context-menu__item ${item.danger ? 'chat-context-menu__item--danger' : ''}`}
                onClick={item.onClick}
                role="menuitem"
              >
                {item.icon && (
                  <span className="chat-context-menu__icon">{item.icon}</span>
                )}
                <span className="chat-context-menu__label">{item.label}</span>
              </button>
            )
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
