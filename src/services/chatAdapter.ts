// === 聊天数据适配层 ===
// 把后端 chatService 返回的 { success, sessions/messages, error } 包裹结构
// 解包并转换为渲染层使用的 RenderSession / RenderMessage。
//
// 后端契约（electron/services/chatService.ts）：
//   getSessions()        -> { success, sessions?: ChatSession[], error? }
//   getMessages()        -> { success, messages?: Message[], hasMore?, nextOffset?, error? }
//   getMyAvatarUrl()     -> { success, avatarUrl?, error? }
//   getContactAvatar()   -> { avatarUrl?, displayName? } | null
//
// 渲染层契约（ChatList / ChatView / messageGrouping）：
//   RenderSession  - 含 avatarText/avatarColor/isGroup/lastMessage/lastMessageTime 等
//   RenderMessage  - 含 isMe/type/content/timestamp/isRecalled/avatarUrl 等

// ---------------- 后端类型（与 chatService.ts 接口对齐，仅声明用到的字段） ----------------

export interface BackendChatSession {
  username: string
  type: number
  unreadCount: number
  summary: string
  sortTimestamp: number
  lastTimestamp: number
  lastMsgType: number
  messageCountHint?: number
  displayName?: string
  avatarUrl?: string
  lastMsgSender?: string
  lastSenderDisplayName?: string
  selfWxid?: string
  isFolded?: boolean
  isMuted?: boolean
}

export interface BackendContact {
  username: string
  displayName?: string
  remark?: string
  nickname?: string
  alias?: string
  labels?: string[]
  description?: string
  detailDescription?: string
  region?: string
  avatarUrl?: string
  type?: 'friend' | 'group' | 'official' | 'former_friend' | 'blocked' | 'other'
  officialAccountKind?: 'subscription' | 'service' | 'enterprise' | 'unknown'
  officialAccountType?: number
}

export interface BackendMessage {
  messageKey: string
  localId: number
  serverId: number
  localType: number
  createTime: number
  sortSeq: number
  isSend: number | null
  senderUsername: string | null
  parsedContent: string
  rawContent: string
  content?: string
  // 表情
  emojiCdnUrl?: string
  emojiLocalPath?: string
  // 引用
  quotedContent?: string
  quotedSender?: string
  // 媒体
  voiceDurationSeconds?: number
  videoMd5?: string
  imageMd5?: string
  // Type 49 细分
  linkTitle?: string
  linkUrl?: string
  fileName?: string
  fileSize?: number
  fileExt?: string
  xmlType?: string
  appMsgKind?: string
  appMsgDesc?: string
  // 位置
  locationPoiname?: string
  locationLabel?: string
  // 名片
  cardNickname?: string
  cardUsername?: string
}

// ---------------- 渲染层类型 ----------------

export type RenderMessageType =
  | 'text'
  | 'image'
  | 'voice'
  | 'video'
  | 'emoji'
  | 'file'
  | 'link'
  | 'location'
  | 'card'
  | 'recall'
  | 'system'

export interface RenderSession {
  id: string
  name: string
  avatarText: string
  avatarColor: string
  avatarUrl?: string
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
  isPinned: boolean
  isGroup: boolean
  memberCount?: number
  messageCount: number
  isMuted?: boolean
  isArchived?: boolean
}

export interface RenderMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  isMe: boolean
  type: RenderMessageType
  content: string
  timestamp: number
  isRecalled: boolean
  duration?: number
  status?: 'sending' | 'sent' | 'read'
  avatarUrl?: string
  // 引用消息（便于后续渲染引用气泡）
  quotedContent?: string
  quotedSender?: string
  // 原始 localId（用于图片解密等需要定位原始消息的 IPC 调用）
  localId?: number
}

// === 渲染层联系人类型 ===
export type RenderContactType = 'friend' | 'group' | 'official' | 'former_friend' | 'blocked' | 'other'

