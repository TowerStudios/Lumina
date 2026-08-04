import { useState, useEffect, useCallback } from 'react'
import { Footprints, Calendar, Download, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import './MyFootprintPage.scss'

interface FootprintStats {
  totalMessages?: number
  totalContacts?: number
  activeDays?: number
  sentMessages?: number
  receivedMessages?: number
  [k: string]: unknown
}

type PresetKey = 'today' | 'yesterday' | 'week' | 'month'

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
]

function getRange(preset: PresetKey): { begin: number; end: number } {
  const now = new Date()
  const end = now.getTime()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  let begin = startOfDay(now)

  if (preset === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    begin = startOfDay(y)
    return { begin, end: startOfDay(now) - 1 }
  }
  if (preset === 'week') {
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(monday.getDate() - day + 1)
    begin = startOfDay(monday)
  }
  if (preset === 'month') {
    begin = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  }
  return { begin, end }
}

export function MyFootprintPage() {
  const [preset, setPreset] = useState<PresetKey>('month')
  const [stats, setStats] = useState<FootprintStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (p: PresetKey) => {
    setLoading(true)
    setError('')
    const { begin, end } = getRange(p)
    try {
      const res = await window.electronAPI?.chat?.getMyFootprintStats?.(begin, end)
      const data = (res as any)?.data ?? res
      setStats(data as FootprintStats)
    } catch {
      setError('加载足迹数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(preset)
  }, [preset, load])

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    const { begin, end } = getRange(preset)
    setExporting(true)
    try {
      const res = await window.electronAPI?.dialog?.saveFile?.({
        title: `导出足迹 (${format.toUpperCase()})`,
        defaultPath: `footprint_${preset}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      })
      const path = (res as any)?.filePath
      if (!path) return
      await window.electronAPI?.chat?.exportMyFootprint?.(begin, end, format, path)
    } catch {
      setError('导出失败')
    } finally {
      setExporting(false)
    }
  }, [preset])

  const cards = stats
    ? [
        { label: '总消息', value: stats.totalMessages ?? 0 },
        { label: '联系人', value: stats.totalContacts ?? 0 },
        { label: '活跃天数', value: stats.activeDays ?? 0 },
        { label: '发送', value: stats.sentMessages ?? 0 },
        { label: '接收', value: stats.receivedMessages ?? 0 },
      ]
    : []

  return (
    <div className="my-footprint">
      <header className="my-footprint__header">
        <h2><Footprints size={20} /> 我的足迹</h2>
        <button onClick={() => void load(preset)} title="刷新">
          <RefreshCw size={15} /> 刷新
        </button>
      </header>

      <div className="my-footprint__toolbar">
        <div className="my-footprint__presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`my-footprint__preset ${preset === p.key ? 'my-footprint__preset--active' : ''}`}
              onClick={() => setPreset(p.key)}
            >
              <Calendar size={13} /> {p.label}
            </button>
          ))}
        </div>
        <div className="my-footprint__exports">
          <button onClick={() => void handleExport('csv')} disabled={exporting}>
            <Download size={14} /> CSV
          </button>
          <button onClick={() => void handleExport('json')} disabled={exporting}>
            <Download size={14} /> JSON
          </button>
        </div>
      </div>

      {error && <div className="my-footprint__error">{error}</div>}

      {loading ? (
        <div className="my-footprint__loading"><Loader2 size={24} className="my-footprint__spin" /> 加载中…</div>
      ) : !stats ? (
        <div className="my-footprint__empty">暂无数据</div>
      ) : (
        <div className="my-footprint__cards">
          {cards.map((c) => (
            <div key={c.label} className="my-footprint__card">
              <Sparkles size={16} />
              <span className="my-footprint__card-value">{c.value.toLocaleString()}</span>
              <span className="my-footprint__card-label">{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
