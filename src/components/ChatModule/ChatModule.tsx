import { ChatList } from '@/components/ChatList/ChatList'
import { ChatView } from '@/components/ChatView/ChatView'
import { ChatDetailPanel } from '@/components/ChatDetailPanel/ChatDetailPanel'
import { useUIStore } from '@/stores/uiStore'
import { useLayoutMode } from '@/hooks/useWindowSize'
import { useResizable } from '@/hooks/useResizable'
import './ChatModule.scss'

/**
 * 聊天模块 - 1/2/3 栏自适应切换
 *
 * - narrow (<700px):  单栏切换（列表 ↔ 聊天视图）
 * - medium (700-1100): 两栏（列表 + 聊天视图/空状态）
 * - wide (>1100px):   三栏（列表 + 聊天视图 + 详情面板）
 *
 * 会话列表宽度可手动拖动（参考 Telegram ResizeArea）
 * - 列宽限制：260px - 540px
 * - 持久化到 localStorage
 */
export function ChatModule() {
  const layoutMode = useLayoutMode()
  const activeChatId = useUIStore((s) => s.activeChatId)
  const setActiveChatId = useUIStore((s) => s.setActiveChatId)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)

  // 会话列表宽度（仅 medium / wide 模式生效）
  const { width: listWidth, isResizing, startResize } = useResizable({
    initial: 320,
    min: 260,
    max: 540,
    storageKey: 'lumina.chatListWidth',
  })

  // 窄屏：单栏切换
  if (layoutMode === 'narrow') {
    if (activeChatId) {
      return (
        <div className="chat-module chat-module--single">
          <ChatView showBackButton onBack={() => setActiveChatId(null)} />
        </div>
      )
    }
    return (
      <div className="chat-module chat-module--single">
        <ChatList />
      </div>
    )
  }

  // 中屏 / 宽屏：两栏或三栏
  return (
    <div className={`chat-module chat-module--${layoutMode} ${isResizing ? 'chat-module--resizing' : ''}`}>
      <div className="chat-module__list" style={{ width: listWidth }}>
        <ChatList />
      </div>

      {/* 拖动分隔条 */}
      <div
        className="chat-module__resize-area"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整会话列表宽度"
        tabIndex={0}
      />

      <div className="chat-module__view">
        <ChatView />
      </div>
      {layoutMode === 'wide' && detailPanelOpen && (
        <div className="chat-module__detail">
          <ChatDetailPanel />
        </div>
      )}
    </div>
  )
}
