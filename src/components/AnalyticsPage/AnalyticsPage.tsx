import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Loader2, RefreshCw, Users, MessageSquare } from 'lucide-react'
import './AnalyticsPage.scss'

interface ChatStatistics {
  totalMessages: number
  textMessages: number
  imageMessages: number
  voiceMessages: number
  videoMessages: number
  emojiMessages: number
  otherMessages: number
  sentMessages: number
  receivedMessages: number
  firstMessageTime: number | null
  lastMessageTime: number | null
  activeDays: number
}

interface ContactRanking {
  username: string
  displayName: string
  messageCount: number
  sentCount: number
  receivedCount: number
}

interface TimeDistribution {
  hourlyDistribution: Record<number, number>
  weekdayDistribution: Record<number, number>
  monthlyDistribution: Record<string, number>
}

const TYPE_LABELS: Array<[keyof ChatStatistics, string]> = [
  ['textMessages', '文本'],
  ['imageMessages', '图片'],
  ['voiceMessages', '语音'],
  ['videoMessages', '视频'],
  ['emojiMessages', '表情'],
  ['otherMessages', '其他'],
]

const TYPE_COLORS = ['#65aadd', '#7bc862', '#e17076', '#a695e7', '#faa774', '#9aa66b']

export function AnalyticsPage() {
  const [stats, setStats] = useState<ChatStatistics | null>(null)
  const [rankings, setRankings] = useState<ContactRanking[]>([])
  const [timeDist, setTimeDist] = useState<TimeDistribution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = async (force = false) => {
    setLoading(true)
    setError('')
    try {
      const api = window.electronAPI?.analytics
      const [s, r, t] = await Promise.all([
        api?.getOverallStatistics(force) as Promise<{ success?: boolean; data?: ChatStatistics; error?: string }>,
        api?.getContactRankings(20) as Promise<{ success?: boolean; data?: ContactRanking[]; error?: string }>,
        api?.getTimeDistribution() as Promise<{ success?: boolean; data?: TimeDistribution; error?: string }>,
      ])
      if (s?.success && s.data) setStats(s.data)
      if (r?.success && r.data) setRankings(r.data)
      if (t?.success && t.data) setTimeDist(t.data)
      if (!s?.success && !r?.success && !t?.success) {
        setError(s?.error || r?.error || t?.error || '数据加载失败')
      }
    } catch {
      setError('数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  // 消息类型占比饼图
  const typePieOption = () => {
    const data = TYPE_LABELS.map(([key, label], i) => ({
      name: label,
      value: stats?.[key] ?? 0,
      itemStyle: { color: TYPE_COLORS[i] },
    })).filter((d) => d.value > 0)
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data,
        },
      ],
    }
  }

  // 24 小时分布柱状图
  const hourlyBarOption = () => {
    const hours = Array.from({ length: 24 }, (_, h) => h)
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 36, right: 12, top: 16, bottom: 24 },
      xAxis: {
        type: 'category',
        data: hours.map((h) => `${h}时`),
        axisLabel: { fontSize: 10, interval: 2 },
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [
        {
          type: 'bar',
          data: hours.map((h) => timeDist?.hourlyDistribution?.[h] ?? 0),
          itemStyle: { color: '#65aadd', borderRadius: [3, 3, 0, 0] },
          barWidth: '60%',
        },
      ],
    }
  }

  // 每周分布折线
  const weekdayLineOption = () => {
    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 36, right: 12, top: 16, bottom: 24 },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: [
        {
          type: 'line',
          smooth: true,
          data: labels.map((_, i) => timeDist?.weekdayDistribution?.[i + 1] ?? 0),
          itemStyle: { color: '#7bc862' },
          areaStyle: { color: 'rgba(123, 200, 98, 0.15)' },
        },
      ],
    }
  }

  const statCards = [
    { label: '总消息', value: stats?.totalMessages ?? 0 },
    { label: '发送', value: stats?.sentMessages ?? 0 },
    { label: '接收', value: stats?.receivedMessages ?? 0 },
    { label: '活跃天数', value: stats?.activeDays ?? 0 },
  ]

  if (loading) {
    return (
      <div className="analytics-page analytics-page--loading">
        <Loader2 size={28} className="analytics-page__spinner" />
        <span>聚合分析中（首次运行可能需要数秒）…</span>
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <header className="analytics-page__header">
        <h2>数据分析</h2>
        <button className="analytics-page__refresh" onClick={() => void loadAll(true)} title="重新计算">
          <RefreshCw size={15} />
          重新计算
        </button>
      </header>

      {error && <div className="analytics-page__error">{error}</div>}

      {/* 概览卡片 */}
      <div className="analytics-page__cards">
        {statCards.map((c) => (
          <div key={c.label} className="analytics-page__card">
            <span className="analytics-page__card-value">{c.value.toLocaleString()}</span>
            <span className="analytics-page__card-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="analytics-page__charts">
        {/* 消息类型占比 */}
        <div className="analytics-page__chart">
          <div className="analytics-page__chart-title">消息类型占比</div>
          <ReactECharts option={typePieOption()} style={{ height: 240 }} notMerge />
        </div>

        {/* 24 小时活跃分布 */}
        <div className="analytics-page__chart">
          <div className="analytics-page__chart-title">24 小时活跃分布</div>
          <ReactECharts option={hourlyBarOption()} style={{ height: 240 }} notMerge />
        </div>

        {/* 周内活跃分布 */}
        <div className="analytics-page__chart">
          <div className="analytics-page__chart-title">周内活跃分布</div>
          <ReactECharts option={weekdayLineOption()} style={{ height: 240 }} notMerge />
        </div>

        {/* 联系人排行 */}
        <div className="analytics-page__chart">
          <div className="analytics-page__chart-title">
            <Users size={13} /> 联系人消息排行 Top 20
          </div>
          {rankings.length === 0 ? (
            <div className="analytics-page__no-data">暂无数据</div>
          ) : (
            <div className="analytics-page__rankings">
              {rankings.map((r, i) => (
                <div key={r.username} className="analytics-page__ranking">
                  <span className="analytics-page__rank">#{i + 1}</span>
                  <span className="analytics-page__rank-name">{r.displayName || r.username}</span>
                  <span className="analytics-page__rank-bar">
                    <span
                      className="analytics-page__rank-bar-fill"
                      style={{ width: `${Math.min(100, (r.messageCount / (rankings[0]?.messageCount || 1)) * 100)}%` }}
                    />
                  </span>
                  <span className="analytics-page__rank-count">
                    <MessageSquare size={11} /> {r.messageCount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
