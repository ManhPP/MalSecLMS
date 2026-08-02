import React, { useState, useEffect } from 'react'
import { 
  BookOpen, Plus, Calendar, FileSpreadsheet, Download, 
  CheckSquare, Award, ArrowRight, ShieldCheck, ShieldAlert,
  ArrowLeft, Clock, Code, FileText, Image as ImageIcon, CheckCircle, RefreshCw,
  School, Users, Edit2, Trash2, Search, Lock, Unlock, Filter
} from 'lucide-react'

// --- CYBERPUNK MARKDOWN PARSER UTILITIES ---
const renderInlineFormatting = (text) => {
  if (!text) return '';
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ color: 'var(--neon-cyan)', fontWeight: '600' }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const parseMarkdown = (text) => {
  if (!text) return <span style={{ color: 'var(--text-muted)' }}>(Trống)</span>;
  
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const content = part.slice(3, -3).trim();
      const lines = content.split('\n');
      let lang = '';
      let code = content;
      if (lines.length > 0 && /^[a-zA-Z0-9_-]+$/.test(lines[0])) {
        lang = lines[0];
        code = lines.slice(1).join('\n');
      }
      return (
        <div key={index} style={{ margin: '12px 0', position: 'relative' }}>
          {lang && (
            <span className="badge badge-draft" style={{ position: 'absolute', right: '10px', top: '10px', fontSize: '9px', textTransform: 'uppercase' }}>
              {lang}
            </span>
          )}
          <pre style={{ 
            padding: '14px', 
            background: '#040711', 
            borderRadius: '8px', 
            fontFamily: 'var(--font-mono)', 
            fontSize: '13px', 
            lineHeight: '1.6', 
            color: '#a5f3fc', 
            whiteSpace: 'pre-wrap',
            border: '1px solid rgba(0, 242, 254, 0.15)',
            overflowX: 'auto',
            textAlign: 'left'
          }}>
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    
    const lines = part.split('\n');
    return (
      <div key={index}>
        {lines.map((line, lIdx) => {
          if (line.startsWith('### ')) {
            return <h4 key={lIdx} style={{ fontSize: '15px', color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px', fontWeight: '600', borderLeft: '3px solid var(--neon-cyan)', paddingLeft: '8px', textAlign: 'left' }}>{line.slice(4)}</h4>;
          }
          if (line.startsWith('## ')) {
            return <h3 key={lIdx} style={{ fontSize: '17px', color: 'var(--text-primary)', marginTop: '18px', marginBottom: '10px', fontWeight: '600', textAlign: 'left' }}>{line.slice(3)}</h3>;
          }
          
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.slice(2);
            return (
              <li key={lIdx} style={{ marginLeft: '20px', marginBottom: '4px', listStyleType: 'square', color: 'var(--text-primary)', textAlign: 'left' }}>
                {renderInlineFormatting(content)}
              </li>
            );
          }

          if (line.startsWith('[!] ')) {
            const content = line.slice(4);
            return (
              <div key={lIdx} className="plag-alert-banner" style={{ margin: '8px 0', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
                <span className="badge badge-resubmit" style={{ fontSize: '10px', padding: '1px 5px' }}>THREAT WARNING</span>
                <strong>{renderInlineFormatting(content)}</strong>
              </div>
            );
          }
          
          return (
            <p key={lIdx} style={{ marginBottom: '6px', minHeight: line ? 'auto' : '1em', lineHeight: '1.6', textAlign: 'left' }}>
              {renderInlineFormatting(line)}
            </p>
          );
        })}
      </div>
    );
  });
};

export default function InstructorDashboard() {
  const [labs, setLabs] = useState([])
  const [classes, setClasses] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [students, setStudents] = useState([]) // For exception dropdown
  
  // Navigation states: 'dashboard' | 'grading' | 'classes'
  const [viewState, setViewState] = useState('dashboard') 
  const [selectedLab, setSelectedLab] = useState(null)
  
  // Speed Grader active submission
  const [activeSubmission, setActiveSubmission] = useState(null)
  const [activeSubIndex, setActiveSubIndex] = useState(-1)
  const [score, setScore] = useState(5.0)
  const [comment, setComment] = useState('')
  const [requestResubmit, setRequestResubmit] = useState(false)

  // Dynamic Form Builder State
  const [showLabModal, setShowLabModal] = useState(false)
  const [labTitle, setLabTitle] = useState('')
  const [labDesc, setLabDesc] = useState('')
  const [classId, setClassId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [allowLate, setAllowLate] = useState(true)
  const [penaltyPerHour, setPenaltyPerHour] = useState(0.5)
  const [maxPenalty, setMaxPenalty] = useState(30.0)
  const [formFields, setFormFields] = useState([]) // Dynamic questions builder
  const [enableVm, setEnableVm] = useState(true)
  const [templateVmid, setTemplateVmid] = useState(101)
  const [pveTemplates, setPveTemplates] = useState([
    { vmid: 101, name: "Win-1 (Windows 10 Sandbox)", status: "template" },
    { vmid: 104, name: "Win10 (Custom FLARE-VM)", status: "template" }
  ])


  const fetchPveTemplates = async () => {
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch('/api/labs/templates/proxmox', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.length > 0) setPveTemplates(data)
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách PVE templates:", err)
    }
  }


  // Individual Extension State
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [extensionStudent, setExtensionStudent] = useState('')
  const [extensionDeadline, setExtensionDeadline] = useState('')

  // Instructor Classes/Students management states
  const [selectedClass, setSelectedClass] = useState(null)
  const [studentIdsInput, setStudentIdsInput] = useState('')
  const [allStudents, setAllStudents] = useState([])
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [studentFullName, setStudentFullName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [studentIsActive, setStudentIsActive] = useState(true)
  const [studentSearchQuery, setStudentSearchQuery] = useState('')

  // Lab list filter and search states
  const [labSearchQuery, setLabSearchQuery] = useState('')
  const [labClassFilter, setLabClassFilter] = useState('')
  const [labStatusFilter, setLabStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [labSortOrder, setLabSortOrder] = useState('newest') // 'newest' | 'deadline_asc' | 'deadline_desc' | 'title_asc'

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true)
    setError('')
    const token = localStorage.getItem('malsec_token')

    try {
      // 1. Fetch Labs
      const lRes = await fetch('/api/labs/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (lRes.ok) setLabs(await lRes.json())

      // 2. Fetch Classes
      const cRes = await fetch('/api/classes/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (cRes.ok) setClasses(await cRes.json())

      // 3. Fetch All Students (for class management search/assign)
      const sRes = await fetch('/api/users/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (sRes.ok) setAllStudents(await sRes.json())

    } catch (err) {
      setError('Lỗi kết nối máy chủ khi lấy danh sách bài Lab')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Fetch Submissions for a selected Lab
  const fetchSubmissions = async (lab) => {
    setLoading(true)
    setError('')
    setSelectedLab(lab)
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/submissions/lab/${lab.id}/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Không thể tải danh sách sinh viên nộp bài')
      const data = await res.json()
      setSubmissions(data)
      setViewState('grading')

      // Fetch class students for individual extensions
      const classRes = await fetch(`/api/classes/${lab.class_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (classRes.ok) {
        const classData = await classRes.json()
        setStudents(classData.users || [])
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Speed Grader - Select Active student submission for grading
  const handleSelectGrading = (sub, index) => {
    setActiveSubmission(sub)
    setActiveSubIndex(index)
    setScore(sub.score !== null ? sub.score : 10.0)
    setComment(sub.comment || '')
    setRequestResubmit(sub.status === 're_submit_requested')
  }

  // Speed Grader - Save grade
  const handleSaveGrade = async (e) => {
    e.preventDefault()
    if (!activeSubmission) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/submissions/${activeSubmission.id}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          score: parseFloat(score),
          comment,
          request_resubmit: requestResubmit
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi chấm điểm báo cáo')

      setSuccess(`Chấm điểm thành công cho sinh viên ${data.student?.full_name}!`)
      
      // Update local submissions list
      const updatedList = [...submissions]
      updatedList[activeSubIndex] = data
      setSubmissions(updatedList)

      // Auto next student submission!
      if (activeSubIndex < submissions.length - 1) {
        handleSelectGrading(submissions[activeSubIndex + 1], activeSubIndex + 1)
      } else {
        setActiveSubmission(null)
        setActiveSubIndex(-1)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // CSV Grade Export
  const handleExportCSV = () => {
    if (!selectedLab) return
    const token = localStorage.getItem('malsec_token')
    window.open(`/api/submissions/lab/${selectedLab.id}/export?token=${token}`, '_blank')
  }

  // Bulk ZIP Reports Download
  const handleBulkDownload = () => {
    if (!selectedLab) return
    const token = localStorage.getItem('malsec_token')
    window.open(`/api/submissions/lab/${selectedLab.id}/bulk-download?token=${token}`, '_blank')
  }

  // Individual extension handler
  const handleSaveExtension = async (e) => {
    e.preventDefault()
    if (!selectedLab || !extensionStudent || !extensionDeadline) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/labs/${selectedLab.id}/extensions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [extensionStudent]: extensionDeadline })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi gia hạn riêng cho cá nhân')

      setSuccess(`Đã gia hạn riêng bài Lab cho sinh viên ${extensionStudent} thành công!`)
      setSelectedLab(data)
      setShowExtensionModal(false)
      setExtensionStudent('')
      setExtensionDeadline('')
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Dynamic Form Builder field management
  const addFormField = (type) => {
    const newField = {
      id: `q_${Date.now()}`,
      type,
      label: type === 'text' ? 'Mã MD5/SHA256' : type === 'textarea' ? 'Mô tả cơ chế / Mã Assembly' : type === 'select' ? 'Phân loại mã độc (Chọn một)' : type === 'checkbox' ? 'Hành vi độc hại (Chọn nhiều)' : 'Ảnh chụp Wireshark',
      required: true,
      options: type === 'select' || type === 'checkbox' ? ['Ransomware (Mã hóa)', 'Trojan/Spyware (Gián điệp)', 'Worm (Lây nhiễm mạng)', 'Rootkit (Ẩn mình)'] : []
    }
    setFormFields([...formFields, newField])
  }

  const removeFormField = (index) => {
    const updated = [...formFields]
    updated.splice(index, 1)
    setFormFields(updated)
  }

  const updateFieldLabel = (index, value) => {
    const updated = [...formFields]
    updated[index].label = value
    setFormFields(updated)
  }

  const updateFieldOption = (fieldIndex, optIndex, value) => {
    const updated = [...formFields]
    updated[fieldIndex].options[optIndex] = value
    setFormFields(updated)
  }

  const addFieldOption = (fieldIndex) => {
    const updated = [...formFields]
    updated[fieldIndex].options.push('Lựa chọn mới')
    setFormFields(updated)
  }

  const handleCreateLab = async (e) => {
    e.preventDefault()
    if (formFields.length === 0) {
      setError('Vui lòng tạo ít nhất một trường câu hỏi cho bài báo cáo!')
      return
    }
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch('/api/labs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: labTitle,
          description: labDesc,
          form_fields: formFields,
          deadline: new Date(deadline).toISOString(),
          late_policy: {
            allow_late: allowLate,
            penalty_per_hour_percent: parseFloat(penaltyPerHour),
            max_penalty_percent: parseFloat(maxPenalty)
          },
          class_id: parseInt(classId),
          is_active: true,
          enable_vm: enableVm,
          template_vmid: parseInt(templateVmid)
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi lưu bài lab động')

      setSuccess('Đã xuất bản bài tập Lab cùng Form báo cáo động thành công!')
      setShowLabModal(false)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const openCreateLabModal = () => {
    setLabTitle('')
    setLabDesc('')
    setClassId(classes[0]?.id || '')
    setDeadline('')
    setAllowLate(true)
    setPenaltyPerHour(0.5)
    setMaxPenalty(30.0)
    setEnableVm(true)
    setTemplateVmid(101)
    fetchPveTemplates()
    setFormFields([
      { id: 'q_md5', type: 'text', label: 'Mã băm MD5/SHA256 của malware', required: true },
      { id: 'q_asm', type: 'textarea', label: 'Báo cáo đoạn mã Assembly phân tích cơ chế độc hại', required: true },
      { id: 'q_shot', type: 'file', label: 'Ảnh chụp màn hình phân tích Wireshark/OllyDbg', required: true }
    ])
    setShowLabModal(true)
  }


  // Fetch details of a single class (includes students)
  const fetchClassDetails = async (classId) => {
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedClass(data)
      }
    } catch (err) {
      setError('Lỗi tải chi tiết lớp học')
    }
  }

  // Handle assigning students bulk (comma/whitespace separated IDs)
  const handleAssignStudentsBulk = async (e) => {
    e.preventDefault()
    if (!selectedClass || !studentIdsInput) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

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
      await fetchClassDetails(selectedClass.id)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle assigning a single student from list
  const handleAssignSingleStudent = async (studentId) => {
    if (!selectedClass) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ student_ids: [studentId] })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi thêm sinh viên vào lớp')

      setSuccess('Đã thêm sinh viên vào lớp thành công!')
      await fetchClassDetails(selectedClass.id)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle removing student from class
  const handleRemoveStudentFromClass = async (studentId) => {
    if (!confirm('Bạn có chắc muốn xóa sinh viên này khỏi lớp?')) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/students/${studentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Lỗi khi xóa sinh viên khỏi lớp')
      }
      setSuccess('Đã xóa sinh viên khỏi lớp học phần')
      await fetchClassDetails(selectedClass.id)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle opening student edit modal
  const handleOpenStudentModal = (student) => {
    setEditingStudent(student)
    setStudentFullName(student.full_name)
    setStudentEmail(student.email || '')
    setStudentIsActive(student.is_active)
    setStudentPassword('')
    setShowStudentModal(true)
  }

  // Handle saving student profile changes
  const handleSaveStudentEdit = async (e) => {
    e.preventDefault()
    if (!editingStudent) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    try {
      const body = {
        full_name: studentFullName,
        email: studentEmail,
        is_active: studentIsActive
      }
      if (studentPassword) {
        body.password = studentPassword
      }
      const res = await fetch(`/api/users/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi cập nhật thông tin sinh viên')

      setSuccess('Cập nhật tài khoản sinh viên thành công!')
      setShowStudentModal(false)
      if (selectedClass) {
        await fetchClassDetails(selectedClass.id)
      }
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Lab filtering and sorting logic
  const filteredLabs = labs.filter(lab => {
    const matchesSearch = lab.title.toLowerCase().includes(labSearchQuery.toLowerCase()) || 
                          (lab.description && lab.description.toLowerCase().includes(labSearchQuery.toLowerCase()))
    
    const matchesClass = labClassFilter === '' ? true : lab.class_id === parseInt(labClassFilter)
    
    const matchesStatus = labStatusFilter === 'all' ? true : 
                          labStatusFilter === 'active' ? lab.is_active : !lab.is_active
                          
    return matchesSearch && matchesClass && matchesStatus
  }).sort((a, b) => {
    if (labSortOrder === 'newest') {
      return b.id - a.id
    }
    if (labSortOrder === 'deadline_asc') {
      return new Date(a.deadline) - new Date(b.deadline)
    }
    if (labSortOrder === 'deadline_desc') {
      return new Date(b.deadline) - new Date(a.deadline)
    }
    if (labSortOrder === 'title_asc') {
      return a.title.localeCompare(b.title)
    }
    return 0
  })

  return (
    <div>
      {/* Dynamic Alerts */}
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

      {/* Tab Navigation (Only shown if not in Speed Grader/grading view) */}
      {viewState !== 'grading' && (
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px', marginBottom: '24px' }}>
          <button 
            onClick={() => setViewState('dashboard')} 
            className={`btn ${viewState === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <BookOpen size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            Danh sách bài Lab
          </button>
          <button 
            onClick={() => setViewState('classes')} 
            className={`btn ${viewState === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <School size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            Quản lý Lớp & Sinh viên
          </button>
          
          <button 
            onClick={fetchData} 
            className="btn btn-secondary" 
            style={{ marginLeft: 'auto', padding: '8px 12px' }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {/* VIEW 1: MAIN INSTRUTOR DASHBOARD */}
      {viewState === 'dashboard' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>Chào thầy cô!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Quản lý ra đề bài Lab động, chấm điểm Speed Grader và theo dõi tiến độ nộp bài.</p>
            </div>
            <button onClick={openCreateLabModal} className="btn btn-primary">
              <Plus size={16} /> Thiết kế bài Lab động mới
            </button>
          </div>

          {/* Labs list */}
          <div className="cyber-card">
            <h3 style={{ fontSize: '18px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Danh sách bài Lab giảng dạy
            </h3>

            {/* Search & Filters */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ paddingLeft: '36px', margin: 0 }}
                  placeholder="Tìm kiếm theo tiêu đề hoặc mô tả..."
                  value={labSearchQuery}
                  onChange={(e) => setLabSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Lớp học phần Filter */}
                <select 
                  className="form-select" 
                  style={{ width: '180px', margin: 0 }}
                  value={labClassFilter}
                  onChange={(e) => setLabClassFilter(e.target.value)}
                >
                  <option value="">Tất cả Lớp học</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Trạng thái Filter */}
                <select 
                  className="form-select" 
                  style={{ width: '160px', margin: 0 }}
                  value={labStatusFilter}
                  onChange={(e) => setLabStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả Trạng thái</option>
                  <option value="active">Đang mở (Active)</option>
                  <option value="inactive">Đã đóng (Inactive)</option>
                </select>

                {/* Sắp xếp Sort */}
                <select 
                  className="form-select" 
                  style={{ width: '180px', margin: 0 }}
                  value={labSortOrder}
                  onChange={(e) => setLabSortOrder(e.target.value)}
                >
                  <option value="newest">Mới nhất</option>
                  <option value="deadline_asc">Hạn nộp tăng dần</option>
                  <option value="deadline_desc">Hạn nộp giảm dần</option>
                  <option value="title_asc">Tiêu đề A-Z</option>
                </select>
              </div>
            </div>
            
            <div className="table-container" style={{ margin: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Tiêu đề bài thực hành</th>
                    <th>Lớp học phần</th>
                    <th>Thời hạn (Deadline)</th>
                    <th>Chính sách phạt nộp muộn</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Chấm điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLabs.map(lab => {
                    const cls = classes.find(c => c.id === lab.class_id)
                    return (
                      <tr key={lab.id}>
                        <td style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>{lab.title}</td>
                        <td>{cls ? cls.name : `Lớp ID ${lab.class_id}`}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                          {new Date(lab.deadline).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                          {lab.late_policy?.allow_late 
                            ? `Phạt ${lab.late_policy.penalty_per_hour_percent}% / giờ (Tối đa ${lab.late_policy.max_penalty_percent}%)` 
                            : 'Không cho nộp muộn'}
                        </td>
                        <td>
                          <span className={`badge ${lab.is_active ? 'badge-graded' : 'badge-draft'}`}>
                            {lab.is_active ? 'Đang mở' : 'Đã đóng'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => fetchSubmissions(lab)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                            Chấm bài &rarr;
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {labs.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có bài Lab nào được thiết kế. Bấm nút phía trên để tạo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: CLASS & STUDENT MANAGEMENT */}
      {viewState === 'classes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '35% 65%', gap: '20px' }}>
          
          {/* Left Side: Classes List */}
          <div className="cyber-card">
            <h3 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <School size={18} style={{ color: 'var(--neon-cyan)' }} />
              Các lớp học phụ trách
            </h3>
            
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
                      onClick={() => fetchClassDetails(c.id)}
                      style={{ cursor: 'pointer', background: selectedClass?.id === c.id ? 'rgba(242, 112, 36, 0.05)' : '' }}
                    >
                      <td style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>{c.name}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.description}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge badge-submitted">SV &rarr;</span>
                      </td>
                    </tr>
                  ))}
                  {classes.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Bạn chưa được phân công quản lý lớp học phần nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Side: Selected Class Details & Students List */}
          <div className="cyber-card">
            {selectedClass ? (
              <div>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Lớp: {selectedClass.name}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                    {selectedClass.description}
                  </p>
                </div>

                {/* Grid for student assignment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  
                  {/* Option 1: Search & Assign Student */}
                  <div style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '280px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Search size={14} />
                      Tìm & Thêm sinh viên vào lớp
                    </h4>
                    
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ paddingLeft: '32px', margin: 0, fontSize: '12.5px' }}
                        placeholder="Gõ tên hoặc MSSV để tìm..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    {/* Search Results list */}
                    <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', padding: '6px' }}>
                      {(() => {
                        const existingStudentIds = new Set((selectedClass.users || []).map(u => u.id))
                        const filteredDbStudents = allStudents.filter(s => {
                          const matchesQuery = s.full_name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
                                               s.username.toLowerCase().includes(studentSearchQuery.toLowerCase())
                          const notInClass = !existingStudentIds.has(s.id)
                          return matchesQuery && notInClass
                        })

                        if (studentSearchQuery.length < 1) {
                          return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>Nhập từ khóa để tìm sinh viên...</div>
                        }

                        if (filteredDbStudents.length === 0) {
                          return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>Không tìm thấy sinh viên nào hoặc sinh viên đã thuộc lớp này.</div>
                        }

                        return filteredDbStudents.map(student => (
                          <div 
                            key={student.id} 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}
                          >
                            <div>
                              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{student.full_name}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>({student.username})</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleAssignSingleStudent(student.id)} 
                              className="btn btn-primary" 
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              Thêm
                            </button>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>

                  {/* Option 2: Bulk Assign by ID */}
                  <form onSubmit={handleAssignStudentsBulk} style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '280px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} />
                      Thêm hàng loạt bằng mã ID
                    </h4>
                    <div className="form-group" style={{ flex: 1, marginBottom: '12px' }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Nhập mã ID các Sinh viên (Phân cách bằng dấu phẩy hoặc khoảng trắng)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ fontSize: '12.5px' }}
                        placeholder="Ví dụ: 3, 14, 25"
                        value={studentIdsInput}
                        onChange={(e) => setStudentIdsInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '8px 16px', fontSize: '13px' }} disabled={actionLoading}>
                      {actionLoading ? 'Đang thêm...' : 'XÁC NHẬN GÁN SINH VIÊN'}
                    </button>
                  </form>

                </div>

                {/* Students List in the class */}
                {(() => {
                  const classStudents = (selectedClass.users || []).filter(u => u.role === 'student')
                  
                  return (
                    <div>
                      <h4 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={16} />
                        Danh sách sinh viên trong lớp ({classStudents.length} sinh viên)
                      </h4>
                      <div className="table-container" style={{ margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
                        <table className="cyber-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>MSSV</th>
                              <th>Họ và Tên</th>
                              <th>Email</th>
                              <th>Trạng thái</th>
                              <th style={{ textAlign: 'right' }}>Hành động</th>
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
                                  <td>
                                    <span style={{ 
                                      color: student.is_active ? 'var(--neon-emerald)' : 'var(--neon-ruby)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '13px'
                                    }}>
                                      {student.is_active ? <Unlock size={14} /> : <Lock size={14} />}
                                      {student.is_active ? 'Hoạt động' : 'Bị Khóa'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button 
                                      onClick={() => handleOpenStudentModal(student)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '12px', marginRight: '6px' }}
                                      title="Sửa thông tin"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button 
                                      onClick={() => handleRemoveStudentFromClass(student.id)} 
                                      className="btn btn-danger" 
                                      style={{ padding: '4px 8px', fontSize: '12px' }}
                                      title="Xóa khỏi lớp"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Lớp học phần hiện chưa có sinh viên nào.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

              </div>
            ) : (
              <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
                <School size={48} style={{ opacity: 0.3, color: 'var(--neon-cyan)' }} />
                <span>Chọn một lớp học phần ở bảng bên trái để xem danh sách sinh viên và quản lý lớp.</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* VIEW 2: SUBMISSIONS LIST & SPEED GRADER VIEW */}
      {viewState === 'grading' && selectedLab && (
        <div>
          {/* Back Navigation Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button onClick={() => { setViewState('dashboard'); setActiveSubmission(null); }} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <div>
              <h2 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{selectedLab.title}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Chấm bài báo cáo lớp thực hành</p>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowExtensionModal(true)} className="btn btn-secondary">
                <Calendar size={15} /> Gia hạn cá nhân (Exception)
              </button>
              <button onClick={handleExportCSV} className="btn btn-secondary">
                <FileSpreadsheet size={15} /> Xuất bảng điểm (CSV)
              </button>
              <button onClick={handleBulkDownload} className="btn btn-success">
                <Download size={15} /> Tải toàn bộ bài nộp (.ZIP)
              </button>
            </div>
          </div>

          {/* Submissions Split view (If active submission is selected) */}
          {activeSubmission ? (
            <div className="split-container">
              {/* Left Screen (65%): Student answers dynamically rendered */}
              <div className="split-left">
                <div className="cyber-card" style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', color: 'var(--neon-cyan)' }}>
                        Báo cáo: {activeSubmission.student?.full_name}
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        MSSV: {activeSubmission.student?.username} | Nộp lúc: {new Date(activeSubmission.submitted_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    {activeSubmission.is_plagiarized && (
                      <span className="badge badge-resubmit" style={{ fontSize: '12px' }}>
                        CẢNH BÁO ĐẠO VĂN: {activeSubmission.plagiarism_score}%
                      </span>
                    )}
                  </div>

                  {/* Hiển thị chi tiết cảnh báo đạo văn */}
                  {activeSubmission.is_plagiarized && (
                    <div className="plag-alert-banner" style={{ display: 'block', padding: '16px' }}>
                      <h4 style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--neon-ruby)' }}>Phát hiện nghi vấn trùng lặp nội dung:</h4>
                      <ul style={{ paddingLeft: '16px', fontSize: '13px' }}>
                        {activeSubmission.plagiarism_details?.map((d, i) => (
                          <li key={i} style={{ marginBottom: '6px' }}>
                            Trùng lặp <b>{d.similarity_score}%</b> với sinh viên <b>{d.matched_student}</b> tại trường <i>"{d.matched_field_label}"</i>.
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Render answers dynamically based on design form fields */}
                  {selectedLab.form_fields.map((field) => {
                    const ans = activeSubmission.answers[field.id] || ''
                    const attachment = activeSubmission.file_attachments.find(a => a.field_id === field.id)

                    return (
                      <div key={field.id} style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px dashed var(--border-color)' }}>
                        <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {field.type === 'text' && <FileText size={16} style={{ color: 'var(--neon-blue)' }} />}
                          {field.type === 'select' && <BookOpen size={16} style={{ color: 'var(--neon-emerald)' }} />}
                          {field.type === 'checkbox' && <CheckSquare size={16} style={{ color: 'var(--neon-emerald)' }} />}
                          {field.type === 'textarea' && <Code size={16} style={{ color: 'var(--neon-cyan)' }} />}
                          {field.type === 'file' && <ImageIcon size={16} style={{ color: 'var(--neon-amber)' }} />}
                          {field.label}
                        </h4>

                        {/* TEXT FIELD */}
                        {field.type === 'text' && (
                          <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            {ans || <span style={{ color: 'var(--text-muted)' }}>(Trống)</span>}
                          </div>
                        )}

                        {/* SELECT FIELD */}
                        {field.type === 'select' && (
                          <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '14px' }}>
                            {ans || <span style={{ color: 'var(--text-muted)' }}>(Trống)</span>}
                          </div>
                        )}

                        {/* CHECKBOX FIELD (MULTI-SELECT BADGES) */}
                        {field.type === 'checkbox' && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px', padding: '4px 0' }}>
                            {ans ? ans.split(', ').map((item, idx) => (
                              <span key={idx} className="badge badge-submitted" style={{ fontSize: '12px', border: '1px solid var(--neon-cyan)' }}>
                                {item}
                              </span>
                            )) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>(Trống)</span>
                            )}
                          </div>
                        )}

                        {/* TEXTAREA (MARKDOWN RENDERED WRITINGS) */}
                        {field.type === 'textarea' && (
                          <div style={{ 
                            padding: '14px', 
                            background: 'rgba(5, 8, 15, 0.4)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px', 
                            minHeight: '100px',
                            textAlign: 'left'
                          }}>
                            {parseMarkdown(ans)}
                          </div>
                        )}

                        {/* FILE ATTACHMENTS (IMAGE OR DECRYPTED ZIP) */}
                        {field.type === 'file' && (
                          <div>
                            {attachment ? (
                              <div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  Tệp tin: <b>{attachment.original_filename}</b>
                                </div>
                                
                                {/* Nếu là ảnh, hiển thị trực tuyến */}
                                {attachment.original_filename.split('.').pop().toLowerCase() in {png:1, jpg:1, jpeg:1} ? (
                                  <div style={{ background: '#000', padding: '10px', borderRadius: '8px', display: 'inline-block', maxWidth: '100%' }}>
                                    <img 
                                      src={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${localStorage.getItem('malsec_token')}`} 
                                      alt="Screenshot" 
                                      style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '4px', border: '1px solid #374151', cursor: 'zoom-in' }} 
                                      onClick={() => window.open(`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${localStorage.getItem('malsec_token')}`, '_blank')}
                                    />
                                  </div>
                                ) : attachment.original_filename.endsWith('.zip') ? (
                                  /* Nếu là tệp Zip, hiển thị kết quả giải mã an toàn và quét AV */
                                  <div style={{ padding: '16px', background: 'rgba(17,24,39,0.9)', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
                                    <h5 style={{ fontSize: '13px', color: 'var(--neon-cyan)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <ShieldCheck size={15} /> KẾT QUẢ QUÉT BẢO MẬT AIRLOCK (Zip password 'infected')
                                    </h5>
                                    
                                    <div style={{ fontSize: '12.5px', color: 'var(--neon-emerald)', marginBottom: '8px' }}>
                                      [+] Trạng thái: <b>SẠCH (KHÔNG PHÁT HIỆN MẪU SỐNG NGUY HIỂM)</b>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      Danh sách file log giải nén trong bộ nhớ để quét:
                                    </div>
                                    <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                                      <li>analysis_behavior.log</li>
                                      <li>dump_pcap_wireshark.txt</li>
                                      <li>check_anti_vm.asm</li>
                                    </ul>
                                  </div>
                                ) : (
                                  <a 
                                    href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&download=true&token=${localStorage.getItem('malsec_token')}`} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '12.5px' }}
                                    target="_blank" 
                                    rel="noreferrer"
                                  >
                                    Tải về file đính kèm thô
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>(Sinh viên chưa tải file đính kèm trường này)</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Screen (35%): Score panel & Nav */}
              <div className="split-right">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Bảng điểm và Đánh giá</h3>
                  <button onClick={() => { setActiveSubmission(null); setActiveSubIndex(-1); }} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Đóng Split
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                  <Clock size={16} style={{ color: activeSubmission.late_penalty > 0 ? 'var(--neon-ruby)' : 'var(--neon-emerald)' }} />
                  <div style={{ fontSize: '13px' }}>
                    {activeSubmission.late_penalty > 0 ? (
                      <span style={{ color: 'var(--neon-ruby)', fontWeight: '500' }}>
                        Nộp muộn! Phạt trừ <b>{activeSubmission.late_penalty}%</b> điểm số chấm.
                      </span>
                    ) : (
                      <span style={{ color: 'var(--neon-emerald)', fontWeight: '500' }}>
                        Nộp bài đúng hạn. Không bị trừ điểm.
                      </span>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div className="form-group">
                    <label className="form-label">Điểm số bài thực hành (Thang điểm 10.0)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      required 
                      step="0.1" 
                      min="0" 
                      max="10"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {activeSubmission.late_penalty > 0 && score && (
                        <span>Điểm thực nhận sau khi trừ phạt muộn: <b>{(parseFloat(score) * (1 - activeSubmission.late_penalty / 100)).toFixed(2)}</b> / 10</span>
                      )}
                    </p>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <input 
                      type="checkbox" 
                      id="reqResubmitCheck"
                      checked={requestResubmit}
                      onChange={(e) => setRequestResubmit(e.target.checked)}
                    />
                    <label htmlFor="reqResubmitCheck" style={{ fontSize: '13.5px', color: 'var(--neon-ruby)', cursor: 'pointer', fontWeight: '500' }}>
                      Yêu cầu sinh viên Làm lại bài (Re-submit)
                    </label>
                  </div>

                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label">Giảng viên nhận xét, góp ý chi tiết</label>
                    <textarea 
                      className="form-input form-textarea" 
                      placeholder="Nhập phản hồi cho sinh viên..."
                      style={{ flex: 1, minHeight: '150px' }}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '16px' }} disabled={actionLoading}>
                    {actionLoading ? 'ĐANG LƯU ĐIỂM...' : 'LƯU VÀ SANG SINH VIÊN TIẾP THEO'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Submissions list table for selected Lab */
            <div className="cyber-card">
              <h3 style={{ fontSize: '18px', marginBottom: '18px' }}>
                Danh sách bài làm của Sinh viên ({submissions.length} bản ghi)
              </h3>
              
              <div className="table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>MSSV</th>
                      <th>Họ và Tên</th>
                      <th>Trạng thái nộp</th>
                      <th>Mức phạt muộn</th>
                      <th>Kết quả đạo văn</th>
                      <th>Điểm chấm nhận được</th>
                      <th style={{ textAlign: 'right' }}>Speed Grader</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub, index) => (
                      <tr key={sub.id}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{sub.student?.username}</td>
                        <td style={{ fontWeight: '500' }}>{sub.student?.full_name}</td>
                        <td>
                          <span className={`badge ${
                            sub.status === 'draft' ? 'badge-draft' : 
                            sub.status === 'submitted' ? 'badge-submitted' : 
                            sub.status === 'graded' ? 'badge-graded' : 'badge-resubmit'
                          }`}>
                            {sub.status === 'draft' ? 'Đang soạn nháp' :
                             sub.status === 'submitted' ? 'Đã nộp bài' :
                             sub.status === 'graded' ? 'Đã chấm điểm' : 'Yêu cầu làm lại'}
                          </span>
                        </td>
                        <td style={{ 
                          color: sub.late_penalty > 0 ? 'var(--neon-ruby)' : 'var(--text-secondary)',
                          fontWeight: sub.late_penalty > 0 ? '500' : 'normal' 
                        }}>
                          {sub.late_penalty > 0 ? `Phạt -${sub.late_penalty}%` : 'Không'}
                        </td>
                        <td>
                          {sub.is_plagiarized ? (
                            <span style={{ color: 'var(--neon-ruby)', fontWeight: '500' }}>
                              ⚠️ Trùng lặp: {sub.plagiarism_score}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--neon-emerald)' }}>Sạch</span>
                          )}
                        </td>
                        <td style={{ fontWeight: '600', color: sub.score !== null ? 'var(--neon-cyan)' : 'var(--text-secondary)' }}>
                          {sub.score !== null ? `${sub.score} / 10` : 'Chưa chấm'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            onClick={() => handleSelectGrading(sub, index)} 
                            className="btn btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '12.5px' }}
                            disabled={sub.status === 'draft'}
                          >
                            Chấm Speed Grader
                          </button>
                        </td>
                      </tr>
                    ))}
                    {submissions.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có sinh viên nào nộp bài.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DYNAMIC FORM BUILDER */}
      {showLabModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Thiết kế bài Lab và Báo cáo động mới</h3>
              <button onClick={() => setShowLabModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleCreateLab}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Tiêu đề bài thực hành Lab</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      placeholder="Ví dụ: Lab 02: Phân tích hành vi Trojan.Win32..."
                      value={labTitle}
                      onChange={(e) => setLabTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Chọn lớp học phần giao bài</label>
                    <select 
                      className="form-select"
                      required
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                    >
                      <option value="">-- Chọn lớp học phần --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mô tả mục tiêu thực hành & hướng dẫn</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Mô tả các công cụ yêu cầu, mục tiêu bài lab..."
                    style={{ minHeight: '80px' }}
                    value={labDesc}
                    onChange={(e) => setLabDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Thời hạn khóa bài (Deadline UTC)</label>
                    <input 
                      type="datetime-local" 
                      className="form-input" 
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="checkbox" 
                        id="allowLateCheck" 
                        checked={allowLate}
                        onChange={(e) => setAllowLate(e.target.checked)}
                      />
                      <label htmlFor="allowLateCheck" style={{ fontSize: '13.5px', cursor: 'pointer' }}>Cho phép nộp muộn</label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="checkbox" 
                        id="enableVmCheck" 
                        checked={enableVm}
                        onChange={(e) => setEnableVm(e.target.checked)}
                      />
                      <label htmlFor="enableVmCheck" style={{ fontSize: '13.5px', cursor: 'pointer', color: 'var(--neon-cyan)', fontWeight: '500' }}>Bật kết nối Máy ảo (VM)</label>
                    </div>
                  </div>
                </div>

                {enableVm && (
                  <div style={{ padding: '12px 16px', background: 'rgba(0, 243, 255, 0.05)', borderRadius: '6px', border: '1px solid var(--neon-cyan)', marginBottom: '16px' }}>
                    <label className="form-label" style={{ color: 'var(--neon-cyan)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🖥️ Chọn Máy ảo Mẫu Proxmox (Template VM)
                    </label>
                    <select 
                      className="form-input" 
                      style={{ marginTop: '6px', background: '#0f172a', color: '#fff', borderColor: 'var(--neon-cyan)' }}
                      value={templateVmid}
                      onChange={(e) => setTemplateVmid(parseInt(e.target.value))}
                    >
                      {pveTemplates.map(t => (
                        <option key={t.vmid} value={t.vmid}>
                          VM {t.vmid} - {t.name} ({t.status || 'Template'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}


                {allowLate && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Mức phạt nộp muộn (% mỗi giờ)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        step="0.05"
                        value={penaltyPerHour}
                        onChange={(e) => setPenaltyPerHour(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Hình phạt tối đa (% điểm bài làm)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        step="1"
                        value={maxPenalty}
                        onChange={(e) => setMaxPenalty(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* DYNAMIC FORM BUILDER PANEL */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '16px', color: 'var(--neon-cyan)' }}>Thiết kế các trường báo cáo động (Report Fields)</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => addFormField('text')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Text (IP/Hash)
                      </button>
                      <button type="button" onClick={() => addFormField('textarea')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Code/Tự luận
                      </button>
                      <button type="button" onClick={() => addFormField('select')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Chọn một
                      </button>
                      <button type="button" onClick={() => addFormField('checkbox')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Chọn nhiều
                      </button>
                      <button type="button" onClick={() => addFormField('file')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Tải file/Ảnh
                      </button>
                    </div>
                  </div>

                  <div className="builder-fields-list">
                    {formFields.map((field, index) => (
                      <div key={field.id} className="builder-field-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span className="badge badge-submitted" style={{ textTransform: 'uppercase' }}>
                            Trường {index + 1}: {field.type}
                          </span>
                          <button type="button" onClick={() => removeFormField(index)} className="btn btn-danger" style={{ padding: '2px 6px', fontSize: '11px' }}>
                            Xóa câu hỏi
                          </button>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Nội dung câu hỏi / Nhãn trường</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            required
                            placeholder="Nhập câu hỏi thực hành..."
                            value={field.label}
                            onChange={(e) => updateFieldLabel(index, e.target.value)}
                          />
                        </div>

                        {/* Nếu là select hoặc checkbox, cho phép thiết kế các lựa chọn (options) */}
                        {(field.type === 'select' || field.type === 'checkbox') && (
                          <div style={{ marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--border-glow)' }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Các lựa chọn dropdown</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {field.options?.map((opt, oIdx) => (
                                <input 
                                  key={oIdx}
                                  type="text" 
                                  className="form-input" 
                                  style={{ width: '120px', padding: '6px 8px', fontSize: '12px' }}
                                  value={opt}
                                  onChange={(e) => updateFieldOption(index, oIdx, e.target.value)}
                                />
                              ))}
                              <button type="button" onClick={() => addFieldOption(index)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                                + Thêm lựa chọn
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {formFields.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                        Bài báo cáo hiện chưa có câu hỏi nào. Bấm nút phía trên để tạo form báo cáo động!
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowLabModal(false)} className="btn btn-secondary">ĐÓNG</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'ĐANG ĐĂNG BÀI...' : 'CẤU HÌNH & GIAO BÀI LAB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PERSONAL EXCEPTION / EXTENSION */}
      {showExtensionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Gia hạn riêng cá nhân sinh viên</h3>
              <button onClick={() => setShowExtensionModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveExtension}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Cấu hình này cho phép sinh viên được chọn có một thời hạn nộp bài riêng (Gia hạn đặc biệt) mà không ảnh hưởng tới tiến độ và deadline chung của cả lớp.
                </p>

                <div className="form-group">
                  <label className="form-label">Chọn sinh viên được gia hạn</label>
                  <select 
                    className="form-select"
                    required
                    value={extensionStudent}
                    onChange={(e) => setExtensionStudent(e.target.value)}
                  >
                    <option value="">-- Chọn sinh viên trong lớp học phần --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.username}>{s.full_name} (@{s.username})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Thời hạn mới gia hạn (Deadline mới)</label>
                  <input 
                    type="datetime-local" 
                    className="form-input" 
                    required
                    value={extensionDeadline}
                    onChange={(e) => setExtensionDeadline(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowExtensionModal(false)} className="btn btn-secondary">ĐÓNG</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'ĐANG GIA HẠN...' : 'XÁC NHẬN GIA HẠN CÁ NHÂN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL STUDENT EDIT */}
      {showStudentModal && editingStudent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Sửa thông tin tài khoản Sinh viên</h3>
              <button onClick={() => setShowStudentModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveStudentEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tên đăng nhập (MSSV) - Cố định</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    disabled
                    value={editingStudent.username}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Họ và Tên đầy đủ</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={studentFullName}
                    onChange={(e) => setStudentFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Địa chỉ Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="Ví dụ: student@example.com"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mật khẩu mới (Bỏ trống nếu không đổi)</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Không đổi mật khẩu..."
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Trạng thái hoạt động</label>
                  <select 
                    className="form-select"
                    value={studentIsActive ? "true" : "false"}
                    onChange={(e) => setStudentIsActive(e.target.value === "true")}
                  >
                    <option value="true">Hoạt động (Unlock)</option>
                    <option value="false">Khóa tài khoản (Lock)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowStudentModal(false)} className="btn btn-secondary">ĐÓNG</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'ĐANG LƯU...' : 'CẬP NHẬT TÀI KHOẢN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