export interface RenderContact {
  /** 微信 username（wxid / wxid_xxx / gh_xxx / @chatroom） */
  username: string
  /** 展示名（备注优先，其次昵称） */
  displayName: string
  /** 备注名 */
  remark?: string
  /** 昵称 */
  nickname?: string
  /** 微信号 */
  alias?: string
  /** 地区 */
  region?: string
  /** 个性签名 / 描述 */
  description?: string
  /** 朋友圈签名 */
  detailDescription?: string
  /** 头像 URL（已升级为 https） */
  avatarUrl?: string
  /** 头像占位文字（首字） */
  avatarText: string
  /** 头像背景色（基于 username 哈希） */
  avatarColor: string
  /** 联系人分类 */
  type: RenderContactType
  /** 公众号子类型 */
  officialAccountKind?: 'subscription' | 'service' | 'enterprise' | 'unknown'
  /** 拼音首字母（A-Z），非字母字符归为 '#' */
  sortKey: string
}

/** 按首字母分组的联系人 */
export interface ContactGroup {
  key: string
  contacts: RenderContact[]
}

// ---------------- 工具函数 ----------------

/**
 * 处理 createTime 的秒/毫秒歧义。
 * README 硬约束：createTime > 1e12 视为毫秒，否则视为秒需 *1000。
 */
function normalizeTimestamp(ts: number): number {
  if (!ts || !Number.isFinite(ts)) return 0
  return ts > 1e12 ? ts : ts * 1000
}

/**
 * Telegram 风格的彩色头像背景：基于 id 哈希生成稳定颜色
 * 采用 TG 官方 userpic palette（8 色，与 TG 桌面/移动端一致）
 * 参考：Telegram/SourceFiles/ui/colorization.cpp 的 kColors 数组
 */
const AVATAR_PALETTE = [
  '#e17076', // red
  '#ee7aae', // pink
  '#7bc862', // green
  '#6ec9cb', // mint
  '#65aadd', // blue
  '#a695e7', // purple
  '#faa774', // orange
  '#9aa66b', // olive
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function avatarColorFor(id: string): string {
  return AVATAR_PALETTE[hashString(id) % AVATAR_PALETTE.length]
}

/** 取首字符作为头像占位文字（中文取第一个字，英文取大写首字母） */
function avatarTextFor(name: string): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '#'
  const first = trimmed.charAt(0)
  return /[a-z]/.test(first) ? first.toUpperCase() : first
}

/** 判断是否群聊会话（微信群 username 以 @chatroom 结尾） */
function isGroupSession(username: string): boolean {
  return String(username || '').endsWith('@chatroom')
}

/** 清理显示名：去掉首尾空白，空值兜底 */
function safeName(displayName: string | undefined, username: string): string {
  const name = (displayName || '').trim()
  return name || username || '未知会话'
}

// ---------------- 微信 localType → RenderMessageType 映射 ----------------

/**
 * 微信消息 localType 取值（来自 chatService.getSessionSummaryFromMessage）：
 *   1=文本  3=图片  34=语音  42=名片  43=视频  47=表情
 *   48=位置  49=appmsg(文件/链接/转账等)  50=VoIP  10000=系统  10002=撤回
 */
function mapMessageType(localType: number, msg: BackendMessage): RenderMessageType {
  switch (Number(localType || 0)) {
    case 1:
      return 'text'
    case 3:
      return 'image'
    case 34:
      return 'voice'
    case 43:
      return 'video'
    case 47:
      return 'emoji'
    case 48:
      return 'location'
    case 42:
      return 'card'
    case 50:
      return 'system' // VoIP 通话归入系统消息样式
    case 10000:
      return 'system'
    case 10002:
      return 'recall'
    case 49: {
      // appmsg 细分：优先看 appMsgKind，其次 xmlType
      const kind = String(msg.appMsgKind || '').toLowerCase()
      const xmlType = String(msg.xmlType || '').toLowerCase()
      // 文件类
      if (
        kind === 'file' ||
        xmlType === '6' ||
        !!msg.fileName
      ) {
        return 'file'
      }
      // 链接类
      return 'link'
    }
    default:
      return 'text'
  }
}

