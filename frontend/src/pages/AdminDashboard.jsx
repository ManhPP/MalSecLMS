import React, { useState, useEffect } from 'react'
import { 
  Users, School, ShieldAlert, FileSpreadsheet, Plus, Edit2, 
  Trash2, ShieldCheck, Lock, Unlock, Key, RefreshCw, UploadCloud, Monitor, Play, Calendar, Check 
} from 'lucide-react'

// --- TIMEZONE & DATE FORMATTING HELPER (LOCAL ASIA/HO_CHI_MINH) ---
export const parseVietnamDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  let s = String(dateInput).trim();
  // If string has no timezone indicator (no Z, no +, no -offset), treat as Vietnam GMT+7
  if (!s.includes('Z') && !s.includes('+') && !s.match(/-\d\d:\d\d$/)) {
    s = s.replace(' ', 'T') + '+07:00';
  }
  return new Date(s);
};

export const formatLocalTime = (dateInput) => {
  if (!dateInput) return '—';
  const d = parseVietnamDate(dateInput);
  if (!d || isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [labs, setLabs] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [semesters, setSemesters] = useState([])
  
  // UI Tabs: 'users' | 'classes' | 'semesters' | 'vms' | 'logs'
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
  const [editingClass, setEditingClass] = useState(null)
  const [className, setClassName] = useState('')
  const [classDesc, setClassDesc] = useState('')
  const [classSemester, setClassSemester] = useState('unknown')

  // Semester Management State
  const [showSemesterModal, setShowSemesterModal] = useState(false)
  const [editingSemester, setEditingSemester] = useState(null)
  const [semesterName, setSemesterName] = useState('')
  const [semesterDesc, setSemesterDesc] = useState('')
  const [semesterIsActive, setSemesterIsActive] = useState(false)

  // VM Manager Modal State
  const [showVmManagerModal, setShowVmManagerModal] = useState(false)
  const [selectedLabForVm, setSelectedLabForVm] = useState(null)
  const [studentVms, setStudentVms] = useState([])
  const [vmActionLoading, setVmActionLoading] = useState(false)

  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Selected class detail for Student Assignment
  const [selectedClass, setSelectedClass] = useState(null)
  const [studentIdsInput, setStudentIdsInput] = useState('') // CSV string of IDs/usernames
  const [lecturerIdsInput, setLecturerIdsInput] = useState('') // CSV string of lecturer IDs/usernames
  const [hideStudentSuggestions, setHideStudentSuggestions] = useState(false)
  const [hideLecturerSuggestions, setHideLecturerSuggestions] = useState(false)



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

      // 3. Fetch Labs
      const labRes = await fetch('/api/labs/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (labRes.ok) setLabs(await labRes.json())

      // 4. Fetch Semesters
      const semRes = await fetch('/api/semesters/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (semRes.ok) setSemesters(await semRes.json())

      // 5. Fetch Audit Logs
      const lRes = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (lRes.ok) setAuditLogs(await lRes.json())

    } catch (err) {
      setError('Failed to fetch data from server')
    } finally {
      setLoading(false)
    }
  }

  // VM Manager Handlers for Admin
  const fetchLabVms = async (labId) => {
    setVmActionLoading(true)
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/${labId}/vms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setStudentVms(await res.json())
      }
    } catch (err) {
      setError('Failed to query student VM list')
    } finally {
      setVmActionLoading(false)
    }
  }

  const openVmManagerModal = async (lab) => {
    setSelectedLabForVm(lab)
    setShowVmManagerModal(true)
    fetchLabVms(lab.id)
  }

  const handleControlVm = async (labId, vmid, action, studentName) => {
    if (action === 'purge' && !confirm(`[ADMIN CONTROL] Are you sure you want to completely purge the VM (VM ${vmid}) for student ${studentName}?\nThis VM will be 100% deleted from the Proxmox cluster so the student can re-clone a fresh VM!`)) return

    setVmActionLoading(true)
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/${labId}/vms/${vmid}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to execute VM operation')
      setSuccess(data.message)
      fetchLabVms(labId)
    } catch (err) {
      setError(err.message)
      setVmActionLoading(false)
    }
  }

  const handleBatchControlVm = async (labId, action) => {
    const isPurge = action === 'purge_all'
    const confirmMsg = isPurge 
      ? `⚠️ [ADMIN CONTROL] HIGH RISK WARNING: Are you SURE you want to completely PURGE 100% of all student VMs for this lab?\nAll student VMs on the Proxmox cluster will be permanently destroyed!`
      : `[ADMIN CONTROL] Are you sure you want to STOP ALL running student VMs for this lab?`

    if (!confirm(confirmMsg)) return

    setVmActionLoading(true)
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/${labId}/vms/batch-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to execute batch VM control')
      setSuccess(data.message)
      fetchLabVms(labId)
    } catch (err) {
      setError(err.message)
      setVmActionLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCleanOrphanedVms = async () => {
    if (!confirm('Are you sure you want to scan and purge all student VMs belonging to deleted/non-existent labs?\nThis will permanently destroy orphaned VMs on Proxmox.')) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch('/api/admin/vms/clean-orphaned', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to clean orphaned VMs')
      setSuccess(data.message || 'Orphaned VMs cleaned successfully!')
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // User CRUD handlers
  const handleSaveUser = async (e) => {
    e.preventDefault()
    if (!editingUser && !password) {
      setError('Please enter an initial password for the new account')
      return
    }
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
        body.password = password
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
      if (!res.ok) throw new Error(data.detail || 'Failed to execute user operation')

      setSuccess(editingUser ? 'Account updated successfully!' : 'New account created successfully!')
      setShowUserModal(false)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this account?')) return
    setActionLoading(true)
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to delete user')
      }
      setSuccess('User deleted successfully!')
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
  const handleOpenClassModal = (cls = null) => {
    setEditingClass(cls)
    if (cls) {
      setClassName(cls.name)
      setClassDesc(cls.description || '')
      setClassSemester(cls.semester || 'unknown')
    } else {
      setClassName('')
      setClassDesc('')
      setClassSemester('unknown')
    }
    setShowClassModal(true)
  }

  const handleSaveClass = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes/'
      const method = editingClass ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: className, 
          description: classDesc,
          semester: classSemester.trim() || 'unknown'
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to execute class operation')

      setSuccess(editingClass ? 'Class updated successfully!' : 'New class created successfully!')
      setShowClassModal(false)
      setEditingClass(null)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteClass = async (classId, clsName) => {
    if (!confirm(`Are you sure you want to delete class "${clsName}"?\nThis action cannot be undone!`)) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const isJson = res.headers.get('content-type')?.includes('application/json')
      const data = isJson ? await res.json() : { detail: await res.text() }

      if (!res.ok) throw new Error(data.detail || 'Failed to delete class')

      setSuccess(`Class "${clsName}" deleted successfully!`)
      if (selectedClass?.id === classId) {
        setSelectedClass(null)
      }
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Semester CRUD & Activation handlers
  const handleOpenSemesterModal = (sem = null) => {
    setEditingSemester(sem)
    if (sem) {
      setSemesterName(sem.name)
      setSemesterDesc(sem.description || '')
      setSemesterIsActive(sem.is_active || false)
    } else {
      setSemesterName('')
      setSemesterDesc('')
      setSemesterIsActive(false)
    }
    setShowSemesterModal(true)
  }

  const handleSaveSemester = async (e) => {
    e.preventDefault()
    if (!semesterName.trim()) {
      setError('Semester name is required')
      return
    }
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      let url = '/api/semesters/'
      let method = 'POST'
      let body = {
        name: semesterName.trim(),
        description: semesterDesc.trim() || null,
        is_active: semesterIsActive
      }

      if (editingSemester) {
        url = `/api/semesters/${editingSemester.id}`
        method = 'PUT'
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
      if (!res.ok) throw new Error(data.detail || 'Failed to save semester')

      setSuccess(editingSemester ? `Semester ${data.name} updated successfully!` : `Semester ${data.name} created successfully!`)
      setShowSemesterModal(false)
      setEditingSemester(null)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSetActiveSemester = async (semId, semName) => {
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/semesters/${semId}/activate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to activate semester')

      setSuccess(`Academic Semester "${semName}" is now the active term across the entire platform!`)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteSemester = async (semId, semName) => {
    if (!confirm(`Are you sure you want to delete semester "${semName}"?\nClasses in this semester will have their term reset to 'unknown'.`)) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/semesters/${semId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to delete semester')

      setSuccess(data.message || `Semester "${semName}" deleted successfully!`)
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

    const items = studentIdsInput.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    const student_ids = items.map(x => parseInt(x)).filter(x => !isNaN(x) && String(x) === items.find(i => i === String(x)))
    const usernames = items.filter(x => isNaN(parseInt(x)) || String(parseInt(x)) !== x)

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ student_ids, usernames })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to add students to class')

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
    if (!confirm('Are you sure you want to remove this student from the class?')) return
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
      setError('Failed to remove student')
    }
  }

  const handleAssignLecturers = async (e) => {
    e.preventDefault()
    if (!selectedClass || !lecturerIdsInput) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    const items = lecturerIdsInput.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    const lecturer_ids = items.map(x => parseInt(x)).filter(x => !isNaN(x) && String(x) === items.find(i => i === String(x)))
    const usernames = items.filter(x => isNaN(parseInt(x)) || String(parseInt(x)) !== x)

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/lecturers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lecturer_ids, usernames })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to add lecturers to class')

      setSuccess(data.message)
      setLecturerIdsInput('')
      
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


  const handleRemoveLecturerFromClass = async (lecturerId) => {
    if (!confirm('Are you sure you want to remove this lecturer from the class?')) return
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/lecturers/${lecturerId}`, {
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
      setError('Failed to remove lecturer')
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
      if (!res.ok) throw new Error(data.detail || 'Failed to import CSV file')

      setImportResult(data)
      setSuccess('Student list imported successfully!')
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
            <div className="stat-label">Total Accounts</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap"><School size={24} /></div>
          <div>
            <div className="stat-number">{classes.length}</div>
            <div className="stat-label">Classes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap"><ShieldAlert size={24} style={{ color: 'var(--neon-emerald)' }} /></div>
          <div>
            <div className="stat-number" style={{ color: 'var(--neon-emerald)' }}>100%</div>
            <div className="stat-label">System Health</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap"><FileSpreadsheet size={24} /></div>
          <div>
            <div className="stat-number">{auditLogs.length}</div>
            <div className="stat-label">Audit Logs</div>
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
          User Management
        </button>
        <button 
          onClick={() => setActiveTab('classes')} 
          className={`btn ${activeTab === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px' }}
        >
          Class Management
        </button>
        <button 
          onClick={() => setActiveTab('semesters')} 
          className={`btn ${activeTab === 'semesters' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Calendar size={15} /> Academic Semesters
        </button>
        <button 
          onClick={() => setActiveTab('vms')} 
          className={`btn ${activeTab === 'vms' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Monitor size={15} /> Proxmox VM Management
        </button>
        <button 
          onClick={() => setActiveTab('logs')} 
          className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px' }}
        >
          Audit Trail & Activity Logs
        </button>

        
        <button 
          onClick={fetchData} 
          className="btn btn-secondary" 
          style={{ marginLeft: 'auto', padding: '8px 12px' }}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* TAB USERS CONTENT */}
      {activeTab === 'users' && (
        <div className="cyber-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px' }}>User Accounts Directory</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowImportModal(true)} className="btn btn-secondary">
                <UploadCloud size={16} /> Bulk Excel/CSV Import
              </button>
              <button onClick={() => handleOpenUserModal()} className="btn btn-primary">
                <Plus size={16} /> Add New User
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username (Student ID)</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
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
                        {u.is_active ? 'Active' : 'Locked'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleOpenUserModal(u)} className="btn btn-secondary" style={{ padding: '6px 10px', marginRight: '6px' }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDeleteUser(u.id)} className="btn btn-danger" style={{ padding: '6px 10px' }} title="Delete">
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
          {/* Classes list */}
          <div className="cyber-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px' }}>Classes</h3>
              <button onClick={() => handleOpenClassModal(null)} className="btn btn-primary" style={{ padding: '8px 12px' }}>
                <Plus size={16} /> Create Class
              </button>
            </div>
            
            <div className="table-container" style={{ margin: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Class Name</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                      <td style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>
                        <div>{c.name}</div>
                        <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10.5px', marginTop: '3px', display: 'inline-block' }}>
                          📅 {c.semester || 'unknown'}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.description}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenClassModal(c)
                            }} 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                            title="Edit Class"
                          >
                            <Edit2 size={12} style={{ marginRight: '3px' }} /> Edit
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClass(c.id, c.name)
                            }} 
                            className="btn btn-danger" 
                            style={{ padding: '4px 8px', fontSize: '11px', border: 'none' }}
                            title="Delete Class"
                          >
                            <Trash2 size={12} style={{ marginRight: '3px' }} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          </div>

          {/* Selected class details & user assignment */}
          <div className="cyber-card">
            {selectedClass ? (
              <div>
                <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Class: {selectedClass.name}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '24px' }}>
                  {selectedClass.description}
                </p>

                {(() => {
                  const classStudents = (selectedClass.users || []).filter(u => u.role === 'student');
                  const classLecturers = (selectedClass.users || []).filter(u => u.role === 'lecturer');
                  
                  return (
                    <div>
                      {/* Assign lecturers form */}
                      <form onSubmit={handleAssignLecturers} style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--neon-cyan)' }}>Assign Lecturers to Class</h4>
                        <div className="form-group" style={{ marginBottom: '12px', position: 'relative' }}>
                          <label className="form-label">Enter Lecturer Username or ID (comma separated)</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. lecturer01, lec_alex, 2"
                            value={lecturerIdsInput}
                            onChange={(e) => {
                              setLecturerIdsInput(e.target.value)
                              setHideLecturerSuggestions(false)
                            }}
                          />
                          {(() => {
                            if (hideLecturerSuggestions) return null;
                            const lastToken = lecturerIdsInput.split(/[\s,]+/).pop()?.trim() || '';
                            const suggestions = lastToken.length >= 1 
                              ? users.filter(u => 
                                  u.role === 'lecturer' && 
                                  !classLecturers.some(cl => cl.id === u.id) &&
                                  (u.username.toLowerCase().includes(lastToken.toLowerCase()) || 
                                   u.full_name.toLowerCase().includes(lastToken.toLowerCase()))
                                ).slice(0, 6)
                              : [];

                            if (suggestions.length === 0) return null;

                            return (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 100,
                                background: '#1e293b',
                                border: '1px solid #38bdf8',
                                borderRadius: '8px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.9)',
                                marginTop: '4px',
                                maxHeight: '220px',
                                overflowY: 'auto'
                              }}>
                                {suggestions.map(u => (
                                  <div 
                                    key={u.id}
                                    onClick={() => {
                                      const parts = lecturerIdsInput.split(/[\s,]+/);
                                      parts.pop();
                                      const prefix = parts.filter(Boolean).join(', ');
                                      setLecturerIdsInput(prefix ? `${prefix}, ${u.username}, ` : `${u.username}, `);
                                      setHideLecturerSuggestions(true);
                                    }}
                                    style={{
                                      padding: '10px 14px',
                                      cursor: 'pointer',
                                      borderBottom: '1px solid #334155',
                                      display: 'flex',
                                      justify: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '13.5px',
                                      transition: 'background 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <div>
                                      <span style={{ fontWeight: '700', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{u.username}</span>
                                      <span style={{ marginLeft: '10px', color: '#f8fafc', fontWeight: '500' }}>{u.full_name}</span>
                                    </div>
                                    <span style={{ 
                                      fontSize: '12px', 
                                      color: '#38bdf8', 
                                      fontWeight: '600',
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(56, 189, 248, 0.3)'
                                    }}>
                                      + Select
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }} disabled={actionLoading}>
                          {actionLoading ? 'ASSIGNING...' : 'CONFIRM ASSIGN LECTURERS'}
                        </button>
                      </form>

                      {/* Assign students form */}
                      <form onSubmit={handleAssignStudents} style={{ marginBottom: '28px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--neon-cyan)' }}>Assign Students to Class</h4>
                        <div className="form-group" style={{ marginBottom: '12px', position: 'relative' }}>
                          <label className="form-label">Enter Student Username (Student ID) or ID (comma separated)</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. std01, std02, 20210001"
                            value={studentIdsInput}
                            onChange={(e) => {
                              setStudentIdsInput(e.target.value)
                              setHideStudentSuggestions(false)
                            }}
                          />
                          {(() => {
                            if (hideStudentSuggestions) return null;
                            const lastToken = studentIdsInput.split(/[\s,]+/).pop()?.trim() || '';
                            const suggestions = lastToken.length >= 1 
                              ? users.filter(u => 
                                  u.role === 'student' && 
                                  !classStudents.some(cs => cs.id === u.id) &&
                                  (u.username.toLowerCase().includes(lastToken.toLowerCase()) || 
                                   u.full_name.toLowerCase().includes(lastToken.toLowerCase()))
                                ).slice(0, 6)
                              : [];

                            if (suggestions.length === 0) return null;

                            return (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 100,
                                background: '#1e293b',
                                border: '1px solid #38bdf8',
                                borderRadius: '8px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.9)',
                                marginTop: '4px',
                                maxHeight: '220px',
                                overflowY: 'auto'
                              }}>
                                {suggestions.map(u => (
                                  <div 
                                    key={u.id}
                                    onClick={() => {
                                      const parts = studentIdsInput.split(/[\s,]+/);
                                      parts.pop();
                                      const prefix = parts.filter(Boolean).join(', ');
                                      setStudentIdsInput(prefix ? `${prefix}, ${u.username}, ` : `${u.username}, `);
                                      setHideStudentSuggestions(true);
                                    }}
                                    style={{
                                      padding: '10px 14px',
                                      cursor: 'pointer',
                                      borderBottom: '1px solid #334155',
                                      display: 'flex',
                                      justify: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '13.5px',
                                      transition: 'background 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <div>
                                      <span style={{ fontWeight: '700', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{u.username}</span>
                                      <span style={{ marginLeft: '10px', color: '#f8fafc', fontWeight: '500' }}>{u.full_name}</span>
                                    </div>
                                    <span style={{ 
                                      fontSize: '12px', 
                                      color: '#38bdf8', 
                                      fontWeight: '600',
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(56, 189, 248, 0.3)'
                                    }}>
                                      + Select
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <button type="submit" className="btn btn-success" style={{ padding: '8px 16px' }} disabled={actionLoading}>
                          {actionLoading ? 'ADDING...' : 'CONFIRM ASSIGN STUDENTS'}
                        </button>
                      </form>



                      {/* Assigned lecturers list */}
                      <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>Assigned Lecturers ({classLecturers.length})</h4>
                      <div className="table-container" style={{ margin: '0 0 28px 0', maxHeight: '200px', overflowY: 'auto' }}>
                        <table className="cyber-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Username</th>
                              <th>Full Name</th>
                              <th>Email</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classLecturers.length > 0 ? (
                              classLecturers.map(lecturer => (
                                <tr key={lecturer.id}>
                                  <td>{lecturer.id}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)' }}>{lecturer.username}</td>
                                  <td style={{ fontWeight: '500' }}>{lecturer.full_name}</td>
                                  <td>{lecturer.email || '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button 
                                      onClick={() => handleRemoveLecturerFromClass(lecturer.id)} 
                                      className="btn btn-danger" 
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                    >
                                      Remove from Class
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No lecturers assigned to this class yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Enrolled students list */}
                      <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>Enrolled Students ({classStudents.length})</h4>
                      <div className="table-container" style={{ margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
                        <table className="cyber-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Student ID (Username)</th>
                              <th>Full Name</th>
                              <th>Email</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.length > 0 ? (
                              classStudents.map(student => (
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
                                      Remove from Class
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students enrolled in this class yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Select a class from the left panel to manage assigned lecturers and enrolled students.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB SEMESTERS CONTENT */}
      {activeTab === 'semesters' && (
        <div className="cyber-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} style={{ color: 'var(--neon-cyan)' }} />
                Academic Semesters (Quản lý Kỳ học)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Create and manage academic semesters. The active semester is marked across the platform to group classes and filter submissions.
              </p>
            </div>
            <button onClick={() => handleOpenSemesterModal(null)} className="btn btn-primary" style={{ padding: '8px 14px' }}>
              <Plus size={16} /> Add New Semester
            </button>
          </div>

          <div className="table-container" style={{ margin: 0 }}>
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Semester Name</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Classes Associated</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {semesters.map(sem => {
                  const classCount = classes.filter(c => (c.semester || '').toLowerCase() === sem.name.toLowerCase()).length
                  return (
                    <tr key={sem.id} style={{ background: sem.is_active ? 'rgba(16, 185, 129, 0.05)' : '' }}>
                      <td style={{ fontWeight: '700', fontSize: '15px', color: 'var(--neon-cyan)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>📅 {sem.name}</span>
                          {sem.is_active && (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '11px', fontWeight: 'bold' }}>
                              🌟 Current Active Term
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {sem.is_active ? (
                          <span className="badge badge-submitted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> Active
                          </span>
                        ) : (
                          <span className="badge badge-draft">
                            Archived / Past
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        {sem.description || '—'}
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11.5px', fontWeight: '600' }}>
                          {classCount} {classCount === 1 ? 'Class' : 'Classes'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                        {new Date(sem.created_at).toLocaleDateString('en-US')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {!sem.is_active && (
                            <button
                              onClick={() => handleSetActiveSemester(sem.id, sem.name)}
                              className="btn btn-success"
                              style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Set as Current Active Term"
                              disabled={actionLoading}
                            >
                              <Check size={12} /> Set as Active
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenSemesterModal(sem)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                            title="Edit Semester"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSemester(sem.id, sem.name)}
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '11px', border: 'none' }}
                            title="Delete Semester"
                            disabled={sem.is_active}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {semesters.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No academic semesters created yet. Click "Add New Semester" to define terms like FA25, SP26, SU26...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB VMS CONTENT */}
      {activeTab === 'vms' && (
        <div className="cyber-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>Proxmox VE Cluster VM Management</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Monitor and manage active student VMs on Proxmox. Total Active Labs: {labs.length}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                onClick={handleCleanOrphanedVms} 
                className="btn btn-danger" 
                style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={actionLoading}
                title="Scan Proxmox cluster and destroy student VMs belonging to deleted/non-existent labs"
              >
                <Trash2 size={15} /> Clean Orphaned VMs
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Practical Lab Title</th>
                  <th>Assigned Class</th>
                  <th>Hạn nộp (Deadline)</th>
                  <th>Lab Status</th>
                  <th style={{ textAlign: 'right' }}>Manage VMs</th>
                </tr>
              </thead>
              <tbody>
                {labs.map(lab => {
                  const cls = classes.find(c => c.id === lab.class_id)
                  return (
                    <tr key={lab.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge" style={{ background: '#e2e8f0', color: '#334155', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px' }}>
                            ID #{lab.id}
                          </span>
                          <span style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>{lab.title}</span>
                        </div>
                      </td>
                      <td>{cls ? cls.name : `Class ID ${lab.class_id}`}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                        {formatLocalTime(lab.deadline)}
                      </td>
                      <td>
                        <span className={`badge ${lab.is_active ? 'badge-graded' : 'badge-draft'}`}>
                          {lab.is_active ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => openVmManagerModal(lab)} 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12.5px' }}
                        >
                          <Monitor size={14} style={{ marginRight: '6px' }} /> Monitor & Purge VMs &rarr;
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {labs.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No labs found in the system.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB AUDIT LOGS CONTENT */}
      {activeTab === 'logs' && (

        <div className="cyber-card">
          <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>System Activity & Security Audit Trail</h3>
          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Thời gian (Timestamp)</th>
                  <th>Actor / User</th>
                  <th>Action</th>
                  <th>IP Address</th>
                  <th>Target Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                      {formatLocalTime(log.timestamp)}
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {log.user ? `${log.user.full_name} (@${log.user.username})` : 'System'}
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
              <h3>{editingUser ? 'Edit User Account' : 'Add New User Account'}</h3>
              <button onClick={() => setShowUserModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Username (Student ID for students)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. AT160102"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={editingUser !== null}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="e.g. student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password {editingUser && '(Leave blank to keep unchanged)'}</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder={editingUser ? "Leave blank to keep password..." : "Enter initial password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editingUser}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select 
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <input 
                    type="checkbox" 
                    id="isActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="isActiveCheck" style={{ fontSize: '14px', cursor: 'pointer' }}>Account is Active</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowUserModal(false)} className="btn btn-secondary">CLOSE</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'SAVING...' : 'SAVE ACCOUNT'}
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
              <h3>{editingClass ? 'Edit Class Details' : 'Create New Class'}</h3>
              <button onClick={() => setShowClassModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveClass}>
              <div className="modal-body">
                {error && (
                  <div className="plag-alert-banner" style={{ marginBottom: '14px' }}>
                    <ShieldAlert size={16} />
                    <span>{error}</span>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Class Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. AT16-Malware"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Academic Semester</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Default: "unknown"</span>
                  </label>
                  <select 
                    className="form-select"
                    value={classSemester}
                    onChange={(e) => setClassSemester(e.target.value)}
                    style={{ background: '#ffffff' }}
                  >
                    <option value="unknown">unknown (Unassigned / No term)</option>
                    {semesters.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.is_active ? '🌟 (Current Active)' : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                    💡 Choose from the academic terms configured in "Academic Semesters".
                  </p>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Class description and curriculum objectives..."
                    value={classDesc}
                    onChange={(e) => setClassDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowClassModal(false)} className="btn btn-secondary">CLOSE</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'SAVING...' : editingClass ? 'SAVE CHANGES' : 'CREATE CLASS'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL SEMESTER ADD/EDIT */}
      {showSemesterModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--neon-cyan)' }} />
                {editingSemester ? 'Edit Academic Semester' : 'Create New Academic Semester'}
              </h3>
              <button onClick={() => setShowSemesterModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveSemester}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {error && (
                  <div className="plag-alert-banner" style={{ margin: 0 }}>
                    <ShieldAlert size={16} />
                    <span>{error}</span>
                  </div>
                )}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Semester Code / Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. FA25, SP26, SU26, 2025-2026..."
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                  />
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                    Unique code identifying the academic term.
                  </p>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description (Optional)</label>
                  <textarea 
                    className="form-input" 
                    rows={2}
                    placeholder="e.g. Fall Semester 2026 - Regular Academic Term"
                    value={semesterDesc}
                    onChange={(e) => setSemesterDesc(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <input 
                    type="checkbox" 
                    id="semActiveCheck"
                    checked={semesterIsActive}
                    onChange={(e) => setSemesterIsActive(e.target.checked)}
                  />
                  <label htmlFor="semActiveCheck" style={{ fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                    🌟 <b>Set as Current Active Term</b> (Will make this the active term across the entire platform)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowSemesterModal(false)} className="btn btn-secondary">CLOSE</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'SAVING...' : editingSemester ? 'SAVE CHANGES' : 'CREATE SEMESTER'}
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
              <h3>Bulk Student Import from CSV File</h3>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); }} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleImportCSV}>
              <div className="modal-body">
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  The system supports bulk importing student accounts and automatically creating/assigning them to classes.
                  Required CSV format with at least 3 columns (or 4 columns including Email): <b>Student ID, Full Name, Class Name, Email (optional)</b>.
                  Initial passwords for imported students are generated according to server security configuration.
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
                      {importFile ? `Selected file: ${importFile.name}` : 'Click here to select a .CSV file from your computer'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Maximum file size: 10 MB.
                    </p>
                  </label>
                </div>

                {importResult && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '15px', color: 'var(--neon-cyan)', marginBottom: '8px' }}>
                      Processing Results:
                    </h4>
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '13.5px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                      {importResult.message}
                    </div>
                    
                    <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Detailed Import Logs:</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <table className="cyber-table" style={{ fontSize: '12.5px' }}>
                        <thead>
                          <tr>
                            <th>Student ID</th>
                            <th>Full Name</th>
                            <th>Email</th>
                            <th>Class</th>
                            <th>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.details?.map((d, i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{d.username}</td>
                              <td>{d.full_name}</td>
                              <td>{d.email || '—'}</td>
                              <td>{d.class}</td>
                              <td style={{ color: d.status?.toLowerCase().includes('create') ? 'var(--neon-cyan)' : 'var(--neon-emerald)' }}>{d.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); }} className="btn btn-secondary">CLOSE</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading || !importFile}>
                  {actionLoading ? 'IMPORTING...' : 'START IMPORT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VM MANAGER FOR ADMIN */}

      {showVmManagerModal && selectedLabForVm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Monitor size={18} style={{ color: 'var(--neon-cyan)' }} />
                [ADMIN CONTROL] Student Virtual Machines — Lab: {selectedLabForVm.title}
                <span className="badge" style={{ background: '#e2e8f0', color: '#334155', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', marginLeft: '4px' }}>
                  Lab ID: {selectedLabForVm.id}
                </span>
              </h3>
              <button onClick={() => setShowVmManagerModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  List of Proxmox VE virtual machines allocated to students for this lab.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleBatchControlVm(selectedLabForVm.id, 'stop_all')} 
                    className="btn btn-secondary" 
                    disabled={vmActionLoading}
                    style={{ padding: '6px 12px', fontSize: '12px', background: '#475569', border: 'none' }}
                    title="Stop all running virtual machines"
                  >
                    🛑 Stop All VMs
                  </button>
                  <button 
                    onClick={() => handleBatchControlVm(selectedLabForVm.id, 'purge_all')} 
                    className="btn btn-danger" 
                    disabled={vmActionLoading}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    title="Purge all student VMs from Proxmox cluster"
                  >
                    <Trash2 size={13} style={{ marginRight: '4px' }} /> Purge All VMs
                  </button>
                  <button 
                    onClick={() => fetchLabVms(selectedLabForVm.id)} 
                    className="btn btn-secondary" 
                    disabled={vmActionLoading}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <RefreshCw size={13} style={{ marginRight: '4px' }} /> Refresh
                  </button>
                </div>
              </div>


              <div className="table-container" style={{ margin: 0, maxHeight: '400px', overflowY: 'auto' }}>
                <table className="cyber-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Student (Username)</th>
                      <th>VMID</th>
                      <th>IP Address</th>
                      <th>Proxmox Status</th>
                      <th>Resources (CPU/RAM)</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentVms.map(vm => (
                      <tr key={vm.vmid}>
                        <td>
                          <div style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>{vm.student_full_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{vm.student_username}</div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{vm.vmid}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{vm.ip_address}</td>
                        <td>
                          <span className={`badge ${
                            vm.status === 'running' ? 'badge-submitted' :
                            vm.status === 'stopped' ? 'badge-resubmit' : 'badge-draft'
                          }`}>
                            {vm.status === 'running' ? '🟢 RUNNING' :
                             vm.status === 'stopped' ? '🔴 STOPPED' : '⚪ NOT CREATED'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {vm.status === 'running' ? `${vm.cpu}% CPU | ${vm.mem}/${vm.maxmem} MB` : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {vm.status === 'stopped' && (
                              <button 
                                onClick={() => handleControlVm(selectedLabForVm.id, vm.vmid, 'start', vm.student_full_name)}
                                className="btn btn-success" 
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                disabled={vmActionLoading}
                                title="Start VM"
                              >
                                <Play size={12} style={{ marginRight: '3px' }} /> Start
                              </button>
                            )}
                            {vm.status === 'running' && (
                              <button 
                                onClick={() => handleControlVm(selectedLabForVm.id, vm.vmid, 'stop', vm.student_full_name)}
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '11px', background: '#475569', border: 'none' }}
                                disabled={vmActionLoading}
                                title="Stop VM"
                              >
                                🛑 Stop
                              </button>
                            )}
                            {vm.status !== 'not_created' && (
                              <button 
                                onClick={() => handleControlVm(selectedLabForVm.id, vm.vmid, 'purge', vm.student_full_name)}
                                className="btn btn-danger" 
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                disabled={vmActionLoading}
                                title="Purge VM completely from Proxmox"
                              >
                                <Trash2 size={12} style={{ marginRight: '3px' }} /> Purge VM
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {studentVms.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No students enrolled in this class or assigned yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowVmManagerModal(false)} className="btn btn-secondary">CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
