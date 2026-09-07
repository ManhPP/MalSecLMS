import React, { createContext, useContext, useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import { Shield, LogOut, Terminal, User as UserIcon, Calendar, CheckSquare, Award, Key, Lock, Eye, EyeOff } from 'lucide-react'

// Page Components
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import InstructorDashboard from './pages/InstructorDashboard.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'

// Create Auth Context
const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

const clearGuacamoleAuth = () => {
  localStorage.removeItem('GUAC_AUTH_TOKEN')
  sessionStorage.removeItem('GUAC_AUTH_TOKEN')
}

// User Profile & Password Change Modal
const UserProfileModal = ({ isOpen, onClose, initialTab = 'profile' }) => {
  const { user, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState(initialTab)

  // Profile Form State
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setEmail(user.email || '')
    }
    setActiveTab(initialTab)
    setProfileError('')
    setProfileSuccess('')
    setPassError('')
    setPassSuccess('')
  }, [user, isOpen, initialTab])

  if (!isOpen || !user) return null

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty')
      return
    }

    setProfileLoading(true)
    try {
      const token = localStorage.getItem('malsec_token')
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Unable to update profile information')
      }

      updateUser({ full_name: data.full_name, email: data.email })
      setProfileSuccess('Profile updated successfully!')
      setTimeout(() => setProfileSuccess(''), 2500)
    } catch (err) {
      setProfileError(err.message)
    } finally {
      setProfileLoading(false)
    }
  }

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPassError('')
    setPassSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('Please fill in all password fields')
      return
    }

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match')
      return
    }

    setPassLoading(true)
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
        throw new Error(data.detail || 'Unable to change password')
      }

      setPassSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        setPassSuccess('')
      }, 2500)
    } catch (err) {
      setPassError(err.message)
    } finally {
      setPassLoading(false)
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
        borderRadius: '10px', padding: '24px', width: '480px', maxWidth: '92vw',
        boxShadow: '0 0 25px rgba(0, 243, 255, 0.25)'
      }}>
        {/* Header Modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserIcon size={22} style={{ color: 'var(--neon-cyan)' }} />
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--neon-cyan)' }}>User Profile & Security Settings</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', marginLeft: 'auto' }}>×</button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none',
              color: activeTab === 'profile' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              cursor: 'pointer', fontWeight: activeTab === 'profile' ? 'bold' : 'normal',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
            }}
          >
            <UserIcon size={15} /> Profile Details
          </button>
          <button
            onClick={() => setActiveTab('password')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none',
              color: activeTab === 'password' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'password' ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              cursor: 'pointer', fontWeight: activeTab === 'password' ? 'bold' : 'normal',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
            }}
          >
            <Key size={15} /> Change Password
          </button>
        </div>

        {/* TAB 1: PROFILE DETAILS */}
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile}>
            {profileError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '13px', padding: '10px 14px', background: 'rgba(255, 0, 85, 0.15)', border: '1px solid var(--neon-pink)', color: '#ff4d6d', borderRadius: '4px' }}>
                ⚠️ {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '16px', fontSize: '13px', padding: '10px 14px', background: 'rgba(0, 255, 170, 0.15)', border: '1px solid var(--neon-green)', color: '#00ffaa', borderRadius: '4px' }}>
                ✅ {profileSuccess}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Username</label>
              <input
                type="text"
                className="form-input"
                value={user.username}
                disabled
                style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed', background: 'rgba(0,0,0,0.3)' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>Role</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="user-role-badge" style={{ padding: '4px 10px', fontSize: '12px', textTransform: 'uppercase' }}>
                  {user.role === 'admin' ? '🛡️ Administrator' : user.role === 'lecturer' ? '👨‍🏫 Instructor' : '🎓 Student'}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Full Name</label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Enter full name..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Email Address</label>
              <input
                type="email"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="e.g. user@malsec.edu.vn..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={profileLoading}>
                Close
              </button>
              <button type="submit" className="btn btn-primary" disabled={profileLoading} style={{ minWidth: '120px' }}>
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: CHANGE PASSWORD */}
        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword}>
            {passError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '13px', padding: '10px 14px', background: 'rgba(255, 0, 85, 0.15)', border: '1px solid var(--neon-pink)', color: '#ff4d6d', borderRadius: '4px' }}>
                ⚠️ {passError}
              </div>
            )}
            {passSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '16px', fontSize: '13px', padding: '10px 14px', background: 'rgba(0, 255, 170, 0.15)', border: '1px solid var(--neon-green)', color: '#00ffaa', borderRadius: '4px' }}>
                ✅ {passSuccess}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '40px' }}
                  placeholder="Enter current password..."
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

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '40px' }}
                  placeholder="New password (min 6 characters)..."
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

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '40px' }}
                  placeholder="Re-enter new password..."
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
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={passLoading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={passLoading} style={{ minWidth: '120px' }}>
                {passLoading ? 'Processing...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// Global Portal Layout for authenticated users
const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [modalInitialTab, setModalInitialTab] = useState('profile')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const openModalWithTab = (tab) => {
    setModalInitialTab(tab)
    setShowProfileModal(true)
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
              <span className="badge badge-draft">Admin Portal</span>
            )}
            {user.role === 'lecturer' && (
              <span className="badge badge-submitted">Instructor Portal</span>
            )}
            {user.role === 'student' && (
              <span className="badge badge-graded">Student Portal</span>
            )}
            
            <div className="user-profile-widget">
              <div 
                className="user-avatar"
                onClick={() => openModalWithTab('profile')}
                style={{ cursor: 'pointer' }}
                title="View Profile"
              >
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div 
                className="user-info"
                onClick={() => openModalWithTab('profile')}
                style={{ cursor: 'pointer' }}
                title="View Profile"
              >
                <span className="user-name">{user.full_name}</span>
                {user.email && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', textTransform: 'lowercase', margin: '2px 0', opacity: 0.8 }}>{user.email}</span>}
                <span className="user-role-badge">{user.role}</span>
              </div>
              <button 
                onClick={() => openModalWithTab('profile')} 
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', marginLeft: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Profile & Security Settings"
              >
                <UserIcon size={15} />
                <span style={{ fontSize: '12px' }}>Profile</span>
              </button>
              <button 
                onClick={handleLogout} 
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', marginLeft: '6px' }}
                title="Sign Out"
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

      <UserProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)}
        initialTab={modalInitialTab}
      />

      
      <footer style={{
        textAlign: 'center', 
        padding: '20px', 
        fontSize: '12px', 
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-color)',
        marginTop: 'auto'
      }}>
        Malware Analysis & Forensics Lab System — FUHL &copy; 2026. All malicious payloads are safely isolated.
      </footer>
    </div>
  )
}

// Authentication Guard Route
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
        [+] Authenticating security session...
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

// Redirect Route based on User Role
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

  // Restore session from LocalStorage
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

  const updateUser = (updatedData) => {
    setUser((prev) => {
      if (!prev) return prev
      const newUser = { ...prev, ...updatedData }
      localStorage.setItem('malsec_user', JSON.stringify(newUser))
      return newUser
    })
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>

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
