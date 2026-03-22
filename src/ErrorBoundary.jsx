import { Component } from 'react'

/**
 * React 렌더 단계 오류 시 전체 화면 대신 복구 UI (모바일 Safari 등에서 빈 화면만 보이는 경우 완화).
 * 네이티브 WebKit 메시지("문제가 반복적으로 발생했습니다" 등)는 잡지 못함.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message ? String(err.message) : '' }
  }

  componentDidCatch(err, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', err, info?.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            background: '#f3f4f6',
            color: '#111827',
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 12px' }}>
            화면을 불러오는 중 문제가 발생했어요
          </h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 20px', color: '#4b5563', maxWidth: 320 }}>
            {this.state.message || '예기치 않은 오류입니다. 새로고침 후 다시 시도해 주세요.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              border: 'none',
              background: '#1F45FF',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
