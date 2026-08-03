import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 错误边界：捕获子组件的渲染错误（如 Maximum update depth exceeded），
 * 显示 fallback UI 而非整个应用崩溃。
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获错误:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="error-boundary">
          <div className="error-boundary__icon">!</div>
          <p className="error-boundary__message">
            {this.state.error?.message || '渲染错误'}
          </p>
          <button className="error-boundary__retry" onClick={this.handleReset}>
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
