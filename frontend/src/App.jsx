import React, { createContext, useContext, useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import { Shield, LogOut, Terminal, User as UserIcon, Calendar, CheckSquare, Award } from 'lucide-react'

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

// Layout chung cho Portal sau khi đăng nhập
const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
                onClick={handleLogout} 
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', marginLeft: '10px' }}
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
