import React, { createContext, useContext, useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import { Shield, LogOut, Terminal, User as UserIcon, Calendar, CheckSquare, Award, Key, Lock, Eye, EyeOff } from 'lucide-react'

// Các Pages (sẽ được viết ở các bước tiếp theo)
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import InstructorDashboard from './pages/InstructorDashboard.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'

// Tạo Auth Context
const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

const clearGuacamoleAuth = () => {
  localStorage.removeItem('GUAC_AUTH_TOKEN')
  sessionStorage.removeItem('GUAC_AUTH_TOKEN')
}

// Modal Đổi Mật Khẩu Cá Nhân
const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Vui lòng nhập đầy đủ thông tin mật khẩu')
      return
    }

    if (newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải chứa ít nhất 6 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu mới và xác nhận mật khẩu không khớp nhau')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('malsec_token')
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Không thể đổi mật khẩu')
      }

      setSuccessMsg('Đổi mật khẩu thành công!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        setSuccessMsg('')
        onClose()
      }, 1500)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div className="modal-content" style={{
        background: 'var(--bg-card)', border: '1px solid var(--neon-cyan)',
        borderRadius: '8px', padding: '24px', width: '420px', maxWidth: '90vw',
        boxShadow: '0 0 20px rgba(0, 243, 255, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <Key size={22} style={{ color: 'var(--neon-cyan)' }} />
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--neon-cyan)' }}>Thay Đổi Mật Khẩu Cá Nhân</h3>
        </div>

        {errorMsg && (
          <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '13px', padding: '10px 14px', background: 'rgba(255, 0, 85, 0.15)', border: '1px solid var(--neon-pink)', color: '#ff4d6d', borderRadius: '4px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success" style={{ marginBottom: '16px', fontSize: '13px', padding: '10px 14px', background: 'rgba(0, 255, 170, 0.15)', border: '1px solid var(--neon-green)', color: '#00ffaa', borderRadius: '4px' }}>
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Mật khẩu hiện tại</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', paddingRight: '40px' }}
                placeholder="Nhập mật khẩu hiện tại..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', paddingRight: '40px' }}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Xác nhận mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', paddingRight: '40px' }}
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ minWidth: '110px' }}
            >
              {loading ? 'Đang xử lý...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Layout chung cho Portal sau khi đăng nhập
const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-container">
      <header className="cyber-header">
        <div className="header-wrap">
          <Link to="/" className="brand">
            <Terminal className="brand-icon" size={24} />
            <span>MALSEC LMS</span>
          </Link>
          
          <div className="nav-links">
            {user.role === 'admin' && (
              <span className="badge badge-draft">Hệ thống Admin</span>
            )}
            {user.role === 'lecturer' && (
              <span className="badge badge-submitted">Portal Giảng viên</span>
            )}
            {user.role === 'student' && (
              <span className="badge badge-graded">Portal Sinh viên</span>
            )}
            
            <div className="user-profile-widget">
              <div className="user-avatar">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info">
                <span className="user-name">{user.full_name}</span>
                {user.email && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', textTransform: 'lowercase', margin: '2px 0', opacity: 0.8 }}>{user.email}</span>}
                <span className="user-role-badge">{user.role}</span>
              </div>
              <button 
                onClick={() => setShowPasswordModal(true)} 
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', marginLeft: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Đổi mật khẩu"
              >
                <Key size={15} />
                <span style={{ fontSize: '12px' }}>Đổi mật khẩu</span>
              </button>
              <button 
                onClick={handleLogout} 
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', marginLeft: '6px' }}
                title="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="main-content">
        {children}
      </main>

      <ChangePasswordModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
      
      <footer style={{
        textAlign: 'center', 
        padding: '20px', 
        fontSize: '12px', 
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-color)',
        marginTop: 'auto'
      }}>
        Hệ thống Lab Forensics & Malware Analysis — FUHL &copy; 2026. Toàn bộ mã độc được cô lập an toàn.
      </footer>
    </div>
  )
}

// Guard Route kiểm tra đăng nhập
const RequireAuth = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        color: 'var(--neon-cyan)'
      }}>
        [+] Đang xác thực hệ thống an ninh malsec...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Layout>{children}</Layout>
}

// Redirect Route dựa trên Role người dùng
const RoleBasedRedirect = () => {
  const { user } = useAuth()
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />
  } else if (user.role === 'lecturer') {
    return <Navigate to="/lecturer" replace />
  } else {
    return <Navigate to="/student" replace />
  }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Khôi phục phiên làm việc từ LocalStorage
  useEffect(() => {
    clearGuacamoleAuth()
    const storedUser = localStorage.getItem('malsec_user')
    const token = localStorage.getItem('malsec_token')
    if (storedUser && token) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = (userData, token) => {
    clearGuacamoleAuth()
    localStorage.setItem('malsec_user', JSON.stringify(userData))
    localStorage.setItem('malsec_token', token)
    setUser(userData)
  }

  const logout = () => {
    clearGuacamoleAuth()
    localStorage.removeItem('malsec_user')
    localStorage.removeItem('malsec_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/admin" element={
            <RequireAuth allowedRoles={['admin']}>
              <AdminDashboard />
            </RequireAuth>
          } />
          
          <Route path="/lecturer" element={
            <RequireAuth allowedRoles={['lecturer', 'admin']}>
              <InstructorDashboard />
            </RequireAuth>
          } />
          
          <Route path="/student" element={
            <RequireAuth allowedRoles={['student']}>
              <StudentDashboard />
            </RequireAuth>
          } />
          
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  )
}
export { AuthContext }
