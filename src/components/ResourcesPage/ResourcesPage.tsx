import { useState, useEffect, useCallback } from 'react'
import { Image as ImageIcon, Video, Loader2, RefreshCw, Grid } from 'lucide-react'
import './ResourcesPage.scss'

type MediaTab = 'images' | 'videos'

interface MediaItem {
  md5?: string
  imageMd5?: string
  videoMd5?: string
  msgId?: string | number
  sessionId?: string
  createTime?: number
  fileName?: string
  type?: string
  [k: string]: unknown
}

const PAGE_SIZE = 60

export function ResourcesPage() {
  const [tab, setTab] = useState<MediaTab>('images')
  const [items, setItems] = useState<MediaItem[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})

  const mediaType = tab === 'images' ? 'image' : 'video'

  const loadPage = useCallback(async (reset: boolean) => {
    setLoading(true)
    setError('')
    const nextOffset = reset ? 0 : offset
    try {
      const res = await window.electronAPI?.chat?.getMediaStream?.({
        mediaType,
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      const data = (res as any)?.data ?? (res as any)?.items ?? (Array.isArray(res) ? res : [])
      const list = data as MediaItem[]
      setItems(reset ? list : [...items, ...list])
      setHasMore(list.length === PAGE_SIZE)
      setOffset(nextOffset + list.length)
    } catch {
      setError('加载媒体失败')
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [items, offset, mediaType])

  useEffect(() => {
    setItems([])
    setOffset(0)
    setHasMore(true)
    setThumbnails({})
    void loadPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // 异步解密图片缩略图
  useEffect(() => {
    if (tab !== 'images') return
    const pending = items.filter((it) => {
      const key = String(it.msgId ?? it.md5 ?? '')
      return key && !thumbnails[key]
    })
    if (pending.length === 0) return
    let cancelled = false
    void Promise.all(pending.slice(0, 12).map(async (it) => {
      try {
        const r = await window.electronAPI?.media?.decryptImage?.({
          sessionId: it.sessionId,
          imageMd5: it.imageMd5 || it.md5,
          imageDatName: (it as any).imageDatName || (it as any).fileName,
          createTime: it.createTime,
        })
        return [String(it.msgId ?? it.md5), (r as any)?.dataUrl || (r as any)?.path || ''] as const
      } catch {
        return ['', ''] as const
      }
    })).then((pairs) => {
      if (cancelled) return
      setThumbnails((prev) => {
        const next = { ...prev }
        for (const [k, v] of pairs) if (k && v) next[k] = v
        return next
      })
    })
    return () => { cancelled = true }
  }, [items, tab, thumbnails])

  return (
    <div className="resources-page">
      <header className="resources-page__header">
        <h2><Grid size={20} /> 资源浏览</h2>
        <button onClick={() => { setItems([]); setOffset(0); setHasMore(true); setThumbnails({}); void loadPage(true) }} title="刷新">
          <RefreshCw size={15} /> 刷新
        </button>
      </header>

      <div className="resources-page__tabs">
        <button
          className={`resources-page__tab ${tab === 'images' ? 'resources-page__tab--active' : ''}`}
          onClick={() => setTab('images')}
        >
          <ImageIcon size={14} /> 图片
        </button>
        <button
          className={`resources-page__tab ${tab === 'videos' ? 'resources-page__tab--active' : ''}`}
          onClick={() => setTab('videos')}
        >
          <Video size={14} /> 视频
        </button>
      </div>

      {error && <div className="resources-page__error">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="resources-page__loading"><Loader2 size={24} className="resources-page__spin" /> 加载中…</div>
      ) : items.length === 0 ? (
        <div className="resources-page__empty">暂无{tab === 'images' ? '图片' : '视频'}资源</div>
      ) : (
        <>
          <div className="resources-page__grid">
            {items.map((it, i) => {
              const key = String(it.msgId ?? it.md5 ?? i)
              const src = thumbnails[key]
              return (
                <div key={key} className="resources-page__cell">
                  {tab === 'images' ? (
                    src ? (
                      <img src={src} alt="" loading="lazy" />
                    ) : (
                      <div className="resources-page__cell-placeholder"><ImageIcon size={22} /></div>
                    )
                  ) : (
                    <div className="resources-page__cell-placeholder"><Video size={22} /></div>
                  )}
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="resources-page__more">
              <button onClick={() => void loadPage(false)} disabled={loading}>
                {loading ? <Loader2 size={14} className="resources-page__spin" /> : null}
                {loading ? '加载中…' : '加载更多'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
