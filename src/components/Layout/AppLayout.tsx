import { useEffect, useState } from 'react'
import { TitleBar } from '@/components/TitleBar/TitleBar'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ChatModule } from '@/components/ChatModule/ChatModule'
import { SettingsPage } from '@/components/SettingsPage/SettingsPage'
import { ContactsPage } from '@/components/ContactsPage/ContactsPage'
import { SnsPage } from '@/components/SnsPage/SnsPage'
import { AiChatPage } from '@/components/AiChatPage/AiChatPage'
import { AnalyticsPage } from '@/components/AnalyticsPage/AnalyticsPage'
import { ExportPage } from '@/components/ExportPage/ExportPage'
import { ChatAnalyticsHubPage } from '@/components/ChatAnalyticsHubPage/ChatAnalyticsHubPage'
import { BackupPage } from '@/components/BackupPage/BackupPage'
import { InsightInboxPage } from '@/components/InsightInboxPage/InsightInboxPage'
import { GroupAnalyticsPage } from '@/components/GroupAnalyticsPage/GroupAnalyticsPage'
import { AnnualReportPage } from '@/components/AnnualReportPage/AnnualReportPage'
import { MyFootprintPage } from '@/components/MyFootprintPage/MyFootprintPage'
import { ResourcesPage } from '@/components/ResourcesPage/ResourcesPage'
import { AccountManagementPage } from '@/components/AccountManagementPage/AccountManagementPage'
import { PlaceholderPage } from '@/components/PlaceholderPage'
import { OnboardingPage } from '@/components/OnboardingPage/OnboardingPage'
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
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const [isMaximized, setIsMaximized] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
        return <SnsPage />
      case 'ai':
        return <AiChatPage />
      case 'analytics':
        return <AnalyticsPage />
      case 'analyticsHub':
        return <ChatAnalyticsHubPage />
      case 'groupAnalytics':
        return <GroupAnalyticsPage />
      case 'insightInbox':
        return <InsightInboxPage />
      case 'resources':
        return <ResourcesPage />
      case 'annualReport':
        return <AnnualReportPage />
      case 'footprint':
        return <MyFootprintPage />
      case 'export':
        return <ExportPage />
      case 'backup':
        return <BackupPage />
      case 'accountManagement':
        return <AccountManagementPage />
      default:
        return <PlaceholderPage title="Lumina" />
    }
  }

  return (
    <div className={`app-layout ${isMaximized ? 'app-layout--maximized' : ''}`}>
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />
      <div className="app-layout__body">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="app-layout__main" role="main">
          {renderContent()}
        </main>
      </div>

      {/* 设置弹窗（WeFlow 风格：模态覆盖层） */}
      {settingsOpen && (
        <div className="settings-modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <SettingsPage onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
