/**
 * 群聊合成头像（TG 风格：最多 4 个成员头像 2x2 拼接）
 * - 无成员头像 → 显示字母占位（背景色 + 首字）
 * - 1 个成员头像 → 单图
 * - 2-4 个成员头像 → 2x2 网格（2 个时上下各占半行）
 * ChatList / ChatView 共用。
 */
export function GroupAvatar({
  avatars,
  color,
  text,
  alt,
}: {
  avatars?: string[]
  color: string
  text: string
  alt: string
}) {
  const list = (avatars ?? []).filter((u): u is string => !!u)
  if (list.length === 0) {
    return (
      <div className="group-avatar group-avatar--text" style={{ background: color }}>
        {text}
      </div>
    )
  }
  if (list.length === 1) {
    return <img className="group-avatar group-avatar--img" src={list[0]} alt={alt} />
  }
  const cells = list.slice(0, 4)
  return (
    <div className="group-avatar group-avatar--grid">
      {cells.map((url, i) => (
        <img key={i} className="group-avatar--cell" src={url} alt="" loading="lazy" />
      ))}
    </div>
  )
}
