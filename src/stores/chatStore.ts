import { create } from 'zustand'
import { useMemo } from 'react'
import {
  adaptSession,
  adaptMessage,
  unwrapSessions,
  unwrapMessages,
  unwrapAvatarUrl,
  type BackendMessage,
  type RenderSession,
  type RenderMessage,
  type SessionsResult,
  type MessagesResult,
  type AvatarResult,
} from '@/services/chatAdapter'

// === Chat Store ===
// 封装 electronAPI.chat.* 调用，提供渲染层使用的状态与 actions

/** 单个会话的本地状态覆盖（持久化到 config.sessionStates，不回写微信） */
interface SessionState {
  isPinned?: boolean
  isMuted?: boolean
  isArchived?: boolean
  markedUnread?: boolean
}

interface ChatState {
  // === 数据 ===
  sessions: RenderSession[]
  messagesBySession: Record<string, RenderMessage[]>
  myWxid: string | null
  myAvatarUrl: string | null

  // === 加载状态 ===
  sessionsLoading: boolean
  sessionsError: string | null
  messagesLoading: Record<string, boolean>
  messagesError: Record<string, string>
  // 每个会话是否还有更多历史消息可加载
  hasMoreBySession: Record<string, boolean>
  // 每个会话是否正在加载更多（上拉）
  loadingMoreBySession: Record<string, boolean>

  // === 本地状态（右键菜单操作，持久化到 config.sessionStates）===
  pinnedMap: Record<string, boolean>
  mutedMap: Record<string, boolean>
  archivedMap: Record<string, boolean>
  markedUnreadMap: Record<string, boolean>

  // === 全局消息搜索 ===
  searchKeyword: string
  searchResults: RenderMessage[]
  searchLoading: boolean
  searchError: string | null

  // === Actions ===
  loadSessions: () => Promise<void>
  loadSessionStates: () => Promise<void>
  loadMessages: (sessionId: string, limit?: number) => Promise<void>
  loadMoreMessages: (sessionId: string, offset: number, limit?: number) => Promise<{ hasMore: boolean; loaded: number }>
  markSessionRead: (sessionId: string) => void
  markSessionUnread: (sessionId: string) => void
  togglePin: (sessionId: string) => void
  toggleMute: (sessionId: string) => void
  toggleArchive: (sessionId: string) => void
  clearSessionMessages: (sessionId: string) => void
  runSearch: (keyword: string) => Promise<void>
  clearSearch: () => void
}