/** 根据消息类型提取展示用 content */
function extractMessageContent(msg: BackendMessage, type: RenderMessageType): string {
  switch (type) {
    case 'text':
    case 'emoji':
      return msg.parsedContent || msg.content || msg.rawContent || ''
    case 'image':
      return '[图片]'
    case 'voice':
      return '[语音]'
    case 'video':
      return '[视频]'
    case 'location':
      return msg.locationPoiname || msg.locationLabel || '[位置]'
    case 'card':
      return msg.cardNickname || '[名片]'
    case 'file':
      return msg.fileName || msg.linkTitle || '[文件]'
    case 'link':
      return msg.linkTitle || msg.appMsgDesc || '[链接]'
    case 'recall':
      return '撤回了一条消息'
    case 'system':
      return msg.parsedContent || msg.content || msg.rawContent || ''
    default:
      return msg.parsedContent || msg.rawContent || ''
  }
}

// ---------------- 适配函数 ----------------

/**
 * 适配会话：BackendChatSession → RenderSession
 * @param backend  后端 ChatSession
 * @param myWxid   当前账号 wxid（用于排除自己，可选）
 */
export function adaptSession(backend: BackendChatSession, myWxid?: string | null): RenderSession {
  const id = String(backend.username || '')
  const name = safeName(backend.displayName, id)
  const isGroup = isGroupSession(id)
  const lastTs = normalizeTimestamp(backend.lastTimestamp || backend.sortTimestamp || 0)

  return {
    id,
    name,
    avatarText: avatarTextFor(name),
    avatarColor: avatarColorFor(id),
    avatarUrl: backend.avatarUrl,
    lastMessage: backend.summary || '',
    lastMessageTime: lastTs,
    unreadCount: Number(backend.unreadCount || 0),
    isPinned: false, // 后端未返回，默认 false，前端 pinnedMap 覆盖
    isGroup,
    memberCount: undefined, // 后端 ChatSession 未提供，留空
    messageCount: Number(backend.messageCountHint || 0),
    isMuted: !!backend.isMuted,
    isArchived: false,
  }
}

/**
 * 适配消息：BackendMessage → RenderMessage
 * @param backend   后端 Message
 * @param sessionId 会话 ID
 * @param myWxid    当前账号 wxid（用于判断 isMe）
 */
export function adaptMessage(
  backend: BackendMessage,
  sessionId: string,
  myWxid?: string | null
): RenderMessage {
  const senderId = String(backend.senderUsername || '')
  const isMe =
    backend.isSend === 1 ||
    (myWxid ? senderId === myWxid : backend.isSend === 1)
  const type = mapMessageType(backend.localType, backend)
  const content = extractMessageContent(backend, type)
  const timestamp = normalizeTimestamp(backend.createTime || 0)

  return {
    id: String(backend.messageKey || backend.localId || backend.serverId || ''),
    sessionId,
    senderId,
    senderName: '', // 由调用方按需补充（getContactAvatar 返回 displayName）
    isMe,
    type,
    content,
    timestamp,
    isRecalled: type === 'recall' || Number(backend.localType) === 10002,
    duration: type === 'voice' ? backend.voiceDurationSeconds : undefined,
    status: isMe ? 'read' : undefined, // 历史消息默认已读
    avatarUrl: undefined, // 由调用方按需补充
    quotedContent: backend.quotedContent,
    quotedSender: backend.quotedSender,
    localId: Number(backend.localId) || undefined,
  }
}

// === 联系人适配 ===

const CONTACT_TYPE_VALUES: RenderContactType[] = [
  'friend',
  'group',
  'official',
  'former_friend',
  'blocked',
  'other',
]

/**
 * 计算 displayName 首字母作为 sortKey。
 * - 中文字符 / 全角字符 / 数字 / 符号 → '#'
 * - 英文字母 → 大写首字母
 * 不引入 pinyin 库，避免体积膨胀；后续可按需替换。
 */
function computeSortKey(displayName: string): string {
  const trimmed = (displayName || '').trim()
  if (!trimmed) return '#'
  const first = trimmed.charAt(0)
  if (/^[A-Za-z]$/.test(first)) {
    return first.toUpperCase()
  }
  return '#'
}

/**
 * 适配联系人：BackendContact → RenderContact
 * - avatarUrl 自动升级 http → https（CSP img-src 兼容）
 * - displayName 取 remark → nickname → username 兜底
 * - type 缺省时按 username 推断（@chatroom 群聊 / gh_ 公众号 / 其它好友）
 */
