import { useEffect, useMemo, useRef, useState, useCallback, Fragment } from 'react'
import type { ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronDown,
  MoreVertical,
  PanelRightOpen,
  CheckCheck,
  Check,
  Clock,
  Loader2,
  ImageIcon,
  AlertCircle,
  X,
  Play,
  Volume2,
  File as FileIcon,
  MapPin,
  User,
  Quote,
  Link2,
  Download,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { groupMessages, type GroupedMessage } from '@/services/messageGrouping'
import { formatMessageTime, formatDateSeparator } from '@/services/timeFormat'
import { renderTextWithEmoji } from '@/utils/renderTextWithEmoji'
import { senderColorFor } from '@/services/chatAdapter'
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
  // 加载更多冷却时间戳（防 smooth/惯性滚动反复触发加载循环）
  const loadMoreCooldownRef = useRef(0)
  // 首屏加载完成后滚动到底部
  const scrollToBottomOnLoadRef = useRef(false)
  // 是否显示"快速到底"按钮（远离底部时显示）
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)

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

  // 切换会话或首次进入：加载消息（后端契约：offset=0 + ascending=false = 最新一批）
  // 使用 ref 跟踪已加载会话，避免空会话（消息数为 0）时 messages.length===0
  // 条件持续成立导致无限重载。重试由用户点击重试按钮触发，不经过此 effect。
  useEffect(() => {
    if (!activeChatId || messagesLoading || messagesError) return
    if (loadedSessionsRef.current.has(activeChatId)) return
    loadedSessionsRef.current.add(activeChatId)
    scrollToBottomOnLoadRef.current = true
    loadMessages(activeChatId, 50)
  }, [activeChatId, messagesLoading, messagesError, loadMessages])

  // 首屏加载完成后：即时滚动到底部（显示最新消息，TG 行为）
  useEffect(() => {
    if (!messagesLoading && messages.length > 0 && scrollToBottomOnLoadRef.current) {
      scrollToBottomOnLoadRef.current = false
      messagesEndRef.current?.scrollIntoView()
    }
  }, [messagesLoading, messages.length])

  // 切换会话时：若目标会话已加载过则直接到底（仅 activeChatId 变化时触发；
  // 加载更多改变 messages.length 不触发，避免抵消滚动位置恢复）
  const lastChatIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeChatId) return
    if (lastChatIdRef.current === activeChatId) return
    lastChatIdRef.current = activeChatId
    if (loadedSessionsRef.current.has(activeChatId)) {
      messagesEndRef.current?.scrollIntoView()
    }
  }, [activeChatId])

  // 搜索结果定位：加载完成后滚动到目标消息并高亮闪烁
  const pendingTargetMessage = useUIStore((s) => s.pendingTargetMessage)
  const setPendingTargetMessage = useUIStore((s) => s.setPendingTargetMessage)
  useEffect(() => {
    if (!pendingTargetMessage) return
    if (pendingTargetMessage.sessionId !== activeChatId) return
    if (messagesLoading) return
    const timer = setTimeout(() => {
      const el = messagesContainerRef.current?.querySelector(
        `[data-message-key="${CSS.escape(pendingTargetMessage.messageKey)}"]`
      )
      if (el) {
        ;(el as HTMLElement).scrollIntoView({ block: 'center' })
        ;(el as HTMLElement).classList.add('message-item--highlight')
        setTimeout(() => {
          ;(el as HTMLElement).classList.remove('message-item--highlight')
        }, 2500)
      }
      setPendingTargetMessage(null)
    }, 150)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTargetMessage, activeChatId, messagesLoading, messages.length, setPendingTargetMessage])

  // 上拉加载更多：检测滚动到顶部时加载历史消息（带冷却，防止循环触发）
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !activeChatId) return

    const handleScroll = () => {
      // 更新"快速到底"按钮可见性：远离底部 120px 以上时显示
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
      setShowJumpToBottom(!nearBottom)

      // 距顶部 50px 以内、还有更多、未在加载中、且过了 600ms 冷却期
      const now = Date.now()
      if (
        container.scrollTop < 50 &&
        hasMore &&
        !loadingMoreRef.current &&
        now - loadMoreCooldownRef.current > 600
      ) {
        loadingMoreRef.current = true
        loadMoreCooldownRef.current = now
        prevScrollHeightRef.current = container.scrollHeight
        void loadMoreMessages(activeChatId, 50).finally(() => {
          loadingMoreRef.current = false
        })
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activeChatId, hasMore, loadMoreMessages])

  // 加载更多完成后恢复滚动位置（即时定位，避免跳到底部）
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

  // 滚动到底部（"快速到底"按钮）
  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    setShowJumpToBottom(false)
  }

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
            {session.isGroup
              ? session.memberCount && session.memberCount > 0
                ? `${session.memberCount} 名成员`
                : '群聊'
              : '最后在线'}
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
        {showJumpToBottom && (
          <button
            className="chat-view__jump-bottom"
            onClick={scrollToBottom}
            aria-label="滚动到最新消息"
            title="回到最新消息"
          >
            <ChevronDown size={20} />
          </button>
        )}
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
// TG 风格浮动头像：头像显示在消息组最后一条消息旁，滚动时若组尾消息
// 滚出可见区底部，头像吸附到可见区底部（enumerateUserpics 双钳制算法）
const AVATAR_SIZE = 36
const AVATAR_BOTTOM_SKIP = 10

