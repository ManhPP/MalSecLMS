import React, { useState, useEffect, useRef } from 'react'
import { 
  BookOpen, Plus, Calendar, FileSpreadsheet, Download, 
  CheckSquare, Award, ArrowRight, ShieldCheck, ShieldAlert,
  ArrowLeft, Clock, Code, FileText, Image as ImageIcon, CheckCircle, RefreshCw,
  School, Users, Edit2, Trash2, Search, Lock, Unlock, Filter, Monitor, Play,
  Copy, Layers, ChevronDown, ChevronRight, Eye, ExternalLink, X, FileCheck, Maximize2,
  ChevronLeft, UserCheck, BarChart3, TrendingUp, Activity, CheckCircle2, AlertCircle
} from 'lucide-react'
import { renderAsync } from 'docx-preview'


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
  if (!text) return <span style={{ color: 'var(--text-muted)' }}>(Empty)</span>;
  
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
  const [editingLab, setEditingLab] = useState(null)
  const [labTitle, setLabTitle] = useState('')

  const [labDesc, setLabDesc] = useState('')
  const [classId, setClassId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [allowLate, setAllowLate] = useState(true)
  const [penaltyPerHour, setPenaltyPerHour] = useState(0.5)
  const [maxPenalty, setMaxPenalty] = useState(30.0)
  const [formFields, setFormFields] = useState([]) // Dynamic questions builder
  const [enableVm, setEnableVm] = useState(true)
  const [runtimeConfig, setRuntimeConfig] = useState(null)
  const [templateVmid, setTemplateVmid] = useState('')
  const [isLinkedClone, setIsLinkedClone] = useState(true)
  const [vmProtocol, setVmProtocol] = useState('')
  const [vmPort, setVmPort] = useState('')
  const [vmUsername, setVmUsername] = useState('')
  const [vmPassword, setVmPassword] = useState('')
  const [pveTemplates, setPveTemplates] = useState([])


  // VM Manager Modal State
  const [showVmManagerModal, setShowVmManagerModal] = useState(false)
  const [selectedLabForVm, setSelectedLabForVm] = useState(null)
  const [studentVms, setStudentVms] = useState([])
  const [vmActionLoading, setVmActionLoading] = useState(false)



  const fetchPveTemplates = async () => {
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch('/api/labs/templates/proxmox', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const templates = Array.isArray(data) ? data : []
        setPveTemplates(templates)
      }
    } catch (err) {
      console.error("Failed to fetch PVE templates:", err)
    }
  }

  const fetchRuntimeConfig = async () => {
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch('/api/config/client', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      setRuntimeConfig(data)
      setTemplateVmid(current => current || data.vm?.default_template_vmid || '')
      setVmProtocol(current => current || data.vm?.default_protocol || '')
      setVmPort(current => current || data.vm?.protocol_ports?.[data.vm?.default_protocol] || '')
    } catch (err) {
      console.error('Failed to fetch runtime config:', err)
    }
  }


  // Individual Extension State
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [extensionStudent, setExtensionStudent] = useState('')
  const [extensionDeadline, setExtensionDeadline] = useState('')

  // Clone Lab State
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneSourceLab, setCloneSourceLab] = useState(null)
  const [cloneTargetClassId, setCloneTargetClassId] = useState('')
  const [cloneNewTitle, setCloneNewTitle] = useState('')
  const [cloneNewDeadline, setCloneNewDeadline] = useState('')

  // Document Preview Modal State (PDF / DOCX)
  const [previewDoc, setPreviewDoc] = useState(null) // { filename: string, url: string, type: 'pdf' | 'docx' | 'image' | 'other' }
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const docxContainerRef = useRef(null)

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
  const [labGroupByClass, setLabGroupByClass] = useState(true) // Gom nhóm theo lớp mặc định
  const [collapsedClassGroups, setCollapsedClassGroups] = useState({}) // { [classId]: boolean }

  // Class Analytics state
  const [analyticsClassId, setAnalyticsClassId] = useState('')
  const [analyticsLabFilter, setAnalyticsLabFilter] = useState('')
  const [analyticsData, setAnalyticsData] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [studentAnalyticsSearch, setStudentAnalyticsSearch] = useState('')

  // Gradebook Matrix state
  const [gradebookClassId, setGradebookClassId] = useState('')
  const [gradebookData, setGradebookData] = useState(null)
  const [gradebookLoading, setGradebookLoading] = useState(false)
  const [selectedStudentFilter, setSelectedStudentFilter] = useState([]) // Array of student usernames, empty = all
  const [selectedLabFilter, setSelectedLabFilter] = useState([]) // Array of lab IDs (numbers), empty = all
  const [gradebookStudentSearch, setGradebookStudentSearch] = useState('')

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Fetch Class Analytics (supports optional labId filter)
  const fetchClassAnalytics = async (classId, labId = '') => {
    if (!classId) return
    setAnalyticsLoading(true)
    setError('')
    const token = localStorage.getItem('malsec_token')
    try {
      const url = labId 
        ? `/api/classes/${classId}/analytics?lab_id=${labId}`
        : `/api/classes/${classId}/analytics`
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Unable to load class analytics')
      }
      const data = await res.json()
      setAnalyticsData(data)
    } catch (err) {
      console.error('Error fetching class analytics:', err)
      setError(err.message)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // Fetch Class Gradebook Matrix
  const fetchClassGradebook = async (classId) => {
    if (!classId) return
    setGradebookLoading(true)
    setError('')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/classes/${classId}/gradebook`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Unable to load gradebook')
      }
      const data = await res.json()
      setGradebookData(data)
    } catch (err) {
      console.error('Error fetching gradebook:', err)
      setError(err.message)
    } finally {
      setGradebookLoading(false)
    }
  }

  // Export Gradebook to CSV
  const exportGradebookToCSV = (filteredRows, visibleLabs) => {
    if (!filteredRows || filteredRows.length === 0 || !visibleLabs || visibleLabs.length === 0) {
      alert('No data available to export.')
      return
    }

    // Build CSV Headers
    const headers = [
      'STT',
      'MSSV',
      'Ho va Ten',
      'Email',
      'So lab da nop',
      ...visibleLabs.map(l => `"${l.title.replace(/"/g, '""')}"`),
      'Diem trung binh'
    ]

    // Build CSV Rows
    const csvLines = [headers.join(',')]

    filteredRows.forEach((row, idx) => {
      const line = [
        idx + 1,
        `"${row.username}"`,
        `"${row.full_name.replace(/"/g, '""')}"`,
        `"${row.email || ''}"`,
        row.completed_labs,
        ...visibleLabs.map(l => {
          const g = row.grades[String(l.id)]
          if (!g || g.final_score === null) return '""'
          return g.final_score
        }),
        row.average_score !== null ? row.average_score : '""'
      ]
      csvLines.push(line.join(','))
    })

    // Create BOM and Blob for UTF-8 CSV
    const csvContent = '\uFEFF' + csvLines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const classNameClean = (gradebookData?.class_name || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_')
    link.setAttribute('href', url)
    link.setAttribute('download', `Gradebook_${classNameClean}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

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
      if (cRes.ok) {
        const clsData = await cRes.json()
        setClasses(clsData)
        if (clsData.length > 0 && !analyticsClassId) {
          setAnalyticsClassId(clsData[0].id)
          fetchClassAnalytics(clsData[0].id)
        }
      }

      // 3. Fetch All Students (for class management search/assign)
      const sRes = await fetch('/api/users/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (sRes.ok) setAllStudents(await sRes.json())

    } catch (err) {
      setError('Server connection error while fetching lab list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchRuntimeConfig()
    fetchPveTemplates()
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
      if (!res.ok) throw new Error('Unable to load student submissions')
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

  // Document Preview Handler (PDF / DOCX)
  const handleOpenDocPreview = async (attachment) => {
    if (!attachment || !attachment.filepath) return
    const token = localStorage.getItem('malsec_token')
    const fileUrl = `/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${token}`
    const filename = attachment.original_filename || 'document'
    const ext = filename.split('.').pop().toLowerCase()

    setPreviewError('')
    setPreviewDoc({
      filename,
      filepath: attachment.filepath,
      url: fileUrl,
      type: ext === 'docx' ? 'docx' : ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : 'other'
    })

    // If DOCX, fetch arrayBuffer and render via docx-preview
    if (ext === 'docx') {
      setPreviewLoading(true)
      try {
        const res = await fetch(fileUrl)
        if (!res.ok) throw new Error('Unable to download Word document from server')
        const arrayBuffer = await res.arrayBuffer()
        
        // Wait small tick for modal DOM node to mount
        setTimeout(async () => {
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = ''
            await renderAsync(arrayBuffer, docxContainerRef.current, null, {
              className: 'docx-preview-content',
              inWrapper: false,
              ignoreWidth: false,
              ignoreHeight: false,
              breakPages: true
            })
            // Xóa triệt để mọi inline style background gray hoặc thẻ STYLE nội bộ nếu có
            const grayEls = docxContainerRef.current.querySelectorAll('*')
            grayEls.forEach(el => {
              if (el.style && (el.style.background === 'gray' || el.style.backgroundColor === 'gray')) {
                el.style.background = '#ffffff'
              }
            })
          }
          setPreviewLoading(false)
        }, 150)
      } catch (err) {
        console.error('Error rendering DOCX:', err)
        setPreviewError('Error displaying DOCX document: ' + err.message)
        setPreviewLoading(false)
      }
    }
  }

  const handleCloseDocPreview = () => {
    setPreviewDoc(null)
    setPreviewLoading(false)
    setPreviewError('')
    if (docxContainerRef.current) {
      docxContainerRef.current.innerHTML = ''
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
      if (!res.ok) throw new Error(data.detail || 'Error grading report')

      setSuccess(`Graded successfully for student ${data.student?.full_name}!`)
      
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
      if (!res.ok) throw new Error(data.detail || 'Error saving individual extension')

      setSuccess(`Individual lab extension granted for ${extensionStudent} successfully!`)
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
      label: type === 'text' ? 'MD5/SHA256 Hash' : type === 'textarea' ? 'Mechanism Analysis / Assembly' : type === 'select' ? 'Malware Classification (Single Choice)' : type === 'checkbox' ? 'Malicious Behaviors (Multiple Choice)' : 'Wireshark Screenshot',
      required: true,
      options: type === 'select' || type === 'checkbox' ? ['Ransomware (Encryption)', 'Trojan/Spyware (Information Stealer)', 'Worm (Network Propagation)', 'Rootkit (Stealth Persistence)'] : []
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
    updated[fieldIndex].options.push('New option')
    setFormFields(updated)
  }

  const handleSaveLab = async (e) => {
    e.preventDefault()
    if (formFields.length === 0) {
      setError('Please create at least one question field for the lab report!')
      return
    }
    if (enableVm && !editingLab && !vmPassword) {
      setError('Please enter a password for the VM connection!')
      return
    }
    if (enableVm && (!templateVmid || !vmProtocol || !vmPort)) {
      setError('VM template, protocol, or port configuration is incomplete!')
      return
    }
    if (enableVm && ['rdp', 'ssh'].includes(vmProtocol) && !vmUsername.trim()) {
      setError('Please enter a username for RDP/SSH connection!')
      return
    }
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const payload = {
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
        enable_vm: enableVm
      }
      if (enableVm) {
        payload.template_vmid = parseInt(templateVmid)
        payload.is_linked_clone = isLinkedClone
        payload.vm_protocol = vmProtocol
        payload.vm_port = parseInt(vmPort)
        payload.vm_username = vmUsername.trim()
        if (vmPassword) payload.vm_password = vmPassword
      }

      const url = editingLab ? `/api/labs/${editingLab.id}` : '/api/labs/'
      const method = editingLab ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error saving lab')

      setSuccess(editingLab ? 'Lab configuration updated successfully!' : 'Published lab assignment with dynamic report form successfully!')
      setShowLabModal(false)
      setEditingLab(null)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const openCreateLabModal = () => {
    setEditingLab(null)
    setLabTitle('')
    setLabDesc('')
    setClassId(classes[0]?.id || '')
    setDeadline('')
    setAllowLate(true)
    setPenaltyPerHour(0.5)
    setMaxPenalty(30.0)
    setEnableVm(true)
    setIsLinkedClone(true)
    const defaultProtocol = runtimeConfig?.vm?.default_protocol || ''
    setTemplateVmid(runtimeConfig?.vm?.default_template_vmid || pveTemplates[0]?.vmid || '')
    setVmProtocol(defaultProtocol)
    setVmPort(runtimeConfig?.vm?.protocol_ports?.[defaultProtocol] || '')
    setVmUsername('')
    setVmPassword('')
    fetchPveTemplates()
    setFormFields([
      { id: 'q_md5', type: 'text', label: 'Malware MD5/SHA256 Hash', required: true },
      { id: 'q_asm', type: 'textarea', label: 'Mechanism Analysis & Assembly Code Excerpt', required: true },
      { id: 'q_shot', type: 'file', label: 'Wireshark/Debugger Analysis Screenshot', required: true }
    ])
    setShowLabModal(true)
  }

  const openEditLabModal = (lab) => {
    setEditingLab(lab)
    setLabTitle(lab.title || '')
    setLabDesc(lab.description || '')
    setClassId(lab.class_id || (classes[0]?.id || ''))
    
    if (lab.deadline) {
      const d = new Date(lab.deadline)
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setDeadline(localIso)
    } else {
      setDeadline('')
    }

    setAllowLate(lab.late_policy?.allow_late ?? true)
    setPenaltyPerHour(lab.late_policy?.penalty_per_hour_percent ?? 0.5)
    setMaxPenalty(lab.late_policy?.max_penalty_percent ?? 30.0)
    setFormFields(lab.form_fields || [])
    setEnableVm(lab.enable_vm !== false)
    setIsLinkedClone(lab.is_linked_clone !== false)
    const configuredProtocol = lab.vm_protocol || runtimeConfig?.vm?.default_protocol || ''
    setTemplateVmid(lab.template_vmid || runtimeConfig?.vm?.default_template_vmid || '')
    setVmProtocol(configuredProtocol)
    setVmPort(lab.vm_port || runtimeConfig?.vm?.protocol_ports?.[configuredProtocol] || '')
    setVmUsername(lab.vm_username || '')
    setVmPassword('')

    fetchPveTemplates()
    setShowLabModal(true)
  }

  const handleDeleteLab = async (labId, labTitle) => {
    if (!window.confirm(`Are you sure you want to delete lab "${labTitle}"?\nAll student submissions for this lab will also be removed.`)) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/labs/${labId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error deleting lab')

      setSuccess(`Lab "${labTitle}" deleted successfully!`)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Clone Lab Handlers
  const openCloneModal = (lab) => {
    setCloneSourceLab(lab)
    // Find classes other than current lab's class
    const otherClasses = classes.filter(c => c.id !== lab.class_id)
    setCloneTargetClassId(otherClasses[0]?.id || classes[0]?.id || '')
    setCloneNewTitle(`${lab.title} (Copy)`)
    
    if (lab.deadline) {
      const d = new Date(lab.deadline)
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setCloneNewDeadline(localIso)
    } else {
      setCloneNewDeadline('')
    }
    setShowCloneModal(true)
  }

  const handleCloneLabSubmit = async (e) => {
    e.preventDefault()
    if (!cloneSourceLab) return
    if (!cloneTargetClassId) {
      setError('Please select a target class')
      return
    }

    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const payload = {
        target_class_id: parseInt(cloneTargetClassId),
        new_title: cloneNewTitle.trim(),
        new_deadline: cloneNewDeadline ? new Date(cloneNewDeadline).toISOString() : null
      }

      const res = await fetch(`/api/labs/${cloneSourceLab.id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error cloning lab assignment')

      setSuccess(`Lab "${data.title}" successfully cloned to target class!`)
      setShowCloneModal(false)
      setCloneSourceLab(null)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // VM Manager Handlers
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
      setError('Error querying student virtual machines')
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
    const actionText = action === 'purge' ? 'permanently purge' : action === 'start' ? 'start' : 'stop'
    if (action === 'purge' && !confirm(`Are you sure you want to permanently purge VM ${vmid} for student ${studentName}?\nThis VM will be 100% purged from the Proxmox cluster so the student can re-clone a clean VM.`)) return

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
      if (!res.ok) throw new Error(data.detail || 'VM operation error')
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
      ? `⚠️ CRITICAL WARNING: Are you SURE you want to PERMANENTLY PURGE 100% of student VMs for this lab?\nAll student VMs on the Proxmox cluster will be completely destroyed!`
      : `Are you sure you want to STOP ALL running student VMs for this lab?`

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
      if (!res.ok) throw new Error(data.detail || 'Batch control error')
      setSuccess(data.message)
      fetchLabVms(labId)
    } catch (err) {
      setError(err.message)
      setVmActionLoading(false)
    }
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
      setError('Error loading class details')
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
      if (!res.ok) throw new Error(data.detail || 'Error adding students to class')

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
      if (!res.ok) throw new Error(data.detail || 'Error adding student to class')

      setSuccess('Student added to class successfully!')
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
    if (!confirm('Are you sure you want to remove this student from the class?')) return
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
        throw new Error(data.detail || 'Error removing student from class')
      }
      setSuccess('Student removed from class')
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
      if (!res.ok) throw new Error(data.detail || 'Error updating student account')

      setSuccess('Student account updated successfully!')
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

  // Group filtered labs by class
  const groupedLabs = React.useMemo(() => {
    const groups = {}
    filteredLabs.forEach(lab => {
      const cid = lab.class_id || 0
      if (!groups[cid]) {
        const cls = classes.find(c => c.id === cid)
        groups[cid] = {
          classId: cid,
          className: cls ? cls.name : `Class ID ${cid}`,
          classDesc: cls?.description || '',
          labs: []
        }
      }
      groups[cid].labs.push(lab)
    })
    return Object.values(groups)
  }, [filteredLabs, classes])

  const toggleClassGroup = (classId) => {
    setCollapsedClassGroups(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }))
  }

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
            Lab Management
          </button>
          <button 
            onClick={() => setViewState('classes')} 
            className={`btn ${viewState === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <School size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            Classes & Students
          </button>
          <button 
            onClick={() => {
              setViewState('analytics')
              if (analyticsClassId) fetchClassAnalytics(analyticsClassId, analyticsLabFilter)
              else if (classes.length > 0) {
                setAnalyticsClassId(classes[0].id)
                fetchClassAnalytics(classes[0].id, '')
              }
            }} 
            className={`btn ${viewState === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <BarChart3 size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            Class Analytics & Insights
          </button>
          
          <button 
            onClick={() => {
              setViewState('gradebook')
              const targetClassId = gradebookClassId || (classes.length > 0 ? classes[0].id : '')
              if (targetClassId) {
                if (!gradebookClassId) setGradebookClassId(targetClassId)
                fetchClassGradebook(targetClassId)
              }
            }} 
            className={`btn ${viewState === 'gradebook' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <FileSpreadsheet size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            Gradebook & Export
          </button>
          
          <button 
            onClick={fetchData} 
            className="btn btn-secondary" 
            style={{ marginLeft: 'auto', padding: '8px 12px' }}
            title="Refresh data"
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
              <h2 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>Welcome, Instructor!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Design dynamic lab assignments, grade submissions via Speed Grader, and monitor student progress.</p>
            </div>
            <button onClick={openCreateLabModal} className="btn btn-primary">
              <Plus size={16} /> Design New Dynamic Lab
            </button>
          </div>

          {/* Labs list */}
          <div className="cyber-card">
            <h3 style={{ fontSize: '18px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Instructed Labs
            </h3>

            {/* Search & Filters */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ paddingLeft: '36px', margin: 0 }}
                  placeholder="Search by title or description..."
                  value={labSearchQuery}
                  onChange={(e) => setLabSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Class Filter */}
                <select 
                  className="form-select" 
                  style={{ width: '180px', margin: 0 }}
                  value={labClassFilter}
                  onChange={(e) => setLabClassFilter(e.target.value)}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select 
                  className="form-select" 
                  style={{ width: '160px', margin: 0 }}
                  value={labStatusFilter}
                  onChange={(e) => setLabStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                {/* Sort Order */}
                <select 
                  className="form-select" 
                  style={{ width: '180px', margin: 0 }}
                  value={labSortOrder}
                  onChange={(e) => setLabSortOrder(e.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="deadline_asc">Deadline (Earliest first)</option>
                  <option value="deadline_desc">Deadline (Latest first)</option>
                  <option value="title_asc">Title (A-Z)</option>
                </select>

                {/* Group By Class Toggle */}
                <button
                  type="button"
                  onClick={() => setLabGroupByClass(!labGroupByClass)}
                  className={`btn ${labGroupByClass ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Toggle grouping labs by class"
                >
                  <Layers size={14} />
                  {labGroupByClass ? 'Group: By Class' : 'Group: Off'}
                </button>
              </div>
            </div>
            
            {/* RENDER LABS: GROUPED BY CLASS OR FLAT LIST */}
            {labGroupByClass ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {groupedLabs.map(group => {
                  const isCollapsed = !!collapsedClassGroups[group.classId]
                  return (
                    <div 
                      key={group.classId} 
                      style={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '10px', 
                        overflow: 'hidden', 
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                      }}
                    >
                      {/* Group Header */}
                      <div 
                        onClick={() => toggleClassGroup(group.classId)}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '14px 18px', 
                          background: '#f8fafc', 
                          cursor: 'pointer',
                          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isCollapsed ? <ChevronRight size={18} style={{ color: 'var(--neon-cyan)' }} /> : <ChevronDown size={18} style={{ color: 'var(--neon-cyan)' }} />}
                          <School size={18} style={{ color: 'var(--neon-cyan)' }} />
                          <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {group.className}
                          </span>
                          {group.classDesc && (
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              — {group.classDesc}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-submitted" style={{ fontSize: '12px', fontWeight: '600' }}>
                            {group.labs.length} {group.labs.length === 1 ? 'lab' : 'labs'}
                          </span>
                        </div>
                      </div>

                      {/* Group Labs Table */}
                      {!isCollapsed && (
                        <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                          <table className="cyber-table">
                            <thead>
                              <tr>
                                <th>Lab Assignment</th>
                                <th>Deadline</th>
                                <th>Late Penalty Policy</th>
                                <th>VM Provision</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions & Grading</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.labs.map(lab => (
                                <tr key={lab.id}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span className="badge" style={{ background: '#e2e8f0', color: '#334155', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px' }}>
                                        ID #{lab.id}
                                      </span>
                                      <span style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>{lab.title}</span>
                                    </div>
                                  </td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                                    {new Date(lab.deadline).toLocaleString('en-US')}
                                  </td>
                                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {lab.late_policy?.allow_late 
                                      ? `Penalty ${lab.late_policy.penalty_per_hour_percent}% / hr (Max ${lab.late_policy.max_penalty_percent}%)` 
                                      : 'No late submissions allowed'}
                                  </td>
                                  <td>
                                    {lab.enable_vm !== false ? (
                                      <span style={{ fontSize: '13px', fontWeight: '600', color: lab.is_linked_clone ? '#0284c7' : '#d97706', fontFamily: 'var(--font-mono)' }}>
                                        {lab.is_linked_clone ? '⚡ Linked' : '📦 Full'}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No VM</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge ${lab.is_active ? 'badge-graded' : 'badge-draft'}`}>
                                      {lab.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                      {lab.enable_vm !== false && (
                                        <button 
                                          onClick={() => openVmManagerModal(lab)} 
                                          className="btn btn-secondary" 
                                          style={{ padding: '5px 10px', fontSize: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}
                                          title="Manage & Purge Student VMs"
                                        >
                                          <Monitor size={13} style={{ marginRight: '4px' }} /> VMs
                                        </button>
                                      )}
                                      <button 
                                        onClick={() => openCloneModal(lab)} 
                                        className="btn btn-secondary" 
                                        style={{ padding: '5px 10px', fontSize: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}
                                        title="Clone lab assignment to another class"
                                      >
                                        <Copy size={13} style={{ marginRight: '4px' }} /> Clone
                                      </button>
                                      <button 
                                        onClick={() => openEditLabModal(lab)} 
                                        className="btn btn-secondary" 
                                        style={{ padding: '5px 10px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                                        title="Edit Lab"
                                      >
                                        <Edit2 size={13} style={{ marginRight: '4px', color: '#475569' }} /> Edit
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteLab(lab.id, lab.title)} 
                                        className="btn btn-danger" 
                                        style={{ padding: '5px 10px', fontSize: '12px' }}
                                        title="Delete Lab"
                                      >
                                        <Trash2 size={13} style={{ marginRight: '4px' }} /> Delete
                                      </button>
                                      <button onClick={() => fetchSubmissions(lab)} className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }}>
                                        Grade &rarr;
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

                {groupedLabs.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                    No labs designed yet or no labs match current filter. Click the button above to create one.
                  </div>
                )}
              </div>
            ) : (
              <div className="table-container" style={{ margin: 0 }}>
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Lab Assignment</th>
                      <th>Class</th>
                      <th>Deadline</th>
                      <th>Late Penalty Policy</th>
                      <th>VM Provision</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions & Grading</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLabs.map(lab => {
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
                          <td style={{ color: 'var(--text-primary)' }}>{cls ? cls.name : `Class ID ${lab.class_id}`}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                            {new Date(lab.deadline).toLocaleString('en-US')}
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {lab.late_policy?.allow_late 
                              ? `Penalty ${lab.late_policy.penalty_per_hour_percent}% / hr (Max ${lab.late_policy.max_penalty_percent}%)` 
                              : 'No late submissions allowed'}
                          </td>
                          <td>
                            {lab.enable_vm !== false ? (
                              <span style={{ fontSize: '13px', fontWeight: '600', color: lab.is_linked_clone ? '#0284c7' : '#d97706', fontFamily: 'var(--font-mono)' }}>
                                {lab.is_linked_clone ? '⚡ Linked' : '📦 Full'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No VM</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${lab.is_active ? 'badge-graded' : 'badge-draft'}`}>
                              {lab.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {lab.enable_vm !== false && (
                                <button 
                                  onClick={() => openVmManagerModal(lab)} 
                                  className="btn btn-secondary" 
                                  style={{ padding: '5px 10px', fontSize: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}
                                  title="Manage & Purge Student VMs"
                                >
                                  <Monitor size={13} style={{ marginRight: '4px' }} /> VMs
                                </button>
                              )}
                                <button 
                                  onClick={() => openCloneModal(lab)} 
                                  className="btn btn-secondary" 
                                  style={{ padding: '5px 10px', fontSize: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}
                                  title="Clone lab assignment to another class"
                                >
                                <Copy size={13} style={{ marginRight: '4px' }} /> Clone
                              </button>
                              <button 
                                onClick={() => openEditLabModal(lab)} 
                                className="btn btn-secondary" 
                                style={{ padding: '5px 10px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                                title="Edit Lab"
                              >
                                <Edit2 size={13} style={{ marginRight: '4px', color: '#475569' }} /> Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteLab(lab.id, lab.title)} 
                                className="btn btn-danger" 
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                                title="Delete Lab"
                              >
                                <Trash2 size={13} style={{ marginRight: '4px' }} /> Delete
                              </button>
                              <button onClick={() => fetchSubmissions(lab)} className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }}>
                                Grade &rarr;
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {labs.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No labs designed yet. Click the button above to create one.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
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
              Assigned Classes
            </h3>
            
            <div className="table-container" style={{ margin: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Class Name</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Students</th>
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
                        <span className="badge badge-submitted">View &rarr;</span>
                      </td>
                    </tr>
                  ))}
                  {classes.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You are not assigned to manage any classes yet.</td>
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
                    Class: {selectedClass.name}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                    {selectedClass.description}
                  </p>
                </div>

                {/* Grid for student assignment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  
                  {/* Option 1: Search & Assign Student */}
                  <div style={{ padding: '18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '300px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                      <Search size={15} />
                      Find & Add Student to Class
                    </h4>
                    
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ paddingLeft: '34px', margin: 0, fontSize: '13px', background: '#ffffff' }}
                        placeholder="Type name or Student ID to search..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    {/* Search Results list */}
                    <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '8px' }}>
                      {(() => {
                        const existingStudentIds = new Set((selectedClass.users || []).map(u => u.id))
                        const filteredDbStudents = allStudents.filter(s => {
                          const matchesQuery = s.full_name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
                                               s.username.toLowerCase().includes(studentSearchQuery.toLowerCase())
                          const notInClass = !existingStudentIds.has(s.id)
                          return matchesQuery && notInClass
                        })

                        if (studentSearchQuery.length < 1) {
                          return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12.5px', padding: '24px 10px' }}>Type to search for students...</div>
                        }

                        if (filteredDbStudents.length === 0) {
                          return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12.5px', padding: '24px 10px' }}>No students found or all matched students are already enrolled.</div>
                        }

                        return filteredDbStudents.map(student => (
                          <div 
                            key={student.id} 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
                          >
                            <div>
                              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{student.full_name}</span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>({student.username})</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleAssignSingleStudent(student.id)} 
                              className="btn btn-primary" 
                              style={{ padding: '3px 10px', fontSize: '11.5px' }}
                            >
                              Add
                            </button>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>

                  {/* Option 2: Bulk Assign by ID */}
                  <form onSubmit={handleAssignStudentsBulk} style={{ padding: '18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '300px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                      <Users size={15} />
                      Bulk Assign by Student IDs
                    </h4>
                    <div className="form-group" style={{ flex: 1, marginBottom: '12px' }}>
                      <label className="form-label" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Enter Student IDs (comma or whitespace separated)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ fontSize: '13px', background: '#ffffff' }}
                        placeholder="e.g. 3, 14, 25"
                        value={studentIdsInput}
                        onChange={(e) => setStudentIdsInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '10px 16px', fontSize: '13.5px', fontWeight: 'bold' }} disabled={actionLoading}>
                      {actionLoading ? 'Assigning...' : 'CONFIRM ASSIGN STUDENTS'}
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
                        Enrolled Students ({classStudents.length} students)
                      </h4>
                      <div className="table-container" style={{ margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
                        <table className="cyber-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Student ID</th>
                              <th>Full Name</th>
                              <th>Email</th>
                              <th>Status</th>
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
                                  <td>
                                    <span style={{ 
                                      color: student.is_active ? 'var(--neon-emerald)' : 'var(--neon-ruby)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '13px'
                                    }}>
                                      {student.is_active ? <Unlock size={14} /> : <Lock size={14} />}
                                      {student.is_active ? 'Active' : 'Locked'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button 
                                      onClick={() => handleOpenStudentModal(student)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '12px', marginRight: '6px' }}
                                      title="Edit details"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button 
                                      onClick={() => handleRemoveStudentFromClass(student.id)} 
                                      className="btn btn-danger" 
                                      style={{ padding: '4px 8px', fontSize: '12px' }}
                                      title="Remove from class"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>This class has no students enrolled yet.</td>
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
                <span>Select a class from the left table to view and manage its students.</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* VIEW 4: CLASS ANALYTICS & INSIGHTS DASHBOARD */}
      {viewState === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Control Bar: Class Selector & Quick Refresh */}
          <div className="cyber-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(242, 112, 36, 0.1)', padding: '8px', borderRadius: '8px', color: 'var(--neon-cyan)' }}>
                <BarChart3 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--text-primary)', fontWeight: '600' }}>Class Analytics & Academic Insights</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>Monitor student submission rates, live VM workloads, and grade distributions.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Class:</label>
                <select
                  className="form-select"
                  style={{ width: '200px', margin: 0, background: '#ffffff', fontWeight: '500' }}
                  value={analyticsClassId}
                  onChange={(e) => {
                    const cId = parseInt(e.target.value)
                    setAnalyticsClassId(cId)
                    setAnalyticsLabFilter('') // reset lab filter when switching class
                    fetchClassAnalytics(cId, '')
                  }}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Lab Filter:</label>
                <select
                  className="form-select"
                  style={{ width: '230px', margin: 0, background: '#ffffff', fontWeight: '500' }}
                  value={analyticsLabFilter}
                  onChange={(e) => {
                    const lId = e.target.value
                    setAnalyticsLabFilter(lId)
                    fetchClassAnalytics(analyticsClassId, lId)
                  }}
                >
                  <option value="">All Labs in Class</option>
                  {labs
                    .filter(l => l.class_id === analyticsClassId)
                    .map(l => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                </select>
              </div>

              <button
                onClick={() => fetchClassAnalytics(analyticsClassId, analyticsLabFilter)}
                className="btn btn-secondary"
                disabled={analyticsLoading}
                style={{ padding: '8px 12px' }}
                title="Refresh Analytics"
              >
                <RefreshCw size={15} className={analyticsLoading ? 'spin-slow' : ''} />
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={32} className="spin-slow" style={{ color: 'var(--neon-cyan)', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px' }}>Aggregating class metrics, submissions, and Proxmox VM resources...</p>
            </div>
          ) : !analyticsData ? (
            <div className="cyber-card" style={{ textAlign: 'center', padding: '50px' }}>
              <School size={48} style={{ opacity: 0.25, color: 'var(--neon-cyan)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)' }}>No analytics data available for this class.</p>
            </div>
          ) : (
            <>
              {/* Row 1: KPI Summary Metric Cards */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                
                {/* Total Students */}
                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
                    <Users size={22} />
                  </div>
                  <div>
                    <div className="stat-number" style={{ color: '#1e293b' }}>{analyticsData.summary.total_students}</div>
                    <div className="stat-label">Enrolled Students</div>
                  </div>
                </div>

                {/* Total Labs / Filtered Lab */}
                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: 'rgba(242, 112, 36, 0.08)', color: 'var(--neon-cyan)' }}>
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <div className="stat-number" style={{ color: '#1e293b' }}>
                      {analyticsData.selected_lab ? '1' : analyticsData.summary.total_labs}
                    </div>
                    <div className="stat-label">
                      {analyticsData.selected_lab ? `Selected: ${analyticsData.selected_lab.title}` : 'Assigned Labs in Class'}
                    </div>
                  </div>
                </div>

                {/* Active Running VMs */}
                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#059669' }}>
                    <Monitor size={22} />
                  </div>
                  <div>
                    <div className="stat-number" style={{ color: '#059669' }}>
                      {analyticsData.summary.running_vms_count}
                    </div>
                    <div className="stat-label">
                      Active Running VMs ({analyticsData.summary.total_cloned_vms} allocated)
                    </div>
                  </div>
                </div>

                {/* Overall Submission Rate */}
                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: 'rgba(147, 51, 234, 0.08)', color: '#9333ea' }}>
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <div className="stat-number" style={{ color: '#1e293b' }}>
                      {analyticsData.summary.overall_submission_rate}%
                    </div>
                    <div className="stat-label">
                      Submission Rate ({analyticsData.summary.total_submitted}/{analyticsData.summary.total_possible_submissions})
                    </div>
                  </div>
                </div>

                {/* Class GPA / Average Score */}
                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: 'rgba(217, 119, 6, 0.08)', color: '#d97706' }}>
                    <Award size={22} />
                  </div>
                  <div>
                    <div className="stat-number" style={{ color: analyticsData.summary.average_score >= 8 ? '#059669' : analyticsData.summary.average_score >= 5 ? '#d97706' : '#dc2626' }}>
                      {analyticsData.summary.average_score !== null ? `${analyticsData.summary.average_score} / 10` : 'N/A'}
                    </div>
                    <div className="stat-label">
                      Average Score ({analyticsData.summary.total_graded} graded)
                    </div>
                  </div>
                </div>

                {/* On-Time Rate */}
                <div className="stat-card">
                  <div className="stat-icon-wrap" style={{ background: 'rgba(13, 148, 136, 0.08)', color: '#0d9488' }}>
                    <Clock size={22} />
                  </div>
                  <div>
                    <div className="stat-number" style={{ color: '#1e293b' }}>
                      {analyticsData.summary.ontime_rate}%
                    </div>
                    <div className="stat-label">
                      On-Time Rate ({analyticsData.summary.late_submissions_count} late)
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 2: Charts - Grade Distribution & Lab Performance */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 35%) 1fr', gap: '20px' }}>
                
                {/* Chart 1: Grade Distribution Histogram */}
                <div className="cyber-card">
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} style={{ color: 'var(--neon-cyan)' }} />
                    Grade Distribution
                  </h4>

                  {analyticsData.summary.total_graded === 0 ? (
                    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No submissions have been graded yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>
                      {[
                        { label: 'Excellent (9.0 - 10.0)', count: analyticsData.grade_distribution.excellent, color: '#10b981' },
                        { label: 'Good (8.0 - 8.9)', count: analyticsData.grade_distribution.good, color: '#2563eb' },
                        { label: 'Fair (6.5 - 7.9)', count: analyticsData.grade_distribution.fair, color: '#f59e0b' },
                        { label: 'Average (5.0 - 6.4)', count: analyticsData.grade_distribution.average, color: '#ea580c' },
                        { label: 'Poor (< 5.0)', count: analyticsData.grade_distribution.poor, color: '#dc2626' },
                      ].map((bar, idx) => {
                        const total = analyticsData.summary.total_graded || 1
                        const pct = Math.round((bar.count / total) * 100)
                        return (
                          <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{bar.label}</span>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                                {bar.count} students ({pct}%)
                              </span>
                            </div>
                            <div style={{ height: '10px', width: '100%', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  height: '100%', 
                                  width: `${pct}%`, 
                                  background: bar.color, 
                                  borderRadius: '6px',
                                  transition: 'width 0.5s ease' 
                                }} 
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Chart 2: Lab-by-Lab Performance Matrix */}
                <div className="cyber-card">
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} style={{ color: 'var(--neon-cyan)' }} />
                    Lab-by-Lab Performance
                  </h4>

                  <div className="table-container" style={{ margin: 0, maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="cyber-table" style={{ fontSize: '12.5px' }}>
                      <thead>
                        <tr>
                          <th>Lab Title</th>
                          <th>Submission Progress</th>
                          <th>On-time vs Late</th>
                          <th>Avg Score</th>
                          <th>VM Status</th>
                          <th>Similarity Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.lab_performance.map(lab => {
                          const isSelected = analyticsData.selected_lab && analyticsData.selected_lab.id === lab.lab_id
                          return (
                            <tr 
                              key={lab.lab_id}
                              style={isSelected ? { background: 'rgba(242, 112, 36, 0.08)', fontWeight: '600' } : {}}
                            >
                              <td style={{ fontWeight: '600', color: isSelected ? 'var(--neon-cyan)' : 'var(--text-primary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isSelected && <span style={{ marginRight: '6px' }}>▶</span>}
                                {lab.title}
                              </td>
                            <td style={{ minWidth: '140px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${lab.submission_rate}%`, background: 'var(--neon-cyan)', borderRadius: '4px' }} />
                                </div>
                                <span style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                  {lab.submitted_count}/{lab.total_students} ({lab.submission_rate}%)
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: '#15803d', fontWeight: '600' }}>{lab.ontime_count} on-time</span>
                              {lab.late_count > 0 && (
                                <span style={{ color: '#dc2626', fontWeight: '600', marginLeft: '6px' }}>({lab.late_count} late)</span>
                              )}
                            </td>
                            <td>
                              {lab.average_score !== null ? (
                                <span style={{ fontWeight: '700', color: lab.average_score >= 8 ? '#059669' : lab.average_score >= 5 ? '#d97706' : '#dc2626' }}>
                                  {lab.average_score} / 10
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Not graded</span>
                              )}
                            </td>
                            <td>
                              {lab.enable_vm ? (
                                <span className="badge badge-submitted" style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                                  VM Enabled
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No VM</span>
                              )}
                            </td>
                            <td>
                              {lab.plagiarism_flags > 0 ? (
                                <span className="badge badge-resubmit" style={{ fontSize: '11px' }}>
                                  {lab.plagiarism_flags} alerts
                                </span>
                              ) : (
                                <span style={{ color: '#10b981', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle2 size={12} /> Clean
                                </span>
                              )}
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Row 3: Student Progress & Completion Tracker */}
              <div className="cyber-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} style={{ color: 'var(--neon-cyan)' }} />
                      Individual Student Completion & Grade Tracker
                    </h4>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      Overview of each student's finished assignments, punctuality, and current sandbox VM status.
                    </p>
                  </div>

                  <div style={{ position: 'relative', width: '250px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '32px', margin: 0, padding: '6px 10px 6px 32px', fontSize: '12.5px' }}
                      placeholder="Filter by name or username..."
                      value={studentAnalyticsSearch}
                      onChange={(e) => setStudentAnalyticsSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="table-container" style={{ margin: 0 }}>
                  <table className="cyber-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student Name</th>
                        <th>Username (MSSV)</th>
                        <th>Completion Progress</th>
                        <th>Punctuality</th>
                        <th>Average Score</th>
                        <th>Sandbox VM Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.student_progress
                        .filter(st => {
                          if (!studentAnalyticsSearch) return true
                          const q = studentAnalyticsSearch.toLowerCase()
                          return st.full_name.toLowerCase().includes(q) || st.username.toLowerCase().includes(q)
                        })
                        .map((st, sIdx) => (
                          <tr key={st.student_id}>
                            <td style={{ color: 'var(--text-muted)' }}>{sIdx + 1}</td>
                            <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{st.full_name}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{st.username}</td>
                            <td style={{ minWidth: '160px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div 
                                    style={{ 
                                      height: '100%', 
                                      width: `${st.completion_percentage}%`, 
                                      background: st.completion_percentage === 100 ? '#10b981' : st.completion_percentage >= 50 ? '#F27024' : '#dc2626',
                                      borderRadius: '4px' 
                                    }} 
                                  />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                  {st.completed_labs}/{st.total_labs} ({st.completion_percentage}%)
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: '#15803d', fontWeight: '600' }}>{st.ontime_submissions} on-time</span>
                              {st.late_submissions > 0 && (
                                <span style={{ color: '#dc2626', fontWeight: '600', marginLeft: '6px' }}>({st.late_submissions} late)</span>
                              )}
                            </td>
                            <td>
                              {st.average_score !== null ? (
                                <span style={{ 
                                  fontWeight: '700', 
                                  fontSize: '13.5px',
                                  color: st.average_score >= 8 ? '#059669' : st.average_score >= 5 ? '#d97706' : '#dc2626' 
                                }}>
                                  {st.average_score}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td>
                              {st.vm_status === 'running' ? (
                                <span className="badge badge-submitted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                  Running (VMID {st.vm_id})
                                </span>
                              ) : st.vm_status === 'stopped' ? (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                  Stopped (VMID {st.vm_id})
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                  Offline / Not created
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {/* VIEW 5: COMPREHENSIVE CLASS GRADEBOOK MATRIX & CSV EXPORT */}
      {viewState === 'gradebook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Control Bar: Class selector, Student multiselect, Lab multiselect & CSV Export button */}
          <div className="cyber-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px', color: '#10b981' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--text-primary)', fontWeight: '600' }}>Comprehensive Gradebook & Export</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                    Cross-lab grade matrix, customized multi-student/multi-lab filtering, and Excel/CSV download.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Class:</label>
                <select
                  className="form-select"
                  style={{ width: '220px', margin: 0, background: '#ffffff', fontWeight: '500' }}
                  value={gradebookClassId}
                  onChange={(e) => {
                    const cId = parseInt(e.target.value)
                    setGradebookClassId(cId)
                    setSelectedStudentFilter([])
                    setSelectedLabFilter([])
                    fetchClassGradebook(cId)
                  }}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => fetchClassGradebook(gradebookClassId)}
                  className="btn btn-secondary"
                  disabled={gradebookLoading}
                  style={{ padding: '8px 12px' }}
                  title="Refresh Gradebook"
                >
                  <RefreshCw size={15} className={gradebookLoading ? 'spin-slow' : ''} />
                </button>
              </div>
            </div>

            {/* Filter Section: Multi-Select Students & Multi-Select Labs */}
            {gradebookData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                {/* Lab Multi-filter */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Filter size={14} style={{ color: 'var(--neon-cyan)' }} />
                      Filter Labs ({selectedLabFilter.length > 0 ? `${selectedLabFilter.length}/${gradebookData.labs.length} selected` : 'All Labs'})
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => setSelectedLabFilter([])}
                        style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', fontSize: '11.5px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Select All
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setSelectedLabFilter(gradebookData.labs.map(l => l.id))}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11.5px', cursor: 'pointer' }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '80px', overflowY: 'auto', padding: '4px 0' }}>
                    {gradebookData.labs.map(l => {
                      const isSelected = selectedLabFilter.length === 0 || selectedLabFilter.includes(l.id)
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            if (selectedLabFilter.length === 0) {
                              // If previously was "All", switch to selecting just this one
                              setSelectedLabFilter([l.id])
                            } else if (selectedLabFilter.includes(l.id)) {
                              const next = selectedLabFilter.filter(id => id !== l.id)
                              setSelectedLabFilter(next.length === 0 ? [] : next)
                            } else {
                              setSelectedLabFilter([...selectedLabFilter, l.id])
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '16px',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            border: isSelected ? '1px solid var(--neon-cyan)' : '1px solid #cbd5e1',
                            background: isSelected ? 'rgba(242, 112, 36, 0.1)' : '#f8fafc',
                            color: isSelected ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                            fontWeight: isSelected ? '600' : 'normal',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {l.title}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Student Multi-filter & Search */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} style={{ color: '#2563eb' }} />
                      Filter Students ({selectedStudentFilter.length > 0 ? `${selectedStudentFilter.length}/${gradebookData.students.length} selected` : 'All Students'})
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => setSelectedStudentFilter([])}
                        style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', fontSize: '11.5px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Select All
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '30px', margin: 0, padding: '5px 8px 5px 30px', fontSize: '12px', height: '32px' }}
                        placeholder="Filter student list by name or MSSV..."
                        value={gradebookStudentSearch}
                        onChange={(e) => setGradebookStudentSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gradebook Matrix Content */}
          {gradebookLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={32} className="spin-slow" style={{ color: 'var(--neon-cyan)', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px' }}>Compiling cross-lab submission records and final grades...</p>
            </div>
          ) : !gradebookData ? (
            <div className="cyber-card" style={{ textAlign: 'center', padding: '50px' }}>
              <School size={48} style={{ opacity: 0.25, color: 'var(--neon-cyan)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)' }}>No gradebook data available for this class.</p>
            </div>
          ) : (() => {
            // Determine visible labs
            const visibleLabs = gradebookData.labs.filter(l => 
              selectedLabFilter.length === 0 || selectedLabFilter.includes(l.id)
            )

            // Determine visible student rows
            const filteredRows = gradebookData.rows.filter(st => {
              // Student multi-select filter
              if (selectedStudentFilter.length > 0 && !selectedStudentFilter.includes(st.username)) {
                return false
              }
              // Student text search filter
              if (gradebookStudentSearch) {
                const q = gradebookStudentSearch.toLowerCase()
                return st.full_name.toLowerCase().includes(q) || st.username.toLowerCase().includes(q)
              }
              return true
            })

            return (
              <div className="cyber-card" style={{ padding: '20px' }}>
                {/* Header & Export Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Showing {filteredRows.length} students across {visibleLabs.length} labs
                    </span>
                    {(selectedLabFilter.length > 0 || selectedStudentFilter.length > 0 || gradebookStudentSearch) && (
                      <span className="badge badge-submitted" style={{ fontSize: '11px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                        Filters active
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => exportGradebookToCSV(filteredRows, visibleLabs)}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
                    title="Export currently filtered gradebook table to CSV file"
                  >
                    <Download size={15} />
                    EXPORT GRADEBOOK TO CSV (.csv)
                  </button>
                </div>

                {/* Grade Matrix Table */}
                <div className="table-container" style={{ margin: 0, overflowX: 'auto', maxHeight: '580px' }}>
                  <table className="cyber-table" style={{ fontSize: '12.5px', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th style={{ minWidth: '160px', position: 'sticky', left: 0, zIndex: 11, background: '#f8fafc', boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }}>
                          Student Name
                        </th>
                        <th style={{ minWidth: '110px' }}>MSSV</th>
                        <th style={{ textAlign: 'center', minWidth: '70px' }}>Labs Done</th>
                        
                        {/* Dynamic Lab Column Headers */}
                        {visibleLabs.map(lab => (
                          <th key={lab.id} style={{ minWidth: '110px', textAlign: 'center' }} title={lab.title}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px', margin: '0 auto' }}>
                              {lab.title}
                            </div>
                          </th>
                        ))}

                        <th style={{ minWidth: '100px', textAlign: 'center', fontWeight: '700', color: 'var(--neon-cyan)' }}>
                          GPA
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={5 + visibleLabs.length} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No student matches the specified filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, rIdx) => (
                          <tr key={row.student_id}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{rIdx + 1}</td>
                            <td style={{ fontWeight: '600', color: 'var(--text-primary)', position: 'sticky', left: 0, background: '#ffffff', boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }}>
                              {row.full_name}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{row.username}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: '600', color: row.completed_labs === visibleLabs.length ? '#10b981' : 'var(--text-secondary)' }}>
                                {row.completed_labs}/{visibleLabs.length}
                              </span>
                            </td>

                            {/* Lab Grades */}
                            {visibleLabs.map(lab => {
                              const grade = row.grades[String(lab.id)]
                              if (!grade || grade.status === 'not_submitted') {
                                return (
                                  <td key={lab.id} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                                    <span style={{ opacity: 0.5 }}>—</span>
                                  </td>
                                )
                              }
                              if (grade.status === 'submitted') {
                                return (
                                  <td key={lab.id} style={{ textAlign: 'center' }}>
                                    <span className="badge badge-submitted" style={{ fontSize: '10.5px' }}>
                                      Submitted
                                    </span>
                                  </td>
                                )
                              }
                              if (grade.status === 'graded') {
                                const sc = grade.final_score
                                return (
                                  <td key={lab.id} style={{ textAlign: 'center' }}>
                                    <span style={{ 
                                      fontWeight: '700', 
                                      fontSize: '13px',
                                      color: sc >= 8 ? '#059669' : sc >= 5 ? '#d97706' : '#dc2626' 
                                    }}>
                                      {sc}
                                    </span>
                                    {grade.late_penalty > 0 && (
                                      <span style={{ fontSize: '10px', color: '#dc2626', display: 'block' }}>
                                        (-{grade.late_penalty}%)
                                      </span>
                                    )}
                                  </td>
                                )
                              }
                              return (
                                <td key={lab.id} style={{ textAlign: 'center', fontSize: '11.5px' }}>
                                  <span className="badge badge-draft" style={{ fontSize: '10.5px' }}>
                                    {grade.status}
                                  </span>
                                </td>
                              )
                            })}

                            {/* Class GPA */}
                            <td style={{ textAlign: 'center' }}>
                              {row.average_score !== null ? (
                                <span style={{ 
                                  fontWeight: '800', 
                                  fontSize: '13.5px',
                                  color: row.average_score >= 8 ? '#059669' : row.average_score >= 5 ? '#d97706' : '#dc2626' 
                                }}>
                                  {row.average_score}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

        </div>
      )}

      {/* VIEW 2: SUBMISSIONS LIST & SPEED GRADER VIEW */}
      {viewState === 'grading' && selectedLab && (
        <div>
          {/* Back Navigation Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button onClick={() => { setViewState('dashboard'); setActiveSubmission(null); }} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
              <ArrowLeft size={16} /> Back
            </button>
            <div>
              <h2 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{selectedLab.title}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Lab Report Grading</p>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowExtensionModal(true)} className="btn btn-secondary">
                <Calendar size={15} /> Individual Extension
              </button>
              <button onClick={handleExportCSV} className="btn btn-secondary">
                <FileSpreadsheet size={15} /> Export Grades (CSV)
              </button>
              <button onClick={handleBulkDownload} className="btn btn-success">
                <Download size={15} /> Download All Submissions (.ZIP)
              </button>
            </div>
          </div>

          {/* Submissions Split view (If active submission is selected) */}
          {activeSubmission ? (
            <div className="split-container">
              {/* Left Screen (65%): Student answers dynamically rendered */}
              <div className="split-left">
                <div className="cyber-card" style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '18px', color: 'var(--neon-cyan)', margin: 0 }}>
                          Report: {activeSubmission.student?.full_name}
                        </h3>
                        <span className={`badge ${
                          activeSubmission.status === 'draft' ? 'badge-draft' :
                          activeSubmission.status === 'submitted' ? 'badge-submitted' :
                          activeSubmission.status === 'graded' ? 'badge-graded' : 'badge-resubmit'
                        }`} style={{ fontSize: '11.5px', padding: '2px 8px' }}>
                          {activeSubmission.status === 'draft' ? 'Draft' :
                           activeSubmission.status === 'submitted' ? 'Submitted' :
                           activeSubmission.status === 'graded' ? `Graded: ${activeSubmission.score}/10` : 'Resubmit Requested'}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', margin: '4px 0 0 0' }}>
                        Student ID: {activeSubmission.student?.username} | Submitted: {new Date(activeSubmission.submitted_at).toLocaleString('en-US')}
                      </p>
                    </div>

                    {/* Quick Student Switcher Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '6px' }}>
                        <Users size={14} style={{ color: 'var(--neon-cyan)' }} />
                        <select
                          className="form-select"
                          style={{
                            padding: '4px 8px',
                            fontSize: '12.5px',
                            margin: 0,
                            maxWidth: '220px',
                            background: '#ffffff',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                          value={activeSubIndex}
                          onChange={(e) => {
                            const idx = parseInt(e.target.value)
                            if (!isNaN(idx) && submissions[idx]) {
                              handleSelectGrading(submissions[idx], idx)
                            }
                          }}
                        >
                          {submissions.map((sub, idx) => (
                            <option key={sub.id} value={idx}>
                              {idx + 1}. {sub.student?.full_name} ({sub.student?.username}) - {sub.status === 'graded' ? `[${sub.score}/10]` : sub.status === 'submitted' ? '[Submitted]' : `[${sub.status}]`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Previous Student Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (activeSubIndex > 0) {
                            handleSelectGrading(submissions[activeSubIndex - 1], activeSubIndex - 1)
                          }
                        }}
                        disabled={activeSubIndex <= 0}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Previous student"
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>

                      {/* Next Student Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (activeSubIndex < submissions.length - 1) {
                            handleSelectGrading(submissions[activeSubIndex + 1], activeSubIndex + 1)
                          }
                        }}
                        disabled={activeSubIndex >= submissions.length - 1}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Next student"
                      >
                        Next <ChevronRight size={14} />
                      </button>

                      {activeSubmission.is_plagiarized && (
                        <span className="badge badge-resubmit" style={{ fontSize: '12px' }}>
                          SIMILARITY: {activeSubmission.plagiarism_score}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plagiarism warning details */}
                  {activeSubmission.is_plagiarized && (
                    <div className="plag-alert-banner" style={{ display: 'block', padding: '16px' }}>
                      <h4 style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--neon-ruby)' }}>Suspected content duplication detected:</h4>
                      <ul style={{ paddingLeft: '16px', fontSize: '13px' }}>
                        {activeSubmission.plagiarism_details?.map((d, i) => (
                          <li key={i} style={{ marginBottom: '6px' }}>
                            <b>{d.similarity_score}%</b> similarity with student <b>{d.matched_student}</b> in field <i>"{d.matched_field_label}"</i>.
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
                          <div className="answer-box-text">
                            {ans || <span style={{ color: 'var(--text-muted)' }}>(Empty)</span>}
                          </div>
                        )}

                        {/* SELECT FIELD */}
                        {field.type === 'select' && (
                          <div className="answer-box-select">
                            {ans || <span style={{ color: 'var(--text-muted)' }}>(Empty)</span>}
                          </div>
                        )}

                        {/* CHECKBOX FIELD (MULTI-SELECT BADGES) */}
                        {field.type === 'checkbox' && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px', padding: '4px 0' }}>
                            {ans ? ans.split(', ').map((item, idx) => (
                              <span key={idx} className="badge badge-submitted" style={{ fontSize: '12px', border: '1px solid var(--neon-cyan)', background: '#fff' }}>
                                {item}
                              </span>
                            )) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>(Empty)</span>
                            )}
                          </div>
                        )}

                        {/* TEXTAREA (MARKDOWN RENDERED WRITINGS) */}
                        {field.type === 'textarea' && (
                          <div className="answer-box-textarea">
                            {parseMarkdown(ans)}
                          </div>
                        )}

                        {/* FILE ATTACHMENTS (IMAGE OR DECRYPTED ZIP) */}
                        {field.type === 'file' && (
                          <div>
                            {attachment ? (
                              <div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  File: <b>{attachment.original_filename}</b>
                                </div>
                                
                                {/* Display inline if image */}
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
                                  /* Display safe extraction and AV scan results if Zip */
                                  <div style={{ padding: '16px', background: 'rgba(17,24,39,0.9)', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
                                    <h5 style={{ fontSize: '13px', color: 'var(--neon-cyan)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <ShieldCheck size={15} /> AIRLOCK SECURITY SCAN RESULTS
                                      {runtimeConfig?.uploads?.zip_password && ` (Zip password '${runtimeConfig.uploads.zip_password}')`}
                                    </h5>
                                    
                                    <div style={{ fontSize: '12.5px', color: 'var(--neon-emerald)', marginBottom: '8px' }}>
                                      [+] Status: <b>CLEAN (NO LIVE MALICIOUS THREAT DETECTED)</b>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      Scanned memory-extracted log files:
                                    </div>
                                    <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                                      <li>analysis_behavior.log</li>
                                      <li>dump_pcap_wireshark.txt</li>
                                      <li>check_anti_vm.asm</li>
                                    </ul>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {/* PREVIEW BUTTON FOR PDF, DOCX, OR IMAGES */}
                                    {['pdf', 'docx'].includes(attachment.original_filename.split('.').pop().toLowerCase()) && (
                                      <button 
                                        type="button" 
                                        onClick={() => handleOpenDocPreview(attachment)} 
                                        className="btn btn-primary" 
                                        style={{ padding: '7px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                                      >
                                        <Eye size={15} /> Preview ({attachment.original_filename.split('.').pop().toUpperCase()})
                                      </button>
                                    )}

                                    {/* RAW DOWNLOAD BUTTON */}
                                    <a 
                                      href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&download=true&token=${localStorage.getItem('malsec_token')}`} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '7px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                      target="_blank" 
                                      rel="noreferrer"
                                    >
                                      <Download size={14} /> Download File
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>(No attachment uploaded for this field)</span>
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
                  <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Score & Evaluation</h3>
                  <button onClick={() => { setActiveSubmission(null); setActiveSubIndex(-1); }} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    Close Split
                  </button>
                </div>

                <div className={`evaluation-status-box ${activeSubmission.late_penalty > 0 ? 'late' : ''}`}>
                  <Clock size={16} style={{ color: activeSubmission.late_penalty > 0 ? 'var(--neon-ruby)' : 'var(--neon-emerald)', flexShrink: 0 }} />
                  <div style={{ fontSize: '13px' }}>
                    {activeSubmission.late_penalty > 0 ? (
                      <span style={{ color: 'var(--neon-ruby)', fontWeight: '600' }}>
                        Late submission! Penalty deducted: <b>{activeSubmission.late_penalty}%</b>.
                      </span>
                    ) : (
                      <span style={{ color: '#15803d', fontWeight: '600' }}>
                        On-time submission. No penalty applied.
                      </span>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div className="form-group">
                    <label className="form-label">Practical Lab Score (Scale of 10.0)</label>
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
                        <span>Final score after late penalty deduction: <b>{(parseFloat(score) * (1 - activeSubmission.late_penalty / 100)).toFixed(2)}</b> / 10</span>
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
                      Request student to resubmit (Re-submit)
                    </label>
                  </div>

                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label">Instructor Detailed Feedback</label>
                    <textarea 
                      className="form-input form-textarea" 
                      placeholder="Enter feedback for student..."
                      style={{ flex: 1, minHeight: '150px' }}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '16px' }} disabled={actionLoading}>
                    {actionLoading ? 'SAVING GRADE...' : 'SAVE AND NEXT STUDENT'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Submissions list table for selected Lab */
            <div className="cyber-card">
              <h3 style={{ fontSize: '18px', marginBottom: '18px' }}>
                Student Submissions ({submissions.length} records)
              </h3>
              
              <div className="table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Full Name</th>
                      <th>Submission Status</th>
                      <th>Late Penalty</th>
                      <th>Plagiarism Result</th>
                      <th>Awarded Score</th>
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
                            {sub.status === 'draft' ? 'Draft' :
                             sub.status === 'submitted' ? 'Submitted' :
                             sub.status === 'graded' ? 'Graded' : 'Resubmit Requested'}
                          </span>
                        </td>
                        <td style={{ 
                          color: sub.late_penalty > 0 ? 'var(--neon-ruby)' : 'var(--text-secondary)',
                          fontWeight: sub.late_penalty > 0 ? '500' : 'normal' 
                        }}>
                          {sub.late_penalty > 0 ? `Penalty -${sub.late_penalty}%` : 'None'}
                        </td>
                        <td>
                          {sub.is_plagiarized ? (
                            <span style={{ color: 'var(--neon-ruby)', fontWeight: '500' }}>
                              ⚠️ Similarity: {sub.plagiarism_score}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--neon-emerald)' }}>Clean</span>
                          )}
                        </td>
                        <td style={{ fontWeight: '600', color: sub.score !== null ? 'var(--neon-cyan)' : 'var(--text-secondary)' }}>
                          {sub.score !== null ? `${sub.score} / 10` : 'Ungraded'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            onClick={() => handleSelectGrading(sub, index)} 
                            className="btn btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '12.5px' }}
                            disabled={sub.status === 'draft'}
                          >
                            Speed Grader
                          </button>
                        </td>
                      </tr>
                    ))}
                    {submissions.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students have submitted yet.</td>
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
              <h3>{editingLab ? 'Edit Lab Configuration & Content' : 'Design New Lab & Dynamic Report'}</h3>
              <button onClick={() => setShowLabModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveLab}>

              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Lab Title</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      placeholder="e.g. Lab 02: PE Malware Analysis..."
                      value={labTitle}
                      onChange={(e) => setLabTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Assign to Class</label>
                    <select 
                      className="form-select"
                      required
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                    >
                      <option value="">-- Select class --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Lab Objectives & Instructions</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Describe required tools, lab objectives, and instructions..."
                    style={{ minHeight: '80px' }}
                    value={labDesc}
                    onChange={(e) => setLabDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Deadline (UTC)</label>
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
                      <label htmlFor="allowLateCheck" style={{ fontSize: '13.5px', cursor: 'pointer' }}>Allow late submissions</label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="checkbox" 
                        id="enableVmCheck" 
                        checked={enableVm}
                        onChange={(e) => setEnableVm(e.target.checked)}
                      />
                      <label htmlFor="enableVmCheck" style={{ fontSize: '13.5px', cursor: 'pointer', color: 'var(--neon-cyan)', fontWeight: '500' }}>Enable Virtual Machine (VM)</label>
                    </div>
                  </div>
                </div>

                {enableVm && (
                  <div style={{ padding: '16px', background: 'rgba(242, 112, 36, 0.04)', borderRadius: '8px', border: '1px solid rgba(242, 112, 36, 0.3)', marginBottom: '16px' }}>
                    <label className="form-label" style={{ color: 'var(--neon-cyan)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🖥️ Select Proxmox Template VM
                    </label>
                    <select 
                      className="form-input" 
                      style={{ marginTop: '6px', background: '#ffffff', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                      value={templateVmid}
                      onChange={(e) => setTemplateVmid(e.target.value)}
                      required
                      disabled={pveTemplates.length === 0}
                    >
                      {pveTemplates.length === 0 && (
                        <option value="">Could not load template VM from Proxmox</option>
                      )}
                      {pveTemplates.map(t => (
                        <option key={t.vmid} value={t.vmid}>
                          VM {t.vmid} - {t.name} ({t.status || 'Template'})
                        </option>
                      ))}
                    </select>

                    <div style={{ marginTop: '14px', marginBottom: '14px', padding: '14px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <label className="form-label" style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '10px', display: 'block', fontWeight: 'bold' }}>
                        ⚡ VM Provisioning Mode (Clone Type)
                      </label>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: isLinkedClone ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontSize: '13.5px', fontWeight: isLinkedClone ? '600' : 'normal' }}>
                          <input
                            type="radio"
                            name="cloneMode"
                            checked={isLinkedClone === true}
                            onChange={() => setIsLinkedClone(true)}
                            style={{ accentColor: 'var(--neon-cyan)' }}
                          />
                          <span><b>Linked Clone</b> (Recommended: Fast provisioning, disk space efficient)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: !isLinkedClone ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontSize: '13.5px', fontWeight: !isLinkedClone ? '600' : 'normal' }}>
                          <input
                            type="radio"
                            name="cloneMode"
                            checked={isLinkedClone === false}
                            onChange={() => setIsLinkedClone(false)}
                            style={{ accentColor: 'var(--neon-cyan)' }}
                          />
                          <span><b>Full Clone</b> (Completely independent disk)</span>
                        </label>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0, lineHeight: '1.4' }}>
                        {isLinkedClone
                          ? '💡 Linked Clone: Student VMs share the base disk with the Template and store only differential changes (Copy-on-Write). Minimizes RAM/disk footprint when running 30+ machines concurrently.'
                          : '⚠️ Full Clone: Clones the full 60GB-120GB disk image for each individual student. Ideal for deep root/kernel system tasks but requires significantly more storage.'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Connection Protocol</label>
                        <select
                          className="form-input"
                          value={vmProtocol}
                          onChange={(e) => {
                            const protocol = e.target.value
                            setVmProtocol(protocol)
                            setVmPort(runtimeConfig?.vm?.protocol_ports?.[protocol] || '')
                          }}
                          required
                        >
                          <option value="rdp">RDP - Windows Remote Desktop</option>
                          <option value="vnc">VNC - Remote framebuffer</option>
                          <option value="ssh">SSH - Secure Shell</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Port</label>
                        <input
                          type="number"
                          min="1"
                          max="65535"
                          className="form-input"
                          value={vmPort}
                          onChange={(e) => setVmPort(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">VM Username</label>
                        <input
                          type="text"
                          className="form-input"
                          value={vmUsername}
                          onChange={(e) => setVmUsername(e.target.value)}
                          required={vmProtocol !== 'vnc'}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">VM Password</label>
                        <input
                          type="password"
                          className="form-input"
                          value={vmPassword}
                          onChange={(e) => setVmPassword(e.target.value)}
                          placeholder={editingLab ? 'Leave blank to keep existing password' : 'Enter connection password'}
                          required={!editingLab}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    {runtimeConfig?.vm && (
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}>
                        📌 Template VMs are in VMID range <b>{runtimeConfig.vm.template_vmid_min} – {runtimeConfig.vm.template_vmid_max}</b>. Student VMs are in range <b>{runtimeConfig.vm.student_vmid_min} – {runtimeConfig.vm.student_vmid_max}</b>.
                      </p>
                    )}

                  </div>
                )}



                {allowLate && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Late Penalty (% per hour)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        step="0.05"
                        value={penaltyPerHour}
                        onChange={(e) => setPenaltyPerHour(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Maximum Penalty (% of score)</label>
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
                    <h4 style={{ fontSize: '16px', color: 'var(--neon-cyan)' }}>Design Dynamic Report Fields</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => addFormField('text')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Text (IP/Hash)
                      </button>
                      <button type="button" onClick={() => addFormField('textarea')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Code/Essay
                      </button>
                      <button type="button" onClick={() => addFormField('select')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Single Choice
                      </button>
                      <button type="button" onClick={() => addFormField('checkbox')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + Multiple Choice
                      </button>
                      <button type="button" onClick={() => addFormField('file')} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        + File/Image Upload
                      </button>
                    </div>
                  </div>

                  <div className="builder-fields-list">
                    {formFields.map((field, index) => (
                      <div key={field.id} className="builder-field-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span className="badge badge-submitted" style={{ textTransform: 'uppercase' }}>
                            Field {index + 1}: {field.type}
                          </span>
                          <button type="button" onClick={() => removeFormField(index)} className="btn btn-danger" style={{ padding: '2px 6px', fontSize: '11px' }}>
                            Delete Question
                          </button>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Question Prompt / Field Label</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            required
                            placeholder="Enter practical question prompt..."
                            value={field.label}
                            onChange={(e) => updateFieldLabel(index, e.target.value)}
                          />
                        </div>

                        {/* Dropdown options for select and checkbox */}
                        {(field.type === 'select' || field.type === 'checkbox') && (
                          <div style={{ marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--border-glow)' }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Dropdown / Select Options</label>
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
                                + Add Option
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {formFields.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                        No report questions added yet. Click buttons above to build the form!
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowLabModal(false)} className="btn btn-secondary">CLOSE</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'SAVING...' : editingLab ? 'SAVE CHANGES' : 'CONFIGURE & PUBLISH LAB'}
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
              <h3>Individual Student Extension</h3>
              <button onClick={() => setShowExtensionModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveExtension}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  This setting allows the selected student to have an individual submission deadline (Special Extension) without affecting the overall class schedule.
                </p>

                <div className="form-group">
                  <label className="form-label">Select Student for Extension</label>
                  <select 
                    className="form-select"
                    required
                    value={extensionStudent}
                    onChange={(e) => setExtensionStudent(e.target.value)}
                  >
                    <option value="">-- Select student in class --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.username}>{s.full_name} (@{s.username})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">New Extended Deadline (UTC)</label>
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
                <button type="button" onClick={() => setShowExtensionModal(false)} className="btn btn-secondary">CLOSE</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'EXTENDING...' : 'CONFIRM INDIVIDUAL EXTENSION'}
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
              <h3>Edit Student Account</h3>
              <button onClick={() => setShowStudentModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>X</button>
            </div>
            <form onSubmit={handleSaveStudentEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Username (Student ID) - Fixed</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    disabled
                    value={editingStudent.username}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. John Doe"
                    value={studentFullName}
                    onChange={(e) => setStudentFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="e.g. student@example.com"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password (leave blank if unchanged)</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Leave blank to keep current password..."
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Status</label>
                  <select 
                    className="form-select"
                    value={studentIsActive ? "true" : "false"}
                    onChange={(e) => setStudentIsActive(e.target.value === "true")}
                  >
                    <option value="true">Active (Unlocked)</option>
                    <option value="false">Locked</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowStudentModal(false)} className="btn btn-secondary">CLOSE</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'SAVING...' : 'UPDATE ACCOUNT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL VM MANAGER FOR LAB */}
      {showVmManagerModal && selectedLabForVm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Monitor size={18} style={{ color: 'var(--neon-cyan)' }} />
                Student Virtual Machines — Lab: {selectedLabForVm.title}
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

      {/* MODAL: CLONE LAB TO ANOTHER CLASS */}
      {showCloneModal && cloneSourceLab && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--neon-emerald)' }}>
                <Copy size={18} /> Clone Lab to Another Class
              </h3>
              <button onClick={() => setShowCloneModal(false)} className="close-btn">&times;</button>
            </div>
            
            <form onSubmit={handleCloneLabSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '12px' }}>Source Lab:</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '15px' }}>{cloneSourceLab.title}</div>
                  <div style={{ fontSize: '12px', color: '#047857', marginTop: '4px', fontWeight: '500' }}>
                    {cloneSourceLab.enable_vm ? (
                      `🖥️ VM Template ${cloneSourceLab.template_vmid} (${cloneSourceLab.is_linked_clone ? 'Linked Clone' : 'Full Clone'}) | ${cloneSourceLab.vm_protocol?.toUpperCase()}`
                    ) : 'No virtual machine'}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Select Target Class <span style={{ color: 'var(--neon-ruby)' }}>*</span>
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={cloneTargetClassId}
                    onChange={(e) => setCloneTargetClassId(e.target.value)}
                    required
                  >
                    <option value="">-- Select target class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.id === cloneSourceLab.class_id ? '(Current Class)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    New Lab Title <span style={{ color: 'var(--neon-ruby)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={cloneNewTitle}
                    onChange={(e) => setCloneNewTitle(e.target.value)}
                    required
                    placeholder="e.g. IA2008 - PE Malware Analysis Exercise"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    New Submission Deadline <span style={{ color: 'var(--neon-ruby)' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={cloneNewDeadline}
                    onChange={(e) => setCloneNewDeadline(e.target.value)}
                    required
                  />
                </div>

                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  💡 All dynamic question fields, late penalty policies, virtual machine configurations, and connection credentials will be cloned intact to the target class.
                </p>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowCloneModal(false)} className="btn btn-secondary">CANCEL</button>
                <button 
                  type="submit" 
                  className="btn btn-success" 
                  disabled={actionLoading}
                  style={{ background: 'var(--neon-emerald)', borderColor: 'var(--neon-emerald)', color: '#000', fontWeight: 'bold' }}
                >
                  {actionLoading ? 'CLONING...' : 'CONFIRM CLONE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL DOCUMENT PREVIEW (PDF / DOCX) */}
      {previewDoc && (
        <div className="modal-overlay" style={{ zIndex: 1200, padding: '12px' }}>
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: '1100px', 
              width: '95vw', 
              height: '92vh', 
              display: 'flex', 
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div className="modal-header" style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge" style={{ background: previewDoc.type === 'pdf' ? '#ef4444' : '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>
                  {previewDoc.type.toUpperCase()}
                </span>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, fontWeight: '600', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={previewDoc.filename}>
                  {previewDoc.filename}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a 
                  href={`${previewDoc.url}&download=true`} 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  target="_blank" 
                  rel="noreferrer"
                >
                  <Download size={13} /> Download Original
                </a>
                <button 
                  type="button" 
                  onClick={handleCloseDocPreview} 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 10px', fontSize: '13px', display: 'flex', alignItems: 'center' }}
                  title="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, position: 'relative', overflowY: 'auto', background: previewDoc.type === 'pdf' ? '#525659' : '#ffffff', display: 'flex', flexDirection: 'column' }}>
              {previewLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '40px', color: 'var(--text-primary)' }}>
                  <RefreshCw size={28} className="spin-slow" style={{ color: 'var(--neon-cyan)' }} />
                  <p style={{ fontSize: '14px', margin: 0 }}>Loading and rendering Word document...</p>
                </div>
              )}

              {previewError && (
                <div style={{ margin: '24px auto', maxWidth: '600px', padding: '20px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b', textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Unable to display document directly</p>
                  <p style={{ fontSize: '13px', marginBottom: '16px' }}>{previewError}</p>
                  <a 
                    href={`${previewDoc.url}&download=true`} 
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                    target="_blank" 
                    rel="noreferrer"
                  >
                    <Download size={14} style={{ marginRight: '6px' }} /> Download to view
                  </a>
                </div>
              )}

              {/* PDF Preview: Native Browser Viewer via iframe */}
              {previewDoc.type === 'pdf' && !previewError && (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.filename}
                  style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
                />
              )}

              {/* DOCX Preview: Rendered HTML Container via docx-preview */}
              {previewDoc.type === 'docx' && (
                <div 
                  ref={docxContainerRef} 
                  style={{ 
                    display: previewLoading ? 'none' : 'block',
                    padding: '24px', 
                    margin: '0 auto', 
                    maxWidth: '900px', 
                    width: '100%',
                    background: '#ffffff'
                  }} 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