export const useChatStore = create<ChatState>((set, get) => {
  // === 持久化 helper ===
  // 将单个会话的本地状态合并写入 config.sessionStates
  // 全默认值时删除条目，避免配置文件无限增长
  const persistSessionState = (sessionId: string) => {
    const st = get()
    const entry: SessionState = {
      isPinned: st.pinnedMap[sessionId] ?? false,
      isMuted: st.mutedMap[sessionId] ?? false,
      isArchived: st.archivedMap[sessionId] ?? false,
      markedUnread: st.markedUnreadMap[sessionId] ?? false,
    }
    const hasValue = entry.isPinned || entry.isMuted || entry.isArchived || entry.markedUnread
    const api = window.electronAPI
    if (!api?.config?.get || !api?.config?.set) return
    api.config.get('sessionStates').then((raw) => {
      const map = (raw && typeof raw === 'object' ? raw : {}) as Record<string, SessionState>
      if (hasValue) {
        map[sessionId] = entry
      } else {
        delete map[sessionId]
      }
      api.config.set('sessionStates', map)
    }).catch((e) => {
      console.error('[chatStore] persistSessionState 失败:', e)
    })
  }

  return {
  sessions: [],
  messagesBySession: {},
  myWxid: null,
  myAvatarUrl: null,

  sessionsLoading: false,
  sessionsError: null,
  messagesLoading: {},
  messagesError: {},
  hasMoreBySession: {},
  loadingMoreBySession: {},

  pinnedMap: {},
  mutedMap: {},
  archivedMap: {},
  markedUnreadMap: {},

  searchKeyword: '',
  searchResults: [],
  searchLoading: false,
  searchError: null,

  loadSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null })
    try {
      const api = window.electronAPI
      if (!api?.chat?.getSessions) {
        throw new Error('electronAPI.chat.getSessions 不可用（preload 未注入或 IPC 未注册）')
      }
      // 并行加载 sessions + myWxid + myAvatarUrl
      // 后端契约：getSessions() -> { success, sessions, error }
      //          getMyAvatarUrl() -> { success, avatarUrl, error }
      const [sessionsResult, myWxid, avatarResult] = await Promise.all([
        api.chat.getSessions() as Promise<SessionsResult>,
        api.config.get('myWxid') as Promise<string | null>,
        api.chat.getMyAvatarUrl().catch(() => null) as Promise<AvatarResult | null>,
      ])
      const rawSessions = unwrapSessions(sessionsResult)
      const myWxidResolved = (myWxid as string) || null
      const sessions = rawSessions.map((s) => adaptSession(s, myWxidResolved))
      const myAvatarUrl = unwrapAvatarUrl(avatarResult)
      set({
        sessions,
        myWxid: myWxidResolved,
        myAvatarUrl,
        sessionsLoading: false,
      })

      // 异步批量加载会话头像（不阻塞页面渲染）
      // 后端 getSessions 不等待联系人信息，首次返回的 avatarUrl 多为空。
      // 这里分批调用 getContactAvatar 补充头像，每批 8 个避免 IPC 拥塞。
      if (api.chat.getContactAvatar && sessions.length > 0) {
        const batchSize = 8
        const needAvatar = sessions.filter((s) => !s.avatarUrl).map((s) => s.id)
        for (let i = 0; i < needAvatar.length; i += batchSize) {
          const batch = needAvatar.slice(i, i + batchSize)
          const results = await Promise.allSettled(
            batch.map((id) =>
              api.chat.getContactAvatar(id).then((r: any) => ({ id, r }))
            )
          )
          const updates: Record<string, string> = {}
          for (const item of results) {
            if (item.status !== 'fulfilled') continue
            const { id, r } = item.value
            const url = r?.avatarUrl || (typeof r === 'string' ? r : null)
            if (url) {
              // 升级 http→https，避免 CSP 拦截
              updates[id] = url.startsWith('http://') ? 'https://' + url.substring(7) : url
            }
          }
          if (Object.keys(updates).length > 0) {
            set((s) => ({
              sessions: s.sessions.map((sess) =>
                updates[sess.id] ? { ...sess, avatarUrl: updates[sess.id] } : sess
              ),
            }))
          }
        }
      }

      // 加载持久化的会话本地状态（置顶/静音/归档/标记未读）
      get().loadSessionStates()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ sessionsLoading: false, sessionsError: msg })
      console.error('[chatStore] loadSessions 失败:', e)
    }
  },

  // 从 config.sessionStates 加载本地状态到 maps
  loadSessionStates: async () => {
    try {
      const api = window.electronAPI
      if (!api?.config?.get) return
      const raw = await api.config.get('sessionStates')
      const map = (raw && typeof raw === 'object' ? raw : {}) as Record<string, SessionState>
      const pinnedMap: Record<string, boolean> = {}
      const mutedMap: Record<string, boolean> = {}
      const archivedMap: Record<string, boolean> = {}
      const markedUnreadMap: Record<string, boolean> = {}
      for (const [id, st] of Object.entries(map)) {
        if (st?.isPinned) pinnedMap[id] = true
        if (st?.isMuted) mutedMap[id] = true
        if (st?.isArchived) archivedMap[id] = true
        if (st?.markedUnread) markedUnreadMap[id] = true
      }
      set({ pinnedMap, mutedMap, archivedMap, markedUnreadMap })
    } catch (e) {
      console.error('[chatStore] loadSessionStates 失败:', e)
    }
  },

  loadMessages: async (sessionId, limit = 50) => {
    set((s) => ({
      messagesLoading: { ...s.messagesLoading, [sessionId]: true },
      messagesError: { ...s.messagesError, [sessionId]: '' },
    }))
    try {
      const api = window.electronAPI
      if (!api?.chat?.getMessages) {
        throw new Error('electronAPI.chat.getMessages 不可用')
      }
      const myWxid = get().myWxid ?? undefined
      // 后端契约：getMessages() -> { success, messages, hasMore, nextOffset, error }
      const result = (await api.chat.getMessages(sessionId, 0, limit, undefined, undefined, true)) as MessagesResult
      const raw = unwrapMessages(result)
      // 按时间升序拉取（最早在上，最新在下 - TG 风格）
      const messages = raw.map((m) => adaptMessage(m, sessionId, myWxid))
      set((s) => ({
        messagesBySession: { ...s.messagesBySession, [sessionId]: messages },
        messagesLoading: { ...s.messagesLoading, [sessionId]: false },
        hasMoreBySession: { ...s.hasMoreBySession, [sessionId]: result.hasMore ?? false },
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set((s) => ({
        messagesLoading: { ...s.messagesLoading, [sessionId]: false },
        messagesError: { ...s.messagesError, [sessionId]: msg },
      }))
      console.error('[chatStore] loadMessages 失败:', e)
    }
  },

  loadMoreMessages: async (sessionId, offset, limit = 50) => {
    const api = window.electronAPI
    if (!api?.chat?.getMessages) return { hasMore: false, loaded: 0 }
    set((s) => ({
      loadingMoreBySession: { ...s.loadingMoreBySession, [sessionId]: true },
    }))
    try {
      const myWxid = get().myWxid ?? undefined
      const result = (await api.chat.getMessages(sessionId, offset, limit, undefined, undefined, true)) as MessagesResult
      const raw = unwrapMessages(result)
      const older = raw.map((m) => adaptMessage(m, sessionId, myWxid))
      const hasMore = result.hasMore ?? false
      set((s) => {
        const existing = s.messagesBySession[sessionId] || []
        return {
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: [...older, ...existing],
          },
          hasMoreBySession: { ...s.hasMoreBySession, [sessionId]: hasMore },
          loadingMoreBySession: { ...s.loadingMoreBySession, [sessionId]: false },
        }
      })
      return { hasMore, loaded: older.length }
    } catch (e) {
      console.error('[chatStore] loadMoreMessages 失败:', e)
      set((s) => ({
        loadingMoreBySession: { ...s.loadingMoreBySession, [sessionId]: false },
      }))
      return { hasMore: false, loaded: 0 }
    }
  },

  markSessionRead: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, unreadCount: 0 } : sess
      ),
      markedUnreadMap: { ...s.markedUnreadMap, [sessionId]: false },
    }))
    persistSessionState(sessionId)
  },

  markSessionUnread: (sessionId) => {
    set((s) => ({
      markedUnreadMap: { ...s.markedUnreadMap, [sessionId]: true },
    }))
    persistSessionState(sessionId)
  },

  togglePin: (sessionId) => {
    set((s) => ({
      pinnedMap: { ...s.pinnedMap, [sessionId]: !s.pinnedMap[sessionId] },
    }))
    persistSessionState(sessionId)
  },

  toggleMute: (sessionId) => {
    set((s) => ({
      mutedMap: { ...s.mutedMap, [sessionId]: !s.mutedMap[sessionId] },
    }))
    persistSessionState(sessionId)
  },

  toggleArchive: (sessionId) => {
    set((s) => ({
      archivedMap: { ...s.archivedMap, [sessionId]: !s.archivedMap[sessionId] },
    }))
    persistSessionState(sessionId)
  },

  clearSessionMessages: (sessionId) =>
    set((s) => ({
      messagesBySession: { ...s.messagesBySession, [sessionId]: [] },
    })),

  // === 全局消息搜索 ===
  // 调用 chat.searchMessages（不传 sessionId 即跨会话全局搜索）
  // 后端返回的 Message 带有 sessionId 字段，用于跳转到对应会话
  runSearch: async (keyword) => {
    const trimmed = keyword.trim()
    if (!trimmed) {
      set({ searchKeyword: '', searchResults: [], searchLoading: false, searchError: null })
      return
    }
    set({ searchLoading: true, searchError: null, searchKeyword: trimmed })
    try {
      const api = window.electronAPI
      if (!api?.chat?.searchMessages) {
        set({ searchLoading: false, searchError: '搜索接口不可用', searchResults: [] })
        return
      }
      const result = await api.chat.searchMessages(trimmed, undefined, 50)
      if (!result?.success) {
        set({ searchLoading: false, searchError: result?.error || '搜索失败', searchResults: [] })
        return
      }
      const myWxid = get().myWxid
      // 后端在 searchMessages 中为每个 message 动态注入 sessionId 字段
      const raw = (result.messages || []) as BackendMessage[]
      const messages = raw.map((m) => {
        const sid = String((m as BackendMessage & { sessionId?: string }).sessionId || '')
        return { ...adaptMessage(m, sid, myWxid), sessionId: sid }
      })
      set({ searchResults: messages, searchLoading: false })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ searchLoading: false, searchError: msg, searchResults: [] })
      console.error('[chatStore] runSearch 失败:', e)
    }
  },

  clearSearch: () =>
    set({ searchKeyword: '', searchResults: [], searchLoading: false, searchError: null }),
  }
})

