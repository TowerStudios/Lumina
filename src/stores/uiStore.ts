import { create } from 'zustand'

// === 布局模式 ===
// narrow:  < 700px   单栏切换式
// medium:  700-1100px 会话列表 + 内容视图
// wide:    > 1100px  会话列表 + 聊天视图 + AI分析/详情面板
export type LayoutMode = 'narrow' | 'medium' | 'wide'

// === 侧边栏导航项 ===
export type NavSection =
  | 'chats'
  | 'contacts'
  | 'sns'
  | 'ai'
  | 'analytics'
  | 'analyticsHub'
  | 'groupAnalytics'
  | 'insightInbox'
  | 'resources'
  | 'annualReport'
  | 'footprint'
  | 'export'
  | 'backup'
  | 'settings'
  | 'accountManagement'

// === 主题 ===
export type ThemeMode = 'light' | 'dark' | 'system'

// === 右键菜单状态 ===
export interface ContextMenuState {
  /** 显示标志 */
  visible: boolean
  /** 屏幕坐标 x（clientX） */
  x: number
  /** 屏幕坐标 y（clientY） */
  y: number
  /** 关联的会话 ID（用于会话列表右键菜单） */
  sessionId: string | null
}

interface UIState {
  // 布局
  layoutMode: LayoutMode
  setLayoutMode: (mode: LayoutMode) => void

  // 导航
  activeSection: NavSection
  setActiveSection: (section: NavSection) => void

  // 会话选择（聊天页用）
  activeChatId: string | null
  setActiveChatId: (id: string | null) => void

  // 搜索结果定位：跳转到会话后滚动到具体消息并高亮
  pendingTargetMessage: { sessionId: string; messageKey: string } | null
  setPendingTargetMessage: (target: { sessionId: string; messageKey: string } | null) => void

  // 详情/AI 面板（宽屏三栏时右侧）
  detailPanelOpen: boolean
  setDetailPanelOpen: (open: boolean) => void

  // 主题
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void

  // 窄屏单栏栈式导航（narrow 模式下用于返回）
  narrowStack: NavSection[]
  pushNarrow: (section: NavSection) => void
  popNarrow: () => void
  resetNarrow: () => void

  // === 右键菜单 ===
  contextMenu: ContextMenuState
  /** 打开会话右键菜单（在指定坐标显示） */
  openContextMenu: (x: number, y: number, sessionId: string) => void
  /** 关闭右键菜单 */
  closeContextMenu: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  layoutMode: 'wide',
  setLayoutMode: (mode) => set({ layoutMode: mode }),

  activeSection: 'chats',
  setActiveSection: (section) =>
    set({ activeSection: section, narrowStack: [section] }),

  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id }),

  pendingTargetMessage: null,
  setPendingTargetMessage: (target) => set({ pendingTargetMessage: target }),

  detailPanelOpen: false,
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),

  theme: 'system',
  setTheme: (theme) => set({ theme }),

  narrowStack: ['chats'],
  pushNarrow: (section) => {
    const stack = get().narrowStack
    if (stack[stack.length - 1] !== section) {
      set({ narrowStack: [...stack, section] })
    }
  },
  popNarrow: () => {
    const stack = get().narrowStack
    if (stack.length > 1) {
      set({ narrowStack: stack.slice(0, -1) })
    }
  },
  resetNarrow: () => set({ narrowStack: [get().activeSection] }),

  // === 右键菜单 ===
  contextMenu: { visible: false, x: 0, y: 0, sessionId: null },
  openContextMenu: (x, y, sessionId) =>
    set({ contextMenu: { visible: true, x, y, sessionId } }),
  closeContextMenu: () =>
    set((s) => ({ contextMenu: { ...s.contextMenu, visible: false } })),
}))
