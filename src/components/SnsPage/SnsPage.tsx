import { useEffect, useState } from 'react'
import { Loader2, Image as ImageIcon, Heart, MessageSquare, MapPin, Trash2, AlertCircle } from 'lucide-react'
import { renderTextWithEmoji } from '@/utils/renderTextWithEmoji'
import './SnsPage.scss'

interface SnsMedia {
  url?: string
  thumbUrl?: string
  thumb?: string
  type?: number
  width?: number
  height?: number
  key?: string
  token?: string
}

interface SnsPost {
  id: string
  tid?: string
  username: string
  nickname: string
  avatarUrl?: string
  createTime: number
  contentDesc: string
  media: SnsMedia[]
  likes: string[]
  comments: Array<{ id: string; nickname: string; content: string }>
  location?: { poiname?: string; label?: string }
}

function formatSnsTime(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  if (d.getFullYear() === new Date().getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function SnsPage() {
  const [posts, setPosts] = useState<SnsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<{ totalPosts: number; totalFriends: number; myPosts: number | null } | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const api = window.electronAPI?.sns
      const [timelineRes, statsRes] = await Promise.all([
        api?.getTimeline(30, 0) as Promise<{ success?: boolean; timeline?: SnsPost[]; error?: string }>,
        api?.getExportStats() as Promise<{
          success?: boolean
          data?: { totalPosts: number; totalFriends: number; myPosts: number | null }
          error?: string
        }>,
      ])
      if (timelineRes?.success && timelineRes.timeline) {
        setPosts(timelineRes.timeline)
      } else {
        setError(timelineRes?.error || '加载朋友圈失败')
      }
      if (statsRes?.success && statsRes.data) setStats(statsRes.data)
    } catch {
      setError('加载朋友圈失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="sns-page">
      <header className="sns-page__header">
        <h2>朋友圈</h2>
        {stats && (
          <div className="sns-page__stats">
            <span>动态 {stats.totalPosts}</span>
            <span>好友 {stats.totalFriends}</span>
            {typeof stats.myPosts === 'number' && <span>我的 {stats.myPosts}</span>}
          </div>
        )}
      </header>

      {error && <div className="sns-page__error">{error}</div>}

      {loading ? (
        <div className="sns-page__loading">
          <Loader2 size={26} className="sns-page__spinner" />
          <span>加载朋友圈…</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="sns-page__empty">
          暂无朋友圈数据（需先安装防删触发器并同步数据）
        </div>
      ) : (
        <div className="sns-page__feed">
          {posts.map((post) => (
            <div key={post.id} className="sns-page__post">
              <div className="sns-page__post-avatar">
                {post.avatarUrl ? (
                  <img src={post.avatarUrl} alt="" loading="lazy" />
                ) : (
                  <span>{post.nickname?.charAt(0) || '#'}</span>
                )}
              </div>
              <div className="sns-page__post-body">
                <div className="sns-page__post-nick">{post.nickname || post.username}</div>
                <div className="sns-page__post-text">
                  {renderTextWithEmoji(post.contentDesc || '', 18)}
                </div>
                {post.media.length > 0 && (
                  <div className="sns-page__post-media">
                    {post.media.slice(0, 9).map((m, i) => (
                      <SnsMediaThumb key={i} media={m} />
                    ))}
                  </div>
                )}
                {post.location?.poiname && (
                  <div className="sns-page__post-location">
                    <MapPin size={12} />
                    {post.location.poiname}
                  </div>
                )}
                <div className="sns-page__post-foot">
                  <span className="sns-page__post-time">{formatSnsTime(post.createTime)}</span>
                  {post.likes.length > 0 && (
                    <span className="sns-page__post-like">
                      <Heart size={12} fill="currentColor" /> {post.likes.length}
                    </span>
                  )}
                  {post.comments.length > 0 && (
                    <span className="sns-page__post-comment">
                      <MessageSquare size={12} /> {post.comments.length}
                    </span>
                  )}
                  <span
                    className="sns-page__post-del"
                    title="删除（需安装防删触发器）"
                    onClick={() => {
                      if (post.tid && window.confirm('确定删除这条朋友圈吗？')) {
                        void window.electronAPI?.sns?.deleteSnsPost(post.tid).then(() => load())
                      }
                    }}
                  >
                    <Trash2 size={12} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 朋友圈图片缩略图：走 sns:proxyImage 转 dataUrl，带错误保护
function SnsMediaThumb({ media }: { media: SnsMedia }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const url = media.thumbUrl || media.thumb || media.url
    if (!url || failed) return
    let cancelled = false
    window.electronAPI?.sns
      ?.proxyImage(url, media.key)
      .then((res: any) => {
        if (!cancelled && res?.success && res.dataUrl) setSrc(res.dataUrl)
        else if (!cancelled) setFailed(true)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [media.thumbUrl, media.url])

  if (src) {
    return <img className="sns-page__thumb" src={src} alt="" loading="lazy" />
  }
  return (
    <div className="sns-page__thumb-placeholder">
      {failed ? <AlertCircle size={14} /> : <ImageIcon size={18} />}
    </div>
  )
}
