import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useUIStore, type ThemeMode } from '@/stores/uiStore'
import './ThemeSettings.scss'

const THEME_OPTIONS: Array<{
  id: ThemeMode
  label: string
  icon: typeof Sun
}> = [
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
  { id: 'system', label: '跟随系统', icon: Monitor }
]

/**
 * 主题设置卡片
 */
export function ThemeSettings() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const [applying, setApplying] = useState(false)

  // 初始化：读取当前主题
  useEffect(() => {
    window.electronAPI?.theme?.get().then((current) => {
      // electron 返回 'light' | 'dark'，system 模式由 nativeTheme.themeSource='system' 处理
      // 这里仅同步显示，不强制覆盖
    }).catch(() => {})
  }, [])

  const handleSelect = async (mode: ThemeMode) => {
    setTheme(mode)
    setApplying(true)
    try {
      // 调用主进程切换 nativeTheme
      await window.electronAPI?.theme?.set(mode)
      // 更新 DOM data-theme 属性
      if (mode === 'system') {
        // 跟随系统：移除显式属性，让 CSS @media 接管
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', mode)
      }
    } catch {
      // 降级：仅切换 DOM
      if (mode === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', mode)
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <section className="theme-settings">
      <h3 className="theme-settings__title">主题</h3>
      <div className="theme-settings__options">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon
          const isActive = theme === option.id
          return (
            <button
              key={option.id}
              className={`theme-settings__option ${isActive ? 'theme-settings__option--active' : ''}`}
              onClick={() => handleSelect(option.id)}
              disabled={applying}
              aria-pressed={isActive}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
