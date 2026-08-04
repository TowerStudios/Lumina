import { ArrowRight, MessageSquare, Users } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import './ChatAnalyticsHubPage.scss'

/** 聊天分析入口枢纽 */
export function ChatAnalyticsHubPage() {
  const setActiveSection = useUIStore((s) => s.setActiveSection)

  return (
    <div className="analytics-hub">
      <div className="analytics-hub-inner">
        <div className="analytics-hub-hero">
          <h1>聊天分析</h1>
          <p>个人对话统计 · 群聊活跃分析</p>
        </div>
        <div className="analytics-hub-cards">
          <button
            className="analytics-hub-card"
            onClick={() => setActiveSection('analytics')}
          >
            <MessageSquare size={28} strokeWidth={1.5} />
            <div className="analytics-hub-card-body">
              <span className="analytics-hub-card-title">个人聊天分析</span>
              <span className="analytics-hub-card-desc">消息统计、时段分布、联系人排行</span>
            </div>
            <ArrowRight size={18} />
          </button>
          <button
            className="analytics-hub-card"
            onClick={() => setActiveSection('groupAnalytics')}
          >
            <Users size={28} strokeWidth={1.5} />
            <div className="analytics-hub-card-body">
              <span className="analytics-hub-card-title">群聊分析</span>
              <span className="analytics-hub-card-desc">群成员活跃度 · 发言排行</span>
            </div>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
