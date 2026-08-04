import { useState, useEffect, useCallback } from 'react'
import { Calendar, Sparkles, Loader2, Users, MessageSquare } from 'lucide-react'
import './AnnualReportPage.scss'

interface YearInfo {
  year: number
  available?: boolean
  messageCount?: number
}

interface ReportData {
  year?: number
  totalMessages?: number
  totalContacts?: number
  totalSessions?: number
  activeDays?: number
  peakMonth?: number | string
  [k: string]: unknown
}

export function AnnualReportPage() {
  const [years, setYears] = useState<YearInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeYear, setActiveYear] = useState<number | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const loadYears = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await window.electronAPI?.annualReport?.getAvailableYears?.()
      const list = (res as any)?.years ?? (res as any)?.data ?? (Array.isArray(res) ? res : [])
      setYears(list as YearInfo[])
    } catch {
      setError('加载可用年份失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadYears()
  }, [loadYears])

  const handleGenerate = useCallback(async (year: number) => {
    setReportLoading(true)
    setActiveYear(year)
    setReport(null)
    try {
      const res = await window.electronAPI?.annualReport?.generateReport?.(year)
      const data = (res as any)?.data ?? (res as any)?.report ?? res
      setReport(data as ReportData)
    } catch {
      setReport(null)
    } finally {
      setReportLoading(false)
    }
  }, [])

  const statCards = report
    ? [
        { label: '总消息数', value: report.totalMessages ?? 0, icon: MessageSquare },
        { label: '联系人数', value: report.totalContacts ?? 0, icon: Users },
        { label: '会话数', value: report.totalSessions ?? 0, icon: Calendar },
        { label: '活跃天数', value: report.activeDays ?? 0, icon: Sparkles },
      ]
    : []

  return (
    <div className="annual-report">
      <header className="annual-report__header">
        <h2><Sparkles size={20} /> 年度报告</h2>
        <p>回顾这一年的聊天故事</p>
      </header>

      {loading ? (
        <div className="annual-report__loading"><Loader2 size={24} className="annual-report__spin" /> 加载中…</div>
      ) : error ? (
        <div className="annual-report__error">{error}</div>
      ) : years.length === 0 ? (
        <div className="annual-report__empty">暂无可用年度数据</div>
      ) : (
        <div className="annual-report__years">
          {years.map((y) => (
            <button
              key={y.year}
              className={`annual-report__year-card ${activeYear === y.year ? 'annual-report__year-card--active' : ''}`}
              onClick={() => void handleGenerate(y.year)}
              disabled={y.available === false}
            >
              <Calendar size={22} />
              <span className="annual-report__year-label">{y.year} 年</span>
              {y.messageCount != null && (
                <span className="annual-report__year-meta">{y.messageCount.toLocaleString()} 条消息</span>
              )}
              {y.available === false && <span className="annual-report__year-disabled">无数据</span>}
            </button>
          ))}
        </div>
      )}

      {activeYear && (
        <section className="annual-report__report">
          <h3>{activeYear} 年报告</h3>
          {reportLoading ? (
            <div className="annual-report__loading"><Loader2 size={22} className="annual-report__spin" /> 生成报告中…</div>
          ) : !report ? (
            <div className="annual-report__empty">无法生成报告</div>
          ) : (
            <>
              <div className="annual-report__stats">
                {statCards.map((c) => {
                  const Icon = c.icon
                  return (
                    <div key={c.label} className="annual-report__stat-card">
                      <Icon size={18} />
                      <span className="annual-report__stat-value">{(c.value as number).toLocaleString()}</span>
                      <span className="annual-report__stat-label">{c.label}</span>
                    </div>
                  )
                })}
              </div>
              {report.peakMonth != null && (
                <div className="annual-report__peak">
                  最活跃月份：<strong>{report.peakMonth}</strong>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
