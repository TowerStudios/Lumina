import { useEffect, useState } from 'react'
import { useUIStore, type LayoutMode } from '@/stores/uiStore'

// === 窗口尺寸断点 ===
const NARROW_MAX = 700
const MEDIUM_MAX = 1100

function calcLayoutMode(width: number): LayoutMode {
  if (width < NARROW_MAX) return 'narrow'
  if (width < MEDIUM_MAX) return 'medium'
  return 'wide'
}

/**
 * 监听窗口尺寸变化，自动更新 layoutMode。
 * 在应用根组件挂载时使用一次即可。
 */
export function useWindowSizeSync() {
  const setLayoutMode = useUIStore((s) => s.setLayoutMode)

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth
      setLayoutMode(calcLayoutMode(width))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [setLayoutMode])
}

/**
 * 获取当前布局模式（响应式）。
 */
export function useLayoutMode(): LayoutMode {
  return useUIStore((s) => s.layoutMode)
}

/**
 * 判断当前是否为某种布局模式。
 */
export function useIsLayout(mode: LayoutMode): boolean {
  return useUIStore((s) => s.layoutMode) === mode
}
