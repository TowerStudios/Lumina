import type { RenderMessage } from '@/services/chatAdapter'

// === Telegram 消息分组规则 ===
// 来源：tdesktop/Telegram/SourceFiles/history/view/history_view_element.cpp
// 同一发送者在 15 分钟（900 秒）内的连续消息归入同一组（"attached"）
// 跨日强制断组。系统消息独立成组。
export const ATTACH_MESSAGE_TO_PREVIOUS_SECONDS_DELTA = 900 // 15 分钟

export type GroupPosition = 'single' | 'first' | 'middle' | 'last'

export interface GroupedMessage {
  message: RenderMessage
  /** 组内位置 */
  position: GroupPosition
  /** 组首条且为对方消息：显示发送者名 */
  showSender: boolean
  /** 组末条且为对方消息：显示头像 */
  showAvatar: boolean
  /** 是否需要日期分隔符 */
  showDateSeparator: boolean
  /** 日期分隔符文本 */
  dateSeparatorText: string
}

/**
 * 计算每条消息在分组中的位置。
 * 分组条件：
 *   1. 同一发送者（senderId）
 *   2. 与上一条消息时间差 <= 15 分钟
 *   3. 上一条消息非撤回/系统
 *   4. 未跨日
 */
export function groupMessages(
  messages: RenderMessage[],
  formatDateSeparator: (ts: number) => string
): GroupedMessage[] {
  const result: GroupedMessage[] = []
  let lastDate = ''

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = i > 0 ? messages[i - 1] : null
    const next = i < messages.length - 1 ? messages[i + 1] : null

    // 自己撤回的消息不展示，跳过分组影响
    if (msg.isRecalled && msg.isMe) continue

    // 日期分隔符
    const dateText = formatDateSeparator(msg.timestamp)
    const showDateSeparator = dateText !== lastDate
    if (showDateSeparator) lastDate = dateText

    // 判断与上一条是否同组
    const attachedToPrev =
      prev != null &&
      !prev.isRecalled &&
      !msg.isRecalled &&
      prev.type !== 'system' &&
      msg.type !== 'system' &&
      prev.senderId === msg.senderId &&
      msg.timestamp - prev.timestamp <= ATTACH_MESSAGE_TO_PREVIOUS_SECONDS_DELTA * 1000 &&
      !showDateSeparator

    // 判断与下一条是否同组
    const attachedToNext =
      next != null &&
      !next.isRecalled &&
      !msg.isRecalled &&
      next.type !== 'system' &&
      msg.type !== 'system' &&
      next.senderId === msg.senderId &&
      next.timestamp - msg.timestamp <= ATTACH_MESSAGE_TO_PREVIOUS_SECONDS_DELTA * 1000 &&
      formatDateSeparator(next.timestamp) === dateText

    let position: GroupPosition
    if (attachedToPrev && attachedToNext) {
      position = 'middle'
    } else if (attachedToPrev && !attachedToNext) {
      position = 'last'
    } else if (!attachedToPrev && attachedToNext) {
      position = 'first'
    } else {
      position = 'single'
    }

    // 头像显示规则：对方消息且组末条或独立
    const showAvatar = !msg.isMe && (position === 'last' || position === 'single')
    // 发送者名规则：对方消息且组首条或独立
    const showSender = !msg.isMe && (position === 'first' || position === 'single')

    result.push({
      message: msg,
      position,
      showSender,
      showAvatar,
      showDateSeparator,
      dateSeparatorText: dateText,
    })
  }

  return result
}
