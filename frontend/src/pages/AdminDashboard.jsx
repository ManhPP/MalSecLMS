import React, { useState, useEffect } from 'react'
import { 
  Users, School, ShieldAlert, FileSpreadsheet, Plus, Edit2, 
  Trash2, ShieldCheck, Lock, Unlock, Key, RefreshCw, UploadCloud 
} from 'lucide-react'

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  
  // UI Tabs: 'users' | 'classes' | 'logs'
  const [activeTab, setActiveTab] = useState('users')
  
  // Modals & Forms State
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null) // null = create new
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [isActive, setIsActive] = useState(true)

  const [showClassModal, setShowClassModal] = useState(false)
  const [className, setClassName] = useState('')
  const [classDesc, setClassDesc] = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Selected class detail for Student Assignment
  const [selectedClass, setSelectedClass] = useState(null)
  const [studentIdsInput, setStudentIdsInput] = useState('') // CSV string of IDs

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true)
    setError('')
    const token = localStorage.getItem('malsec_token')
    
    try {
      // 1. Fetch Users
      const uRes = await fetch('/api/users/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (uRes.ok) setUsers(await uRes.json())

      // 2. Fetch Classes
      const cRes = await fetch('/api/classes/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (cRes.ok) setClasses(await cRes.json())

      // 3. Fetch Audit Logs
      const lRes = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (lRes.ok) setAuditLogs(await lRes.json())

    } catch (err) {
      setError('Lỗi khi truy xuất dữ liệu từ máy chủ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // User CRUD handlers
  const handleSaveUser = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      let url = '/api/users/'
      let method = 'POST'
      let body = { username, full_name: fullName, role, is_active: isActive, email }
      
      if (editingUser) {
        url = `/api/users/${editingUser.id}`
        method = 'PUT'
        if (password) body.password = password
      } else {
        body.password = password || '12345678' // default password
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi thao tác người dùng')

      setSuccess(editingUser ? 'Cập nhật tài khoản thành công!' : 'Tạo tài khoản mới thành công!')
      setShowUserModal(false)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này không?')) return
    setActionLoading(true)
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Lỗi khi xóa người dùng')
      }
      setSuccess('Xóa người dùng thành công!')
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenUserModal = (user = null) => {
    setEditingUser(user)
    if (user) {
      setUsername(user.username)
      setFullName(user.full_name)
      setRole(user.role)
      setIsActive(user.is_active)
      setEmail(user.email || '')
      setPassword('')
    } else {
      setUsername('')
      setFullName('')
      setRole('student')
      setIsActive(true)
      setEmail('')
      setPassword('')
    }
    setShowUserModal(true)
  }

  // Class CRUD handlers
  const handleSaveClass = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch('/api/classes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: className, description: classDesc })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi tạo lớp học phần')

      setSuccess('Tạo lớp học phần thành công!')
      setShowClassModal(false)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssignStudents = async (e) => {
    e.preventDefault()
    if (!selectedClass || !studentIdsInput) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    // Parse IDs (split by comma or whitespace, convert to ints)
    const student_ids = studentIdsInput
      .split(/[\s,]+/)
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id))

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ student_ids })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi thêm sinh viên vào lớp')

      setSuccess(data.message)
      setStudentIdsInput('')
      
      // Refresh selected class details
      const detailRes = await fetch(`/api/classes/${selectedClass.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (detailRes.ok) setSelectedClass(await detailRes.json())
      
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveStudentFromClass = async (studentId) => {
    if (!confirm('Bạn có chắc xóa sinh viên này khỏi lớp?')) return
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/students/${studentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        // Refresh selected class details
        const detailRes = await fetch(`/api/classes/${selectedClass.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (detailRes.ok) setSelectedClass(await detailRes.json())
        fetchData()
      }
    } catch (err) {
      setError('Lỗi khi xóa sinh viên')
    }
  }

  // Bulk CSV User Import
  const handleImportCSV = async (e) => {
    e.preventDefault()
    if (!importFile) return
    setActionLoading(true)
    setError('')
    setImportResult(null)
    const token = localStorage.getItem('malsec_token')

    const formData = new FormData()
    formData.append('file', importFile)

    try {
      const res = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi import file CSV')

      setImportResult(data)
      setSuccess('Import danh sách sinh viên hoàn tất!')
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      {/* 1. Stats row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap"><Users size={24} /></div>
          <div>
            <div className="stat-number">{users.length}</div>
            <div className="stat-label">Tổng số Tài khoản</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap"><School size={24} /></div>
          <div>
            <div className="stat-number">{classes.length}</div>
            <div className="stat-label">Lớp học phần</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap"><ShieldAlert size={24} style={{ color: 'var(--neon-emerald)' }} /></div>
          <div>
            <div className="stat-number" style={{ color: 'var(--neon-emerald)' }}>100%</div>
            <div className="stat-label">Hệ thống An toàn</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap"><FileSpreadsheet size={24} /></div>
          <div>
            <div className="stat-number">{auditLogs.length}</div>
            <div className="stat-label">Nhật ký Kiểm toán</div>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {success && (
        <div className="plag-alert-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--neon-emerald)', color: 'var(--neon-emerald)', marginBottom: '20px' }}>
          <ShieldCheck size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="plag-alert-banner" style={{ marginBottom: '20px' }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs list */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('users')} 
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px' }}
        >
          Quản lý Tài khoản
        </button>
        <button 
          onClick={() => setActiveTab('classes')} 
          className={`btn ${activeTab === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px' }}
        >
          Quản lý Lớp học phần
        </button>
        <button 
          onClick={() => setActiveTab('logs')} 
          className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px' }}
        >
          Nhật ký Hoạt động (Audit Log)
        </button>
        
        <button 
          onClick={fetchData} 
          className="btn btn-secondary" 
          style={{ marginLeft: 'auto', padding: '8px 12px' }}
          title="Làm mới"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* TAB USERS CONTENT */}
      {activeTab === 'users' && (
        <div className="cyber-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px' }}>Danh sách tài khoản trong hệ thống</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowImportModal(true)} className="btn btn-secondary">
                <UploadCloud size={16} /> Nhập Excel/CSV hàng loạt
              </button>
              <button onClick={() => handleOpenUserModal()} className="btn btn-primary">
                <Plus size={16} /> Thêm tài khoản mới
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên đăng nhập (MSSV)</th>
                  <th>Họ và Tên</th>
                  <th>Email</th>
                  <th>Vai trò (Role)</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{u.username}</td>
                    <td style={{ fontWeight: '500' }}>{u.full_name}</td>
                    <td>{u.email || '—'}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-resubmit' : u.role === 'lecturer' ? 'badge-submitted' : 'badge-draft'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        color: u.is_active ? 'var(--neon-emerald)' : 'var(--neon-ruby)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '13px'
                      }}>
                        {u.is_active ? <Unlock size={14} /> : <Lock size={14} />}
                        {u.is_active ? 'Hoạt động' : 'Bị Khóa'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleOpenUserModal(u)} className="btn btn-secondary" style={{ padding: '6px 10px', marginRight: '6px' }} title="Sửa">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDeleteUser(u.id)} className="btn btn-danger" style={{ padding: '6px 10px' }} title="Xóa">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CLASSES CONTENT */}
      {activeTab === 'classes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '20px' }}>
          {/* Lớp học phần list */}
          <div className="cyber-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px' }}>Các lớp học</h3>
              <button onClick={() => setShowClassModal(true)} className="btn btn-primary" style={{ padding: '8px 12px' }}>
                <Plus size={16} /> Tạo lớp
              </button>
            </div>
            
            <div className="table-container" style={{ margin: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Tên Lớp</th>
                    <th>Mô tả</th>
                    <th style={{ textAlign: 'right' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(c => (
                    <tr 
                      key={c.id} 
                      onClick={async () => {
                        const token = localStorage.getItem('malsec_token')
                        const res = await fetch(`/api/classes/${c.id}`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        })
                        if (res.ok) setSelectedClass(await res.json())
                      }}
                      style={{ cursor: 'pointer', background: selectedClass?.id === c.id ? 'rgba(0, 242, 254, 0.05)' : '' }}
                    >
                      <td style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>{c.name}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.description}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge badge-submitted">SV &rarr;</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chi tiết lớp được chọn & Gán sinh viên */}
          <div className="cyber-card">
            {selectedClass ? (
              <div>
                <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Lớp: {selectedClass.name}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '24px' }}>
                  {selectedClass.description}
                </p>

                {/* Form gán học sinh vào lớp */}
                <form onSubmit={handleAssignStudents} style={{ marginBottom: '28px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--neon-cyan)' }}>Gán sinh viên vào lớp học phần</h4>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Nhập mã ID các Sinh viên (Phân cách bằng dấu phẩy hoặc khoảng trắng)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ví dụ: 3, 4, 15, 20"
                      value={studentIdsInput}
                      onChange={(e) => setStudentIdsInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-success" style={{ padding: '8px 16px' }} disabled={actionLoading}>
                    {actionLoading ? 'ĐANG THÊM...' : 'XÁC NHẬN GÁN SINH VIÊN'}
                  </button>
                </form>

                {/* Danh sách sinh viên thuộc lớp */}
                <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>Danh sách sinh viên trong lớp ({selectedClass.users?.length || 0} SV)</h4>
                <div className="table-container" style={{ margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="cyber-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Tên sinh viên (MSSV)</th>
                        <th>Họ và Tên</th>
                        <th>Email</th>
                        <th style={{ textAlign: 'right' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClass.users && selectedClass.users.length > 0 ? (
                        selectedClass.users.map(student => (
                          <tr key={student.id}>
                            <td>{student.id}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{student.username}</td>
                            <td style={{ fontWeight: '500' }}>{student.full_name}</td>
                            <td>{student.email || '—'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button 
                                onClick={() => handleRemoveStudentFromClass(student.id)} 
                                className="btn btn-danger" 
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                Xóa khỏi lớp
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có sinh viên nào trong lớp này.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Chọn một lớp học phần ở bảng bên trái để xem danh sách sinh viên và gán sinh viên.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB AUDIT LOGS CONTENT */}
      {activeTab === 'logs' && (
        <div className="cyber-card">
          <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Lịch sử hoạt động của hệ thống (Audit Trail)</h3>
          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Thời gian (UTC)</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>IP Address</th>
                  <th>Chi tiết đối tượng</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {log.user ? `${log.user.full_name} (@${log.user.username})` : 'Hệ thống'}
                    </td>
                    <td>
                      <span className="badge badge-submitted" style={{ textTransform: 'uppercase' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{log.ip_address}</td>
                    <td style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>{log.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL USER ADD/EDIT */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingUser ? 'Sửa thông tin tài khoản' : 'Thêm tài khoản mới'}</h3>
              <button onClick={() => setShowUserModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tên đăng nhập (MSSV đối với sinh viên)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="Ví dụ: AT160102"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={editingUser !== null}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Họ và Tên đầy đủ</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Địa chỉ Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="Ví dụ: student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mật khẩu {editingUser && '(Bỏ trống nếu không đổi)'}</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder={editingUser ? "Không đổi mật khẩu..." : "Mặc định nếu trống là 12345678"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vai trò (Role)</label>
                  <select 
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="student">Student (Sinh viên)</option>
                    <option value="lecturer">Lecturer (Giảng viên)</option>
                    <option value="admin">Admin (Quản trị)</option>
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <input 
                    type="checkbox" 
                    id="isActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="isActiveCheck" style={{ fontSize: '14px', cursor: 'pointer' }}>Tài khoản hoạt động bình thường</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowUserModal(false)} className="btn btn-secondary">ĐÓNG</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'ĐANG LƯU...' : 'LƯU TÀI KHOẢN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CLASS ADD */}
      {showClassModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Tạo lớp học phần mới</h3>
              <button onClick={() => setShowClassModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveClass}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tên lớp học phần</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="Ví dụ: AT16-Malware"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Mô tả chi tiết</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Mô tả học phần..."
                    value={classDesc}
                    onChange={(e) => setClassDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowClassModal(false)} className="btn btn-secondary">ĐÓNG</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'ĐANG TẠO...' : 'TẠO LỚP HỌC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL/CSV */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>Nhập danh sách sinh viên hàng loạt từ tệp tin CSV</h3>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); }} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleImportCSV}>
              <div className="modal-body">
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Hệ thống hỗ trợ nhập tự động hàng loạt tài khoản sinh viên và tự động tạo/gán lớp học phần.
                  Yêu cầu định dạng tệp tin CSV gồm ít nhất 3 cột (hoặc 4 cột để nạp địa chỉ Email): <b>MSSV, Họ và tên, Lớp học phần, Email (tùy chọn)</b>.
                  Mật khẩu đăng nhập mặc định cho các sinh viên mới tạo sẽ là <b>12345678</b>.
                </p>

                <div className="upload-zone" style={{ marginBottom: '20px' }}>
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={(e) => setImportFile(e.target.files[0])}
                    style={{ display: 'none' }} 
                    id="csvFileInput" 
                  />
                  <label htmlFor="csvFileInput" style={{ cursor: 'pointer', display: 'block' }}>
                    <UploadCloud className="upload-icon" size={48} style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '15px', fontWeight: '500' }}>
                      {importFile ? `Tệp tin đã chọn: ${importFile.name}` : 'Click vào đây để chọn tệp tin .CSV từ máy tính'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Kích thước tối đa 10 MB.
                    </p>
                  </label>
                </div>

                {importResult && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '15px', color: 'var(--neon-cyan)', marginBottom: '8px' }}>
                      Kết quả xử lý:
                    </h4>
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '13.5px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                      {importResult.message}
                    </div>
                    
                    <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Danh sách chi tiết xử lý:</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <table className="cyber-table" style={{ fontSize: '12.5px' }}>
                        <thead>
                          <tr>
                            <th>MSSV</th>
                            <th>Sinh viên</th>
                            <th>Email</th>
                            <th>Lớp</th>
                            <th>Kết quả</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.details?.map((d, i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{d.username}</td>
                              <td>{d.full_name}</td>
                              <td>{d.email || '—'}</td>
                              <td>{d.class}</td>
                              <td style={{ color: d.status.includes('Tạo mới') ? 'var(--neon-cyan)' : 'var(--neon-emerald)' }}>{d.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); }} className="btn btn-secondary">ĐÓNG</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading || !importFile}>
                  {actionLoading ? 'ĐANG NHẬP DỮ LIỆU...' : 'BẮT ĐẦU IMPORT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
