import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0a0d14',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'var(--font-main, sans-serif)'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            background: 'rgba(255, 8, 68, 0.08)',
            border: '1px solid rgba(255, 8, 68, 0.3)',
            borderRadius: '12px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ color: '#ff0844', fontSize: '20px', marginBottom: '12px', fontWeight: '600' }}>
              ⚠️ Đã xảy ra lỗi giao diện
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
              Hệ thống vừa gặp sự cố hiển thị. Bạn có thể bấm nút bên dưới để tải lại trang hoặc quay về trang chủ.
            </p>
            {this.state.error && (
              <div style={{
                background: '#040711',
                padding: '12px',
                borderRadius: '6px',
                textAlign: 'left',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#fca5a5',
                marginBottom: '20px',
                overflowX: 'auto',
                border: '1px solid rgba(255, 8, 68, 0.2)'
              }}>
                {this.state.error.toString()}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 18px',
                  background: '#00f2fe',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Tải lại trang
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                style={{
                  padding: '8px 18px',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