// === 选择器：合并本地状态后的 sessions ===
// 注意：不能在选择器内 .map() 返回新数组，否则 Zustand 的 Object.is 比较会
// 认为每次都变化，导致 React 无限渲染（Maximum update depth exceeded）。
// 改为分别订阅各 slice（引用稳定），再用 useMemo 派生合并结果。
export function useDisplaySessions(): RenderSession[] {
  const sessions = useChatStore((s) => s.sessions)
  const pinnedMap = useChatStore((s) => s.pinnedMap)
  const mutedMap = useChatStore((s) => s.mutedMap)
  const archivedMap = useChatStore((s) => s.archivedMap)
  const markedUnreadMap = useChatStore((s) => s.markedUnreadMap)

  return useMemo(() => {
    return sessions.map((sess) => {
      const markedUnread = markedUnreadMap[sess.id] ?? false
      return {
        ...sess,
        isPinned: pinnedMap[sess.id] ?? sess.isPinned,
        isMuted: mutedMap[sess.id] ?? sess.isMuted,
        isArchived: archivedMap[sess.id] ?? sess.isArchived,
        // 用户主动标记未读时，未读数至少为 1；标记已读时为 0
        unreadCount: markedUnread
          ? Math.max(1, sess.unreadCount)
          : sess.unreadCount,
      }
    })
  }, [sessions, pinnedMap, mutedMap, archivedMap, markedUnreadMap])
}
