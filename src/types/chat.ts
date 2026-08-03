// === 聊天模块类型定义 ===

export interface ChatSession {
  id: string
  name: string
  avatarText: string  // mock 用首字母
  avatarColor: string  // mock 用背景色
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
  isPinned: boolean
  isGroup: boolean
  memberCount?: number
  messageCount: number
  /** 是否已静音（右键菜单操作） */
  isMuted?: boolean
  /** 是否已归档（右键菜单操作，归档后不在主列表显示） */
  isArchived?: boolean
}

export type MessageType = 'text' | 'image' | 'voice' | 'video' | 'emoji' | 'system'

export interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  isMe: boolean
  type: MessageType
  content: string
  timestamp: number
  isRecalled: boolean
  duration?: number  // 语音/视频时长（秒）
  /** 发送状态：sending=发送中、sent=已送达、read=已读 */
  status?: 'sending' | 'sent' | 'read'
}
