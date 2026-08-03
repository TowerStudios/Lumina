import {
  MessageCircle,
  Users,
  Image as ImageIcon,
  Sparkles,
  BarChart3,
  Download,
  Settings,
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
  { id: 'analytics', label: '分析', icon: BarChart3 },
  { id: 'export', label: '导出', icon: Download },
]

export function Sidebar() {
  const activeSection = useUIStore((s) => s.activeSection)
  const setActiveSection = useUIStore((s) => s.setActiveSection)

  return (
    <nav className="sidebar" role="navigation" aria-label="主导航">
      <div className="sidebar__top">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => setActiveSection(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              <Icon size={22} strokeWidth={1.75} />
              <span className="sidebar__item-label">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="sidebar__bottom">
        <button
          className={`sidebar__item ${activeSection === 'settings' ? 'sidebar__item--active' : ''}`}
          onClick={() => setActiveSection('settings')}
          title="设置"
          aria-label="设置"
          aria-pressed={activeSection === 'settings'}
        >
          <Settings size={22} strokeWidth={1.75} />
          <span className="sidebar__item-label">设置</span>
        </button>
      </div>
    </nav>
  )
}
