import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App.jsx'
import { Terminal, ShieldAlert, Key, User } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng nhập thất bại')
      }

      // Lưu trữ session vào AuthContext
      login({
        username: data.username,
        full_name: data.full_name,
        role: data.role
      }, data.access_token)

      // Điều hướng tương ứng
      if (data.role === 'admin') {
        navigate('/admin')
      } else if (data.role === 'lecturer') {
        navigate('/lecturer')
      } else {
        navigate('/student')
      }

    } catch (err) {
      setError(err.message || 'Lỗi kết nối tới máy chủ an ninh')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      position: 'relative'
    }}>
      <div className="cyber-card glow" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '14px',
            background: 'rgba(0, 242, 254, 0.08)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--neon-cyan)',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.2)',
            marginBottom: '16px'
          }}>
            <Terminal size={32} />
          </div>
          <h2 style={{ fontSize: '24px', color: '#fff', marginBottom: '6px' }}>MALSEC PORTAL</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Hệ thống Quản lý Báo cáo Lab & Phân tích Mã độc
          </p>
        </div>

        {error && (
          <div className="plag-alert-banner" style={{ marginBottom: '20px' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> Mã số Sinh viên / Giảng viên
              </span>
            </label>
            <input
              type="text"
              id="username"
              className="form-input"
              placeholder="Nhập tên đăng nhập..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="password">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} /> Mật khẩu truy cập
              </span>
            </label>
            <input
              type="password"
              id="password"
              className="form-input"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', fontSize: '15px' }}
            disabled={submitting}
          >
            {submitting ? 'ĐANG XÁC THỰC KẾT NỐI...' : 'ĐĂNG NHẬP HỆ THỐNG'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}>
          [!] Phiên truy cập của bạn được giám sát an ninh mạng.
        </div>
      </div>
    </div>
  )
}
