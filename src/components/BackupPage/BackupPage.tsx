import { useState, useEffect, useCallback } from 'react'
import { ArchiveRestore, Database, Download, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import './BackupPage.scss'

interface BackupManifest {
  dbPath?: string
  wxid?: string
  tables?: Array<{ name: string; rowCount: number }>
  resourceCounts?: { images: number; videos: number; files: number }
}

interface BackupProgress {
  phase?: string
  percent?: number
  message?: string
}

export function BackupPage() {
  const [archivePath, setArchivePath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [includeResources, setIncludeResources] = useState(false)
  const [manifest, setManifest] = useState<BackupManifest | null>(null)
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [resultOk, setResultOk] = useState<boolean | null>(null)
  const [restoreResult, setRestoreResult] = useState<{ inserted?: number; skipped?: number } | null>(null)

  // 订阅进度
  useEffect(() => {
    return window.electronAPI?.backup?.onProgress?.((p: BackupProgress) => setProgress(p))
  }, [])

  const handleSelectOutput = useCallback(async () => {
    const res = await window.electronAPI?.dialog?.saveFile?.({
      title: '保存备份文件',
      defaultPath: `lumina-backup-${new Date().toISOString().slice(0, 10)}.tar`,
      filters: [{ name: '备份文件', extensions: ['tar', 'gz'] }],
    })
    if (res?.filePath) setOutputPath(res.filePath)
  }, [])

  const handleSelectArchive = useCallback(async () => {
    const res = await window.electronAPI?.dialog?.openFile?.({
      title: '选择备份文件',
      filters: [{ name: '备份文件', extensions: ['tar', 'gz'] }],
    })
    if (res?.filePaths?.[0]) {
      setArchivePath(res.filePaths[0])
      setManifest(null)
      setRestoreResult(null)
      const inspect = await window.electronAPI?.backup?.inspect({ archivePath: res.filePaths[0] })
      if (inspect?.success && inspect.manifest) setManifest(inspect.manifest)
    }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!outputPath) return
    setBusy(true)
    setResultMsg('')
    setResultOk(null)
    try {
      const res = await window.electronAPI?.backup?.create({
        outputPath,
        options: { includeResources },
      })
      setResultOk(!!res?.success)
      setResultMsg(res?.success ? '备份创建成功' : res?.error || '备份失败')
    } catch { setResultMsg('备份异常'); setResultOk(false) }
    finally { setBusy(false); setProgress(null) }
  }, [outputPath, includeResources])

  const handleRestore = useCallback(async () => {
    if (!archivePath) return
    setBusy(true)
    setResultMsg('')
    setResultOk(null)
    try {
      const res = await window.electronAPI?.backup?.restore({ archivePath })
      setResultOk(!!res?.success)
      if (res?.success) {
        setRestoreResult({ inserted: res.inserted ?? res.total ?? 0, skipped: res.skipped ?? 0 })
        setResultMsg('恢复成功')
      } else {
        setResultMsg(res?.error || '恢复失败')
      }
    } catch { setResultMsg('恢复异常'); setResultOk(false) }
    finally { setBusy(false); setProgress(null) }
  }, [archivePath])

  return (
    <div className="backup-page">
      <header className="backup-page__header">
        <h2>数据库备份</h2>
        <p>创建/恢复微信聊天记录的完整备份</p>
      </header>

      <div className="backup-page__sections">
        {/* 创建备份 */}
        <section className="backup-page__card">
          <h3><Download size={18} /> 创建备份</h3>
          <div className="backup-page__row">
            <input
              value={outputPath}
              placeholder="点击选择保存位置…"
              readOnly
              className="backup-page__input"
              onClick={handleSelectOutput}
            />
            <button onClick={handleSelectOutput} className="backup-page__btn" disabled={busy}>选择</button>
          </div>
          <label className="backup-page__check">
            <input
              type="checkbox"
              checked={includeResources}
              onChange={(e) => setIncludeResources(e.target.checked)}
            />
            包含图片/视频/文件资源
          </label>
          {progress && (
            <div className="backup-page__progress">
              <div className="backup-page__progress-bar" style={{ width: `${progress.percent ?? 0}%` }} />
              <span>{progress.message || progress.phase}</span>
            </div>
          )}
          <button className="backup-page__run" onClick={handleCreate} disabled={busy || !outputPath}>
            {busy ? <Loader2 size={16} className="backup-page__spin" /> : <ArchiveRestore size={16} />}
            开始备份
          </button>
          {resultOk !== null && (
            <div className={`backup-page__result ${resultOk ? 'backup-page__result--ok' : 'backup-page__result--err'}`}>
              {resultOk ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{resultMsg}
            </div>
          )}
        </section>

        {/* 查看/恢复备份 */}
        <section className="backup-page__card">
          <h3><Upload size={18} /> 恢复备份</h3>
          <div className="backup-page__row">
            <input
              value={archivePath}
              placeholder="点击选择备份文件…"
              readOnly
              className="backup-page__input"
              onClick={handleSelectArchive}
            />
            <button onClick={handleSelectArchive} className="backup-page__btn" disabled={busy}>选择</button>
          </div>
          {manifest && (
            <div className="backup-page__manifest">
              <span><Database size={13} /> {manifest.tables?.length ?? 0} 个表 · {manifest.tables?.reduce((s, t) => s + (t.rowCount ?? 0), 0) ?? 0} 行</span>
              {manifest.resourceCounts && <span>资源 {manifest.resourceCounts.images + manifest.resourceCounts.videos + manifest.resourceCounts.files}</span>}
            </div>
          )}
          <button className="backup-page__run" onClick={handleRestore} disabled={busy || !archivePath}>
            {busy ? <Loader2 size={16} className="backup-page__spin" /> : <Upload size={16} />}
            恢复备份
          </button>
          {restoreResult && (
            <div className="backup-page__manifest">
              <span>新增 {restoreResult.inserted} · 已存在 {restoreResult.skipped}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
