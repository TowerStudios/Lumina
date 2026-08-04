import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Send, Square, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import './AiChatPage.scss'

/** AI 会话（渲染层轻量类型，对应 aiChatService.AiChatSession） */
interface AiSession {
  sessionId: string
  displayName?: string
  messages: AiMsg[]
  profileSummary?: string
  lastActiveAt: number
  totalRounds: number
}

interface AiMsg {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

/** 基于当前会话上下文生成 AI 会话名（复用 chatStore 会话名/头像） */
export function AiChatPage() {
  const sessions = useChatStore((s) => s.sessions)
  const [aiSessions, setAiSessions] = useState<AiSession[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState('')
  const [providerReady, setProviderReady] = useState<boolean | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const current = useMemo(
    () => aiSessions.find((s) => s.sessionId === currentId) || null,
    [aiSessions, currentId]
  )

  // 挂载：加载会话列表 + 检查提供方配置
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const res = (await window.electronAPI?.aiChat?.listSessions()) as {
          success?: boolean
          sessions?: AiSession[]
          error?: string
        }
        if (!cancelled) {
          const list = res?.sessions ?? []
          setAiSessions(list)
          if (list.length > 0) setCurrentId(list[0].sessionId)
        }
        // 提供方就绪检查：列一次预设即可（非空则配置可用）
        const presets = await window.electronAPI?.aiChat?.listProviderPresets()
        if (!cancelled) setProviderReady(Array.isArray(presets) && presets.length > 0)
      } catch {
        if (!cancelled) setError('AI 服务加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  // 选中会话 → 加载消息
  useEffect(() => {
    if (!currentId) return
    let cancelled = false
    async function load() {
      try {
        const res = (await window.electronAPI?.aiChat?.getSession(currentId)) as {
          success?: boolean
          session?: AiSession
          error?: string
        }
        if (!cancelled && res?.success && res.session) {
          setMessages(res.session.messages ?? [])
          setError('')
        } else if (!cancelled) {
          setError(res?.error || '加载会话失败')
        }
      } catch {
        if (!cancelled) setError('加载会话失败')
      }
    }
    void load()
  }, [currentId])

  // 新消息/流式输出时滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, streamText])

  // 流式订阅
  useEffect(() => {
    return window.electronAPI?.aiChat?.onChatChunk?.((requestId, chunk) => {
      if (requestId === currentRequestRef.current) {
        setStreamText((prev) => prev + chunk)
      }
    })
  }, [])
  const currentRequestRef = useRef<string>('')

  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming || !currentId) return
    setInput('')
    setError('')

    // 立即追加用户消息
    const userMsg: AiMsg = { role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)
    setStreamText('')

    const requestId = `req-${Date.now()}`
    currentRequestRef.current = requestId
    try {
      const res = (await window.electronAPI?.aiChat?.chatWithContext(
        requestId,
        { sessionId: currentId, displayName: current?.displayName },
        text
      )) as { success?: boolean; reply?: string; error?: string }
      if (!res?.success) {
        setError(res?.error || '发送失败')
      }
      // 流式结束后刷新会话（拿到完整回复）
      const sessionRes = (await window.electronAPI?.aiChat?.getSession(currentId)) as {
        success?: boolean
        session?: AiSession
      }
      if (sessionRes?.success && sessionRes.session) {
        setMessages(sessionRes.session.messages ?? [])
      }
    } catch {
      setError('AI 请求异常')
    } finally {
      setStreaming(false)
      setStreamText('')
      currentRequestRef.current = ''
    }
  }

  const handleAbort = () => {
    if (currentRequestRef.current) {
      void window.electronAPI?.aiChat?.abortRequest(currentRequestRef.current)
      setStreaming(false)
      setStreamText('')
    }
  }

  const handleNew = async () => {
    const key = `ai-${Date.now()}`
    setCurrentId(key)
    setMessages([])
    // 预创建会话（getSession 会按需创建）
    await window.electronAPI?.aiChat?.getSession(key)
  }

  const handleDelete = async (sessionId: string) => {
    await window.electronAPI?.aiChat?.deleteSession(sessionId)
    const res = (await window.electronAPI?.aiChat?.listSessions()) as {
      sessions?: AiSession[]
    }
    const list = res?.sessions ?? []
    setAiSessions(list)
    if (currentId === sessionId) {
      setCurrentId(list[0]?.sessionId ?? null)
    }
  }

  const sessionName = (s: AiSession) =>
    s.displayName || sessions.find((x) => x.id === s.sessionId)?.name || 'AI 对话'

  if (loading) {
    return (
      <div className="ai-chat-page ai-chat-page--loading">
        <Loader2 size={28} className="ai-chat-page__spinner" />
      </div>
    )
  }

  return (
    <div className="ai-chat-page">
      {/* 会话列表 */}
      <aside className="ai-chat-page__sidebar">
        <div className="ai-chat-page__sidebar-header">
          <span>AI 会话</span>
          <button className="ai-chat-page__new" onClick={handleNew} title="新建会话">
            <Plus size={16} />
          </button>
        </div>
        <div className="ai-chat-page__session-list">
          {aiSessions.length === 0 && (
            <div className="ai-chat-page__empty">暂无会话，点击 + 新建</div>
          )}
          {aiSessions.map((s) => (
            <button
              key={s.sessionId}
              className={`ai-chat-page__session ${currentId === s.sessionId ? 'ai-chat-page__session--active' : ''}`}
              onClick={() => setCurrentId(s.sessionId)}
            >
              <MessageSquare size={15} className="ai-chat-page__session-icon" />
              <span className="ai-chat-page__session-name">{sessionName(s)}</span>
              <span className="ai-chat-page__session-rounds">{s.totalRounds || 0}</span>
              <span
                className="ai-chat-page__session-del"
                role="button"
                title="删除会话"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDelete(s.sessionId)
                }}
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))}
        </div>
        {providerReady === false && (
          <div className="ai-chat-page__warn">
            未配置 AI 提供方，请先在设置页配置模型 API。
          </div>
        )}
      </aside>

      {/* 对话区 */}
      <main className="ai-chat-page__main">
        <div className="ai-chat-page__list" ref={listRef}>
          {messages.length === 0 && !streaming && (
            <div className="ai-chat-page__hint">
              <MessageSquare size={40} strokeWidth={1} />
              <p>基于聊天记录上下文的 AI 对话</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`ai-chat-page__msg ai-chat-page__msg--${m.role}`}
            >
              {m.content}
            </div>
          ))}
          {streaming && (
            <div className="ai-chat-page__msg ai-chat-page__msg--assistant ai-chat-page__msg--streaming">
              {streamText}
              <span className="ai-chat-page__caret" />
            </div>
          )}
        </div>

        {error && <div className="ai-chat-page__error">{error}</div>}

        <div className="ai-chat-page__compose">
          <textarea
            className="ai-chat-page__input"
            placeholder="输入问题，回车发送（Shift+Enter 换行）"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />
          {streaming ? (
            <button className="ai-chat-page__send ai-chat-page__send--stop" onClick={handleAbort} title="停止">
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              className="ai-chat-page__send"
              onClick={() => void handleSend()}
              disabled={!input.trim() || !currentId}
              title="发送"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
