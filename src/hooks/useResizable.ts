import { useCallback, useEffect, useRef, useState } from 'react'

// === 列宽拖动 Hook ===
// 参考 Telegram Desktop 的 ResizeArea 控件实现
// 列宽限制：会话列表最小 260px / 最大 540px
// 持久化：通过 localStorage 保存用户偏好

export interface ResizeOptions {
  /** 初始宽度 */
  initial: number
  /** 最小宽度 */
  min: number
  /** 最大宽度 */
  max: number
  /** localStorage 持久化 key（不传则不持久化） */
  storageKey?: string
}

export interface ResizeResult {
  /** 当前宽度 */
  width: number
  /** 设置宽度（会自动 clamp 到 [min, max] 范围） */
  setWidth: (w: number) => void
  /** 是否正在拖动 */
  isResizing: boolean
  /** 拖动开始：绑定到 ResizeArea 的 onMouseDown / onPointerDown */
  startResize: (e: React.PointerEvent) => void
}

export function useResizable(options: ResizeOptions): ResizeResult {
  const { initial, min, max, storageKey } = options
  const [width, setWidthState] = useState<number>(() => {
    if (storageKey) {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (saved) {
        const v = parseInt(saved, 10)
        if (!Number.isNaN(v)) return Math.max(min, Math.min(max, v))
      }
    }
    return initial
  })
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  const setWidth = useCallback(
    (w: number) => {
      const clamped = Math.max(min, Math.min(max, w))
      setWidthState(clamped)
      if (storageKey && typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, String(clamped))
      }
    },
    [min, max, storageKey]
  )

  const startResize = useCallback((e: React.PointerEvent) => {
    // 仅响应主鼠标键
    if (e.button !== 0) return
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = width
    setIsResizing(true)
  }, [width])

  useEffect(() => {
    if (!isResizing) return

    const onMove = (e: PointerEvent) => {
      if (e.button !== 0 && e.buttons !== 1) return
      const delta = e.clientX - startXRef.current
      // 向右拖动增加宽度
      const next = startWidthRef.current + delta
      setWidth(next)
    }
    const onUp = () => {
      setIsResizing(false)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, setWidth])

  return { width, setWidth, isResizing, startResize }
}
