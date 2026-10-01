import React, { useState, useEffect } from 'react'
import { 
  Users, School, ShieldAlert, FileSpreadsheet, Plus, Edit2, 
  Trash2, ShieldCheck, Lock, Unlock, Key, RefreshCw, UploadCloud, Monitor, Play, Calendar, Check,
  HardDrive, Disc, FileArchive, Upload, Download, AlertTriangle,
  Search, ChevronDown, ChevronRight, Folder, FolderPlus
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
  const [hideLecturerSuggestions, setHideLecturerSuggestions] = useState(false)
  const [hideStudentSuggestions, setHideStudentSuggestions] = useState(false)
  // User directory filter & search state
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all') // all | student | lecturer | admin
  const [userStatusFilter, setUserStatusFilter] = useState('all') // all | active | locked

  // Class grouping & filter state
  const [classSearchQuery, setClassSearchQuery] = useState('')
  const [classSemesterFilter, setClassSemesterFilter] = useState('all')
  const [collapsedSemesters, setCollapsedSemesters] = useState({})

  // VM Management grouping & filter state
  const [vmSearchQuery, setVmSearchQuery] = useState('')
  const [vmSemesterFilter, setVmSemesterFilter] = useState('all')
  const [vmClassFilter, setVmClassFilter] = useState('all')
  const [vmLecturerFilter, setVmLecturerFilter] = useState('all')
  const [vmStatusFilter, setVmStatusFilter] = useState('all') // all | active | closed
  const [vmGroupingMode, setVmGroupingMode] = useState('semester') // semester | class | lecturer | flat
  const [collapsedVmGroups, setCollapsedVmGroups] = useState({})

  // VM Shared Tools Space state
  const [vmToolSpace, setVmToolSpace] = useState('common') // 'common' | 'lecturer_<username>'

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

  // --- VM SHARED DRIVE (Ổ D:) HANDLERS ---
  const [vmToolFiles, setVmToolFiles] = useState([])
  const [vmToolUploading, setVmToolUploading] = useState(false)
  const [vmToolSyncing, setVmToolSyncing] = useState(false)
  const [toolFileToUpload, setToolFileToUpload] = useState(null)

  const fetchVmTools = async (targetSpace = vmToolSpace) => {
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/admin/vm-tools/files?scope=${encodeURIComponent(targetSpace)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setVmToolFiles(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch VM tool files:', e)
    }
  }

  const handleUploadVmTool = async (e) => {
    e.preventDefault()
    if (!toolFileToUpload) return
    setVmToolUploading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    const formData = new FormData()
    formData.append('file', toolFileToUpload)

    try {
      const res = await fetch(`/api/admin/vm-tools/files?scope=${encodeURIComponent(vmToolSpace)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to upload tool')
      setSuccess(`Uploaded ${data.filename} to [${data.scope || vmToolSpace}] workspace successfully!`)
      setToolFileToUpload(null)
      // Reset input element
      const fileInput = document.getElementById('vmToolFileInput')
      if (fileInput) fileInput.value = ''
      await fetchVmTools(vmToolSpace)
    } catch (err) {
      setError(err.message)
    } finally {
      setVmToolUploading(false)
    }
  }

  const handleDeleteVmTool = async (fname) => {
    const spaceLabel = vmToolSpace === 'common' ? 'Drive D: Common Storage' : `Private Workspace of ${vmToolSpace.replace('lecturer_', '')}`
    if (!confirm(`Are you sure you want to delete '${fname}' from ${spaceLabel}?`)) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/admin/vm-tools/files/${encodeURIComponent(fname)}?scope=${encodeURIComponent(vmToolSpace)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to delete file')
      setSuccess(`Deleted ${fname} from ${spaceLabel} successfully!`)
      await fetchVmTools(vmToolSpace)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSyncVmTools = async () => {
    setVmToolSyncing(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch('/api/admin/vm-tools/sync-vms', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to sync Drive D: to active VMs')
      setSuccess(data.message || `Drive D: synchronized to ${data.synced_count} active student VMs!`)
    } catch (err) {
      setError(err.message)
    } finally {
      setVmToolSyncing(false)
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
          onClick={() => {
            setActiveTab('vm-tools')
            fetchVmTools()
          }} 
          className={`btn ${activeTab === 'vm-tools' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <HardDrive size={15} /> VM Shared Tools (Drive D:)
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>User Accounts Directory</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: '4px 0 0 0' }}>
                Manage all students, lecturers, and system administrators.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowImportModal(true)} className="btn btn-secondary">
                <UploadCloud size={16} /> Bulk Excel/CSV Import
              </button>
              <button onClick={() => handleOpenUserModal()} className="btn btn-primary">
                <Plus size={16} /> Add New User
              </button>
            </div>
          </div>

          {/* User Filters & Search Bar */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap', 
            alignItems: 'center', 
            padding: '12px 16px', 
            background: '#f8fafc', 
            borderRadius: '10px', 
            border: '1px solid var(--border-color)',
            marginBottom: '18px' 
          }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px', margin: 0, fontSize: '13px', background: '#ffffff' }}
                placeholder="Search by username, full name, or email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter by Role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Role:</label>
              <select
                className="form-select"
                style={{ width: '130px', margin: 0, fontSize: '12.5px', background: '#ffffff' }}
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="lecturer">Lecturer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Filter by Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Status:</label>
              <select
                className="form-select"
                style={{ width: '130px', margin: 0, fontSize: '12.5px', background: '#ffffff' }}
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="locked">Locked Only</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {(userSearchQuery || userRoleFilter !== 'all' || userStatusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setUserSearchQuery('')
                  setUserRoleFilter('all')
                  setUserStatusFilter('all')
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Users Table */}
          {(() => {
            const filteredUsers = users.filter(u => {
              if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
              if (userStatusFilter === 'active' && !u.is_active) return false
              if (userStatusFilter === 'locked' && u.is_active) return false
              if (userSearchQuery.trim()) {
                const q = userSearchQuery.trim().toLowerCase()
                const matchU = u.username && u.username.toLowerCase().includes(q)
                const matchN = u.full_name && u.full_name.toLowerCase().includes(q)
                const matchE = u.email && u.email.toLowerCase().includes(q)
                if (!matchU && !matchN && !matchE) return false
              }
              return true
            })

            return (
              <div className="table-container">
                <div style={{ marginBottom: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Showing <b>{filteredUsers.length}</b> of <b>{users.length}</b> accounts</span>
                </div>
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
                    {filteredUsers.map(u => (
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
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                          No accounts match your search/filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}

      {/* TAB CLASSES CONTENT */}
      {activeTab === 'classes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: '20px' }}>
          {/* Classes list */}
          <div className="cyber-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '18px', margin: 0 }}>Classes Directory</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0 0' }}>
                  Grouped by Academic Semester ({classes.length} total)
                </p>
              </div>
              <button onClick={() => handleOpenClassModal(null)} className="btn btn-primary" style={{ padding: '7px 12px', fontSize: '12.5px' }}>
                <Plus size={15} /> Create Class
              </button>
            </div>

            {/* Filter and Search for Classes */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '30px', margin: 0, fontSize: '12px', background: '#f8fafc' }}
                  placeholder="Search class..."
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ width: '130px', margin: 0, fontSize: '12px', background: '#f8fafc' }}
                value={classSemesterFilter}
                onChange={(e) => setClassSemesterFilter(e.target.value)}
              >
                <option value="all">All Semesters</option>
                {semesters.map(s => (
                  <option key={s.id} value={s.name}>{s.name} {s.is_active ? '🌟' : ''}</option>
                ))}
                <option value="unknown">Unknown</option>
              </select>
            </div>
            
            {/* Grouped Classes View */}
            {(() => {
              // Group classes by semester
              const semMap = {}
              classes.forEach(c => {
                const sem = c.semester || 'unknown'
                if (classSemesterFilter !== 'all' && sem !== classSemesterFilter) return
                if (classSearchQuery.trim()) {
                  const q = classSearchQuery.trim().toLowerCase()
                  const matchN = c.name && c.name.toLowerCase().includes(q)
                  const matchD = c.description && c.description.toLowerCase().includes(q)
                  if (!matchN && !matchD) return
                }
                if (!semMap[sem]) semMap[sem] = []
                semMap[sem].push(c)
              })

              const sortedSemesters = Object.keys(semMap).sort((a, b) => {
                const semA = semesters.find(s => s.name === a)
                const semB = semesters.find(s => s.name === b)
                if (semA?.is_active) return -1
                if (semB?.is_active) return 1
                if (a === 'unknown') return 1
                if (b === 'unknown') return -1
                return b.localeCompare(a)
              })

              if (sortedSemesters.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No classes found matching filters.
                  </div>
                )
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '560px', overflowY: 'auto', paddingRight: '4px' }}>
                  {sortedSemesters.map(semKey => {
                    const classList = semMap[semKey]
                    const isCollapsed = !!collapsedSemesters[semKey]
                    const semObj = semesters.find(s => s.name === semKey)

                    return (
                      <div 
                        key={semKey}
                        style={{ 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px', 
                          background: '#ffffff',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Semester Header */}
                        <div
                          onClick={() => setCollapsedSemesters(prev => ({ ...prev, [semKey]: !prev[semKey] }))}
                          style={{
                            padding: '8px 12px',
                            background: semObj?.is_active ? 'rgba(16, 185, 129, 0.08)' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                            <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                              📅 {semKey === 'unknown' ? 'Unknown Semester' : `Semester ${semKey}`}
                            </span>
                            {semObj?.is_active && (
                              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '10px', padding: '1px 6px' }}>
                                Active Term
                              </span>
                            )}
                          </div>
                          <span className="badge badge-submitted" style={{ fontSize: '11px' }}>
                            {classList.length} {classList.length === 1 ? 'class' : 'classes'}
                          </span>
                        </div>

                        {/* Classes Table under this semester */}
                        {!isCollapsed && (
                          <div className="table-container" style={{ margin: 0 }}>
                            <table className="cyber-table" style={{ fontSize: '12.5px' }}>
                              <thead>
                                <tr>
                                  <th>Class Name</th>
                                  <th>Description</th>
                                  <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {classList.map(c => (
                                  <tr 
                                    key={c.id} 
                                    onClick={async () => {
                                      const token = localStorage.getItem('malsec_token')
                                      const res = await fetch(`/api/classes/${c.id}`, {
                                        headers: { 'Authorization': `Bearer ${token}` }
                                      })
                                      if (res.ok) setSelectedClass(await res.json())
                                    }}
                                    style={{ 
                                      cursor: 'pointer', 
                                      background: selectedClass?.id === c.id ? 'rgba(0, 242, 254, 0.08)' : 'transparent',
                                      borderLeft: selectedClass?.id === c.id ? '3px solid var(--neon-cyan)' : 'none'
                                    }}
                                  >
                                    <td style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>
                                      {c.name}
                                    </td>
                                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      {c.description || '—'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleOpenClassModal(c)
                                          }} 
                                          className="btn btn-secondary" 
                                          style={{ padding: '3px 6px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                                          title="Edit Class"
                                        >
                                          <Edit2 size={11} />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteClass(c.id, c.name)
                                          }} 
                                          className="btn btn-danger" 
                                          style={{ padding: '3px 6px', fontSize: '11px', border: 'none' }}
                                          title="Delete Class"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
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
                Academic Semesters
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
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

          {/* VM Filter and Grouping Bar */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            marginBottom: '18px'
          }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px', margin: 0, fontSize: '13px', background: '#ffffff' }}
                placeholder="Search lab title or ID..."
                value={vmSearchQuery}
                onChange={(e) => setVmSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter by Semester */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Semester:</label>
              <select
                className="form-select"
                style={{ width: '135px', margin: 0, fontSize: '12.5px', background: '#ffffff' }}
                value={vmSemesterFilter}
                onChange={(e) => setVmSemesterFilter(e.target.value)}
              >
                <option value="all">All Semesters</option>
                {semesters.map(s => (
                  <option key={s.id} value={s.name}>{s.name} {s.is_active ? '🌟' : ''}</option>
                ))}
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Filter by Class */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Class:</label>
              <select
                className="form-select"
                style={{ width: '150px', margin: 0, fontSize: '12.5px', background: '#ffffff' }}
                value={vmClassFilter}
                onChange={(e) => setVmClassFilter(e.target.value)}
              >
                <option value="all">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Lecturer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Lecturer:</label>
              <select
                className="form-select"
                style={{ width: '150px', margin: 0, fontSize: '12.5px', background: '#ffffff' }}
                value={vmLecturerFilter}
                onChange={(e) => setVmLecturerFilter(e.target.value)}
              >
                <option value="all">All Lecturers</option>
                {users.filter(u => u.role === 'lecturer' || u.role === 'admin').map(u => (
                  <option key={u.id} value={String(u.id)}>{u.full_name} ({u.username})</option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Status:</label>
              <select
                className="form-select"
                style={{ width: '110px', margin: 0, fontSize: '12.5px', background: '#ffffff' }}
                value={vmStatusFilter}
                onChange={(e) => setVmStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Grouping Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--neon-cyan)' }}>Group by:</label>
              <select
                className="form-select"
                style={{ width: '130px', margin: 0, fontSize: '12.5px', background: '#ffffff', borderColor: 'var(--neon-cyan)' }}
                value={vmGroupingMode}
                onChange={(e) => setVmGroupingMode(e.target.value)}
              >
                <option value="semester">📅 Semester</option>
                <option value="class">🏫 Class</option>
                <option value="lecturer">👨‍🏫 Lecturer</option>
                <option value="flat">📄 Flat List</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {(vmSearchQuery || vmSemesterFilter !== 'all' || vmClassFilter !== 'all' || vmLecturerFilter !== 'all' || vmStatusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setVmSearchQuery('')
                  setVmSemesterFilter('all')
                  setVmClassFilter('all')
                  setVmLecturerFilter('all')
                  setVmStatusFilter('all')
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Filtered & Grouped Labs VM Table */}
          {(() => {
            const filteredLabs = labs.filter(lab => {
              const cls = classes.find(c => c.id === lab.class_id)
              const sem = cls?.semester || 'unknown'
              if (vmSemesterFilter !== 'all' && sem !== vmSemesterFilter) return false
              if (vmClassFilter !== 'all' && String(lab.class_id) !== vmClassFilter) return false
              if (vmLecturerFilter !== 'all' && String(lab.created_by_id) !== vmLecturerFilter) return false
              if (vmStatusFilter === 'active' && !lab.is_active) return false
              if (vmStatusFilter === 'closed' && lab.is_active) return false
              if (vmSearchQuery.trim()) {
                const q = vmSearchQuery.trim().toLowerCase()
                const matchTitle = lab.title && lab.title.toLowerCase().includes(q)
                const matchId = String(lab.id).includes(q)
                const matchClass = cls?.name && cls.name.toLowerCase().includes(q)
                if (!matchTitle && !matchId && !matchClass) return false
              }
              return true
            })

            if (filteredLabs.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  No practical labs found matching your filters.
                </div>
              )
            }

            // Flat mode
            if (vmGroupingMode === 'flat') {
              return (
                <div className="table-container">
                  <table className="cyber-table">
                    <thead>
                      <tr>
                        <th>Practical Lab Title</th>
                        <th>Assigned Class</th>
                        <th>Lecturer / Author</th>
                        <th>Submission Deadline</th>
                        <th>Lab Status</th>
                        <th style={{ textAlign: 'right' }}>Manage VMs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLabs.map(lab => {
                        const cls = classes.find(c => c.id === lab.class_id)
                        const lecturer = users.find(u => u.id === lab.created_by_id)
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
                            <td>
                              <div>{cls ? cls.name : `Class ID ${lab.class_id}`}</div>
                              {cls?.semester && (
                                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px' }}>
                                  📅 {cls.semester}
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: '12.5px' }}>
                              {lecturer ? lecturer.full_name : `User ID ${lab.created_by_id}`}
                            </td>
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
                    </tbody>
                  </table>
                </div>
              )
            }

            // Grouped Mode: Semester | Class | Lecturer
            const groupMap = {}
            filteredLabs.forEach(lab => {
              const cls = classes.find(c => c.id === lab.class_id)
              const lecturer = users.find(u => u.id === lab.created_by_id)
              
              let groupKey = 'Default'
              let groupLabel = 'Default'
              let groupBadge = ''

              if (vmGroupingMode === 'semester') {
                const sem = cls?.semester || 'unknown'
                groupKey = sem
                groupLabel = sem === 'unknown' ? 'Unknown Semester' : `Semester ${sem}`
                const semObj = semesters.find(s => s.name === sem)
                if (semObj?.is_active) groupBadge = '🌟 Active Term'
              } else if (vmGroupingMode === 'class') {
                groupKey = String(lab.class_id)
                groupLabel = cls ? cls.name : `Class #${lab.class_id}`
                if (cls?.semester) groupBadge = `📅 ${cls.semester}`
              } else if (vmGroupingMode === 'lecturer') {
                groupKey = String(lab.created_by_id)
                groupLabel = lecturer ? `${lecturer.full_name} (@${lecturer.username})` : `Lecturer ID ${lab.created_by_id}`
                if (lecturer?.role) groupBadge = lecturer.role.toUpperCase()
              }

              if (!groupMap[groupKey]) {
                groupMap[groupKey] = {
                  label: groupLabel,
                  badge: groupBadge,
                  labs: []
                }
              }
              groupMap[groupKey].labs.push(lab)
            })

            const groupKeys = Object.keys(groupMap).sort((a, b) => {
              if (vmGroupingMode === 'semester') {
                if (a === 'unknown') return 1
                if (b === 'unknown') return -1
                return b.localeCompare(a)
              }
              return groupMap[a].label.localeCompare(groupMap[b].label)
            })

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {groupKeys.map(gKey => {
                  const grp = groupMap[gKey]
                  const isCollapsed = !!collapsedVmGroups[gKey]

                  return (
                    <div 
                      key={gKey} 
                      style={{ 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '10px', 
                        background: '#ffffff', 
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Group Header */}
                      <div
                        onClick={() => setCollapsedVmGroups(prev => ({ ...prev, [gKey]: !prev[gKey] }))}
                        style={{
                          padding: '10px 16px',
                          background: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {grp.label}
                          </span>
                          {grp.badge && (
                            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', padding: '2px 8px' }}>
                              {grp.badge}
                            </span>
                          )}
                        </div>
                        <span className="badge badge-submitted" style={{ fontSize: '11.5px' }}>
                          {grp.labs.length} {grp.labs.length === 1 ? 'lab' : 'labs'}
                        </span>
                      </div>

                      {/* Group Labs Table */}
                      {!isCollapsed && (
                        <div className="table-container" style={{ margin: 0 }}>
                          <table className="cyber-table">
                            <thead>
                              <tr>
                                <th>Practical Lab Title</th>
                                <th>Assigned Class</th>
                                <th>Lecturer / Author</th>
                                <th>Submission Deadline</th>
                                <th>Lab Status</th>
                                <th style={{ textAlign: 'right' }}>Manage VMs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grp.labs.map(lab => {
                                const cls = classes.find(c => c.id === lab.class_id)
                                const lecturer = users.find(u => u.id === lab.created_by_id)
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
                                    <td>
                                      <div>{cls ? cls.name : `Class ID ${lab.class_id}`}</div>
                                      {cls?.semester && (
                                        <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px' }}>
                                          📅 {cls.semester}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ fontSize: '12.5px' }}>
                                      {lecturer ? lecturer.full_name : `User ID ${lab.created_by_id}`}
                                    </td>
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
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* TAB VM SHARED DRIVE (DRIVE D:) CONTENT */}
      {activeTab === 'vm-tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div className="cyber-card" style={{ 
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.04) 0%, rgba(79, 172, 254, 0.08) 100%)',
            border: '1px solid rgba(0, 242, 254, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '46px', 
                  height: '46px', 
                  borderRadius: '10px', 
                  background: 'rgba(0, 242, 254, 0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--neon-cyan)',
                  border: '1px solid rgba(0, 242, 254, 0.3)'
                }}>
                  <Disc size={26} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Shared VM Tools Drive (Drive D: ISO & Private Lecturer Spaces)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: '4px 0 0 0' }}>
                    Manage files in the <b>Common Shared Space</b> (mounted as <code>tools-1001.iso</code>) or individual <b>Private Spaces</b> for each lecturer.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => fetchVmTools(vmToolSpace)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
                >
                  <RefreshCw size={14} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={handleSyncVmTools}
                  className="btn btn-primary"
                  disabled={vmToolSyncing}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
                  title="Remount CD-ROM drive on all active student VMs"
                >
                  <RefreshCw size={14} className={vmToolSyncing ? 'animate-spin' : ''} />
                  {vmToolSyncing ? 'Syncing...' : 'Sync to Running VMs 🔄'}
                </button>
              </div>
            </div>
          </div>

          {/* Workspace Space Selector Switcher */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap', 
            alignItems: 'center', 
            padding: '12px 18px', 
            background: '#ffffff', 
            borderRadius: '10px', 
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={18} style={{ color: 'var(--neon-cyan)' }} />
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>Storage Workspace:</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setVmToolSpace('common')
                  fetchVmTools('common')
                }}
                className={`btn ${vmToolSpace === 'common' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                🌐 Common Space (Drive D: Global)
              </button>

              <div style={{ height: '24px', width: '1px', background: '#cbd5e1', margin: '0 4px' }} />

              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                👨‍🏫 Lecturer Private Spaces:
              </span>

              <select
                className="form-select"
                style={{ 
                  width: '260px', 
                  margin: 0, 
                  fontSize: '12.5px', 
                  background: vmToolSpace.startsWith('lecturer_') ? '#f0f9ff' : '#ffffff',
                  borderColor: vmToolSpace.startsWith('lecturer_') ? '#38bdf8' : 'var(--border-color)',
                  fontWeight: vmToolSpace.startsWith('lecturer_') ? '600' : 'normal'
                }}
                value={vmToolSpace.startsWith('lecturer_') ? vmToolSpace : ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val) {
                    setVmToolSpace(val)
                    fetchVmTools(val)
                  }
                }}
              >
                <option value="">-- Select Lecturer to Open Private Workspace --</option>
                {users.filter(u => u.role === 'lecturer' || u.role === 'admin').map(u => (
                  <option key={u.id} value={`lecturer_${u.username}`}>
                    {u.full_name} (@{u.username})
                  </option>
                ))}
              </select>

              {vmToolSpace.startsWith('lecturer_') && (
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', padding: '4px 8px' }}>
                  🔒 Lecturer Private Space: <b>@{vmToolSpace.replace('lecturer_', '')}</b>
                </span>
              )}
            </div>
          </div>

          {/* Upload card & Files table grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Upload form card */}
            <div className="cyber-card">
              <h4 style={{ fontSize: '15px', color: 'var(--neon-cyan)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} /> 
                {vmToolSpace === 'common' 
                  ? 'Upload to Common Drive D:' 
                  : `Upload to @${vmToolSpace.replace('lecturer_', '')}'s Space`}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5, marginBottom: '16px' }}>
                {vmToolSpace === 'common' 
                  ? 'Files uploaded to the common storage will be automatically packaged into tools-1001.iso for all student VMs.'
                  : `Files uploaded to lecturer @${vmToolSpace.replace('lecturer_', '')}'s private space. The lecturer can select these files when creating lab exercises.`}
              </p>
              <form onSubmit={handleUploadVmTool}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <input
                    type="file"
                    id="vmToolFileInput"
                    className="form-input"
                    onChange={(e) => setToolFileToUpload(e.target.files?.[0] || null)}
                    disabled={vmToolUploading}
                    style={{ padding: '8px', fontSize: '12.5px' }}
                  />
                  {toolFileToUpload && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--neon-emerald)' }}>
                      ✓ Selected: <b>{toolFileToUpload.name}</b> ({(toolFileToUpload.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={!toolFileToUpload || vmToolUploading}
                >
                  <Upload size={15} />
                  {vmToolUploading ? 'Uploading...' : `Upload to [${vmToolSpace === 'common' ? 'Common' : vmToolSpace.replace('lecturer_', '')}]`}
                </button>
              </form>
            </div>

            {/* Files list table */}
            <div className="cyber-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} style={{ color: 'var(--neon-cyan)' }} />
                    {vmToolSpace === 'common' 
                      ? 'Files on Common Drive D:\\' 
                      : `Files in Lecturer @${vmToolSpace.replace('lecturer_', '')}'s Private Space`
                    } ({vmToolFiles.length} {vmToolFiles.length === 1 ? 'file' : 'files'})
                  </h4>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Storage target: <code>{vmToolSpace === 'common' ? '/var/lib/vz/template/iso/tools-content' : `/var/lib/vz/template/iso/tools-content/lecturers/${vmToolSpace.replace('lecturer_', '')}`}</code>
                  </span>
                </div>
                <span className="badge badge-submitted" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  Total: {(vmToolFiles.reduce((acc, f) => acc + (f.size_bytes || 0), 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              <div className="table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      {vmToolSpace === 'common' && <th>Uploaded By (Owner)</th>}
                      <th>Last Modified</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vmToolFiles.map((file, idx) => {
                      const isZip = file.filename.endsWith('.zip') || file.filename.endsWith('.rar') || file.filename.endsWith('.7z')
                      const isExe = file.filename.endsWith('.exe') || file.filename.endsWith('.msi')
                      const sizeMb = (file.size_bytes / (1024 * 1024)).toFixed(2)
                      return (
                        <tr key={idx}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {isZip ? (
                                <FileArchive size={18} style={{ color: 'var(--neon-amber)', flexShrink: 0 }} />
                              ) : isExe ? (
                                <Disc size={18} style={{ color: 'var(--neon-ruby)', flexShrink: 0 }} />
                              ) : (
                                <HardDrive size={18} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                              )}
                              <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                                {file.filename}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                            {file.size_bytes > 1024 * 1024 
                              ? `${sizeMb} MB` 
                              : `${(file.size_bytes / 1024).toFixed(1)} KB`}
                          </td>
                          {vmToolSpace === 'common' && (
                            <td>
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '12px',
                                color: file.owner_username === 'system' ? 'var(--text-muted)' : 'var(--neon-cyan)',
                                fontWeight: '500'
                              }}>
                                👤 {file.owner_name || file.owner_username || 'System'}
                                {file.owner_username && file.owner_username !== 'system' && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                    (@{file.owner_username})
                                  </span>
                                )}
                              </span>
                            </td>
                          )}
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            {file.updated_at || '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteVmTool(file.filename)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', color: 'var(--neon-ruby)', borderColor: 'rgba(255, 8, 68, 0.3)' }}
                              title="Delete file"
                              disabled={actionLoading}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {vmToolFiles.length === 0 && (
                      <tr>
                        <td colSpan={vmToolSpace === 'common' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>
                          No files found in {vmToolSpace === 'common' ? 'Common Drive D:\\' : `private workspace of @${vmToolSpace.replace('lecturer_', '')}`}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'logs' && (

        <div className="cyber-card">
          <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>System Activity & Security Audit Trail</h3>
          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
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