function MessageList({
  grouped,
  session,
}: {
  grouped: GroupedMessage[]
  session: RenderSession
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [floatYMap, setFloatYMap] = useState<Record<string, number>>({})

  const computeFloats = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()
    const cTop = cRect.top
    const cBottom = cRect.bottom
    const next: Record<string, number> = {}
    let groupLastId: string | null = null
    let groupFirstTop = 0

    for (const item of grouped) {
      const el = rowRefs.current.get(item.message.id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (item.position === 'first' || item.position === 'single') {
        groupLastId = item.message.id
        groupFirstTop = rect.top
      } else if (item.position === 'last' && groupLastId) {
        groupLastId = item.message.id
      }
      if (groupLastId && (item.position === 'last' || item.position === 'single')) {
        // 组结束：TG enumerateUserpics 双钳制
        const lastRect = rowRefs.current.get(groupLastId)?.getBoundingClientRect()
        const lastTop = lastRect?.top ?? groupFirstTop
        const lastBottom = lastRect?.bottom ?? lastTop + AVATAR_SIZE
        let userpicBottom = Math.min(lastBottom, cBottom - AVATAR_BOTTOM_SKIP)
        userpicBottom = Math.max(userpicBottom, groupFirstTop + AVATAR_SIZE)
        const userpicTop = userpicBottom - AVATAR_SIZE
        // 头像正常位置 = 组尾行顶部；offset 用于 transform 下移
        const offset = userpicTop - lastTop
        if (Math.abs(offset) > 1) next[groupLastId] = offset
        groupLastId = null
      }
    }
    setFloatYMap((prev) => {
      let changed = false
      const merged: Record<string, number> = {}
      for (const k of Object.keys(prev)) if (!(k in next)) { changed = true; break }
      for (const [k, v] of Object.entries(next)) if (prev[k] !== v) { changed = true; break }
      if (!changed) return prev
      for (const [k, v] of Object.entries(next)) merged[k] = v
      return merged
    })
  }, [grouped])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handler = () => computeFloats()
    container.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    const raf = requestAnimationFrame(handler)
    return () => {
      container.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
      cancelAnimationFrame(raf)
    }
  }, [computeFloats])

  const registerRow = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }, [])

  return (
    <div className="message-list" ref={containerRef}>
      {grouped.map((item, idx) => (
        <div key={`${item.message.id}-${idx}`} ref={registerRow(item.message.id)}>
          <MessageRow
            item={item}
            sessionAvatarColor={session.avatarColor}
            sessionAvatarText={session.avatarText}
            sessionAvatarUrl={session.avatarUrl}
            isGroup={session.isGroup}
            sessionId={session.id}
            avatarFloatY={floatYMap[item.message.id] ?? 0}
          />
        </div>
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
  isGroup,
  sessionId,
  avatarFloatY = 0,
}: {
  item: GroupedMessage
  sessionAvatarColor: string
  sessionAvatarText: string
  sessionAvatarUrl?: string
  isGroup: boolean
  sessionId: string
  /** TG 浮动头像垂直偏移（px，滚动时头像吸附可见区底部） */
  avatarFloatY?: number
}) {
  const {
    message: msg,
    position,
    showSender,
    showAvatar,
    showDateSeparator,
    dateSeparatorText,
  } = item

  // 群聊中获取发送者独立头像
  const [senderAvatarUrl, setSenderAvatarUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!isGroup || msg.isMe || !msg.senderUsername || !sessionId) return
    let cancelled = false
    window.electronAPI?.chat?.getContactAvatar(msg.senderUsername, sessionId)
      .then((info: any) => {
        if (!cancelled && info?.avatarUrl) {
          const url = info.avatarUrl.startsWith('http://') ? 'https://' + info.avatarUrl.substring(7) : info.avatarUrl
          setSenderAvatarUrl(url.replace(/\/132(\b|$)/, '/0'))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isGroup, msg.isMe, msg.senderUsername, sessionId])

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
        data-message-key={msg.id}
      >
        {/* 对方消息：头像在左（仅组末条显示）*/}
        {!isOut && (
          <div
            className={`message-item__avatar message-item__avatar--other ${
              showAvatar ? 'message-item__avatar--visible' : 'message-item__avatar--placeholder'
            }`}
            style={avatarFloatY ? { transform: `translateY(${avatarFloatY}px)` } : undefined}
            aria-hidden={!showAvatar}
          >
            {showAvatar ? (
              msg.avatarUrl ? (
                <img src={msg.avatarUrl} alt={msg.senderName} className="message-item__avatar-img" />
              ) : (isGroup && !msg.isMe && senderAvatarUrl) ? (
                <img src={senderAvatarUrl} alt={msg.senderName} className="message-item__avatar-img" />
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
          {/* 对方组首条：显示发送者名（仅群聊，TG 风格彩色） */}
          {!isOut && showSender && (
            <div
              className="message-item__sender"
              style={{ color: senderColorFor(msg.senderId) }}
            >
              {msg.senderName}
            </div>
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

// === 图片消息：懒加载解密 + 点击放大预览 ===
function ImageMessage({ message }: { message: RenderMessage }) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [src, setSrc] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [lightbox, setLightbox] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)

  // IntersectionObserver 懒加载：图片进入视口时才调用解密 IPC
  useEffect(() => {
    if (loadedRef.current || state === 'loaded') return
    const el = containerRef.current
    if (!el) return
    // 已经在视口内则直接加载
    const rect = el.getBoundingClientRect()
    const inView = rect.top < window.innerHeight && rect.bottom > 0
    if (inView) {
      loadedRef.current = true
      void loadImage()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadedRef.current = true
          void loadImage()
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadImage = async () => {
    if (!message.sessionId) {
      setState('error')
      setErrorMsg('缺少会话信息')
      return
    }
    setState('loading')
    try {
      // 主路径：image:decrypt（对齐 WeFlow，带 imageMd5/imageDatName/createTime 走完整解密）
      if (message.imageMd5 || message.imageDatName) {
        const decryptRes = await window.electronAPI?.media?.decryptImage({
          sessionId: message.sessionId,
          imageMd5: message.imageMd5,
          imageDatName: message.imageDatName,
          createTime: message.createTime,
          force: false,
          preferFilePath: true,
          hardlinkOnly: true,
        })
        if (decryptRes?.success && decryptRes.localPath) {
          if (String(decryptRes.localPath).startsWith('data:')) {
            setSrc(String(decryptRes.localPath))
          } else {
            // file:// 或绝对路径 → 转 data URL 供渲染（CSP 兼容）
            setSrc(`file://${String(decryptRes.localPath).replace(/^file:\/\//, '')}`)
          }
          setState('loaded')
          return
        }
      }
      // fallback：chat:getImageData（后端重新解析 rawContent 解密）
      if (!message.localId) {
        setState('error')
        setErrorMsg('缺少消息定位信息')
        return
      }
      const result = await window.electronAPI?.chat?.getImageData(
        message.sessionId,
        String(message.localId)
      )
      if (result?.success && result.data) {
        setSrc(`data:image/jpeg;base64,${result.data}`)
        setState('loaded')
      } else {
        setState('error')
        setErrorMsg(result?.error || '解密失败')
      }
    } catch (e) {
      setState('error')
      setErrorMsg(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <div
        className="message-item__image"
        ref={containerRef}
        onClick={() => state === 'loaded' && setLightbox(true)}
      >
        {state === 'idle' && (
          <div className="message-item__image-placeholder">
            <ImageIcon size={28} />
          </div>
        )}
        {state === 'loading' && (
          <div className="message-item__image-placeholder">
            <Loader2 size={24} className="message-item__image-spinner" />
          </div>
        )}
        {state === 'error' && (
          <div className="message-item__image-placeholder message-item__image-placeholder--error">
            <AlertCircle size={20} />
            <span>[图片] {errorMsg}</span>
          </div>
        )}
        {state === 'loaded' && (
          <img className="message-item__image-img" src={src} alt="[图片]" loading="lazy" />
        )}
      </div>
      {lightbox && src && (
        <div className="message-item__lightbox" onClick={() => setLightbox(false)}>
          <img className="message-item__lightbox-img" src={src} alt="[图片]" />
          <button className="message-item__lightbox-close" aria-label="关闭">
            <X size={20} />
          </button>
        </div>
      )}
    </>
  )
}

// === 视频消息：封面 + 播放按钮 ===
function VideoMessage({ message }: { message: RenderMessage }) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [coverUrl, setCoverUrl] = useState<string>('')
  const [videoPath, setVideoPath] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)

  const loadVideo = async () => {
    if (!message.videoMd5) {
      setState('error')
      setErrorMsg('缺少 videoMd5')
      return
    }
    setState('loading')
    try {
      const result = await window.electronAPI?.media?.decodeVideo(message.videoMd5, {
        includePoster: true,
        posterFormat: 'dataUrl',
      })
      if (result?.success && result.exists) {
        setCoverUrl(result.coverUrl || result.thumbUrl || '')
        setVideoPath(result.videoUrl || '')
        setState('loaded')
      } else {
        setState('error')
        setErrorMsg(result?.error || '视频未找到')
      }
    } catch (e) {
      setState('error')
      setErrorMsg(e instanceof Error ? e.message : String(e))
    }
  }

  // IntersectionObserver 懒加载
  useEffect(() => {
    if (loadedRef.current || state === 'loaded') return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const inView = rect.top < window.innerHeight && rect.bottom > 0
    if (inView) {
      loadedRef.current = true
      void loadVideo()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadedRef.current = true
          void loadVideo()
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlay = async () => {
    if (!videoPath) return
    // 通过 shell 在系统默认播放器中打开视频
    await window.electronAPI?.shell?.openPath(videoPath)
  }

  return (
    <div className="message-item__video" ref={containerRef}>
      {state === 'idle' && (
        <div className="message-item__video-placeholder">
          <Play size={28} />
        </div>
      )}
      {state === 'loading' && (
        <div className="message-item__video-placeholder">
          <Loader2 size={24} className="message-item__image-spinner" />
        </div>
      )}
      {state === 'error' && (
        <div className="message-item__video-placeholder message-item__image-placeholder--error">
          <AlertCircle size={20} />
          <span>[视频] {errorMsg}</span>
        </div>
      )}
      {state === 'loaded' && (
        <div className="message-item__video-wrap" onClick={handlePlay}>
          {coverUrl ? (
            <img className="message-item__video-cover" src={coverUrl} alt="[视频]" />
          ) : (
            <div className="message-item__video-placeholder">
              <Play size={28} />
            </div>
          )}
          <div className="message-item__video-play">
            <Play size={32} fill="currentColor" />
          </div>
        </div>
      )}
    </div>
  )
}

// === 语音消息：波形 + 时长 + 转文字 ===
function VoiceMessage({ message }: { message: RenderMessage }) {
  const [transcript, setTranscript] = useState<string>('')
  const [partialText, setPartialText] = useState<string>('')
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string>('')
  const [checked, setChecked] = useState(false)
  const partialUnsubRef = useRef<(() => void) | null>(null)

  const duration = message.duration ?? 0
  // 基于 duration 生成稳定的伪波形条（视觉装饰，非真实波形）
  const bars = useMemo(() => {
    const count = Math.min(28, Math.max(8, Math.floor(duration / 0.4) + 8))
    return Array.from({ length: count }, (_, i) => {
      // 用正弦+伪随机生成稳定的波形高度
      const seed = (i * 9301 + 49297) % 233280
      const r = seed / 233280
      return 0.3 + r * 0.7
    })
  }, [duration])

  // 检查转写缓存
  useEffect(() => {
    let cancelled = false
    const unsub = partialUnsubRef.current
    if (unsub) {
      unsub()
      partialUnsubRef.current = null
    }
    setTranscript('')
    setPartialText('')
    setError('')
    setChecked(false)
    void (async () => {
      if (!message.sessionId || !message.localId) return
      try {
        const cached = await window.electronAPI?.media?.resolveVoiceCache(
          message.sessionId,
          String(message.localId)
        )
        if (!cancelled && cached?.success && cached.hasCache && cached.data) {
          setTranscript(cached.data)
        }
      } catch {
        /* 缓存读取失败忽略 */
      } finally {
        if (!cancelled) setChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [message.id, message.sessionId, message.localId])

  // 清理 partial 订阅
  useEffect(() => {
    return () => {
      if (partialUnsubRef.current) {
        partialUnsubRef.current()
        partialUnsubRef.current = null
      }
    }
  }, [])

  const handleTranscribe = async () => {
    if (transcribing || !message.sessionId || !message.localId) return
    setError('')
    setPartialText('')
    setTranscribing(true)
    // 订阅流式 partial
    if (partialUnsubRef.current) partialUnsubRef.current()
    partialUnsubRef.current = window.electronAPI?.media?.onTranscribePartial((payload) => {
      if (payload.sessionId === message.sessionId && payload.msgId === String(message.localId)) {
        setPartialText(payload.text)
      }
    })
    try {
      const result = await window.electronAPI?.media?.transcribeVoice(
        message.sessionId,
        String(message.localId),
        message.timestamp ? Math.floor(message.timestamp / 1000) : undefined,
        message.serverId
      )
      if (result?.success && result.transcript) {
        setTranscript(result.transcript)
        setPartialText('')
      } else if (!result?.success) {
        setError(result?.error || '转写失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTranscribing(false)
      if (partialUnsubRef.current) {
        partialUnsubRef.current()
        partialUnsubRef.current = null
      }
    }
  }

  return (
    <div className="message-item__voice-msg">
      <div className="message-item__voice-bar">
        <Volume2 size={18} className="message-item__voice-icon" />
        <div className="message-item__voice-waveform" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className="message-item__voice-bar-seg" style={{ height: `${h * 100}%` }} />
          ))}
        </div>
        <span className="message-item__voice-duration">{duration}&quot;</span>
      </div>
      {(transcript || partialText || transcribing || error) && (
        <div className="message-item__voice-transcript">
          {transcribing && !transcript && (
            <div className="message-item__voice-transcribing">
              <Loader2 size={12} className="message-item__image-spinner" />
              <span>{partialText || '转写中…'}</span>
            </div>
          )}
          {transcript && <span className="message-item__voice-text">{transcript}</span>}
          {error && <span className="message-item__voice-error">{error}</span>}
        </div>
      )}
      {checked && !transcript && !transcribing && (
        <button
          className="message-item__voice-transcribe-btn"
          onClick={handleTranscribe}
          disabled={transcribing}
        >
          转文字
        </button>
      )}
    </div>
  )
}

// === 表情包消息：下载 + 缓存显示 ===
// 进程级缓存：cdnUrl → dataUrl，避免重复 IPC
const emojiCache = new Map<string, string>()
function EmojiMessage({ message }: { message: RenderMessage }) {
  const [src, setSrc] = useState<string>('')
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const loadedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadEmoji = async () => {
    const cdnUrl = message.emojiCdnUrl
    if (!cdnUrl) {
      // 无 CDN URL：尝试用内置表情码渲染（content 形如 [微笑]），仍失败则降级文本
      const emojiNodes = renderTextWithEmoji(message.content, 24)
      if (emojiNodes !== message.content) {
        setState('loaded')
        return
      }
      setState('error')
      return
    }
    // 命中内存缓存
    const cached = emojiCache.get(cdnUrl)
    if (cached) {
      setSrc(cached)
      setState('loaded')
      return
    }
    setState('loading')
    try {
      const result = await window.electronAPI?.media?.getEmoji(cdnUrl)
      if (result?.success && result.dataUrl) {
        emojiCache.set(cdnUrl, result.dataUrl)
        setSrc(result.dataUrl)
        setState('loaded')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    if (loadedRef.current || state === 'loaded') return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const inView = rect.top < window.innerHeight && rect.bottom > 0
    if (inView) {
      loadedRef.current = true
      void loadEmoji()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadedRef.current = true
          void loadEmoji()
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="message-item__emoji" ref={containerRef}>
      {state === 'loaded' && !src ? (
        <span className="message-item__text">{renderTextWithEmoji(message.content, 24)}</span>
      ) : state === 'loaded' && src ? (
        <img className="message-item__emoji-img" src={src} alt="[表情]" />
      ) : state === 'loading' ? (
        <Loader2 size={20} className="message-item__image-spinner" />
      ) : state === 'error' ? (
        <span className="message-item__text">{renderTextWithEmoji(message.content, 24)}</span>
      ) : (
        <div className="message-item__emoji-placeholder" />
      )}
    </div>
  )
}

// === 文件大小格式化 ===
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let val = bytes
  let i = 0
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// 根据扩展名选择文件图标颜色
function fileIconColor(ext?: string): string {
  if (!ext) return 'var(--text-tertiary)'
  const e = ext.toLowerCase()
  if (['.pdf'].includes(e)) return '#e53935'
  if (['.doc', '.docx'].includes(e)) return '#1976d2'
  if (['.xls', '.xlsx', '.csv'].includes(e)) return '#2e7d32'
  if (['.ppt', '.pptx'].includes(e)) return '#ef6c00'
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(e)) return '#8d6e63'
  if (['.mp4', '.avi', '.mov', '.mkv'].includes(e)) return '#7b1fa2'
  if (['.mp3', '.wav', '.flac'].includes(e)) return '#00838f'
  if (['.txt', '.md'].includes(e)) return '#546e7a'
  return 'var(--text-tertiary)'
}

// === 文件消息卡片 ===
function FileMessage({ message }: { message: RenderMessage }) {
  const name = message.fileName || message.content || '[文件]'
  const sizeText = formatFileSize(message.fileSize)
  const ext = message.fileExt || (name.includes('.') ? '.' + name.split('.').pop() : '')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  // 打开文件：先探测本地路径，存在则用系统默认应用打开；否则提示 CDN 无本地副本
  const handleOpen = async () => {
    if (busy || !message.localId || !message.sessionId) return
    setBusy(true)
    setHint('')
    try {
      const result = await window.electronAPI?.chat?.getFileInfo(
        message.sessionId,
        String(message.localId)
      )
      if (result?.success && result.localPath) {
        const err = await window.electronAPI?.shell?.openPath(result.localPath)
        if (err) setHint(err)
      } else {
        setHint('此文件为 CDN 文件，本地无副本，请在微信中接收后查看')
      }
    } catch {
      setHint('文件打开失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="message-item__file-card">
      <div className="message-item__file-icon" style={{ color: fileIconColor(ext) }}>
        <FileIcon size={32} />
        {ext && <span className="message-item__file-ext">{ext.replace('.', '').toUpperCase()}</span>}
      </div>
      <div className="message-item__file-info">
        <div className="message-item__file-name" title={name}>{name}</div>
        {sizeText && <div className="message-item__file-size">{sizeText}</div>}
        {hint && <div className="message-item__file-hint">{hint}</div>}
      </div>
      <button
        className="message-item__file-open"
        onClick={handleOpen}
        disabled={busy}
        title="打开文件"
        aria-label="打开文件"
      >
        {busy ? <Loader2 size={16} className="message-item__image-spinner" /> : <Download size={16} />}
      </button>
    </div>
  )
}

// === 链接消息卡片 ===
function LinkMessage({ message }: { message: RenderMessage }) {
  // 转发聊天记录（appmsg type=19）：渲染层级列表
  if (message.chatRecordList && message.chatRecordList.length > 0) {
    return (
      <div className="message-item__chat-record">
        <div className="message-item__chat-record-header">
          <Quote size={13} />
          <span>{message.chatRecordTitle || '聊天记录'}</span>
          <span className="message-item__chat-record-count">
            {message.chatRecordList.length} 条
          </span>
        </div>
        <div className="message-item__chat-record-list">
          {message.chatRecordList.slice(0, 8).map((item, i) => (
            <div key={i} className="message-item__chat-record-item">
              <span className="message-item__chat-record-sender">{item.sourcename || '成员'}</span>
              <span className="message-item__chat-record-text">
                {renderTextContent(item.datadesc || item.datatitle || `[${recordTypeLabel(item.datatype)}]`)}
              </span>
            </div>
          ))}
          {message.chatRecordList.length > 8 && (
            <div className="message-item__chat-record-more">
              还有 {message.chatRecordList.length - 8} 条…
            </div>
          )}
        </div>
      </div>
    )
  }

  const title = message.linkTitle || message.content || '[链接]'
  const desc = message.appMsgDesc
  return (
    <div className="message-item__link-card-full">
      <div className="message-item__link-header">
        <Link2 size={14} className="message-item__link-icon" />
        <span className="message-item__link-title-full">{title}</span>
      </div>
      {desc && <div className="message-item__link-desc">{desc}</div>}
      {message.linkUrl && (
        <div className="message-item__link-url" title={message.linkUrl}>{message.linkUrl}</div>
      )}
    </div>
  )
}

// 聊天记录条目类型文案（对齐 WeFlow datatype：1 文本 / 3 图片 / 34 语音 / 43 视频 / 47 表情）
function recordTypeLabel(datatype: number): string {
  switch (datatype) {
    case 1: return '文本'
    case 3: return '图片'
    case 34: return '语音'
    case 43: return '视频'
    case 47: return '表情'
    default: return '消息'
  }
}

// === 位置消息 ===
function LocationMessage({ message }: { message: RenderMessage }) {
  const poiname = message.locationPoiname || message.content || '[位置]'
  return (
    <div className="message-item__location-card">
      <MapPin size={16} className="message-item__location-icon" />
      <div className="message-item__location-info">
        <div className="message-item__location-name">{poiname}</div>
        {message.locationLabel && (
          <div className="message-item__location-label">{message.locationLabel}</div>
        )}
      </div>
    </div>
  )
}

// === 名片消息 ===
function CardMessage({ message }: { message: RenderMessage }) {
  const nickname = message.cardNickname || message.content || '[名片]'
  return (
    <div className="message-item__card-full">
      <div className="message-item__card-avatar">
        <User size={22} />
      </div>
      <div className="message-item__card-info">
        <div className="message-item__card-name">{nickname}</div>
        <div className="message-item__card-label">个人名片</div>
      </div>
    </div>
  )
}

// === 引用消息块（气泡内顶部）===
function QuoteBlock({ message }: { message: RenderMessage }) {
  if (!message.quotedContent) return null
  return (
    <div className="message-item__quote">
      <Quote size={12} className="message-item__quote-icon" />
      <div className="message-item__quote-body">
        {message.quotedSender && (
          <div className="message-item__quote-sender">{message.quotedSender}</div>
        )}
        <div className="message-item__quote-text">{message.quotedContent}</div>
      </div>
    </div>
  )
}

// === 消息内容（按类型渲染）===
function MessageContent({ message }: { message: RenderMessage }) {
  return (
    <>
      {message.quotedContent && <QuoteBlock message={message} />}
      {(() => {
        switch (message.type) {
          case 'text':
            return (
              <span className="message-item__text">
                {renderTextContent(message.content)}
              </span>
            )
          case 'image':
            return <ImageMessage message={message} />
          case 'voice':
            return <VoiceMessage message={message} />
          case 'video':
            return <VideoMessage message={message} />
          case 'emoji':
            return <EmojiMessage message={message} />
          case 'file':
            return <FileMessage message={message} />
          case 'link':
            return <LinkMessage message={message} />
          case 'location':
            return <LocationMessage message={message} />
          case 'card':
            return <CardMessage message={message} />
          case 'recall':
            return <span className="message-item__text">{message.content}</span>
          default:
            return <span className="message-item__text">{message.content}</span>
        }
      })()}
    </>
  )
}

// === 渲染文本：@提及高亮（TG 风格蓝色）+ 表情码内联图 ===
function renderTextContent(text: string): ReactNode {
  if (!text) return text
  // 按 @提及 分段：/@[^\s@，。！？,.!?；;]{1,32}/
  const parts = text.split(/(@[^\s@，。！？,.!?；;]{1,32})/g)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span key={i} className="message-item__mention">
          {part}
        </span>
      )
    }
    return <Fragment key={i}>{renderTextWithEmoji(part, 20)}</Fragment>
  })
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
