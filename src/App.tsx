import { useEffect } from 'react'
import { AppLayout } from '@/components/Layout/AppLayout'
import './App.scss'

function App() {
  useEffect(() => {
    // 初始化主题：跟随系统，并订阅系统主题变化
    const applyTheme = async () => {
      try {
        const current = await window.electronAPI?.theme?.get()
        const resolved = current === 'dark' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', resolved)
      } catch {
        // 降级：跟随系统 CSS 媒体查询（global.scss 已处理）
      }
    }
    applyTheme()

    // 监听系统主题变化（通过 matchMedia）
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      // 仅在用户选择"跟随系统"时更新
      const currentAttr = document.documentElement.getAttribute('data-theme')
      if (!currentAttr) {
        // 未显式设置，跟随系统
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return <AppLayout />
}

export default App
