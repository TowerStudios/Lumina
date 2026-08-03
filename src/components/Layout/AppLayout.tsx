import { useEffect, useState } from 'react'
import { TitleBar } from '@/components/TitleBar/TitleBar'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ChatModule } from '@/components/ChatModule/ChatModule'
import { SettingsPage } from '@/components/SettingsPage/SettingsPage'
import { ContactsPage } from '@/components/ContactsPage/ContactsPage'
import { PlaceholderPage } from '@/components/PlaceholderPage'
import { OnboardingPage } from '@/components/OnboardingPage/OnboardingPage'
import {
  Image as ImageIcon,
  Sparkles,
  BarChart3,
  Download,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useWindowSizeSync } from '@/hooks/useWindowSize'
import './AppLayout.scss'

/**
 * 应用主布局
 * - 顶部 TitleBar
 * - 左侧 Sidebar 导航
 * - 右侧主内容区（根据 activeSection 渲染）
 * - 外层圆角窗口（最大化时取消圆角以贴边显示）
 *
 * 首次启动检测 config.onboardingDone，未完成时显示 OnboardingPage。
 */
export function AppLayout() {
  useWindowSizeSync()

  const activeSection = useUIStore((s) => s.activeSection)
  const [isMaximized, setIsMaximized] = useState(false)

  // === Onboarding 检测 ===
  // onboardingChecking: 正在读取配置；onboardingDone: 是否已完成引导
  const [onboardingChecking, setOnboardingChecking] = useState(true)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const done = await window.electronAPI?.config?.get('onboardingDone')
        if (!cancelled) setOnboardingDone(!!done)
      } catch {
        // 读取失败视为未完成，让用户走 Onboarding
        if (!cancelled) setOnboardingDone(false)
      } finally {
        if (!cancelled) setOnboardingChecking(false)
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  // 订阅窗口最大化状态：最大化时取消圆角与阴影
  useEffect(() => {
    window.electronAPI?.window?.isMaximized().then(setIsMaximized).catch(() => {})
    const unsubscribe = window.electronAPI?.window?.onMaximizeChange(setIsMaximized)
    return () => {
      unsubscribe?.()
    }
  }, [])

  // Onboarding 完成回调：刷新状态，进入主界面
  const handleOnboardingComplete = () => {
    setOnboardingDone(true)
  }

  // 正在检查 onboarding 状态：显示空白避免闪烁
  if (onboardingChecking) {
    return <div className="app-layout app-layout--loading" />
  }

  // 未完成 Onboarding：显示引导页（不含 Sidebar/TitleBar，全屏引导）
  if (!onboardingDone) {
    return <OnboardingPage onComplete={handleOnboardingComplete} />
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'chats':
        return <ChatModule />
      case 'contacts':
        return <ContactsPage />
      case 'sns':
        return <PlaceholderPage title="朋友圈" description="朋友圈时间线、防删、导出。" icon={<ImageIcon size={48} strokeWidth={1} />} />
      case 'ai':
        return <PlaceholderPage title="AI 助手" description="多轮对话、画像、见解、群摘要。" icon={<Sparkles size={48} strokeWidth={1} />} />
      case 'analytics':
        return <PlaceholderPage title="数据分析" description="个人/群聊统计、年度报告、词云、热力图。" icon={<BarChart3 size={48} strokeWidth={1} />} />
      case 'export':
        return <PlaceholderPage title="导出" description="10 种格式导出、自动化任务、暂停恢复。" icon={<Download size={48} strokeWidth={1} />} />
      case 'settings':
        return <SettingsPage />
      default:
        return <PlaceholderPage title="Lumina" />
    }
  }

  return (
    <div className={`app-layout ${isMaximized ? 'app-layout--maximized' : ''}`}>
      <TitleBar />
      <div className="app-layout__body">
        <Sidebar />
        <main className="app-layout__main" role="main">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
