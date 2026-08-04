import { useEffect, useState, useRef } from 'react'
import {
  MessageCircle,
  Users,
  Image as ImageIcon,
  Sparkles,
  BarChart3,
  Download,
  Settings,
  Lightbulb,
  FolderOpen,
  CalendarHeart,
  Footprints,
  ArchiveRestore,
  Database,
  ChevronUp,
} from 'lucide-react'
import { useUIStore, type NavSection } from '@/stores/uiStore'
import './Sidebar.scss'

interface NavItem {
  id: NavSection
  label: string
  icon: typeof MessageCircle
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chats', label: '聊天', icon: MessageCircle },
  { id: 'contacts', label: '联系人', icon: Users },
  { id: 'sns', label: '朋友圈', icon: ImageIcon },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'insightInbox', label: '灵感信箱', icon: Lightbulb },
  { id: 'resources', label: '资源浏览', icon: FolderOpen },
  { id: 'analyticsHub', label: '聊天分析', icon: BarChart3 },
  { id: 'annualReport', label: '年度报告', icon: CalendarHeart },
  { id: 'footprint', label: '我的足迹', icon: Footprints },
  { id: 'export', label: '导出', icon: Download },
  { id: 'backup', label: '备份', icon: Database },
]

/** WeFlow 风格用户信息缓存 key */
const USER_CACHE_KEY = 'lumina_sidebar_user_v1'

interface UserProfile {
  avatarUrl?: string
  displayName?: string
  wxid?: string
  alias?: string
}

export function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const activeSection = useUIStore((s) => s.activeSection)
  const setActiveSection = useUIStore((s) => s.setActiveSection)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile>(() => {
    try { return JSON.parse(localStorage.getItem(USER_CACHE_KEY) || '{}') } catch { return {} }
  })
  const menuRef = useRef<HTMLDivElement>(null)
  const loadSeq = useRef(0)

  // 加载用户头像+昵称+wxid（并行 + 竞态控制）
  useEffect(() => {
    const seq = ++loadSeq.current
    let cancelled = false
    async function load() {
      try {
        const wxid = await window.electronAPI?.config?.get('myWxid')
        const [contact, avatarUrl] = await Promise.all([
          wxid ? window.electronAPI?.chat?.getContact(String(wxid)) : Promise.resolve(null),
          window.electronAPI?.chat?.getMyAvatarUrl?.() ?? Promise.resolve(null),
        ])
        if (cancelled || seq !== loadSeq.current) return
        const p: UserProfile = {
          wxid: String(wxid || ''),
          displayName: (contact as any)?.remark || (contact as any)?.nickname || (contact as any)?.displayName || '微信用户',
          alias: (contact as any)?.alias || (contact as any)?.wechatId || (contact as any)?.username || '',
          avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : (profile.avatarUrl || ''),
        }
        setProfile(p)
        try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(p)) } catch {}
      } catch { /* 忽略 */ }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // 点击菜单外关闭
  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  return (
    <nav className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`} role="navigation" aria-label="主导航">
      <div className="sidebar__top">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => { setActiveSection(item.id); setUserMenuOpen(false) }}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              <Icon size={22} strokeWidth={1.75} />
              {!collapsed && <span className="sidebar__item-label">{item.label}</span>}
            </button>
          )
        })}
      </div>

      {/* 底部用户区域（WeFlow 风格） */}
      <div className="sidebar__user" ref={menuRef}>
        <button
          className="sidebar__user-btn"
          onClick={() => setUserMenuOpen((v) => !v)}
          title="账号与设置"
        >
          <div className="sidebar__user-avatar">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" />
            ) : (
              <span>{profile.displayName?.charAt(0) || 'Me'}</span>
            )}
          </div>
          {!collapsed && (
            <>
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{profile.displayName || '微信用户'}</span>
                <span className="sidebar__user-wxid">{profile.alias || profile.wxid || '微信账号'}</span>
              </div>
              <ChevronUp
                size={14}
                className={`sidebar__user-chevron ${userMenuOpen ? 'sidebar__user-chevron--open' : ''}`}
              />
            </>
          )}
        </button>

        {userMenuOpen && (
          <div className="sidebar__user-menu">
            <button
              className="sidebar__user-menu-item"
              onClick={() => { setActiveSection('accountManagement'); setUserMenuOpen(false) }}
            >
              <Users size={15} /> 账号管理
            </button>
            <button
              className="sidebar__user-menu-item"
              onClick={() => { setSettingsOpen(true); setUserMenuOpen(false) }}
            >
              <Settings size={15} /> 设置
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
