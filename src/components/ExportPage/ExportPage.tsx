import { useState } from 'react'
import { Loader2, Download, FileJson, FileSpreadsheet, Contact, CheckCircle2 } from 'lucide-react'
import './ExportPage.scss'

type ExportFormat = 'json' | 'csv' | 'vcf'

interface ExportRecord {
  sessionId?: string
  format?: string
  path?: string
  createdAt?: number
}

export function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>('json')
  const [types, setTypes] = useState({ friends: true, groups: true, officials: true })
  const [exportAvatars, setExportAvatars] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [latestRecord, setLatestRecord] = useState<ExportRecord | null>(null)

  const handleExport = async () => {
    setBusy(true)
    setResult(null)
    try {
      // 选择导出目录
      const dir = await window.electronAPI?.dialog?.openDirectory({
        title: '选择导出目录',
        defaultPath: window.electronAPI?.config?.get('defaultExportDir') || undefined,
      })
      const outputDir = dir?.filePaths?.[0]
      if (!outputDir) return

      const res = await window.electronAPI?.export?.contacts(outputDir, {
        format,
        exportAvatars,
        contactTypes: { ...types, blocked: false },
      })
      if (res?.success) {
        setResult({ ok: true, msg: `导出成功：${res.successCount ?? 0} 个联系人 → ${outputDir}` })
        const rec = await window.electronAPI?.export?.getLatestRecord('', format)
        if (rec?.success && rec.record) setLatestRecord(rec.record)
      } else {
        setResult({ ok: false, msg: res?.error || '导出失败' })
      }
    } catch {
      setResult({ ok: false, msg: '导出异常' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="export-page">
      <header className="export-page__header">
        <h2>导出中心</h2>
        <p className="export-page__sub">将微信数据导出为通用格式（JSON / CSV / VCF）</p>
      </header>

      {/* 格式选择 */}
      <section className="export-page__section">
        <div className="export-page__section-title">导出格式</div>
        <div className="export-page__formats">
          {(
            [
              { id: 'json', label: 'JSON', desc: '结构化数据，适合程序处理', icon: FileJson },
              { id: 'csv', label: 'CSV', desc: '表格数据，适合 Excel 打开', icon: FileSpreadsheet },
              { id: 'vcf', label: 'VCF', desc: '通讯录格式，可导入手机', icon: Contact },
            ] as const
          ).map((f) => {
            const Icon = f.icon
            return (
              <button
                key={f.id}
                className={`export-page__format ${format === f.id ? 'export-page__format--active' : ''}`}
                onClick={() => setFormat(f.id)}
              >
                <Icon size={22} />
                <span className="export-page__format-name">{f.label}</span>
                <span className="export-page__format-desc">{f.desc}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 导出范围 */}
      <section className="export-page__section">
        <div className="export-page__section-title">导出范围</div>
        <div className="export-page__checks">
          {(
            [
              { id: 'friends', label: '好友' },
              { id: 'groups', label: '群聊' },
              { id: 'officials', label: '公众号' },
            ] as const
          ).map((c) => (
            <label key={c.id} className="export-page__check">
              <input
                type="checkbox"
                checked={types[c.id]}
                onChange={(e) => setTypes((t) => ({ ...t, [c.id]: e.target.checked }))}
              />
              <span>{c.label}</span>
            </label>
          ))}
          <label className="export-page__check">
            <input
              type="checkbox"
              checked={exportAvatars}
              onChange={(e) => setExportAvatars(e.target.checked)}
            />
            <span>包含头像</span>
          </label>
        </div>
      </section>

      <button className="export-page__run" onClick={() => void handleExport()} disabled={busy}>
        {busy ? (
          <Loader2 size={18} className="export-page__spinner" />
        ) : (
          <Download size={18} />
        )}
        {busy ? '导出中…' : '选择目录并导出'}
      </button>

      {result && (
        <div className={`export-page__result ${result.ok ? 'export-page__result--ok' : 'export-page__result--err'}`}>
          {result.ok && <CheckCircle2 size={16} />}
          {result.msg}
        </div>
      )}

      {latestRecord?.path && (
        <div className="export-page__record">
          最近导出：{latestRecord.path}
        </div>
      )}

      <div className="export-page__note">
        说明：消息内容/聊天记录批量导出依赖导出 Worker 机制，将在后续版本开放；当前支持联系人导出。
      </div>
    </div>
  )
}
