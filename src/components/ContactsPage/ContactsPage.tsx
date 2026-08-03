import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Users,
  User,
  UserCircle2,
  Megaphone,
  UserMinus,
  Ban,
  MessageCircle,
  MapPin,
  AtSign,
  Loader2,
  X,
} from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useUIStore } from '@/stores/uiStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  groupContactsBySortKey,
  type RenderContact,
  type RenderContactType,
} from '@/services/chatAdapter'
import './ContactsPage.scss'

// === 类型筛选标签 ===
interface FilterTab {
  id: RenderContactType | 'all'
  label: string
  icon: typeof User
}

const FILTER_TABS: FilterTab[] = [
  { id: 'all', label: '全部', icon: Users },
  { id: 'friend', label: '好友', icon: User },
  { id: 'group', label: '群聊', icon: UserCircle2 },
  { id: 'official', label: '公众号', icon: Megaphone },
  { id: 'former_friend', label: '已删', icon: UserMinus },
  { id: 'blocked', label: '屏蔽', icon: Ban },
]

function ContactsPageInner() {
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<RenderContactType | 'all'>('all')

  const contacts = useChatStore((s) => s.contacts)
  const contactsLoading = useChatStore((s) => s.contactsLoading)
  const contactsError = useChatStore((s) => s.contactsError)
  const loadContacts = useChatStore((s) => s.loadContacts)
  const selectedContactId = useChatStore((s) => s.selectedContactId)
  const selectContact = useChatStore((s) => s.selectContact)

  const setActiveSection = useUIStore((s) => s.setActiveSection)
  const setActiveChatId = useUIStore((s) => s.setActiveChatId)

  // 首次挂载加载联系人
  // ref 防止 StrictMode 双调用
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadContacts()
  }, [loadContacts])

  // 搜索 + 类型筛选
  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return contacts.filter((c) => {
      if (activeFilter !== 'all' && c.type !== activeFilter) return false
      if (!query) return true
      return (
        c.displayName.toLowerCase().includes(query) ||
        c.username.toLowerCase().includes(query) ||
        (c.alias?.toLowerCase().includes(query) ?? false) ||
        (c.remark?.toLowerCase().includes(query) ?? false) ||
        (c.nickname?.toLowerCase().includes(query) ?? false)
      )
    })
  }, [contacts, searchQuery, activeFilter])

  const grouped = useMemo(() => groupContactsBySortKey(filteredContacts), [filteredContacts])

  // 各类型计数
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: contacts.length }
    for (const c of contacts) {
      map[c.type] = (map[c.type] || 0) + 1
    }
    return map
  }, [contacts])

  const handleSelect = (username: string) => {
    selectContact(username)
  }

  // 跳转到对应聊天会话
  const handleOpenChat = (username: string) => {
    setActiveChatId(username)
    setActiveSection('chats')
  }

  return (
    <div className="contacts-page">
      {/* === 左侧列表面板 === */}
      <section className="contacts-page__list-panel">
        <header className="contacts-page__header">
          <h1 className="contacts-page__title">联系人</h1>
          <button
            className="contacts-page__search-btn"
            onClick={() => setSearchVisible((v) => !v)}
            aria-label="搜索联系人"
          >
            <Search size={18} />
          </button>
        </header>

        {searchVisible && (
          <div className="contacts-page__search">
            <Search size={14} className="contacts-page__search-icon" />
            <input
              className="contacts-page__search-input"
              placeholder="搜索昵称、备注或微信号"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                className="contacts-page__search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="清空"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* 类型筛选标签 */}
        <div className="contacts-page__filters" role="tablist">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeFilter === tab.id
            const count = counts[tab.id] ?? 0
            // 隐藏数量为 0 的非"全部"标签（避免太长）
            if (tab.id !== 'all' && count === 0) return null
            return (
              <button
                key={tab.id}
                className={`contacts-page__filter ${isActive ? 'contacts-page__filter--active' : ''}`}
                onClick={() => setActiveFilter(tab.id)}
                role="tab"
                aria-selected={isActive}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                <span className="contacts-page__filter-count">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="contacts-page__items" role="listbox">
          {contactsLoading && contacts.length === 0 && (
            <div className="contacts-page__state">
              <Loader2 size={20} className="contacts-page__spinner" />
              <span>加载中…</span>
            </div>
          )}
          {contactsError && (
            <div className="contacts-page__state contacts-page__state--error">
              <span>加载失败</span>
              <button onClick={() => loadContacts(true)}>重试</button>
            </div>
          )}
          {!contactsLoading && !contactsError && grouped.length === 0 && (
            <div className="contacts-page__empty">
              {contacts.length === 0 ? '暂无联系人数据' : '无匹配联系人'}
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.key} className="contacts-page__group">
              <div className="contacts-page__group-label">{group.key}</div>
              {group.contacts.map((contact) => (
                <ContactRow
                  key={contact.username}
                  contact={contact}
                  active={selectedContactId === contact.username}
                  query={searchQuery.trim()}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* === 右侧详情面板 === */}
      <aside className="contacts-page__detail-panel">
        <ContactDetailPanel onOpenChat={handleOpenChat} />
      </aside>
    </div>
  )
}

// === 联系人项 ===
function ContactRow({
  contact,
  active,
  query,
  onSelect,
}: {
  contact: RenderContact
  active: boolean
  query: string
  onSelect: (username: string) => void
}) {
  const displayName = query ? highlightKeyword(contact.displayName, query) : contact.displayName

  return (
    <button
      className={`contacts-page__item ${active ? 'contacts-page__item--active' : ''}`}
      onClick={() => onSelect(contact.username)}
      role="option"
      aria-selected={active}
    >
      <div className="contacts-page__avatar-wrap">
        {contact.avatarUrl ? (
          <img className="contacts-page__avatar-img" src={contact.avatarUrl} alt={contact.displayName} />
        ) : (
          <div
            className="contacts-page__avatar contacts-page__avatar--text"
            style={{ background: contact.avatarColor }}
          >
            {contact.avatarText}
          </div>
        )}
      </div>
      <div className="contacts-page__content">
        <div className="contacts-page__name">{displayName}</div>
        {(contact.alias || contact.remark) && (
          <div className="contacts-page__sub">
            {contact.remark && <span className="contacts-page__remark">备注：{contact.remark}</span>}
            {contact.alias && <span className="contacts-page__alias">微信号：{contact.alias}</span>}
          </div>
        )}
      </div>
      <ContactTypeBadge type={contact.type} />
    </button>
  )
}

function ContactTypeBadge({ type }: { type: RenderContactType }) {
  if (type === 'friend') return null
  const labelMap: Record<RenderContactType, string> = {
    friend: '好友',
    group: '群',
    official: '公众号',
    former_friend: '已删',
    blocked: '屏蔽',
    other: '其他',
  }
  return <span className={`contacts-page__type-badge contacts-page__type-badge--${type}`}>{labelMap[type]}</span>
}

// === 联系人详情面板 ===
function ContactDetailPanel({ onOpenChat }: { onOpenChat: (username: string) => void }) {
  const contact = useChatStore((s) =>
    s.selectedContactId ? s.contacts.find((c) => c.username === s.selectedContactId) ?? null : null
  )

  if (!contact) {
    return (
      <div className="contacts-page__detail-empty">
        <User size={48} strokeWidth={1} />
        <p>选择联系人查看详情</p>
      </div>
    )
  }

  return (
    <div className="contact-detail">
      <div className="contact-detail__header">
        <div className="contact-detail__avatar-wrap">
          {contact.avatarUrl ? (
            <img className="contact-detail__avatar-img" src={contact.avatarUrl} alt={contact.displayName} />
          ) : (
            <div
              className="contact-detail__avatar contact-detail__avatar--text"
              style={{ background: contact.avatarColor }}
            >
              {contact.avatarText}
            </div>
          )}
        </div>
        <h2 className="contact-detail__name">{contact.displayName}</h2>
        {contact.username && (
          <div className="contact-detail__username">{contact.username}</div>
        )}
        <button
          className="contact-detail__chat-btn"
          onClick={() => onOpenChat(contact.username)}
        >
          <MessageCircle size={16} />
          <span>发消息</span>
        </button>
      </div>

      <div className="contact-detail__fields">
        {contact.remark && (
          <Field icon={<User size={14} />} label="备注名" value={contact.remark} />
        )}
        {contact.nickname && contact.nickname !== contact.displayName && (
          <Field icon={<User size={14} />} label="昵称" value={contact.nickname} />
        )}
        {contact.alias && (
          <Field icon={<AtSign size={14} />} label="微信号" value={contact.alias} />
        )}
        {contact.region && (
          <Field icon={<MapPin size={14} />} label="地区" value={contact.region} />
        )}
        {contact.description && (
          <Field icon={<MessageCircle size={14} />} label="个性签名" value={contact.description} />
        )}
        {contact.detailDescription && (
          <Field icon={<MessageCircle size={14} />} label="朋友圈签名" value={contact.detailDescription} />
        )}
      </div>
    </div>
  )
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="contact-detail__field">
      <div className="contact-detail__field-icon">{icon}</div>
      <div className="contact-detail__field-body">
        <div className="contact-detail__field-label">{label}</div>
        <div className="contact-detail__field-value">{value}</div>
      </div>
    </div>
  )
}

/** 关键词高亮：在文本中高亮首个匹配 */
function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text
  const lower = text.toLowerCase()
  const kwLower = keyword.toLowerCase()
  const idx = lower.indexOf(kwLower)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="contacts-page__hit-mark">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  )
}

export function ContactsPage() {
  return (
    <ErrorBoundary
      fallback={
        <div className="contacts-page">
          <div className="contacts-page__state contacts-page__state--error">
            <span>联系人页面渲染失败</span>
          </div>
        </div>
      }
    >
      <ContactsPageInner />
    </ErrorBoundary>
  )
}
