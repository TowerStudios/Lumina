import type { ReactNode } from 'react'

/**
 * 微信内置表情码 → 静态表情图渲染（对齐 WeFlow 的 renderTextWithEmoji 方案）
 *
 * 表情资源位于 public/assets/face/*.png（共 75 个微信默认表情），
 * 文本中的 [微笑] 这类表情码会渲染为内联表情图片；未匹配的方括号内容原样保留。
 *
 * 资源来源：reference/WeFlow-5.1.0/public/assets/face
 */

// 所有可用表情名称（对应 public/assets/face/<名称>.png，无扩展名）
const FACE_NAMES = new Set([
  '666', 'Emm', '亲亲', '偷笑', '傲慢', '再见', '加油', '发呆', '发怒', '可怜',
  '右哼哼', '叹气', '吃瓜', '吐', '呲牙', '咒骂', '哇', '嘘', '嘿哈', '囧',
  '困', '坏笑', '大哭', '天啊', '失望', '奸笑', '好的', '委屈', '害羞', '尴尬',
  '得意', '微笑', '快哭了', '恐惧', '悠闲', '惊恐', '惊讶', '愉快', '憨笑', '打脸',
  '抓狂', '抠鼻', '捂脸', '撇嘴', '擦汗', '敲打', '无语', '旺柴', '晕', '机智',
  '汗', '流泪', '生病', '疑问', '白眼', '皱眉', '睡', '破涕为笑', '社会社会', '笑脸',
  '翻白眼', '耶', '脸红', '色', '苦涩', '衰', '裂开', '让我看看', '调皮', '鄙视',
  '闭嘴', '阴险', '难过', '骷髅', '鼓掌',
])

const FACE_BASE = `${import.meta.env.BASE_URL}assets/face/`

/**
 * 把文本中的微信表情代码（如 [微笑]）渲染为内联表情图片。
 * @param text  原始文本（可能包含多个 [表情码]）
 * @param size  表情边长（px），默认 22
 */
export function renderTextWithEmoji(text: string, size = 22): ReactNode {
  if (!text) return text
  const parts = text.split(/\[(.*?)\]/g)
  return parts.map((part, index) => {
    // 奇数索引是方括号捕获组的内容
    if (index % 2 === 1) {
      const name = part.trim()
      if (name && FACE_NAMES.has(name)) {
        return (
          <img
            key={index}
            src={`${FACE_BASE}${encodeURIComponent(name)}.png`}
            alt={`[${name}]`}
            className="inline-emoji"
            draggable={false}
            style={{
              width: size,
              height: size,
              verticalAlign: 'bottom',
              margin: '0 1px',
              display: 'inline-block',
            }}
          />
        )
      }
      return `[${part}]`
    }
    return part
  })
}
