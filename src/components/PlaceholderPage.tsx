import type { ReactNode } from 'react'
import './PlaceholderPage.scss'

interface PlaceholderPageProps {
  title: string
  description?: string
  icon?: ReactNode
}

/**
 * 通用占位页面 - 用于尚未实现的模块
 */
export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      {icon && <div className="placeholder-page__icon">{icon}</div>}
      <h2 className="placeholder-page__title">{title}</h2>
      {description && <p className="placeholder-page__desc">{description}</p>}
      <span className="placeholder-page__badge">开发中</span>
    </div>
  )
}