export function adaptContact(backend: BackendContact): RenderContact {
  const username = String(backend.username || '')
  const remark = (backend.remark || '').trim() || undefined
  const nickname = (backend.nickname || '').trim() || undefined
  const displayName =
    remark || nickname || (backend.displayName || '').trim() || username

  let type: RenderContactType =
    backend.type && CONTACT_TYPE_VALUES.includes(backend.type)
      ? backend.type
      : username.endsWith('@chatroom')
      ? 'group'
      : username.startsWith('gh_')
      ? 'official'
      : 'friend'

  // 公众号 type 字段有时缺失，按 gh_ 前缀补齐
  if (type === 'friend' && username.startsWith('gh_')) {
    type = 'official'
  }

  const avatarUrl = backend.avatarUrl
    ? backend.avatarUrl.startsWith('http://')
      ? 'https://' + backend.avatarUrl.substring(7)
      : backend.avatarUrl
    : undefined

  return {
    username,
    displayName,
    remark,
    nickname,
    alias: (backend.alias || '').trim() || undefined,
    region: (backend.region || '').trim() || undefined,
    description: (backend.description || '').trim() || undefined,
    detailDescription: (backend.detailDescription || '').trim() || undefined,
    avatarUrl,
    avatarText: avatarTextFor(displayName),
    avatarColor: avatarColorFor(username),
    type,
    officialAccountKind: backend.officialAccountKind,
    sortKey: computeSortKey(displayName),
  }
}

/**
 * 将扁平联系人列表按 sortKey 分组（A-Z + #），返回有序分组。
 * - 字母组按 A→Z 顺序，'#' 组排末尾
 * - 每组内联系人按 displayName 排序（大小写不敏感）
 */
export function groupContactsBySortKey(contacts: RenderContact[]): ContactGroup[] {
  const buckets = new Map<string, RenderContact[]>()
  for (const c of contacts) {
    const key = c.sortKey
    const arr = buckets.get(key) || []
    arr.push(c)
    buckets.set(key, arr)
  }
  const letterKeys = Array.from(buckets.keys()).filter((k) => k !== '#').sort()
  const orderedKeys = buckets.has('#') ? [...letterKeys, '#'] : letterKeys
  return orderedKeys.map((key) => ({
    key,
    contacts: (buckets.get(key) || []).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
    ),
  }))
}

// ---------------- 后端包裹结构解包辅助 ----------------

/** 后端统一返回结构：{ success, error, ...data } */
interface BackendResult<T> {
  success: boolean
  error?: string
}

export interface SessionsResult extends BackendResult<unknown> {
  sessions?: BackendChatSession[]
}

export interface MessagesResult extends BackendResult<unknown> {
  messages?: BackendMessage[]
  hasMore?: boolean
  nextOffset?: number
}

export interface AvatarResult extends BackendResult<unknown> {
  avatarUrl?: string
}

export interface ContactsResult extends BackendResult<unknown> {
  contacts?: BackendContact[]
}

/** 解包会话列表结果，失败时抛错（由调用方 catch） */
export function unwrapSessions(result: SessionsResult | null | undefined): BackendChatSession[] {
  if (!result) return []
  if (!result.success) {
    throw new Error(result.error || '获取会话列表失败')
  }
  return Array.isArray(result.sessions) ? result.sessions : []
}

/** 解包消息列表结果，失败时抛错 */
export function unwrapMessages(result: MessagesResult | null | undefined): BackendMessage[] {
  if (!result) return []
  if (!result.success) {
    throw new Error(result.error || '获取消息失败')
  }
  return Array.isArray(result.messages) ? result.messages : []
}

/** 解包头像 URL 结果，失败/空时返回 null */
export function unwrapAvatarUrl(result: AvatarResult | null | undefined): string | null {
  if (!result || !result.success) return null
  return result.avatarUrl || null
}

/** 解包联系人列表结果，失败时抛错 */
export function unwrapContacts(result: ContactsResult | null | undefined): BackendContact[] {
  if (!result) return []
  if (!result.success) {
    throw new Error(result.error || '获取联系人列表失败')
  }
  return Array.isArray(result.contacts) ? result.contacts : []
}
