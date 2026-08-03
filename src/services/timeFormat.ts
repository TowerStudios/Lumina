// === 时间格式化工具 ===
// 与 chatAdapter 一起使用，供 ChatList/ChatView 共享

/** 会话列表时间显示（简短） */
export function formatSessionTime(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  const oneDay = 1000 * 60 * 60 * 24

  if (diff < oneDay && date.getDate() === now.getDate()) {
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }
  if (diff < oneDay * 2) return '昨天'
  if (diff < oneDay * 7) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[date.getDay()]
  }
  const mo = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${mo}/${d}`
}

/** 消息时间显示（时:分） */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/** 日期分隔符文本 */
export function formatDateSeparator(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const oneDay = 1000 * 60 * 60 * 24
  const diff = now.getTime() - timestamp

  if (diff < oneDay && date.getDate() === now.getDate()) return '今天'
  if (diff < oneDay * 2) return '昨天'
  const y = date.getFullYear()
  const mo = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}年${mo}月${d}日`
}
