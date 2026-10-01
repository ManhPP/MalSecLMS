import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  BookOpen, Plus, Calendar, FileSpreadsheet, Download, 
  CheckSquare, Award, ArrowRight, ShieldCheck, ShieldAlert,
  ArrowLeft, Clock, Code, FileText, Image as ImageIcon, CheckCircle, RefreshCw, RotateCcw,
  School, Users, Edit2, Trash2, Search, Lock, Unlock, Filter, Monitor, Play,
  Copy, Layers, ChevronDown, ChevronRight, Eye, ExternalLink, X, FileCheck, Maximize2,
  ChevronLeft, UserCheck, BarChart3, TrendingUp, Activity, CheckCircle2, AlertCircle,
  Paperclip, Upload, HardDrive, FileArchive, Disc, Globe
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

export const toLocalIsoInput = (dateInput) => {
  if (!dateInput) return '';
  let s = String(dateInput).trim();
  if (s.length === 16 && s.includes('T')) return s;
  if (!s.includes('Z') && !s.includes('+') && !s.match(/-\d\d:\d\d$/)) {
    s = s.replace(' ', 'T') + '+07:00';
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const vnDateStr = d.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(' ', 'T');
  return vnDateStr.slice(0, 16);
};

export default function InstructorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [labs, setLabs] = useState([])
  const [classes, setClasses] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [students, setStudents] = useState([]) // For exception dropdown
  
  // Navigation states: 'dashboard' | 'grading' | 'classes' | 'analytics' | 'gradebook' | 'student_grading'
  const [viewState, setViewState] = useState('dashboard') 
  const [selectedLab, setSelectedLab] = useState(null)
  
  // Grade by Student states
  const [studentGradingClass, setStudentGradingClass] = useState(null)
  const [studentGradingStudent, setStudentGradingStudent] = useState(null)
  const [studentGradingLabs, setStudentGradingLabs] = useState([]) // array of { lab, submission }
  const [studentGradingActiveLabIndex, setStudentGradingActiveLabIndex] = useState(0)
  const [studentGradingLoading, setStudentGradingLoading] = useState(false)

  // Speed Grader active submission
  const [activeSubmission, setActiveSubmission] = useState(null)
  const [activeSubIndex, setActiveSubIndex] = useState(-1)
  const [score, setScore] = useState('')
  const [comment, setComment] = useState('')
  const [requestResubmit, setRequestResubmit] = useState(false)

  // Dynamic Form Builder State
  const [showLabModal, setShowLabModal] = useState(false)
  const [editingLab, setEditingLab] = useState(null)
  const [labTitle, setLabTitle] = useState('')

  const [labDesc, setLabDesc] = useState('')
  const [gradeTag, setGradeTag] = useState('') // Tag đầu điểm (ví dụ: Đầu điểm 1, Chuyên cần, Thực hành 1, Giữa kỳ)
  const [classId, setClassId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [allowLate, setAllowLate] = useState(false)
  const [penaltyPerHour, setPenaltyPerHour] = useState('')
  const [maxPenalty, setMaxPenalty] = useState('')
  const [formFields, setFormFields] = useState([]) // Dynamic questions builder
  const [labAttachments, setLabAttachments] = useState([]) // File đính kèm tài liệu học liệu bài lab do GV cung cấp
  const [uploadingLabAttachment, setUploadingLabAttachment] = useState(false)
  const [enableVm, setEnableVm] = useState(false)
  const [disableVmCopy, setDisableVmCopy] = useState(false)
  const [disableVmPaste, setDisableVmPaste] = useState(false)
  const [isExamMode, setIsExamMode] = useState(false)
  const [cpuCores, setCpuCores] = useState('')
  const [ramGb, setRamGb] = useState('')
  const [runtimeConfig, setRuntimeConfig] = useState(null)
  const [templateVmid, setTemplateVmid] = useState('')
  const [isLinkedClone, setIsLinkedClone] = useState(true)
  const [vmProtocol, setVmProtocol] = useState('')
  const [vmPort, setVmPort] = useState('')
  const [vmUsername, setVmUsername] = useState('')
  const [vmPassword, setVmPassword] = useState('')
  const [pveTemplates, setPveTemplates] = useState([])
  // Per-Lab VM Drive D: Content Configuration
  const [vmDriveMode, setVmDriveMode] = useState('default') // 'default' | 'custom'
  const [vmDriveFiles, setVmDriveFiles] = useState([])
  const [availableVmTools, setAvailableVmTools] = useState([])
  const [loadingVmTools, setLoadingVmTools] = useState(false)
  // Lecturer VM Drive D: Files State (Private Workspace or Common Drive D:)
  const [myVmTools, setMyVmTools] = useState([])
  const [myVmToolScope, setMyVmToolScope] = useState('private') // 'private' | 'common'
  const [loadingMyVmTools, setLoadingMyVmTools] = useState(false)
  const [myVmToolFileToUpload, setMyVmToolFileToUpload] = useState(null)
  const [myVmToolUploading, setMyVmToolUploading] = useState(false)

  // VM Manager Modal State
  const [showVmManagerModal, setShowVmManagerModal] = useState(false)
  const [selectedLabForVm, setSelectedLabForVm] = useState(null)
  const [studentVms, setStudentVms] = useState([])
  const [vmActionLoading, setVmActionLoading] = useState(false)

  // Instructor Lab Preview State (Test lab environment, VM, guide, and dynamic questions before or after publishing)
  const [showLabPreviewModal, setShowLabPreviewModal] = useState(false)
  const [previewLabData, setPreviewLabData] = useState(null)
  const [previewLabTab, setPreviewLabTab] = useState('vm') // 'vm' | 'guide' | 'form'
  const [previewVmLoading, setPreviewVmLoading] = useState(false)
  const [previewVmError, setPreviewVmError] = useState('')
  const [previewGuacamoleUrl, setPreviewGuacamoleUrl] = useState('')
  const [previewVmInfo, setPreviewVmInfo] = useState(null)
  const [previewAnswers, setPreviewAnswers] = useState({})
  const previewGuacRef = useRef(null)

  const openLabPreview = async (lab) => {
    setPreviewLabData(lab)
    setPreviewLabTab(lab.enable_vm !== false ? 'vm' : 'guide')
    setPreviewVmError('')
    setPreviewGuacamoleUrl('')
    setPreviewVmInfo(null)
    setPreviewAnswers({})
    setShowLabPreviewModal(true)

    // Automatically initialize VM session if VM is enabled for this lab
    if (lab.enable_vm !== false) {
      launchPreviewVmSession(lab.id)
    }
  }

  const launchPreviewVmSession = async (labId) => {
    setPreviewVmLoading(true)
    setPreviewVmError('')
    setPreviewGuacamoleUrl('')
    setPreviewVmInfo(null)
    localStorage.removeItem('GUAC_AUTH_TOKEN')
    sessionStorage.removeItem('GUAC_AUTH_TOKEN')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/${labId}/vm-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const contentType = res.headers.get('content-type') || ''
      let data = {}
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const rawText = await res.text()
        if (!res.ok) {
          throw new Error(`VM is being prepared on Proxmox (HTTP ${res.status}). Please wait 15-30s and click retry.`)
        }
      }
      if (!res.ok) throw new Error(data.detail || 'Failed to establish instructor preview VM session')
      setPreviewGuacamoleUrl(data.guacamole_url)
      setPreviewVmInfo(data)
    } catch (err) {
      setPreviewVmError(err.message)
    } finally {
      setPreviewVmLoading(false)
    }
  }

  const handlePreviewVmRollback = async () => {
    if (!previewLabData) return
    if (!window.confirm('Reset this instructor preview VM back to clean template state?')) return
    setPreviewVmLoading(true)
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/${previewLabData.id}/vm-rollback`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Unable to reset preview VM')
      }
      setPreviewGuacamoleUrl('')
      setPreviewVmInfo(null)
      await launchPreviewVmSession(previewLabData.id)
    } catch (err) {
      alert('VM Reset error: ' + err.message)
      setPreviewVmLoading(false)
    }
  }



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
        if (templates.length > 0) {
          setTemplateVmid(current => current || String(templates[0].vmid))
        }
      }
    } catch (err) {
      console.error("Failed to fetch PVE templates:", err)
    }
  }

  const fetchAvailableVmTools = async () => {
    const token = localStorage.getItem('malsec_token')
    setLoadingVmTools(true)
    try {
      const res = await fetch('/api/labs/vm-tools/available-files', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAvailableVmTools(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Failed to fetch available VM tools:", err)
    } finally {
      setLoadingVmTools(false)
    }
  }

  const fetchMyVmTools = async (targetScope = myVmToolScope) => {
    const token = localStorage.getItem('malsec_token')
    setLoadingMyVmTools(true)
    try {
      const res = await fetch(`/api/labs/vm-tools/my-files?scope=${encodeURIComponent(targetScope)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMyVmTools(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Failed to fetch VM tools:", err)
    } finally {
      setLoadingMyVmTools(false)
    }
  }

  const handleUploadMyVmTool = async (e) => {
    e.preventDefault()
    if (!myVmToolFileToUpload) return
    setMyVmToolUploading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    const formData = new FormData()
    formData.append('file', myVmToolFileToUpload)
    formData.append('scope', myVmToolScope)

    try {
      const res = await fetch('/api/labs/vm-tools/my-files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to upload tool file')
      const destLabel = myVmToolScope === 'common' ? 'Common Drive D: (Global)' : 'your private drive'
      setSuccess(`File "${data.filename}" uploaded successfully to ${destLabel}!`)
      setMyVmToolFileToUpload(null)
      const fileInput = document.getElementById('myVmToolFileInput')
      if (fileInput) fileInput.value = ''
      fetchMyVmTools(myVmToolScope)
      fetchAvailableVmTools()
    } catch (err) {
      setError(err.message)
    } finally {
      setMyVmToolUploading(false)
    }
  }

  const handleDeleteMyVmTool = async (filename) => {
    const destLabel = myVmToolScope === 'common' ? 'Common Drive D:' : 'your private drive'
    if (!confirm(`Are you sure you want to delete file "${filename}" from ${destLabel}?`)) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/vm-tools/my-files/${encodeURIComponent(filename)}?scope=${encodeURIComponent(myVmToolScope)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to delete tool file')
      setSuccess(data.message)
      fetchMyVmTools(myVmToolScope)
      fetchAvailableVmTools()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
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

  // Attachment Access Control State (Phân quyền hiển thị tài liệu đính kèm cho từng sinh viên)
  const [showAttachmentPermModal, setShowAttachmentPermModal] = useState(false)
  const [activeAttachmentIdx, setActiveAttachmentIdx] = useState(null)
  const [permSearchTerm, setPermSearchTerm] = useState('')

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
  const [activeClassTab, setActiveClassTab] = useState('labs') // 'labs' | 'students' | 'analytics' | 'gradebook'
  const [classSearchQuery, setClassSearchQuery] = useState('')
  const [semestersList, setSemestersList] = useState([])
  const [editClassModal, setEditClassModal] = useState(false)
  const [editClassSemester, setEditClassSemester] = useState('unknown')
  const [editClassDesc, setEditClassDesc] = useState('')
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
  const [labSemesterFilter, setLabSemesterFilter] = useState('all') // 'all' or specific semester
  const [hidePastSemesters, setHidePastSemesters] = useState(false)
  const [collapsedSemesterGroups, setCollapsedSemesterGroups] = useState({}) // { [semester]: boolean }
  const [labStatusFilter, setLabStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [labSortOrder, setLabSortOrder] = useState('newest') // 'newest' | 'deadline_asc' | 'deadline_desc' | 'title_asc'
  const [labGroupByClass, setLabGroupByClass] = useState(true) // Gom nhóm theo lớp mặc định
  const [collapsedClassGroups, setCollapsedClassGroups] = useState({}) // { [classId]: boolean }

  // Class Analytics state
  const [analyticsClassId, setAnalyticsClassId] = useState('')
  const [analyticsSemesterFilter, setAnalyticsSemesterFilter] = useState('all') // 'all' or specific semester
  const [analyticsLabFilter, setAnalyticsLabFilter] = useState('')
  const [analyticsData, setAnalyticsData] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [studentAnalyticsSearch, setStudentAnalyticsSearch] = useState('')

  // Gradebook Matrix state
  const [gradebookClassId, setGradebookClassId] = useState('')
  const [gradebookSemesterFilter, setGradebookSemesterFilter] = useState('all') // 'all' or specific semester
  const [gradebookData, setGradebookData] = useState(null)
  const [gradebookLoading, setGradebookLoading] = useState(false)
  const [gradebookViewMode, setGradebookViewMode] = useState('labs') // 'labs' (chi tiết từng lab) | 'tags' (xem theo đầu điểm)
  const [selectedStudentFilter, setSelectedStudentFilter] = useState([]) // Array of student usernames, empty = all
  const [selectedLabFilter, setSelectedLabFilter] = useState([]) // Array of lab IDs (numbers), empty = all
  const [selectedTagFilter, setSelectedTagFilter] = useState([]) // Array of tag names (strings), empty = all
  const [gradebookStudentSearch, setGradebookStudentSearch] = useState('')

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')

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

  // Export Gradebook to CSV (supports full labs or aggregated grade_tag mode)
  const exportGradebookToCSV = (filteredRows, visibleLabs, visibleTags, mode = 'labs') => {
    if (!filteredRows || filteredRows.length === 0) {
      alert('No student data available to export.')
      return
    }

    let headers = []
    let csvLines = []

    if (mode === 'tags') {
      if (!visibleTags || visibleTags.length === 0) {
        alert('No grade tags defined in this class to export.')
        return
      }
      headers = [
        'STT',
        'MSSV',
        'Ho va Ten',
        'Email',
        'Tong so lab da nop',
        ...visibleTags.map(t => `"${t.replace(/"/g, '""')}"`),
        'Diem trung binh (GPA)'
      ]
      csvLines.push(headers.join(','))

      filteredRows.forEach((row, idx) => {
        const line = [
          idx + 1,
          `"${row.username}"`,
          `"${row.full_name.replace(/"/g, '""')}"`,
          `"${row.email || ''}"`,
          row.completed_labs,
          ...visibleTags.map(t => {
            const tg = row.tag_grades?.[t]
            if (!tg || tg.average_score === null) return '0'
            return tg.average_score
          }),
          row.average_score !== null && row.average_score !== undefined ? row.average_score : 0
        ]
        csvLines.push(line.join(','))
      })
    } else {
      if (!visibleLabs || visibleLabs.length === 0) {
        alert('No labs available to export.')
        return
      }
      headers = [
        'STT',
        'MSSV',
        'Ho va Ten',
        'Email',
        'So lab da nop',
        ...visibleLabs.map(l => {
          const tagInfo = l.grade_tag ? ` [${l.grade_tag}]` : ''
          return `"${(l.title + tagInfo).replace(/"/g, '""')}"`
        }),
        'Diem trung binh (GPA)'
      ]
      csvLines.push(headers.join(','))

      filteredRows.forEach((row, idx) => {
        const line = [
          idx + 1,
          `"${row.username}"`,
          `"${row.full_name.replace(/"/g, '""')}"`,
          `"${row.email || ''}"`,
          row.completed_labs,
          ...visibleLabs.map(l => {
            const g = row.grades[String(l.id)]
            if (!g || g.final_score === null) return '0'
            return g.final_score
          }),
          row.average_score !== null && row.average_score !== undefined ? row.average_score : 0
        ]
        csvLines.push(line.join(','))
      })
    }

    // Create BOM and Blob for UTF-8 CSV
    const csvContent = '\uFEFF' + csvLines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const classNameClean = (gradebookData?.class_name || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_')
    const modeSuffix = mode === 'tags' ? 'By_Grade_Tags' : 'All_Labs'
    link.setAttribute('href', url)
    link.setAttribute('download', `Gradebook_${classNameClean}_${modeSuffix}_${new Date().toISOString().slice(0, 10)}.csv`)
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

      // 4. Fetch Semesters list (configured by Admin)
      const semRes = await fetch('/api/semesters/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (semRes.ok) setSemestersList(await semRes.json())

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

  // Sync state FROM URL query params on mount & when searchParams / classes / labs change
  useEffect(() => {
    const paramClassId = searchParams.get('classId')
    const paramTab = searchParams.get('tab')
    const paramView = searchParams.get('view')
    const paramLabId = searchParams.get('labId')
    const paramStudentId = searchParams.get('studentId')

    // 1. Grading view via URL: ?view=grading&labId=123
    if (paramView === 'grading' && paramLabId) {
      if (labs.length > 0) {
        const foundLab = labs.find(l => String(l.id) === String(paramLabId))
        if (foundLab && (!selectedLab || String(selectedLab.id) !== String(paramLabId))) {
          fetchSubmissions(foundLab)
        }
      }
      return
    }

    // 2. Student grading view via URL: ?view=student_grading&classId=10&studentId=5
    if (paramView === 'student_grading' && paramClassId && paramStudentId) {
      if (classes.length > 0) {
        const foundClass = classes.find(c => String(c.id) === String(paramClassId))
        if (foundClass) {
          const foundStudent = (foundClass.users || []).find(u => String(u.id) === String(paramStudentId)) || 
                               allStudents.find(u => String(u.id) === String(paramStudentId)) ||
                               { id: parseInt(paramStudentId), full_name: 'Student', username: `student_${paramStudentId}` }
          if (!studentGradingStudent || String(studentGradingStudent.id) !== String(paramStudentId)) {
            openStudentGrading(foundClass, foundStudent)
          }
        }
      }
      return
    }

    // 3. Analytics standalone view via URL: ?view=analytics
    if (paramView === 'analytics') {
      if (viewState !== 'analytics') setViewState('analytics')
      if (paramClassId && classes.length > 0) {
        const cId = parseInt(paramClassId)
        if (cId && analyticsClassId !== cId) {
          setAnalyticsClassId(cId)
          fetchClassAnalytics(cId, '')
        }
      }
      return
    }

    // 4. Gradebook standalone view via URL: ?view=gradebook
    if (paramView === 'gradebook') {
      if (viewState !== 'gradebook') setViewState('gradebook')
      if (paramClassId && classes.length > 0) {
        const cId = parseInt(paramClassId)
        if (cId && gradebookClassId !== cId) {
          setGradebookClassId(cId)
          fetchClassGradebook(cId)
        }
      }
      return
    }

    // 5. My VM Drive view via URL: ?view=my_drive
    if (paramView === 'my_drive') {
      if (viewState !== 'my_drive') setViewState('my_drive')
      fetchMyVmTools()
      return
    }

    // 6. Class Hub view via URL: ?classId=10&tab=labs (or students, analytics, gradebook)
    if (paramClassId) {
      if (viewState !== 'dashboard') setViewState('dashboard')
      if (paramTab && ['labs', 'students', 'analytics', 'gradebook'].includes(paramTab)) {
        if (activeClassTab !== paramTab) setActiveClassTab(paramTab)
      }
      if (classes.length > 0) {
        const found = classes.find(c => String(c.id) === String(paramClassId))
        if (found && (!selectedClass || String(selectedClass.id) !== String(paramClassId))) {
          fetchClassDetails(found.id)
          if (paramTab === 'analytics') {
            setAnalyticsClassId(found.id)
            fetchClassAnalytics(found.id, '')
          } else if (paramTab === 'gradebook') {
            setGradebookClassId(found.id)
            fetchClassGradebook(found.id)
          }
        }
      }
    } else {
      // Home classes grid
      if (viewState === 'dashboard' && selectedClass) {
        setSelectedClass(null)
      }
    }
  }, [classes, labs, allStudents, searchParams])

  // Listen to browser Back button so sub-views (grading, student_grading) and class hub return smoothly
  useEffect(() => {
    const handlePopState = () => {
      // React Router searchParams update will trigger the sync effect above
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
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
      setSearchParams({ view: 'grading', labId: lab.id })

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

  // Fetch all labs & submissions for a specific student (Grade by Student view)
  const openStudentGrading = async (cls, student, defaultLabIndex = 0) => {
    if (!cls || !student) return
    setStudentGradingLoading(true)
    setError('')
    setSuccess('')
    setStudentGradingClass(cls)
    setStudentGradingStudent(student)
    setStudentGradingLabs([])
    setStudentGradingActiveLabIndex(defaultLabIndex)
    setActiveSubmission(null)

    const token = localStorage.getItem('malsec_token')
    try {
      // Ensure class has full student list populated (Gradebook/Analytics use list view which lacks users)
      let resolvedClass = cls
      if (!cls.users || cls.users.length === 0) {
        try {
          const clsRes = await fetch(`/api/classes/${cls.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (clsRes.ok) {
            resolvedClass = await clsRes.json()
            setStudentGradingClass(resolvedClass)
            const foundStudent = (resolvedClass.users || []).find(u => u.id === student.id)
            if (foundStudent) {
              setStudentGradingStudent(foundStudent)
            }
          }
        } catch (clsErr) {
          console.error('Failed to load class student list', clsErr)
        }
      }

      const res = await fetch(`/api/submissions/class/${cls.id}/student/${student.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Unable to load student labs')
      }
      const data = await res.json()
      const labsData = data.labs || []
      setStudentGradingLabs(labsData)
      setViewState('student_grading')
      setSearchParams({ view: 'student_grading', classId: cls.id, studentId: student.id })

      // If labs available, activate the selected lab submission
      if (labsData.length > 0) {
        const targetIdx = defaultLabIndex >= 0 && defaultLabIndex < labsData.length ? defaultLabIndex : 0
        setStudentGradingActiveLabIndex(targetIdx)
        const targetPair = labsData[targetIdx]
        if (targetPair && targetPair.submission) {
          setActiveSubmission(targetPair.submission)
          setSelectedLab(targetPair.lab)
          const isSubmitted = targetPair.submission.status === 'submitted' || targetPair.submission.status === 'graded' || Object.keys(targetPair.submission.answers || {}).length > 0 || (targetPair.submission.file_attachments || []).length > 0
          const initialScore = targetPair.submission.score !== null ? targetPair.submission.score : (isSubmitted ? '' : 0)
          setScore(initialScore)
          setComment(targetPair.submission.comment || '')
          setRequestResubmit(targetPair.submission.status === 're_submit_requested')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setStudentGradingLoading(false)
    }
  }

  // Switch active lab when in Grade by Student view
  const handleSelectStudentGradingLab = (pair, index) => {
    setStudentGradingActiveLabIndex(index)
    setSelectedLab(pair.lab)
    setActiveSubmission(pair.submission)
    if (pair.submission) {
      const isSubmitted = pair.submission.status === 'submitted' || pair.submission.status === 'graded' || Object.keys(pair.submission.answers || {}).length > 0 || (pair.submission.file_attachments || []).length > 0
      const initialScore = pair.submission.score !== null ? pair.submission.score : (isSubmitted ? '' : 0)
      setScore(initialScore)
      setComment(pair.submission.comment || '')
      setRequestResubmit(pair.submission.status === 're_submit_requested')
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
    const isCode = ['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log'].includes(ext)
    setPreviewDoc({
      filename,
      filepath: attachment.filepath,
      url: fileUrl,
      type: ext === 'docx' ? 'docx' : ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : isCode ? 'code' : 'other',
      content: ''
    })

    // If Code / Text, fetch text content directly
    if (isCode) {
      setPreviewLoading(true)
      try {
        const res = await fetch(fileUrl)
        if (!res.ok) throw new Error('Unable to download source code file from server')
        const textContent = await res.text()
        setPreviewDoc(prev => prev ? { ...prev, content: textContent } : null)
      } catch (err) {
        console.error('Error loading code file:', err)
        setPreviewError('Source code preview error: ' + err.message)
      } finally {
        setPreviewLoading(false)
      }
      return
    }

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
    const isSubmitted = sub.status === 'submitted' || sub.status === 'graded' || Object.keys(sub.answers || {}).length > 0 || (sub.file_attachments || []).length > 0
    const initialScore = sub.score !== null ? sub.score : (isSubmitted ? '' : 0)
    setScore(initialScore)
    setComment(sub.comment || '')
    setRequestResubmit(sub.status === 're_submit_requested')
  }

  // Speed Grader - Save grade
  const handleSaveGrade = async (e) => {
    e.preventDefault()
    if (!activeSubmission) return
    if (score === '' || score === null || isNaN(parseFloat(score))) {
      setError('Please enter a grade score (from 0 to 10)!')
      return
    }
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
      
      // Update local submissions list if in lab grading mode
      if (activeSubIndex >= 0 && submissions.length > 0) {
        const updatedList = [...submissions]
        updatedList[activeSubIndex] = data
        setSubmissions(updatedList)
      }

      // Update studentGradingLabs if in student grading mode
      if (studentGradingLabs.length > 0 && studentGradingActiveLabIndex >= 0) {
        const updatedLabs = [...studentGradingLabs]
        if (updatedLabs[studentGradingActiveLabIndex]) {
          updatedLabs[studentGradingActiveLabIndex] = {
            ...updatedLabs[studentGradingActiveLabIndex],
            submission: data
          }
          setStudentGradingLabs(updatedLabs)
        }
      }

      setActiveSubmission(data)
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
    setModalError('')
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
      setModalError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Dynamic Form Builder field management
  const addFormField = (type) => {
    const newField = {
      id: `q_${Date.now()}`,
      type,
      label: '',
      required: true,
      options: type === 'select' || type === 'checkbox' ? [''] : []
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
    updated[fieldIndex].options.push('')
    setFormFields(updated)
  }

  // Upload attachment file for lab (Instructor)
  const handleLabAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploadingLabAttachment(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const uploadedList = []
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/labs/upload-attachment', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || `Upload failed for file ${file.name}`)
        uploadedList.push(data)
      }

      setLabAttachments(prev => [...prev, ...uploadedList])
      setSuccess(`Successfully attached ${uploadedList.length} reference file(s)!`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingLabAttachment(false)
      e.target.value = ''
    }
  }

  const handleRemoveLabAttachment = (indexToRemove) => {
    setLabAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSaveLab = async (e) => {
    e.preventDefault()
    if (!isExamMode && formFields.length === 0) {
      setModalError('Please create at least one question field for the lab report (or enable Exam / Test Mode for in-VM Word report)!')
      return
    }
    if (enableVm && !editingLab && !vmPassword) {
      setModalError('Please enter a password for the VM connection!')
      return
    }
    if (enableVm && (!templateVmid || !vmProtocol || !vmPort)) {
      setModalError('VM template, protocol, or port configuration is incomplete!')
      return
    }
    if (enableVm && vmProtocol !== 'vnc' && !vmUsername.trim()) {
      setModalError('Please enter a username for RDP/SSH connection!')
      return
    }
    setActionLoading(true)
    setError('')
    setModalError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const deadlinePayload = deadline.length === 16 ? `${deadline}:00` : deadline
      const payload = {
        title: labTitle,
        description: labDesc,
        grade_tag: gradeTag.trim() || 'Default',
        form_fields: formFields,
        attachment_files: labAttachments,
        deadline: deadlinePayload,
        late_policy: {
          allow_late: allowLate,
          penalty_per_hour_percent: allowLate && penaltyPerHour !== '' ? parseFloat(penaltyPerHour) : 0,
          max_penalty_percent: allowLate && maxPenalty !== '' ? parseFloat(maxPenalty) : 0
        },
        class_id: parseInt(classId),
        is_active: true,
        enable_vm: enableVm,
        vm_drive_mode: vmDriveMode,
        vm_drive_files: vmDriveMode === 'custom' ? vmDriveFiles : [],
        disable_vm_copy: disableVmCopy,
        disable_vm_paste: disableVmPaste,
        is_exam_mode: isExamMode,
        cpu_cores: cpuCores ? parseInt(cpuCores) : null,
        ram_mb: ramGb ? Math.round(parseFloat(ramGb) * 1024) : null
      }
      if (enableVm) {
        payload.template_vmid = parseInt(templateVmid)
        payload.is_linked_clone = isLinkedClone
        payload.vm_protocol = vmProtocol
        payload.vm_port = parseInt(vmPort)
        payload.vm_username = vmUsername.trim()
        if (vmPassword) payload.vm_password = vmPassword
        payload.disable_vm_copy = disableVmCopy
        payload.disable_vm_paste = disableVmPaste
        payload.is_exam_mode = isExamMode
        payload.cpu_cores = cpuCores ? parseInt(cpuCores) : null
        payload.ram_mb = ramGb ? Math.round(parseFloat(ramGb) * 1024) : null
      }

      let res
      if (editingLab) {
        res = await fetch(`/api/labs/${editingLab.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch('/api/labs/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error saving lab assignment')

      setSuccess(`Lab assignment ${editingLab ? 'updated' : 'created'} successfully!`)
      setShowLabModal(false)
      fetchData()
      resetLabForm()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const resetLabForm = () => {
    setEditingLab(null)
    setLabTitle('')
    setLabDesc('')
    setGradeTag('')
    setDeadline('')
    setAllowLate(false)
    setPenaltyPerHour('')
    setMaxPenalty('')
    setFormFields([])
    setLabAttachments([])
    setEnableVm(false)
    setIsLinkedClone(true)
    setTemplateVmid('')
    setVmProtocol('')
    setVmPort('')
    setVmUsername('')
    setVmPassword('')
  }

  const openCreateLabModal = () => {
    setEditingLab(null)
    setLabTitle('')
    setLabDesc('')
    setGradeTag('')
    setClassId(classes[0]?.id || '')
    setDeadline('')
    setAllowLate(false)
    setPenaltyPerHour('')
    setMaxPenalty('')
    setEnableVm(false)
    setDisableVmCopy(false)
    setDisableVmPaste(false)
    setIsExamMode(false)
    setCpuCores('')
    setRamGb('')
    setIsLinkedClone(true)

    const defaultProto = runtimeConfig?.vm?.default_protocol || 'rdp'
    const defaultTpl = runtimeConfig?.vm?.default_template_vmid || (pveTemplates[0]?.vmid ? String(pveTemplates[0].vmid) : '')
    const defaultPort = runtimeConfig?.vm?.protocol_ports?.[defaultProto] || 3389

    setTemplateVmid(defaultTpl)
    setVmProtocol(defaultProto)
    setVmPort(defaultPort)
    setVmUsername('')
    setVmPassword('')
    setVmDriveMode('default')
    setVmDriveFiles([])
    setModalError('')
    fetchPveTemplates()
    fetchAvailableVmTools()
    setLabAttachments([])
    setFormFields([])
    setShowLabModal(true)
  }

  const openEditLabModal = (lab) => {
    setEditingLab(lab)
    setLabTitle(lab.title || '')
    setLabDesc(lab.description || '')
    setGradeTag(lab.grade_tag || '')
    setClassId(lab.class_id || (classes[0]?.id || ''))
    
    if (lab.deadline) {
      setDeadline(toLocalIsoInput(lab.deadline))
    } else {
      setDeadline('')
    }

    setAllowLate(lab.late_policy?.allow_late ?? true)
    setPenaltyPerHour(lab.late_policy?.penalty_per_hour_percent ?? 0.5)
    setMaxPenalty(lab.late_policy?.max_penalty_percent ?? 30.0)
    setFormFields(lab.form_fields || [])
    setLabAttachments(lab.attachment_files || [])
    setEnableVm(lab.enable_vm !== false)
    setDisableVmCopy(Boolean(lab.disable_vm_copy))
    setDisableVmPaste(Boolean(lab.disable_vm_paste))
    setIsExamMode(Boolean(lab.is_exam_mode))
    setCpuCores(lab.cpu_cores ? String(lab.cpu_cores) : '')
    setRamGb(lab.ram_mb ? String(Math.round(lab.ram_mb / 1024)) : '')
    setIsLinkedClone(lab.is_linked_clone !== false)
    setVmDriveMode(lab.vm_drive_mode || 'default')
    setVmDriveFiles(Array.isArray(lab.vm_drive_files) ? lab.vm_drive_files : [])
    const configuredProtocol = lab.vm_protocol || runtimeConfig?.vm?.default_protocol || ''
    setTemplateVmid(lab.template_vmid || runtimeConfig?.vm?.default_template_vmid || '')
    setVmProtocol(configuredProtocol)
    setVmPort(lab.vm_port || runtimeConfig?.vm?.protocol_ports?.[configuredProtocol] || '')
    setVmUsername(lab.vm_username || '')
    setVmPassword('')
    setModalError('')

    fetchPveTemplates()
    fetchAvailableVmTools()
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
      setCloneNewDeadline(toLocalIsoInput(lab.deadline))
    } else {
      setCloneNewDeadline('')
    }
    setModalError('')
    setShowCloneModal(true)
  }

  const handleCloneLabSubmit = async (e) => {
    e.preventDefault()
    if (!cloneSourceLab) return
    if (!cloneTargetClassId) {
      setModalError('Please select a target class')
      return
    }

    setActionLoading(true)
    setError('')
    setModalError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const deadlinePayload = cloneNewDeadline 
        ? (cloneNewDeadline.length === 16 ? `${cloneNewDeadline}:00` : cloneNewDeadline)
        : null
      const payload = {
        target_class_id: parseInt(cloneTargetClassId),
        new_title: cloneNewTitle.trim(),
        new_deadline: deadlinePayload
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
      setModalError(err.message)
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
    setModalError('')
    setShowVmManagerModal(true)
    fetchLabVms(lab.id)
  }

  const handleControlVm = async (labId, vmid, action, studentName) => {
    const actionText = action === 'purge' ? 'permanently purge' : action === 'start' ? 'start' : 'stop'
    if (action === 'purge' && !confirm(`Are you sure you want to permanently purge VM ${vmid} for student ${studentName}?\nThis VM will be 100% purged from the Proxmox cluster so the student can re-clone a clean VM.`)) return

    setVmActionLoading(true)
    setModalError('')
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
      setModalError(err.message)
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
    setModalError('')
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
      setModalError(err.message)
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

  const openEditClassModal = (cls) => {
    if (!cls) return
    setEditClassSemester(cls.semester || 'unknown')
    setEditClassDesc(cls.description || '')
    setModalError('')
    setEditClassModal(true)
  }

  const handleSaveClassSettings = async (e) => {
    e.preventDefault()
    if (!selectedClass) return
    setActionLoading(true)
    setError('')
    setModalError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          semester: editClassSemester.trim() || 'unknown',
          description: editClassDesc
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to update class')

      setSuccess('Class semester & settings updated successfully!')
      setEditClassModal(false)
      fetchClassDetails(selectedClass.id)
      fetchData()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setActionLoading(false)
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
    setModalError('')
    setShowStudentModal(true)
  }

  // Handle saving student profile changes
  const handleSaveStudentEdit = async (e) => {
    e.preventDefault()
    if (!editingStudent) return
    setActionLoading(true)
    setError('')
    setModalError('')
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
      setModalError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Current active semester configured by Admin (fallback to newest recognized)
  const currentSemester = React.useMemo(() => {
    const activeSem = semestersList.find(s => s.is_active)
    if (activeSem?.name) return activeSem.name
    const semSet = new Set()
    semestersList.forEach(s => { if (s.name) semSet.add(s.name) })
    classes.forEach(c => { semSet.add(c.semester || 'unknown') })
    const arr = Array.from(semSet).filter(s => s !== 'unknown').sort((a, b) => b.localeCompare(a))
    return arr[0] || 'unknown'
  }, [semestersList, classes])

  // List of unique semesters from classes (Current active semester sorted first)
  const availableSemesters = React.useMemo(() => {
    const semSet = new Set()
    // Include configured semesters from Admin
    semestersList.forEach(s => {
      if (s.name) semSet.add(s.name)
    })
    // Also include any semesters already on classes
    classes.forEach(c => {
      semSet.add(c.semester || 'unknown')
    })
    return Array.from(semSet).sort((a, b) => {
      // 1. Current active semester always comes first
      if (a === currentSemester && b !== currentSemester) return -1
      if (b === currentSemester && a !== currentSemester) return 1
      // 2. Unknown semester always comes last
      if (a === 'unknown') return 1
      if (b === 'unknown') return -1
      // 3. Otherwise reverse alphabetical (e.g. SP26, FA25)
      return b.localeCompare(a)
    })
  }, [classes, semestersList, currentSemester])

  // Lab filtering and sorting logic
  const filteredLabs = labs.filter(lab => {
    const matchesSearch = lab.title.toLowerCase().includes(labSearchQuery.toLowerCase()) || 
                          (lab.description && lab.description.toLowerCase().includes(labSearchQuery.toLowerCase()))
    
    const labClass = classes.find(c => c.id === lab.class_id)
    const labSemester = labClass ? (labClass.semester || 'unknown') : 'unknown'

    // Semester filter
    if (labSemesterFilter !== 'all' && labSemester !== labSemesterFilter) {
      return false
    }

    // Hide past semesters toggle: only keep current semester and unknown
    if (hidePastSemesters && availableSemesters.length > 1) {
      if (labSemester !== currentSemester && labSemester !== 'unknown') {
        return false
      }
    }
    
    const matchesClass = labClassFilter === '' ? true : lab.class_id === parseInt(labClassFilter)
    
    const matchesStatus = labStatusFilter === 'all' ? true : 
                          labStatusFilter === 'active' ? lab.is_active : !lab.is_active
                          
    return matchesSearch && matchesClass && matchesStatus
  }).sort((a, b) => {
    if (labSortOrder === 'newest') {
      return b.id - a.id
    }
    if (labSortOrder === 'deadline_asc') {
      const da = parseVietnamDate(a.deadline)
      const db = parseVietnamDate(b.deadline)
      return (da?.getTime() || 0) - (db?.getTime() || 0)
    }
    if (labSortOrder === 'deadline_desc') {
      const da = parseVietnamDate(a.deadline)
      const db = parseVietnamDate(b.deadline)
      return (db?.getTime() || 0) - (da?.getTime() || 0)
    }
    if (labSortOrder === 'title_asc') {
      return a.title.localeCompare(b.title)
    }
    return 0
  })

  // Hierarchical Grouping: Semester -> Class -> Labs
  const groupedSemesters = React.useMemo(() => {
    const semMap = {}
    filteredLabs.forEach(lab => {
      const cid = lab.class_id || 0
      const cls = classes.find(c => c.id === cid)
      const semester = cls?.semester || 'unknown'
      
      if (!semMap[semester]) {
        semMap[semester] = {
          semester,
          classes: {}
        }
      }
      if (!semMap[semester].classes[cid]) {
        semMap[semester].classes[cid] = {
          classId: cid,
          className: cls ? cls.name : `Class ID ${cid}`,
          classDesc: cls?.description || '',
          semester,
          labs: []
        }
      }
      semMap[semester].classes[cid].labs.push(lab)
    })

    // Convert to sorted array of semesters (Current active semester on top)
    return Object.values(semMap).map(s => ({
      semester: s.semester,
      totalLabs: Object.values(s.classes).reduce((acc, c) => acc + c.labs.length, 0),
      classes: Object.values(s.classes)
    })).sort((a, b) => {
      // 1. Current active semester always first
      if (a.semester === currentSemester && b.semester !== currentSemester) return -1
      if (b.semester === currentSemester && a.semester !== currentSemester) return 1
      // 2. Unknown semester always last
      if (a.semester === 'unknown') return 1
      if (b.semester === 'unknown') return -1
      // 3. Otherwise reverse alphabetical
      return b.semester.localeCompare(a.semester)
    })
  }, [filteredLabs, classes, currentSemester])

  // Backward compatibility alias for single group
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
          semester: cls?.semester || 'unknown',
          labs: []
        }
      }
      groups[cid].labs.push(lab)
    })
    return Object.values(groups)
  }, [filteredLabs, classes])

  // Group all instructor's classes by semester for the Google Classroom Card Grid
  const groupedSemesterClasses = React.useMemo(() => {
    const semMap = {}
    classes.forEach(c => {
      const sem = c.semester || 'unknown'
      if (!semMap[sem]) {
        semMap[sem] = {
          semester: sem,
          classes: []
        }
      }
      semMap[sem].classes.push(c)
    })

    return Object.values(semMap).sort((a, b) => {
      if (a.semester === currentSemester && b.semester !== currentSemester) return -1
      if (b.semester === currentSemester && a.semester !== currentSemester) return 1
      if (a.semester === 'unknown') return 1
      if (b.semester === 'unknown') return -1
      return b.semester.localeCompare(a.semester)
    })
  }, [classes, currentSemester])

  const toggleClassGroup = (classId) => {
    setCollapsedClassGroups(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }))
  }

  const toggleSemesterGroup = (sem) => {
    setCollapsedSemesterGroups(prev => ({
      ...prev,
      [sem]: !prev[sem]
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

      {error && !showLabModal && !showCloneModal && !showExtensionModal && !showStudentModal && !showVmManagerModal && (
        <div className="plag-alert-banner" style={{ marginBottom: '20px' }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tab Navigation (Only shown if not in Speed Grader/grading view or student_grading view) */}
      {viewState !== 'grading' && viewState !== 'student_grading' && (
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px', marginBottom: '24px' }}>
          <button 
            onClick={() => {
              setViewState('dashboard')
              setSelectedClass(null)
              setSearchParams({})
            }} 
            className={`btn ${viewState === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <School size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            {selectedClass ? 'Class Hub' : 'My Classes & Labs'}
          </button>
          <button 
            onClick={() => {
              setViewState('analytics')
              const targetClassId = selectedClass ? selectedClass.id : (analyticsClassId || (classes.length > 0 ? classes[0].id : ''))
              if (targetClassId) {
                setAnalyticsClassId(targetClassId)
                fetchClassAnalytics(targetClassId, '')
                setSearchParams({ view: 'analytics', classId: targetClassId })
              } else {
                setSearchParams({ view: 'analytics' })
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
              const targetClassId = selectedClass ? selectedClass.id : (gradebookClassId || (classes.length > 0 ? classes[0].id : ''))
              if (targetClassId) {
                setGradebookClassId(targetClassId)
                fetchClassGradebook(targetClassId)
                setSearchParams({ view: 'gradebook', classId: targetClassId })
              } else {
                setSearchParams({ view: 'gradebook' })
              }
            }} 
            className={`btn ${viewState === 'gradebook' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <FileSpreadsheet size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            Gradebook & Export
          </button>
          
          <button 
            onClick={() => {
              setViewState('my_drive')
              fetchMyVmTools()
              setSearchParams({ view: 'my_drive' })
            }} 
            className={`btn ${viewState === 'my_drive' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <HardDrive size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
            My VM Drive Tools
          </button>
          
          <button 
            onClick={() => {
              if (viewState === 'my_drive') {
                fetchMyVmTools()
              } else {
                fetchData()
              }
            }} 
            className="btn btn-secondary" 
            style={{ marginLeft: 'auto', padding: '8px 12px' }}
            title="Refresh data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {/* VIEW 1: MAIN INSTRUCTOR DASHBOARD (GOOGLE CLASSROOM GRID OR SELECTED CLASS HUB) */}
      {viewState === 'dashboard' && (
        <div>
          {!selectedClass ? (
            /* ========================================================================= */
            /* MODE A: SEMESTER-GROUPED GOOGLE CLASSROOM CARD GRID                       */
            /* ========================================================================= */
            <div>
              {/* Header with Title, Semester Filter, Search Bar, and Create Lab CTA */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', margin: 0, fontWeight: '700' }}>Classes & Course Labs</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0 0' }}>
                    Select a class to manage its lab assignments, enroll students, view academic analytics, or export gradebook.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={openCreateLabModal} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: '13.5px', fontWeight: '600' }}>
                    <Plus size={16} style={{ marginRight: '6px' }} /> Design New Dynamic Lab
                  </button>
                </div>
              </div>

              {/* Filters Bar: Search & Semester selector */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                flexWrap: 'wrap', 
                marginBottom: '28px', 
                padding: '14px 18px', 
                background: '#ffffff', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color)', 
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ paddingLeft: '36px', margin: 0, background: '#f8fafc', fontSize: '13.5px' }}
                    placeholder="Search class by name, subject code, or description..."
                    value={classSearchQuery}
                    onChange={(e) => setClassSearchQuery(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {availableSemesters.length > 0 && (
                    <select 
                      className="form-select" 
                      style={{ width: '170px', margin: 0, background: '#f8fafc', fontWeight: '500' }}
                      value={labSemesterFilter}
                      onChange={(e) => setLabSemesterFilter(e.target.value)}
                      title="Filter by academic semester"
                    >
                      <option value="all">All Semesters</option>
                      {availableSemesters.map(sem => (
                        <option key={sem} value={sem}>{sem === 'unknown' ? 'Unknown Semester' : `Semester ${sem}`}</option>
                      ))}
                    </select>
                  )}

                  {availableSemesters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setHidePastSemesters(!hidePastSemesters)}
                      className={`btn ${hidePastSemesters ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '7px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Toggle hiding past semesters"
                    >
                      <Calendar size={14} />
                      {hidePastSemesters ? 'Active Sem Only' : 'Show All Sems'}
                    </button>
                  )}
                </div>
              </div>

              {/* Semester Groups Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {groupedSemesterClasses
                  .filter(semGroup => {
                    if (labSemesterFilter !== 'all' && semGroup.semester !== labSemesterFilter) return false
                    if (hidePastSemesters && semGroup.semester !== currentSemester && semGroup.semester !== 'unknown') return false
                    return true
                  })
                  .map(semGroup => {
                    const isSemCollapsed = !!collapsedSemesterGroups[semGroup.semester]
                    
                    // Filter classes within this semester by classSearchQuery
                    const matchingClasses = semGroup.classes.filter(c => {
                      if (!classSearchQuery) return true
                      const q = classSearchQuery.toLowerCase()
                      return (c.name && c.name.toLowerCase().includes(q)) || (c.description && c.description.toLowerCase().includes(q))
                    })

                    if (matchingClasses.length === 0) return null

                    // Palette colors for Google Classroom cards
                    const cardThemes = [
                      { grad: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#3b82f6' },
                      { grad: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#10b981' },
                      { grad: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#4b5563' },
                      { grad: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#ea580c' },
                      { grad: 'linear-gradient(135deg, #581c87 0%, #8b5cf6 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#8b5cf6' },
                      { grad: 'linear-gradient(135deg, #0f766e 0%, #06b6d4 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#06b6d4' }
                    ]

                    return (
                      <div 
                        key={semGroup.semester}
                        style={{ 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '16px', 
                          overflow: 'hidden', 
                          background: '#ffffff',
                          boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        {/* Semester Section Header */}
                        <div 
                          onClick={() => toggleSemesterGroup(semGroup.semester)}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '14px 20px', 
                            background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', 
                            cursor: 'pointer',
                            borderBottom: isSemCollapsed ? 'none' : '1px solid #e2e8f0',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isSemCollapsed ? <ChevronRight size={18} style={{ color: 'var(--neon-cyan)' }} /> : <ChevronDown size={18} style={{ color: 'var(--neon-cyan)' }} />}
                            <Calendar size={18} style={{ color: 'var(--neon-cyan)' }} />
                            <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
                              {semGroup.semester === 'unknown' ? 'Unknown Academic Semester' : `Semester: ${semGroup.semester}`}
                            </span>
                            {semGroup.semester === currentSemester && (
                              <span className="badge badge-submitted" style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 'bold' }}>
                                Current Active Term
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="badge badge-draft" style={{ fontSize: '12px', fontWeight: '600' }}>
                              {matchingClasses.length} {matchingClasses.length === 1 ? 'class' : 'classes'}
                            </span>
                          </div>
                        </div>

                        {/* Google Classroom Cards Grid for this Semester */}
                        {!isSemCollapsed && (
                          <div style={{ 
                            padding: '24px', 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', 
                            gap: '24px', 
                            background: '#f8fafc' 
                          }}>
                            {matchingClasses.map((cls, idx) => {
                              const theme = cardThemes[idx % cardThemes.length]
                              const classLabs = labs.filter(l => l.class_id === cls.id)
                              const enrolledCount = (cls.users || []).filter(u => u.role === 'student').length

                              return (
                                <div 
                                  key={cls.id}
                                  onClick={() => {
                                    fetchClassDetails(cls.id)
                                    setActiveClassTab('labs')
                                    setSearchParams({ classId: cls.id, tab: 'labs' })
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    borderRadius: '14px',
                                    border: '1px solid #e2e8f0',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.04)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    cursor: 'pointer',
                                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)'
                                    e.currentTarget.style.boxShadow = '0 10px 24px -4px rgba(0, 0, 0, 0.1)'
                                    e.currentTarget.style.borderColor = '#cbd5e1'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.04)'
                                    e.currentTarget.style.borderColor = '#e2e8f0'
                                  }}
                                >
                                  {/* Card Top Banner (Google Classroom colorful header) */}
                                  <div style={{
                                    background: theme.grad,
                                    padding: '18px 20px',
                                    color: '#ffffff',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    minHeight: '100px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ 
                                          fontSize: '18px', 
                                          fontWeight: '700', 
                                          margin: 0, 
                                          color: '#ffffff', 
                                          overflow: 'hidden', 
                                          textOverflow: 'ellipsis', 
                                          whiteSpace: 'nowrap' 
                                        }}>
                                          {cls.name}
                                        </h3>
                                        <span style={{ 
                                          fontSize: '12px', 
                                          color: 'rgba(255,255,255,0.85)', 
                                          marginTop: '3px', 
                                          display: 'inline-block',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: '100%'
                                        }}>
                                          {cls.description || 'Cybersecurity Practice Lab'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Semester Badge inside banner */}
                                    <div style={{ marginTop: '12px' }}>
                                      <span style={{
                                        background: theme.badgeBg,
                                        backdropFilter: 'blur(4px)',
                                        color: '#ffffff',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        padding: '3px 8px',
                                        borderRadius: '20px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}>
                                        📅 {cls.semester || 'unknown'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Card Body: Key Metrics */}
                                  <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                      <div style={{ 
                                        padding: '10px 12px', 
                                        background: '#f8fafc', 
                                        borderRadius: '8px', 
                                        border: '1px solid #f1f5f9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                      }}>
                                        <div style={{ color: theme.accent }}>
                                          <BookOpen size={18} />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{classLabs.length}</div>
                                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Lab Assignments</div>
                                        </div>
                                      </div>

                                      <div style={{ 
                                        padding: '10px 12px', 
                                        background: '#f8fafc', 
                                        borderRadius: '8px', 
                                        border: '1px solid #f1f5f9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                      }}>
                                        <div style={{ color: theme.accent }}>
                                          <Users size={18} />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{enrolledCount}</div>
                                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Enrolled Students</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Upcoming or latest lab status */}
                                    <div style={{ 
                                      fontSize: '12px', 
                                      color: 'var(--text-secondary)', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '6px',
                                      marginTop: 'auto',
                                      paddingTop: '6px'
                                    }}>
                                      <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                                      {classLabs.length > 0 ? (
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          Latest: <strong style={{ color: 'var(--text-primary)' }}>{classLabs[0].title}</strong>
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>No lab assignments created yet</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Card Footer: Quick Actions */}
                                  <div style={{ 
                                    padding: '10px 14px', 
                                    background: '#ffffff', 
                                    borderTop: '1px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', flex: 1 }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          fetchClassDetails(cls.id)
                                          setActiveClassTab('students')
                                          setSearchParams({ classId: cls.id, tab: 'students' })
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 7px', fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}
                                        title="Manage students in this class"
                                      >
                                        <Users size={12} style={{ marginRight: '3px' }} /> Students
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setAnalyticsClassId(cls.id)
                                          fetchClassAnalytics(cls.id, '')
                                          setViewState('analytics')
                                          setSearchParams({ view: 'analytics', classId: cls.id })
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 7px', fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}
                                        title="View Analytics for this class"
                                      >
                                        <BarChart3 size={12} style={{ marginRight: '3px' }} /> Analytics
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setGradebookClassId(cls.id)
                                          fetchClassGradebook(cls.id)
                                          setViewState('gradebook')
                                          setSearchParams({ view: 'gradebook', classId: cls.id })
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 7px', fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}
                                        title="View Gradebook for this class"
                                      >
                                        <FileSpreadsheet size={12} style={{ marginRight: '3px' }} /> Gradebook
                                      </button>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: theme.accent, fontWeight: '600', fontSize: '12px', flexShrink: 0 }}>
                                      <ArrowRight size={14} />
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                {classes.length === 0 && (
                  <div className="cyber-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <School size={48} style={{ opacity: 0.3, marginBottom: '12px', color: 'var(--neon-cyan)' }} />
                    <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>No Classes Assigned</h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>You are not currently assigned to any classes by the administrator.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* MODE B: UNIFIED CLASS HUB (SELECTED CLASS)                                */
            /* ========================================================================= */
            <div>
              {/* Back breadcrumb and Class Header */}
              <div className="cyber-card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClass(null)
                        setSearchParams({})
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12.5px', marginBottom: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1' }}
                    >
                      <ArrowLeft size={14} /> Back to All Classes
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', margin: 0, fontWeight: '700' }}>
                        {selectedClass.name}
                      </h2>
                      <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 'bold', padding: '4px 10px' }}>
                        📅 Semester: {selectedClass.semester || 'unknown'}
                      </span>
                    </div>

                    {selectedClass.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '6px 0 0 0' }}>
                        {selectedClass.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setClassId(selectedClass.id)
                        openCreateLabModal()
                      }}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: '600' }}
                    >
                      <Plus size={15} style={{ marginRight: '4px' }} /> Create Lab in this Class
                    </button>
                  </div>
                </div>

                {/* Sub-tabs within this Class: Labs, Students & Enrollment, Class Analytics, Gradebook */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '22px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClassTab('labs')
                      setSearchParams({ classId: selectedClass.id, tab: 'labs' })
                    }}
                    className={`btn ${activeClassTab === 'labs' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 16px', fontSize: '13px', fontWeight: activeClassTab === 'labs' ? '600' : '500' }}
                  >
                    <BookOpen size={15} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                    Labs ({labs.filter(l => l.class_id === selectedClass.id).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveClassTab('students')
                      setSearchParams({ classId: selectedClass.id, tab: 'students' })
                    }}
                    className={`btn ${activeClassTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 16px', fontSize: '13px', fontWeight: activeClassTab === 'students' ? '600' : '500' }}
                  >
                    <Users size={15} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                    Students & Enrollment ({(selectedClass.users || []).filter(u => u.role === 'student').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveClassTab('analytics')
                      setAnalyticsClassId(selectedClass.id)
                      setAnalyticsLabFilter('')
                      fetchClassAnalytics(selectedClass.id, '')
                      setSearchParams({ classId: selectedClass.id, tab: 'analytics' })
                    }}
                    className={`btn ${activeClassTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 16px', fontSize: '13px', fontWeight: activeClassTab === 'analytics' ? '600' : '500' }}
                  >
                    <BarChart3 size={15} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                    Class Analytics
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveClassTab('gradebook')
                      setGradebookClassId(selectedClass.id)
                      setSelectedStudentFilter([])
                      setSelectedLabFilter([])
                      setSelectedTagFilter([])
                      fetchClassGradebook(selectedClass.id)
                      setSearchParams({ classId: selectedClass.id, tab: 'gradebook' })
                    }}
                    className={`btn ${activeClassTab === 'gradebook' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 16px', fontSize: '13px', fontWeight: activeClassTab === 'gradebook' ? '600' : '500' }}
                  >
                    <FileSpreadsheet size={15} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                    Gradebook & Export
                  </button>
                </div>
              </div>

              {/* TAB CONTENT 1: LABS FOR THIS CLASS */}
              {activeClassTab === 'labs' && (
                <div className="cyber-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ fontSize: '18px', margin: 0, fontWeight: '600' }}>
                      Lab Assignments in {selectedClass.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          className="form-input"
                          style={{ paddingLeft: '32px', margin: 0, fontSize: '12.5px' }}
                          placeholder="Filter labs..."
                          value={labSearchQuery}
                          onChange={(e) => setLabSearchQuery(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={() => {
                          setClassId(selectedClass.id)
                          openCreateLabModal()
                        }}
                        className="btn btn-primary"
                        style={{ padding: '7px 14px', fontSize: '12.5px' }}
                      >
                        <Plus size={14} style={{ marginRight: '4px' }} /> New Lab
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const classLabs = labs
                      .filter(l => l.class_id === selectedClass.id)
                      .filter(l => {
                        if (!labSearchQuery) return true
                        const q = labSearchQuery.toLowerCase()
                        return (l.title && l.title.toLowerCase().includes(q)) || (l.description && l.description.toLowerCase().includes(q))
                      })

                    if (classLabs.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                          <BookOpen size={40} style={{ opacity: 0.3, marginBottom: '8px', color: 'var(--neon-cyan)' }} />
                          <p style={{ margin: 0 }}>No lab assignments found in this class yet.</p>
                          <button
                            onClick={() => {
                              setClassId(selectedClass.id)
                              openCreateLabModal()
                            }}
                            className="btn btn-primary"
                            style={{ marginTop: '12px', padding: '6px 14px', fontSize: '12.5px' }}
                          >
                            <Plus size={14} style={{ marginRight: '4px' }} /> Create First Lab
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div className="table-container" style={{ margin: 0 }}>
                        <table className="cyber-table">
                          <thead>
                            <tr>
                              <th>Lab Assignment</th>
                              <th>Deadline</th>
                              <th>Late Policy</th>
                              <th>VM Provision</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Actions & Grading</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classLabs.map(lab => (
                              <tr key={lab.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className="badge" style={{ background: '#e2e8f0', color: '#334155', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px' }}>
                                      ID #{lab.id}
                                    </span>
                                    <span style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>{lab.title}</span>
                                    <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontSize: '11px', fontWeight: '600', padding: '1px 6px' }}>
                                      🏷️ {lab.grade_tag || 'Default'}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                                  {formatLocalTime(lab.deadline)}
                                </td>
                                <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                  {lab.late_policy?.allow_late 
                                    ? `${lab.late_policy.penalty_per_hour_percent}%/h (max ${lab.late_policy.max_penalty_percent}%)` 
                                    : <span style={{ color: 'var(--text-muted)' }}>No late</span>}
                                </td>
                                <td>
                                  {lab.enable_vm !== false ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: lab.is_linked_clone ? '#0284c7' : '#d97706', fontFamily: 'var(--font-mono)' }}>
                                          {lab.is_linked_clone ? '⚡ Linked' : '📦 Full'}
                                        </span>
                                        {(lab.cpu_cores || lab.ram_mb) && (
                                          <span style={{ fontSize: '10.5px', background: '#f1f5f9', color: '#475569', padding: '1px 4px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                                            {lab.cpu_cores ? `${lab.cpu_cores}C` : ''}{lab.cpu_cores && lab.ram_mb ? ' / ' : ''}{lab.ram_mb ? `${Math.round(lab.ram_mb / 1024)}GB` : ''}
                                          </span>
                                        )}
                                      </div>
                                      {lab.is_exam_mode && (
                                        <span style={{ fontSize: '11px', color: '#be185d', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                          🎓 Exam Mode
                                        </span>
                                      )}
                                      {!lab.is_exam_mode && (lab.disable_vm_copy || lab.disable_vm_paste) && (
                                        <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                          🔒 {lab.disable_vm_copy && lab.disable_vm_paste ? 'No Copy/Paste' : lab.disable_vm_copy ? 'No Copy' : 'No Paste'}
                                        </span>
                                      )}
                                    </div>
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
                                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button 
                                      type="button"
                                      onClick={() => openLabPreview(lab)} 
                                      className="btn-icon btn-secondary" 
                                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}
                                      title="Preview Lab as Student (Test VM & Questions)"
                                    >
                                      <Eye size={15} />
                                    </button>
                                    {lab.enable_vm !== false && (
                                      <button 
                                        type="button"
                                        onClick={() => openVmManagerModal(lab)} 
                                        className="btn-icon btn-secondary" 
                                        style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}
                                        title="Manage & Purge Student VMs"
                                      >
                                        <Monitor size={15} />
                                      </button>
                                    )}
                                    <button 
                                      type="button"
                                      onClick={() => openCloneModal(lab)} 
                                      className="btn-icon btn-secondary" 
                                      style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}
                                      title="Clone lab assignment to another class"
                                    >
                                      <Copy size={15} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => openEditLabModal(lab)} 
                                      className="btn-icon btn-secondary" 
                                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                                      title="Edit Lab"
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleDeleteLab(lab.id, lab.title)} 
                                      className="btn-icon btn-danger" 
                                      title="Delete Lab"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => fetchSubmissions(lab)} 
                                      className="btn-icon btn-primary" 
                                      title="Grade Student Submissions"
                                    >
                                      <FileCheck size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* TAB CONTENT 2: STUDENTS & ENROLLMENT FOR THIS CLASS */}
              {activeClassTab === 'students' && (
                <div className="cyber-card">
                  {/* Grid for student assignment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
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

                  {/* Enrolled Students Table */}
                  {(() => {
                    const classStudents = (selectedClass.users || []).filter(u => u.role === 'student')
                    
                    return (
                      <div>
                        <h4 style={{ fontSize: '16px', marginBottom: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={16} />
                          Enrolled Students ({classStudents.length} students)
                        </h4>
                        <div className="table-container" style={{ margin: 0, maxHeight: '420px', overflowY: 'auto' }}>
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
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                                        <button 
                                          type="button"
                                          onClick={() => openStudentGrading(selectedClass, student)} 
                                          className="btn-icon btn-primary" 
                                          title="Grade all labs for this student"
                                        >
                                          <FileCheck size={14} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleOpenStudentModal(student)} 
                                          className="btn-icon btn-secondary" 
                                          title="Edit details"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleRemoveStudentFromClass(student.id)} 
                                          className="btn-icon btn-danger" 
                                          title="Remove from class"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
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
              )}

              {/* TAB CONTENT 3: CLASS ANALYTICS */}
              {activeClassTab === 'analytics' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Filter Lab:</label>
                      <select
                        className="form-select"
                        style={{ width: '240px', margin: 0, background: '#ffffff', fontWeight: '500' }}
                        value={analyticsLabFilter}
                        onChange={(e) => {
                          const lId = e.target.value
                          setAnalyticsLabFilter(lId)
                          fetchClassAnalytics(selectedClass.id, lId)
                        }}
                      >
                        <option value="">All Labs in {selectedClass.name}</option>
                        {labs
                          .filter(l => l.class_id === selectedClass.id)
                          .map(l => (
                            <option key={l.id} value={l.id}>
                              {l.title}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => fetchClassAnalytics(selectedClass.id, analyticsLabFilter)}
                        className="btn btn-secondary"
                        disabled={analyticsLoading}
                        style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        title="Refresh Analytics"
                      >
                        <RefreshCw size={13} className={analyticsLoading ? 'spin-slow' : ''} />
                        Refresh
                      </button>
                      <button
                        onClick={() => {
                          setAnalyticsClassId(selectedClass.id)
                          fetchClassAnalytics(selectedClass.id, '')
                          setViewState('analytics')
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        Open Full Workspace &rarr;
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* KPI Summary Metric Cards */}
                      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                        <div className="stat-card">
                          <div className="stat-icon-wrap" style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
                            <Users size={20} />
                          </div>
                          <div>
                            <div className="stat-number" style={{ color: '#1e293b' }}>{analyticsData.summary.total_students}</div>
                            <div className="stat-label">Enrolled Students</div>
                          </div>
                        </div>

                        <div className="stat-card">
                          <div className="stat-icon-wrap" style={{ background: 'rgba(242, 112, 36, 0.08)', color: 'var(--neon-cyan)' }}>
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <div className="stat-number" style={{ color: '#1e293b' }}>
                              {analyticsData.selected_lab ? '1' : analyticsData.summary.total_labs}
                            </div>
                            <div className="stat-label">
                              {analyticsData.selected_lab ? `Selected: ${analyticsData.selected_lab.title}` : 'Assigned Labs'}
                            </div>
                          </div>
                        </div>

                        <div className="stat-card">
                          <div className="stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#059669' }}>
                            <Monitor size={20} />
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

                        <div className="stat-card">
                          <div className="stat-icon-wrap" style={{ background: 'rgba(147, 51, 234, 0.08)', color: '#9333ea' }}>
                            <TrendingUp size={20} />
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

                        <div className="stat-card">
                          <div className="stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#d97706' }}>
                            <Award size={20} />
                          </div>
                          <div>
                            <div className="stat-number" style={{ color: '#1e293b' }}>
                              {analyticsData.summary.average_score !== null ? analyticsData.summary.average_score : '—'}
                            </div>
                            <div className="stat-label">
                              Class Avg Score ({analyticsData.summary.total_graded} graded)
                            </div>
                          </div>
                        </div>

                        <div className="stat-card">
                          <div className="stat-icon-wrap" style={{ background: 'rgba(13, 148, 136, 0.08)', color: '#0d9488' }}>
                            <Clock size={20} />
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

                      {/* Charts - Grade Distribution & Lab Performance */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 35%) 1fr', gap: '18px' }}>
                        {/* Chart 1: Grade Distribution */}
                        <div className="cyber-card">
                          <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Award size={16} style={{ color: 'var(--neon-cyan)' }} />
                            Grade Distribution
                          </h4>

                          {analyticsData.summary.total_graded === 0 ? (
                            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                              No submissions have been graded yet.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '6px' }}>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{bar.label}</span>
                                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                                        {bar.count} ({pct}%)
                                      </span>
                                    </div>
                                    <div style={{ height: '8px', width: '100%', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div 
                                        style={{ 
                                          height: '100%', 
                                          width: `${pct}%`, 
                                          background: bar.color, 
                                          borderRadius: '4px',
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
                          <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} style={{ color: 'var(--neon-cyan)' }} />
                            Lab-by-Lab Performance
                          </h4>

                          <div className="table-container" style={{ margin: 0, maxHeight: '260px', overflowY: 'auto' }}>
                            <table className="cyber-table" style={{ fontSize: '12px' }}>
                              <thead>
                                <tr>
                                  <th>Lab Title</th>
                                  <th>Submission Progress</th>
                                  <th>Avg Score</th>
                                  <th>VM Status</th>
                                  <th>Similarity</th>
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
                                      <td style={{ minWidth: '120px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${lab.submission_rate}%`, background: 'var(--neon-cyan)' }} />
                                          </div>
                                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lab.submitted_count}/{lab.total_students}</span>
                                        </div>
                                      </td>
                                      <td style={{ fontWeight: '700', color: lab.average_score !== null && lab.average_score >= 8 ? '#059669' : lab.average_score >= 5 ? '#d97706' : '#dc2626' }}>
                                        {lab.average_score !== null ? lab.average_score : '—'}
                                      </td>
                                      <td>
                                        <span className={`badge ${lab.running_vms > 0 ? 'badge-submitted' : 'badge-draft'}`} style={{ fontSize: '10.5px' }}>
                                          {lab.running_vms} running
                                        </span>
                                      </td>
                                      <td>
                                        {lab.flagged_similarity_count > 0 ? (
                                          <span style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                            <AlertTriangle size={12} /> {lab.flagged_similarity_count}
                                          </span>
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>0</span>
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
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 4: GRADEBOOK & EXPORT */}
              {activeClassTab === 'gradebook' && (
                <div>
                  {gradebookLoading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={32} className="spin-slow" style={{ color: '#10b981', marginBottom: '12px' }} />
                      <p style={{ fontSize: '14px' }}>Loading gradebook matrix...</p>
                    </div>
                  ) : !gradebookData ? (
                    <div className="cyber-card" style={{ textAlign: 'center', padding: '50px' }}>
                      <School size={48} style={{ opacity: 0.25, color: '#10b981', marginBottom: '12px' }} />
                      <p style={{ color: 'var(--text-muted)' }}>No gradebook records available for this class.</p>
                    </div>
                  ) : (() => {
                    const visibleLabs = (gradebookData.labs || []).filter(l => selectedLabFilter.length === 0 || selectedLabFilter.includes(l.id))
                    const visibleTags = (gradebookData.tags || []).filter(t => selectedTagFilter.length === 0 || selectedTagFilter.includes(t))
                    const filteredRows = (gradebookData.rows || []).filter(r => selectedStudentFilter.length === 0 || selectedStudentFilter.includes(r.student_id))

                    return (
                      <div>
                        {/* Control Bar: Mode Toggle & Export Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                          {/* View Mode Toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>View Mode:</span>
                            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                              <button
                                type="button"
                                onClick={() => setGradebookViewMode('labs')}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '5px',
                                  border: 'none',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  background: gradebookViewMode === 'labs' ? '#ffffff' : 'transparent',
                                  color: gradebookViewMode === 'labs' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                                  boxShadow: gradebookViewMode === 'labs' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                              >
                                📄 By Labs ({gradebookData?.labs?.length || 0})
                              </button>
                              <button
                                type="button"
                                onClick={() => setGradebookViewMode('tags')}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '5px',
                                  border: 'none',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  background: gradebookViewMode === 'tags' ? '#ffffff' : 'transparent',
                                  color: gradebookViewMode === 'tags' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                                  boxShadow: gradebookViewMode === 'tags' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                              >
                                🏷️ By Grade Tags ({gradebookData?.tags?.length || 0})
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => exportGradebookToCSV(filteredRows, visibleLabs, visibleTags, gradebookViewMode)}
                              className="btn btn-secondary"
                              disabled={gradebookLoading || !gradebookData}
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Download size={13} /> Export CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => fetchClassGradebook(selectedClass.id)}
                              className="btn btn-secondary"
                              disabled={gradebookLoading}
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              title="Refresh Gradebook"
                            >
                              <RefreshCw size={13} className={gradebookLoading ? 'spin-slow' : ''} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGradebookClassId(selectedClass.id)
                                fetchClassGradebook(selectedClass.id)
                                setViewState('gradebook')
                              }}
                              className="btn btn-secondary"
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              Open Full Workspace &rarr;
                            </button>
                          </div>
                        </div>

                        {/* Gradebook Matrix Table */}
                        <div className="cyber-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div className="table-container" style={{ margin: 0, maxHeight: '420px', overflowX: 'auto', overflowY: 'auto' }}>
                          <table className="cyber-table" style={{ fontSize: '12.5px' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                              <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                <th style={{ minWidth: '170px', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 11 }}>Student</th>
                                <th style={{ minWidth: '100px' }}>ID</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>Progress</th>
                                {gradebookViewMode === 'labs' ? (
                                  visibleLabs.map(lab => (
                                    <th key={lab.id} style={{ minWidth: '110px', textAlign: 'center' }}>
                                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lab.title}>
                                        {lab.title}
                                      </div>
                                    </th>
                                  ))
                                ) : (
                                  visibleTags.map(tag => (
                                    <th key={tag} style={{ minWidth: '110px', textAlign: 'center' }}>
                                      🏷️ {tag}
                                    </th>
                                  ))
                                )}
                                <th style={{ width: '80px', textAlign: 'center', background: '#ecfdf5', color: '#047857' }}>GPA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRows.length === 0 ? (
                                <tr>
                                  <td colSpan={5 + (gradebookViewMode === 'labs' ? visibleLabs.length : visibleTags.length)} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                                    No student rows matching the selected filters.
                                  </td>
                                </tr>
                              ) : (
                                filteredRows.map((row, rIdx) => (
                                  <tr key={row.student_id}>
                                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{rIdx + 1}</td>
                                    <td style={{ fontWeight: '600', color: 'var(--text-primary)', position: 'sticky', left: 0, background: '#ffffff', boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.full_name}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const studentObj = (selectedClass?.users || []).find(u => u.id === row.student_id) || { id: row.student_id, full_name: row.full_name, username: row.username, role: 'student' }
                                            openStudentGrading(selectedClass, studentObj)
                                          }}
                                          className="btn btn-secondary"
                                          style={{ padding: '2px 5px', fontSize: '10.5px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                          title={`Grade all labs for ${row.full_name}`}
                                        >
                                          <FileCheck size={11} style={{ color: 'var(--neon-cyan)' }} />
                                        </button>
                                      </div>
                                    </td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>{row.username}</td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span style={{ fontWeight: '600', color: row.completed_labs === (gradebookData.labs?.length || 0) ? '#10b981' : 'var(--text-secondary)' }}>
                                        {row.completed_labs}/{gradebookData.labs?.length || 0}
                                      </span>
                                    </td>

                                    {gradebookViewMode === 'labs' ? (
                                      visibleLabs.map(lab => {
                                        const grade = row.grades[String(lab.id)]
                                        if (!grade || grade.status === 'not_submitted') {
                                          return (
                                            <td key={lab.id} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                                              <span style={{ opacity: 0.5 }}>—</span>
                                            </td>
                                          )
                                        }
                                        if (grade.status === 'submitted') {
                                          return (
                                            <td key={lab.id} style={{ textAlign: 'center' }}>
                                              <span className="badge badge-submitted" style={{ fontSize: '10px' }}>
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
                                                fontSize: '12.5px',
                                                color: sc >= 8 ? '#059669' : sc >= 5 ? '#d97706' : '#dc2626' 
                                              }}>
                                                {sc}
                                              </span>
                                              {grade.late_penalty > 0 && (
                                                <span style={{ fontSize: '9.5px', color: '#dc2626', display: 'block' }}>
                                                  (-{grade.late_penalty}%)
                                                </span>
                                              )}
                                            </td>
                                          )
                                        }
                                        return (
                                          <td key={lab.id} style={{ textAlign: 'center', fontSize: '11px' }}>
                                            <span className="badge badge-draft" style={{ fontSize: '10px' }}>
                                              {grade.status}
                                            </span>
                                          </td>
                                        )
                                      })
                                    ) : (
                                      visibleTags.map(tag => {
                                        const tagInfo = row.tag_grades?.[tag]
                                        if (!tagInfo || tagInfo.average_score === null) {
                                          return (
                                            <td key={tag} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                                              <span style={{ opacity: 0.5 }}>—</span>
                                            </td>
                                          )
                                        }
                                        const sc = tagInfo.average_score
                                        return (
                                          <td key={tag} style={{ textAlign: 'center' }}>
                                            <span style={{ 
                                              fontWeight: '700', 
                                              fontSize: '12.5px',
                                              color: sc >= 8 ? '#059669' : sc >= 5 ? '#d97706' : '#dc2626' 
                                            }}>
                                              {sc}
                                            </span>
                                            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block' }}>
                                              ({tagInfo.completed_count} labs)
                                            </span>
                                          </td>
                                        )
                                      })
                                    )}

                                    <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '13px', color: row.average_score >= 8 ? '#059669' : row.average_score >= 5 ? '#d97706' : '#dc2626' }}>
                                      {row.average_score !== null ? row.average_score : '—'}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
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
              {/* Semester Filter */}
              {availableSemesters.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Semester:</label>
                  <select
                    className="form-select"
                    style={{ width: '160px', margin: 0, background: '#ffffff', fontWeight: '500' }}
                    value={analyticsSemesterFilter}
                    onChange={(e) => {
                      const sem = e.target.value
                      setAnalyticsSemesterFilter(sem)
                      const matchingClasses = classes.filter(c => sem === 'all' || (c.semester || 'unknown') === sem)
                      if (matchingClasses.length > 0 && !matchingClasses.some(c => c.id === analyticsClassId)) {
                        setAnalyticsClassId(matchingClasses[0].id)
                        setAnalyticsLabFilter('')
                        fetchClassAnalytics(matchingClasses[0].id, '')
                      }
                    }}
                  >
                    <option value="all">All Semesters</option>
                    {availableSemesters.map(sem => (
                      <option key={sem} value={sem}>{sem === 'unknown' ? 'Unknown Semester' : `Semester ${sem}`}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Class:</label>
                <select
                  className="form-select"
                  style={{ width: '220px', margin: 0, background: '#ffffff', fontWeight: '500' }}
                  value={analyticsClassId}
                  onChange={(e) => {
                    const cId = parseInt(e.target.value)
                    setAnalyticsClassId(cId)
                    setAnalyticsLabFilter('') // reset lab filter when switching class
                    fetchClassAnalytics(cId, '')
                  }}
                >
                  {classes
                    .filter(c => analyticsSemesterFilter === 'all' || (c.semester || 'unknown') === analyticsSemesterFilter)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.semester && c.semester !== 'unknown' ? `(${c.semester})` : ''}
                      </option>
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
                        <th style={{ textAlign: 'right' }}>Actions</th>
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
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const matchedClass = classes.find(c => c.id === analyticsClassId)
                                  const studentObj = (matchedClass?.users || []).find(u => u.id === st.student_id) || { id: st.student_id, full_name: st.full_name, username: st.username, role: 'student' }
                                  if (matchedClass) {
                                    openStudentGrading(matchedClass, studentObj)
                                  }
                                }}
                                className="btn-icon btn-primary"
                                title={`Grade all labs for ${st.full_name}`}
                              >
                                <FileCheck size={14} />
                              </button>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Semester Filter */}
                {availableSemesters.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Semester:</label>
                    <select
                      className="form-select"
                      style={{ width: '160px', margin: 0, background: '#ffffff', fontWeight: '500' }}
                      value={gradebookSemesterFilter}
                      onChange={(e) => {
                        const sem = e.target.value
                        setGradebookSemesterFilter(sem)
                        const matchingClasses = classes.filter(c => sem === 'all' || (c.semester || 'unknown') === sem)
                        if (matchingClasses.length > 0 && !matchingClasses.some(c => c.id === gradebookClassId)) {
                          const newCId = matchingClasses[0].id
                          setGradebookClassId(newCId)
                          setSelectedStudentFilter([])
                          setSelectedLabFilter([])
                          setSelectedTagFilter([])
                          fetchClassGradebook(newCId)
                        }
                      }}
                    >
                      <option value="all">All Semesters</option>
                      {availableSemesters.map(sem => (
                        <option key={sem} value={sem}>{sem === 'unknown' ? 'Unknown Semester' : `Semester ${sem}`}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      setSelectedTagFilter([])
                      fetchClassGradebook(cId)
                    }}
                  >
                    {classes
                      .filter(c => gradebookSemesterFilter === 'all' || (c.semester || 'unknown') === gradebookSemesterFilter)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.semester && c.semester !== 'unknown' ? `(${c.semester})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

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

            {/* Filter Section: Multi-Select Students & Multi-Select Labs / Tags */}
            {gradebookData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                
                {/* Mode Selector Toggle: View by Labs vs View by Grade Category Tags */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>View Mode:</span>
                    <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                      <button
                        type="button"
                        onClick={() => setGradebookViewMode('labs')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '5px',
                          border: 'none',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: gradebookViewMode === 'labs' ? '#ffffff' : 'transparent',
                          color: gradebookViewMode === 'labs' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                          boxShadow: gradebookViewMode === 'labs' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        📄 Detailed by Labs ({gradebookData.labs.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGradebookViewMode('tags')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '5px',
                          border: 'none',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: gradebookViewMode === 'tags' ? '#ffffff' : 'transparent',
                          color: gradebookViewMode === 'tags' ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                          boxShadow: gradebookViewMode === 'tags' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        🏷️ Aggregated by Grade Category Tags ({gradebookData.tags?.length || 0})
                      </button>
                    </div>
                  </div>

                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {gradebookViewMode === 'tags' 
                      ? '⚡ Averaging scores of all labs assigned under the same category tag (e.g. "Assignment 1", "Homework", "Default").' 
                      : '⚡ Showing raw individual scores and late penalty deductions for every single lab.'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Mode-specific Multi-Filter: Labs vs Tags */}
                  {gradebookViewMode === 'labs' ? (
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
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '85px', overflowY: 'auto', padding: '4px 0' }}>
                        {gradebookData.labs.map(l => {
                          const isSelected = selectedLabFilter.length === 0 || selectedLabFilter.includes(l.id)
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => {
                                if (selectedLabFilter.length === 0) {
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
                              {l.title} {l.grade_tag && <span style={{ opacity: 0.75 }}>({l.grade_tag})</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Award size={14} style={{ color: '#059669' }} />
                          Filter Grade Category Tags ({selectedTagFilter.length > 0 ? `${selectedTagFilter.length}/${(gradebookData.tags || []).length} selected` : 'All Categories'})
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            type="button" 
                            onClick={() => setSelectedTagFilter([])}
                            style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', fontSize: '11.5px', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Select All
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setSelectedTagFilter(gradebookData.tags || [])}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11.5px', cursor: 'pointer' }}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '85px', overflowY: 'auto', padding: '4px 0' }}>
                        {(gradebookData.tags || []).map(tag => {
                          const isSelected = selectedTagFilter.length === 0 || selectedTagFilter.includes(tag)
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (selectedTagFilter.length === 0) {
                                  setSelectedTagFilter([tag])
                                } else if (selectedTagFilter.includes(tag)) {
                                  const next = selectedTagFilter.filter(t => t !== tag)
                                  setSelectedTagFilter(next.length === 0 ? [] : next)
                                } else {
                                  setSelectedTagFilter([...selectedTagFilter, tag])
                                }
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '16px',
                                fontSize: '11.5px',
                                cursor: 'pointer',
                                border: isSelected ? '1px solid #059669' : '1px solid #cbd5e1',
                                background: isSelected ? 'rgba(16, 185, 129, 0.1)' : '#f8fafc',
                                color: isSelected ? '#059669' : 'var(--text-secondary)',
                                fontWeight: isSelected ? '600' : 'normal',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              🏷️ {tag}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

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

            // Determine visible tags
            const visibleTags = (gradebookData.tags || []).filter(t => 
              selectedTagFilter.length === 0 || selectedTagFilter.includes(t)
            )

            // Determine visible student rows
            const filteredRows = gradebookData.rows.filter(st => {
              if (selectedStudentFilter.length > 0 && !selectedStudentFilter.includes(st.username)) {
                return false
              }
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
                      {gradebookViewMode === 'tags' 
                        ? `Showing ${filteredRows.length} students across ${visibleTags.length} grade categories` 
                        : `Showing ${filteredRows.length} students across ${visibleLabs.length} labs`}
                    </span>
                    {(selectedLabFilter.length > 0 || selectedTagFilter.length > 0 || selectedStudentFilter.length > 0 || gradebookStudentSearch) && (
                      <span className="badge badge-submitted" style={{ fontSize: '11px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                        Filters active
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => exportGradebookToCSV(filteredRows, visibleLabs, visibleTags, gradebookViewMode)}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
                      title={`Export currently viewed ${gradebookViewMode === 'tags' ? 'grade categories' : 'labs'} table to CSV file`}
                    >
                      <Download size={15} />
                      {gradebookViewMode === 'tags' ? 'EXPORT BY GRADE TAGS (.csv)' : 'EXPORT FULL LABS (.csv)'}
                    </button>
                  </div>
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
                        
                        {/* Dynamic Column Headers depending on Mode */}
                        {gradebookViewMode === 'labs' ? (
                          visibleLabs.map(lab => (
                            <th key={lab.id} style={{ minWidth: '110px', textAlign: 'center' }} title={`${lab.title} (Tag: ${lab.grade_tag})`}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', margin: '0 auto' }}>
                                {lab.title}
                              </div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal', display: 'block' }}>
                                [{lab.grade_tag}]
                              </span>
                            </th>
                          ))
                        ) : (
                          visibleTags.map(tag => (
                            <th key={tag} style={{ minWidth: '120px', textAlign: 'center' }} title={`Grade Category: ${tag}`}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', margin: '0 auto', color: '#059669', fontWeight: '700' }}>
                                🏷️ {tag}
                              </div>
                              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 'normal', display: 'block' }}>
                                Avg Score
                              </span>
                            </th>
                          ))
                        )}

                        <th style={{ minWidth: '100px', textAlign: 'center', fontWeight: '700', color: 'var(--neon-cyan)' }}>
                          GPA
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={5 + (gradebookViewMode === 'labs' ? visibleLabs.length : visibleTags.length)} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No student matches the specified filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, rIdx) => (
                          <tr key={row.student_id}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{rIdx + 1}</td>
                            <td style={{ fontWeight: '600', color: 'var(--text-primary)', position: 'sticky', left: 0, background: '#ffffff', boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <span>{row.full_name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matchedClass = classes.find(c => c.id === gradebookClassId)
                                    const studentObj = (matchedClass?.users || []).find(u => u.id === row.student_id) || { id: row.student_id, full_name: row.full_name, username: row.username, role: 'student' }
                                    if (matchedClass) {
                                      openStudentGrading(matchedClass, studentObj)
                                    }
                                  }}
                                  className="btn-icon-sm btn-secondary"
                                  title={`Grade all labs for ${row.full_name}`}
                                >
                                  <FileCheck size={13} style={{ color: 'var(--neon-cyan)' }} />
                                </button>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{row.username}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: '600', color: row.completed_labs === (gradebookData.labs?.length || 0) ? '#10b981' : 'var(--text-secondary)' }}>
                                {row.completed_labs}/{gradebookData.labs?.length || 0}
                              </span>
                            </td>

                            {/* Columns depending on Mode: Individual Labs vs Category Tags */}
                            {gradebookViewMode === 'labs' ? (
                              visibleLabs.map(lab => {
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
                              })
                            ) : (
                              visibleTags.map(tag => {
                                const tagInfo = row.tag_grades?.[tag]
                                if (!tagInfo || tagInfo.average_score === null) {
                                  return (
                                    <td key={tag} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                                      <span style={{ opacity: 0.5 }}>—</span>
                                    </td>
                                  )
                                }
                                const sc = tagInfo.average_score
                                return (
                                  <td key={tag} style={{ textAlign: 'center' }}>
                                    <span style={{ 
                                      fontWeight: '700', 
                                      fontSize: '13.5px',
                                      color: sc >= 8 ? '#059669' : sc >= 5 ? '#d97706' : '#dc2626' 
                                    }}>
                                      {sc}
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                                      ({tagInfo.completed_count} labs)
                                    </span>
                                  </td>
                                )
                              })
                            )}

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

      {/* VIEW 5: MY VM DRIVE TOOLS (LECTURER PRIVATE DRIVE D:\ & COMMON DRIVE D:\) */}
      {viewState === 'my_drive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div className="cyber-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <HardDrive size={22} style={{ color: 'var(--neon-cyan)' }} />
                  VM Drive Tools Management
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: 0, maxWidth: '780px', lineHeight: 1.5 }}>
                  Manage toolkits, malware samples, reverse engineering tools, or exercise scripts. 
                  You can upload files directly into your <b>Private Workspace</b> (isolated from other instructors) or into the <b>Common Drive D:</b> (global shared drive accessible across all default lab environments).
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => fetchMyVmTools(myVmToolScope)} 
                className="btn btn-secondary" 
                style={{ padding: '8px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={loadingMyVmTools}
              >
                <RefreshCw size={14} className={loadingMyVmTools ? 'spin-slow' : ''} />
                Refresh Files
              </button>
            </div>
          </div>

          {/* Scope Selector Bar: Private Workspace vs Common Drive */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap', 
            gap: '12px', 
            padding: '12px 18px', 
            background: '#ffffff', 
            borderRadius: '10px', 
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>Storage Workspace:</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMyVmToolScope('private')
                    fetchMyVmTools('private')
                  }}
                  className={`btn ${myVmToolScope === 'private' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <HardDrive size={15} /> My Private Workspace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMyVmToolScope('common')
                    fetchMyVmTools('common')
                  }}
                  className={`btn ${myVmToolScope === 'common' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Globe size={15} /> Common Drive D: (Global)
                </button>
              </div>
            </div>

            <div>
              {myVmToolScope === 'private' ? (
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', padding: '4px 10px', fontWeight: '600' }}>
                  🔒 Private Workspace (Only visible to you & attached labs)
                </span>
              ) : (
                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: '11px', padding: '4px 10px', fontWeight: '600' }}>
                  🌐 Common Shared Drive D:\ (Packaged into tools-1001.iso)
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '24px', alignItems: 'flex-start' }}>
            {/* Upload Card */}
            <div className="cyber-card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} style={{ color: 'var(--neon-cyan)' }} />
                Upload to {myVmToolScope === 'private' ? 'Private Drive' : 'Common Drive D:'}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                {myVmToolScope === 'private'
                  ? 'Files uploaded here are stored in your personal isolated folder on Proxmox and can be attached to custom lab environments.'
                  : 'Files uploaded here will be placed in the global tools folder and automatically rebuilt into tools-1001.iso for all student VMs.'
                }
              </p>

              <form onSubmit={handleUploadMyVmTool}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <input
                    type="file"
                    id="myVmToolFileInput"
                    className="form-input"
                    style={{ padding: '8px', fontSize: '12.5px' }}
                    onChange={(e) => setMyVmToolFileToUpload(e.target.files[0] || null)}
                    disabled={myVmToolUploading}
                  />
                  {myVmToolFileToUpload && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Selected: {myVmToolFileToUpload.name} ({(myVmToolFileToUpload.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={!myVmToolFileToUpload || myVmToolUploading}
                >
                  {myVmToolUploading ? (
                    <>
                      <RefreshCw size={15} className="spin-slow" /> Uploading to {myVmToolScope === 'private' ? 'Private Drive' : 'Common Drive'}...
                    </>
                  ) : (
                    <>
                      <Upload size={15} /> Upload to {myVmToolScope === 'private' ? 'My Drive' : 'Common Drive D:'}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Files List Table */}
            <div className="cyber-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} style={{ color: 'var(--neon-cyan)' }} />
                    {myVmToolScope === 'private' ? 'Private Files' : 'Common Drive D: Files'} ({myVmTools.length} {myVmTools.length === 1 ? 'file' : 'files'})
                  </h4>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {myVmToolScope === 'private' ? 'Isolated workspace on Proxmox hypervisor' : 'Global Drive D: storage on Proxmox hypervisor'}
                  </span>
                </div>
                <span className="badge badge-submitted" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  Total: {(myVmTools.reduce((acc, f) => acc + (f.size_bytes || 0), 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              <div className="table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      {myVmToolScope === 'common' && <th>Uploaded By (Owner)</th>}
                      <th>Last Modified</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myVmTools.map((file, idx) => {
                      const isZip = file.filename.endsWith('.zip') || file.filename.endsWith('.rar') || file.filename.endsWith('.7z')
                      const isExe = file.filename.endsWith('.exe') || file.filename.endsWith('.msi')
                      const sizeMb = (file.size_bytes / (1024 * 1024)).toFixed(2)
                      const canDel = file.can_delete !== false
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
                          {myVmToolScope === 'common' && (
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
                            {canDel ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteMyVmTool(file.filename)}
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', color: 'var(--neon-ruby)', borderColor: 'rgba(255, 8, 68, 0.3)', fontSize: '12px' }}
                                title={`Delete file from ${myVmToolScope === 'private' ? 'private drive' : 'common drive'}`}
                                disabled={actionLoading}
                              >
                                <Trash2 size={13} style={{ marginRight: '4px' }} /> Delete
                              </button>
                            ) : (
                              <span 
                                title="You cannot delete files uploaded by other instructors or administrators" 
                                style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'not-allowed' }}
                              >
                                <Lock size={12} /> Protected
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {myVmTools.length === 0 && (
                      <tr>
                        <td colSpan={myVmToolScope === 'common' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px 16px' }}>
                          <HardDrive size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                          <div>No files found in {myVmToolScope === 'private' ? 'your private drive' : 'Common Drive D:'}.</div>
                          <div style={{ fontSize: '12px', marginTop: '4px' }}>Upload your custom tools or malware samples using the panel on the left.</div>
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

      {/* VIEW 2: SUBMISSIONS LIST & SPEED GRADER VIEW */}
      {viewState === 'grading' && selectedLab && (
        <div>
          {/* Back Navigation Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button 
              onClick={() => { 
                setViewState('dashboard'); 
                setActiveSubmission(null); 
                if (selectedLab && selectedLab.class_id) {
                  setSearchParams({ classId: selectedLab.class_id, tab: 'labs' })
                } else if (selectedClass) {
                  setSearchParams({ classId: selectedClass.id, tab: 'labs' })
                } else {
                  setSearchParams({})
                }
              }} 
              className="btn btn-secondary" 
              style={{ padding: '8px 12px' }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div>
              <h2 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{selectedLab.title}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Lab Report Grading</p>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => { setModalError(''); setShowExtensionModal(true); }} className="btn btn-secondary">
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
                          {activeSubmission.status === 'draft' ? (Object.keys(activeSubmission.answers || {}).length === 0 ? 'Not Submitted' : 'Draft') :
                           activeSubmission.status === 'submitted' ? 'Submitted' :
                           activeSubmission.status === 'graded' ? `Graded: ${activeSubmission.score}/10` : 'Resubmit Requested'}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', margin: '4px 0 0 0' }}>
                        Student ID: {activeSubmission.student?.username} | Submitted: {formatLocalTime(activeSubmission.submitted_at)}
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
                          {submissions.map((sub, idx) => {
                            const subStatusLabel = sub.status === 'graded' 
                              ? `[${sub.score}/10]` 
                              : sub.status === 'submitted' 
                                ? '[Submitted]' 
                                : Object.keys(sub.answers || {}).length === 0 
                                  ? '[Not Submitted]' 
                                  : '[Draft]';
                            return (
                              <option key={sub.id} value={idx}>
                                {idx + 1}. {sub.student?.full_name} ({sub.student?.username}) - {subStatusLabel}
                              </option>
                            );
                          })}
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

                  {/* In-VM Exam Report & Attachments Display (Especially when lab has 0 form fields) */}
                  {(selectedLab.is_exam_mode || (!selectedLab.form_fields || selectedLab.form_fields.length === 0)) && (
                    <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={18} style={{ color: 'var(--neon-cyan)' }} />
                          <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, fontWeight: '600' }}>
                            {selectedLab.is_exam_mode ? 'In-VM Exam Report & Workspace Submissions' : 'Student Submission Attachments'}
                          </h4>
                        </div>
                        {activeSubmission.file_attachments && activeSubmission.file_attachments.length > 0 && (
                          <span className="badge badge-submitted" style={{ fontSize: '11px' }}>
                            {activeSubmission.file_attachments.length} File(s)
                          </span>
                        )}
                      </div>

                      {activeSubmission.file_attachments && activeSubmission.file_attachments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {activeSubmission.file_attachments.map((attachment, attIdx) => {
                            const fname = attachment.original_filename || 'Attachment'
                            const ext = (fname || '').split('.').pop().toLowerCase()
                            const isDocx = ext === 'docx'
                            const isZip = ext === 'zip'
                            const isCode = ['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log'].includes(ext)
                            const canPreview = ['pdf', 'docx', 'png', 'jpg', 'jpeg', ...['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log']].includes(ext)

                            return (
                              <div 
                                key={attIdx} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between', 
                                  padding: '12px 14px', 
                                  background: isDocx ? '#eff6ff' : '#ffffff', 
                                  borderRadius: '6px', 
                                  border: isDocx ? '1.5px solid #3b82f6' : '1px solid var(--border-color)' 
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
                                  {isDocx ? (
                                    <FileText size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
                                  ) : isZip ? (
                                    <Archive size={18} style={{ color: 'var(--neon-amber)', flexShrink: 0 }} />
                                  ) : (
                                    <FileText size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                  )}
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontWeight: '600', color: isDocx ? '#1d4ed8' : 'var(--text-primary)', wordBreak: 'break-all', fontSize: '13.5px' }}>
                                        {fname}
                                      </span>
                                      {isDocx && (
                                        <span className="badge" style={{ background: '#2563eb', color: '#ffffff', fontSize: '10px', padding: '1px 6px' }}>
                                          WORD REPORT
                                        </span>
                                      )}
                                      {isZip && (
                                        <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '10px', padding: '1px 6px' }}>
                                          WORKSPACE ZIP
                                        </span>
                                      )}
                                    </div>
                                    {attachment.uploaded_at && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Received: {formatLocalTime(attachment.uploaded_at)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                                  {canPreview && (
                                    <button 
                                      type="button" 
                                      onClick={() => handleOpenDocPreview(attachment)} 
                                      className="btn btn-primary" 
                                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                                    >
                                      <Eye size={14} /> Preview
                                    </button>
                                  )}
                                  <a 
                                    href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&download=true&token=${localStorage.getItem('malsec_token')}`} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    target="_blank" 
                                    rel="noreferrer"
                                  >
                                    <Download size={13} /> Download
                                  </a>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No files received from student VM workspace yet.
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedLab.form_fields || []).map((field) => {
                    const ans = (activeSubmission.answers || {})[field.id] || ''
                    const fieldAttachments = (activeSubmission.file_attachments || []).filter(a => a.field_id === field.id)

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

                        {/* FILE ATTACHMENTS (IMAGE, CODE, DOCX, PDF, ZIP) */}
                        {field.type === 'file' && (
                          <div>
                            {fieldAttachments.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {fieldAttachments.map((attachment, attIdx) => {
                                  const ext = (attachment.original_filename || '').split('.').pop().toLowerCase();
                                  const isCode = ['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log'].includes(ext);

                                  return (
                                    <div key={attIdx} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {isCode ? <Code size={15} style={{ color: 'var(--neon-amber)' }} /> : <FileText size={15} style={{ color: 'var(--neon-cyan)' }} />}
                                          File #{attIdx + 1}: <b style={{ color: 'var(--text-primary)' }}>{attachment.original_filename}</b>
                                        </span>
                                        {isCode && <span className="badge badge-submitted" style={{ fontSize: '10px' }}>CODE</span>}
                                      </div>
                                      
                                      {/* Display inline if image */}
                                      {ext in {png:1, jpg:1, jpeg:1} ? (
                                        <div style={{ background: '#000', padding: '10px', borderRadius: '8px', display: 'inline-block', maxWidth: '100%' }}>
                                          <img 
                                            src={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${localStorage.getItem('malsec_token')}`} 
                                            alt="Screenshot" 
                                            style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '4px', border: '1px solid #374151', cursor: 'zoom-in' }} 
                                            onClick={() => window.open(`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${localStorage.getItem('malsec_token')}`, '_blank')}
                                          />
                                        </div>
                                      ) : ext === 'zip' ? (
                                        /* Display safe extraction and AV scan results if Zip */
                                        <div style={{ padding: '14px', background: 'rgba(17,24,39,0.9)', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
                                          <h5 style={{ fontSize: '12.5px', color: 'var(--neon-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ShieldCheck size={14} /> AIRLOCK SECURITY SCAN RESULTS
                                            {runtimeConfig?.uploads?.zip_password && ` (Zip password '${runtimeConfig.uploads.zip_password}')`}
                                          </h5>
                                          <div style={{ fontSize: '12px', color: 'var(--neon-emerald)', marginBottom: '6px' }}>
                                            [+] Status: <b>CLEAN (NO LIVE MALICIOUS THREAT DETECTED)</b>
                                          </div>
                                          <div style={{ marginTop: '8px' }}>
                                            <a 
                                              href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&download=true&token=${localStorage.getItem('malsec_token')}`} 
                                              className="btn btn-secondary" 
                                              style={{ padding: '5px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                              target="_blank" 
                                              rel="noreferrer"
                                            >
                                              <Download size={13} /> Download ZIP
                                            </a>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                          {/* PREVIEW BUTTON FOR PDF, DOCX, OR CODE FILES */}
                                          {['pdf', 'docx', ...['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log']].includes(ext) && (
                                            <button 
                                              type="button" 
                                              onClick={() => handleOpenDocPreview(attachment)} 
                                              className="btn btn-primary" 
                                              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                                            >
                                              <Eye size={14} /> {isCode ? 'Xem Code' : `Preview (${ext.toUpperCase()})`}
                                            </button>
                                          )}

                                          {/* RAW DOWNLOAD BUTTON */}
                                          <a 
                                            href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&download=true&token=${localStorage.getItem('malsec_token')}`} 
                                            className="btn btn-secondary" 
                                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                            target="_blank" 
                                            rel="noreferrer"
                                          >
                                            <Download size={13} /> Download File
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
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
                    {actionLoading ? 'SAVING GRADE...' : 'SAVE GRADE'}
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
                            {sub.status === 'draft' ? (Object.keys(sub.answers || {}).length === 0 ? 'Not Submitted' : 'Draft') :
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

      {/* VIEW 3: GRADE BY STUDENT (Chấm điểm theo từng sinh viên) */}
      {viewState === 'student_grading' && studentGradingStudent && studentGradingClass && (
        <div>
          {/* Top Header & Navigation Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => { 
                setViewState('dashboard'); 
                const targetCId = studentGradingClass?.id || selectedClass?.id;
                setStudentGradingStudent(null); 
                setStudentGradingLabs([]); 
                setActiveSubmission(null); 
                setSelectedLab(null); 
                if (targetCId) {
                  setSearchParams({ classId: targetCId, tab: 'students' })
                } else {
                  setSearchParams({})
                }
              }} 
              className="btn btn-secondary" 
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} /> Back to Class
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>
                  Student Grading: {studentGradingStudent.full_name}
                </h2>
                <span className="badge badge-submitted" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  MSSV: {studentGradingStudent.username}
                </span>
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 'bold' }}>
                  Class: {studentGradingClass.name} {studentGradingClass.semester ? `(${studentGradingClass.semester})` : ''}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: '4px 0 0 0' }}>
                Select any lab assigned to this student below to review their findings, source code, screenshots, and grade them directly.
              </p>
            </div>

            {/* Quick Student Switcher Bar */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <Users size={15} style={{ color: 'var(--neon-cyan)' }} />
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Switch Student:</span>
                <select
                  className="form-select"
                  style={{
                    padding: '4px 10px',
                    fontSize: '13px',
                    margin: 0,
                    minWidth: '220px',
                    background: '#f8fafc',
                    fontWeight: '500',
                    cursor: 'pointer',
                    border: '1px solid #cbd5e1'
                  }}
                  value={studentGradingStudent.id}
                  onChange={(e) => {
                    const nextStudentId = parseInt(e.target.value)
                    const nextStudent = (studentGradingClass.users || []).find(u => u.id === nextStudentId)
                    if (nextStudent) {
                      openStudentGrading(studentGradingClass, nextStudent)
                    }
                  }}
                >
                  {(studentGradingClass.users || [])
                    .filter(u => u.role === 'student')
                    .map((st, idx) => (
                      <option key={st.id} value={st.id}>
                        {idx + 1}. {st.full_name} ({st.username})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {studentGradingLoading ? (
            <div className="cyber-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin-slow" style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--neon-cyan)' }} />
              Loading student's practical labs and submissions...
            </div>
          ) : studentGradingLabs.length === 0 ? (
            <div className="cyber-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <BookOpen size={36} style={{ opacity: 0.3, margin: '0 auto 12px auto', display: 'block', color: 'var(--neon-cyan)' }} />
              This class has no practical labs created yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
              
              {/* Left Column: List of All Labs for This Student */}
              <div className="cyber-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0, fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={16} style={{ color: 'var(--neon-cyan)' }} />
                    Assigned Labs ({studentGradingLabs.length})
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {studentGradingLabs.filter(p => p.submission?.status === 'graded').length} graded
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                  {studentGradingLabs.map((pair, pIdx) => {
                    const { lab, submission: sub } = pair
                    const isSelected = pIdx === studentGradingActiveLabIndex
                    const subStatus = sub?.status || 'draft'
                    const hasAnswers = Object.keys(sub?.answers || {}).length > 0 || (sub?.file_attachments || []).length > 0

                    return (
                      <div
                        key={lab.id}
                        onClick={() => handleSelectStudentGradingLab(pair, pIdx)}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(242, 112, 36, 0.08)' : '#ffffff',
                          border: isSelected ? '2px solid var(--neon-cyan)' : '1px solid #e2e8f0',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ fontWeight: isSelected ? '700' : '600', fontSize: '13px', color: isSelected ? 'var(--neon-cyan)' : 'var(--text-primary)', lineHeight: '1.3' }}>
                            {pIdx + 1}. {lab.title}
                          </span>
                          {lab.grade_tag && (
                            <span className="badge" style={{ fontSize: '9.5px', padding: '1px 5px', background: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                              {lab.grade_tag}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                          <span className={`badge ${
                            subStatus === 'graded' ? 'badge-graded' :
                            subStatus === 'submitted' ? 'badge-submitted' :
                            subStatus === 're_submit_requested' ? 'badge-resubmit' : 'badge-draft'
                          }`} style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                            {subStatus === 'graded' ? `Graded: ${sub.score}/10` :
                             subStatus === 'submitted' ? 'Submitted' :
                             subStatus === 're_submit_requested' ? 'Resubmit' :
                             hasAnswers ? 'Draft' : 'Not Started'}
                          </span>

                          {sub?.late_penalty > 0 && (
                            <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600' }}>
                              Late -{sub.late_penalty}%
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Speed Grader Workspace for the Selected Lab */}
              <div>
                {activeSubmission && selectedLab ? (
                  <div className="split-container" style={{ margin: 0 }}>
                    {/* Left Inner (65%): Student answers dynamically rendered */}
                    <div className="split-left">
                      <div className="cyber-card" style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3 style={{ fontSize: '18px', color: 'var(--neon-cyan)', margin: 0 }}>
                                Lab: {selectedLab.title}
                              </h3>
                              <span className={`badge ${
                                activeSubmission.status === 'draft' ? 'badge-draft' :
                                activeSubmission.status === 'submitted' ? 'badge-submitted' :
                                activeSubmission.status === 'graded' ? 'badge-graded' : 'badge-resubmit'
                              }`} style={{ fontSize: '11.5px', padding: '2px 8px' }}>
                                {activeSubmission.status === 'draft' ? (Object.keys(activeSubmission.answers || {}).length === 0 ? 'Not Submitted' : 'Draft') :
                                 activeSubmission.status === 'submitted' ? 'Submitted' :
                                 activeSubmission.status === 'graded' ? `Graded: ${activeSubmission.score}/10` : 'Resubmit Requested'}
                              </span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', margin: '4px 0 0 0' }}>
                              Student: {studentGradingStudent.full_name} ({studentGradingStudent.username}) | Submitted: {formatLocalTime(activeSubmission.submitted_at)}
                            </p>
                          </div>
                        </div>

                        {/* Plagiarism details alert if detected */}
                        {activeSubmission.is_plagiarized && (
                          <div className="plag-alert-banner" style={{ marginBottom: '20px' }}>
                            <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 'bold' }}>
                                [!] ACADEMIC INTEGRITY WARNING: Plagiarism Flagged ({activeSubmission.plagiarism_score}% similarity)
                              </div>
                              <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                                Similar phrases matching other submissions found in the database.
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Question by question answers */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {(selectedLab.form_fields || []).map((field, fIdx) => {
                            const ans = (activeSubmission.answers || {})[field.id]
                            const fieldAttachments = (activeSubmission.file_attachments || []).filter(
                              a => a.field_id === field.id
                            )

                            return (
                              <div key={field.id} className="answer-item-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                  <span className="badge badge-draft" style={{ fontSize: '11px', padding: '2px 6px' }}>Q{fIdx + 1}</span>
                                  <span style={{ fontWeight: '600', fontSize: '14.5px', color: 'var(--text-primary)' }}>{field.label}</span>
                                </div>

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

                                {/* CHECKBOX FIELD */}
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

                                {/* TEXTAREA FIELD */}
                                {field.type === 'textarea' && (
                                  <div className="answer-box-textarea">
                                    {parseMarkdown(ans)}
                                  </div>
                                )}

                                {/* FILE ATTACHMENTS */}
                                {field.type === 'file' && (
                                  <div>
                                    {fieldAttachments.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {fieldAttachments.map((attachment, attIdx) => {
                                          const ext = (attachment.original_filename || '').split('.').pop().toLowerCase();
                                          const isCode = ['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log'].includes(ext);

                                          return (
                                            <div key={attIdx} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  {isCode ? <Code size={15} style={{ color: 'var(--neon-amber)' }} /> : <FileText size={15} style={{ color: 'var(--neon-cyan)' }} />}
                                                  File #{attIdx + 1}: <b style={{ color: 'var(--text-primary)' }}>{attachment.original_filename}</b>
                                                </span>
                                                {isCode && <span className="badge badge-submitted" style={{ fontSize: '10px' }}>CODE</span>}
                                              </div>
                                              
                                              {/* Display inline if image */}
                                              {ext in {png:1, jpg:1, jpeg:1} ? (
                                                <div style={{ background: '#000', padding: '10px', borderRadius: '8px', display: 'inline-block', maxWidth: '100%' }}>
                                                  <img 
                                                    src={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${localStorage.getItem('malsec_token')}`} 
                                                    alt="Screenshot" 
                                                    style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '4px', border: '1px solid #374151', cursor: 'zoom-in' }} 
                                                    onClick={() => window.open(`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${localStorage.getItem('malsec_token')}`, '_blank')}
                                                  />
                                                </div>
                                              ) : ext === 'zip' ? (
                                                <div style={{ padding: '14px', background: 'rgba(17,24,39,0.9)', borderRadius: '8px', border: '1px solid var(--border-glow)' }}>
                                                  <h5 style={{ fontSize: '12.5px', color: 'var(--neon-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <ShieldCheck size={14} /> AIRLOCK SECURITY SCAN RESULTS
                                                    {runtimeConfig?.uploads?.zip_password && ` (Zip password '${runtimeConfig.uploads.zip_password}')`}
                                                  </h5>
                                                  <div style={{ fontSize: '12px', color: 'var(--neon-emerald)', marginBottom: '6px' }}>
                                                    [+] Status: <b>CLEAN (NO LIVE MALICIOUS THREAT DETECTED)</b>
                                                  </div>
                                                  <div style={{ marginTop: '8px' }}>
                                                    <a 
                                                      href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&download=true&token=${localStorage.getItem('malsec_token')}`} 
                                                      className="btn btn-secondary" 
                                                      style={{ padding: '5px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                      target="_blank" 
                                                      rel="noreferrer"
                                                    >
                                                      <Download size={13} /> Download ZIP
                                                    </a>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                  {['pdf', 'docx', ...['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log']].includes(ext) && (
                                                    <button 
                                                      type="button" 
                                                      onClick={() => handleOpenDocPreview(attachment)} 
                                                      className="btn btn-primary" 
                                                      style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                                                    >
                                                      <Eye size={14} /> {isCode ? 'Xem Code' : `Preview (${ext.toUpperCase()})`}
                                                    </button>
                                                  )}

                                                  <a 
                                                    href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&download=true&token=${localStorage.getItem('malsec_token')}`} 
                                                    className="btn btn-secondary" 
                                                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                  >
                                                    <Download size={13} /> Download File
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
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
                    </div>

                    {/* Right Inner (35%): Score panel */}
                    <div className="split-right">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Score & Evaluation</h3>
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
                            id="studentReqResubmitCheck"
                            checked={requestResubmit}
                            onChange={(e) => setRequestResubmit(e.target.checked)}
                          />
                          <label htmlFor="studentReqResubmitCheck" style={{ fontSize: '13.5px', color: 'var(--neon-ruby)', cursor: 'pointer', fontWeight: '500' }}>
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
                          {actionLoading ? 'SAVING GRADE...' : 'SAVE GRADE'}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="cyber-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Please select a lab from the left sidebar to start grading.
                  </div>
                )}
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
                {modalError && (
                  <div className="plag-alert-banner" style={{ marginBottom: '16px' }}>
                    <ShieldAlert size={18} />
                    <span>{modalError}</span>
                  </div>
                )}
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

                {/* Lab Attachment Files */}
                <div className="form-group" style={{ background: 'rgba(242, 112, 36, 0.03)', border: '1px dashed rgba(242, 112, 36, 0.3)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neon-cyan)', fontWeight: '600' }}>
                      <Paperclip size={15} /> Lab Reference Materials & Attachment Files (Optional)
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Students will view and download these when opening the lab</span>
                  </div>

                  {/* Current attachments list */}
                  {labAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                      {labAttachments.map((fileItem, idx) => (
                        <div 
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            fontSize: '12.5px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                            <FileText size={15} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                            <span style={{ fontWeight: '500', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                              {fileItem.original_filename || fileItem.filename}
                            </span>
                            {fileItem.size_bytes && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                ({(fileItem.size_bytes / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {/* Visibility Badge */}
                            {fileItem.visibility_mode === 'specific' ? (
                              <span 
                                className="badge" 
                                style={{ 
                                  background: 'rgba(242, 112, 36, 0.1)', 
                                  color: 'var(--neon-amber)', 
                                  border: '1px solid rgba(242, 112, 36, 0.3)',
                                  fontSize: '11px',
                                  padding: '2px 6px'
                                }}
                              >
                                👤 {(fileItem.allowed_students || []).length} Students
                              </span>
                            ) : (
                              <span 
                                className="badge" 
                                style={{ 
                                  background: 'rgba(16, 185, 129, 0.1)', 
                                  color: 'var(--neon-emerald)', 
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  fontSize: '11px',
                                  padding: '2px 6px'
                                }}
                              >
                                👥 Whole Class
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setActiveAttachmentIdx(idx)
                                setPermSearchTerm('')
                                setShowAttachmentPermModal(true)
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Configure student access permissions for this file"
                            >
                              <Users size={12} /> Permissions
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDocPreview({ filepath: fileItem.filepath, original_filename: fileItem.original_filename || fileItem.filename })}
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Preview document"
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLabAttachment(idx)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--neon-ruby)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Remove this attachment"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* File upload input zone */}
                  <div>
                    <input 
                      type="file"
                      id="labAttachmentInput"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleLabAttachmentUpload}
                      disabled={uploadingLabAttachment}
                    />
                    <label 
                      htmlFor="labAttachmentInput" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px', 
                        padding: '10px 16px', 
                        background: '#ffffff', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px', 
                        cursor: uploadingLabAttachment ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        color: 'var(--text-primary)',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Upload size={14} style={{ color: 'var(--neon-cyan)' }} />
                      {uploadingLabAttachment 
                        ? 'Scanning for security & uploading...' 
                        : labAttachments.length > 0 
                          ? '+ Attach additional reference file (Word, PDF, ZIP, Code, Image)...' 
                          : 'Attach files for Lab assignment (supports multiple files: Word, PDF, malware samples in ZIP, Code, Images)...'}
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Grade Category Tag</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Optional (Default: "Default")</span>
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Assignment 1, Homework, Midterm, Practice..."
                    value={gradeTag}
                    onChange={(e) => setGradeTag(e.target.value)}
                  />
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                    💡 Multiple labs sharing the same tag will be grouped together and averaged when viewing the Gradebook by category.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Deadline (Local Time GMT+7)</label>
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
                        onChange={(e) => {
                          const checked = e.target.checked
                          setEnableVm(checked)
                          if (checked) {
                            const defaultProto = runtimeConfig?.vm?.default_protocol || 'rdp'
                            if (!vmProtocol) setVmProtocol(defaultProto)
                            if (!vmPort) setVmPort(runtimeConfig?.vm?.protocol_ports?.[defaultProto] || 3389)
                            if (!templateVmid) {
                              setTemplateVmid(runtimeConfig?.vm?.default_template_vmid || (pveTemplates[0]?.vmid ? String(pveTemplates[0].vmid) : ''))
                            }
                          }
                        }}
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
                    {/* VM SHARED DRIVE D: CONTENT CONFIGURATION */}
                    <div style={{ marginTop: '16px', padding: '14px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <label className="form-label" style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                        <HardDrive size={15} style={{ color: 'var(--neon-cyan)' }} />
                        VM Shared Drive (Drive D:\) Content
                      </label>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                        Choose whether this lab uses the platform default tools drive (<code>tools-1001.iso</code>) or a custom set of files isolated specifically for this lab.
                      </p>

                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: vmDriveMode === 'default' ? 'var(--neon-cyan)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: vmDriveMode === 'default' ? '600' : 'normal' }}>
                          <input
                            type="radio"
                            name="vmDriveModeRadio"
                            checked={vmDriveMode === 'default'}
                            onChange={() => setVmDriveMode('default')}
                            style={{ accentColor: 'var(--neon-cyan)' }}
                          />
                          <span><b>Default Tools Drive</b> (All tools in <code>tools-1001.iso</code>)</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: vmDriveMode === 'custom' ? 'var(--neon-amber)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: vmDriveMode === 'custom' ? '600' : 'normal' }}>
                          <input
                            type="radio"
                            name="vmDriveModeRadio"
                            checked={vmDriveMode === 'custom'}
                            onChange={() => setVmDriveMode('custom')}
                            style={{ accentColor: 'var(--neon-amber)' }}
                          />
                          <span><b>Custom Drive for this Lab</b> (Designated files only)</span>
                        </label>
                      </div>

                      {vmDriveMode === 'custom' && (
                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              Select files to mount on Drive D:\ ({vmDriveFiles.length} selected):
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => setVmDriveFiles(availableVmTools.map(t => t.filename))}
                                className="btn btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => setVmDriveFiles([])}
                                className="btn btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          {loadingVmTools ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                              Loading available tools from Proxmox...
                            </div>
                          ) : availableVmTools.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                              No files found in tools repository. Admin can upload tools in Admin &rarr; VM Shared Tools.
                            </div>
                          ) : (
                            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {availableVmTools.map(tool => {
                                const toolKey = tool.rel_path || tool.filename
                                const isChecked = vmDriveFiles.includes(toolKey) || vmDriveFiles.includes(tool.filename)
                                const sizeMb = (tool.size_bytes / (1024 * 1024)).toFixed(2)
                                const isPrivate = tool.scope && tool.scope.startsWith('lecturer_')
                                const lecturerOwner = isPrivate ? tool.scope.replace('lecturer_', '') : null

                                return (
                                  <label
                                    key={toolKey}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '7px 10px',
                                      borderRadius: '6px',
                                      background: isChecked ? 'rgba(0, 242, 254, 0.06)' : '#ffffff',
                                      border: isChecked ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid #e2e8f0',
                                      cursor: 'pointer',
                                      fontSize: '12.5px',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setVmDriveFiles([...vmDriveFiles.filter(f => f !== tool.filename && f !== toolKey), toolKey])
                                          } else {
                                            setVmDriveFiles(vmDriveFiles.filter(f => f !== toolKey && f !== tool.filename))
                                          }
                                        }}
                                      />
                                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {tool.filename}
                                      </span>
                                      {isPrivate ? (
                                        <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '10px', padding: '1px 6px', fontWeight: 'bold' }}>
                                          🔒 @{lecturerOwner}
                                        </span>
                                      ) : (
                                        <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px', padding: '1px 6px' }}>
                                          🌐 Common
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: '8px', flexShrink: 0 }}>
                                      {tool.size_bytes > 1024 * 1024 ? `${sizeMb} MB` : `${(tool.size_bytes / 1024).toFixed(1)} KB`}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0 }}>
                            💡 A custom ISO will be compiled automatically and mounted exclusively to student VMs taking this lab.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Hardware Specifications */}
                    <div style={{ marginTop: '14px', marginBottom: '14px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚡ VM Hardware Allocation (Custom Specifications)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>CPU Cores (vCPU)</label>
                          <input
                            type="number"
                            min="1"
                            max="32"
                            className="form-input"
                            placeholder="Template default (e.g. 2, 4)"
                            value={cpuCores}
                            onChange={(e) => setCpuCores(e.target.value)}
                            style={{ fontSize: '13px' }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leave blank to inherit cores from base template VM</span>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>RAM (GB)</label>
                          <input
                            type="number"
                            min="1"
                            max="128"
                            step="1"
                            className="form-input"
                            placeholder="Template default (e.g. 4, 8, 16)"
                            value={ramGb}
                            onChange={(e) => setRamGb(e.target.value)}
                            style={{ fontSize: '13px' }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leave blank to inherit RAM from base template VM</span>
                        </div>
                      </div>
                    </div>

                    {/* Exam / Test Mode Switch */}
                    <div style={{ 
                      marginTop: '14px', 
                      marginBottom: '14px', 
                      padding: '16px', 
                      background: isExamMode ? 'rgba(236, 72, 153, 0.05)' : '#ffffff', 
                      borderRadius: '8px', 
                      border: isExamMode ? '1.5px solid #ec4899' : '1px solid var(--border-color)', 
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          id="isExamModeCheck"
                          checked={isExamMode}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setIsExamMode(checked)
                            if (checked) {
                              setDisableVmCopy(true)
                              setDisableVmPaste(true)
                            }
                          }}
                          style={{ marginTop: '3px', accentColor: '#ec4899', width: '16px', height: '16px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: isExamMode ? '#be185d' : 'var(--text-primary)' }}>
                              🎓 Exam / Test Mode (Anti-Cheating Sandbox & In-VM Word Submission)
                            </span>
                            {isExamMode && (
                              <span className="badge" style={{ background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', fontSize: '11px', fontWeight: '600' }}>
                                EXAM ACTIVE
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: '1.45' }}>
                            When enabled: Students perform analysis and author their Word report (<b>.docx</b>) completely inside the VM. Automatically enforces <b>two-way clipboard isolation</b> (blocks copy from VM to host, and blocks paste from host to VM). Students can <b>Rollback clean VMs anytime without losing their report or analysis files</b> in the Exam_Workspace folder, and submit their final Word report directly from the VM for instructor speed grading.
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Clipboard Isolation Options */}
                    <div style={{ marginTop: '14px', marginBottom: '14px', padding: '14px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        🔒 Clipboard Isolation Policy
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: isExamMode ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            id="disableVmCopyCheck"
                            checked={isExamMode || disableVmCopy}
                            disabled={isExamMode}
                            onChange={(e) => setDisableVmCopy(e.target.checked)}
                            style={{ marginTop: '3px', accentColor: 'var(--neon-ruby)' }}
                          />
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: (isExamMode || disableVmCopy) ? '#dc2626' : 'var(--text-primary)' }}>
                              Block Copy from VM to Host (VM &rarr; Physical Host)
                            </span>
                            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: '1.35' }}>
                              Prevents students from copying text, code, or malware artifacts out of the VM to their physical computer. Internal VM copy/paste remains functional.
                            </p>
                          </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: isExamMode ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            id="disableVmPasteCheck"
                            checked={isExamMode || disableVmPaste}
                            disabled={isExamMode}
                            onChange={(e) => setDisableVmPaste(e.target.checked)}
                            style={{ marginTop: '3px', accentColor: 'var(--neon-ruby)' }}
                          />
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: (isExamMode || disableVmPaste) ? '#dc2626' : 'var(--text-primary)' }}>
                              Block Paste from Host to VM (Physical Host &rarr; VM)
                            </span>
                            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: '1.35' }}>
                              Prevents students from pasting external solutions, code, or pre-made reports into the VM from outside.
                            </p>
                          </div>
                        </label>
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
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingLab && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const tempLabObj = {
                          ...editingLab,
                          title: labTitle,
                          description: labDesc,
                          class_id: parseInt(classId),
                          deadline: deadline,
                          late_policy: {
                            allow_late: allowLate,
                            penalty_per_hour_percent: parseFloat(penaltyPerHour) || 0,
                            max_penalty_percent: parseFloat(maxPenalty) || 0
                          },
                          form_schema: formFields,
                          attachments: labAttachments,
                          enable_vm: enableVm,
                          template_vmid: templateVmid ? parseInt(templateVmid) : null,
                          is_linked_clone: isLinkedClone,
                          vm_protocol: vmProtocol,
                          vm_port: vmPort ? parseInt(vmPort) : null,
                          disable_vm_copy: disableVmCopy
                        }
                        openLabPreview(tempLabObj)
                      }} 
                      className="btn btn-secondary" 
                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title="Preview this lab and test VM environment"
                    >
                      <Eye size={15} /> Preview Lab
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowLabModal(false)} className="btn btn-secondary">CLOSE</button>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'SAVING...' : editingLab ? 'SAVE CHANGES' : 'CONFIGURE & PUBLISH LAB'}
                  </button>
                </div>
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
                {modalError && (
                  <div className="plag-alert-banner" style={{ marginBottom: '16px' }}>
                    <ShieldAlert size={18} />
                    <span>{modalError}</span>
                  </div>
                )}
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
                  <label className="form-label">New Extended Deadline (Local Time GMT+7)</label>
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
                {modalError && (
                  <div className="plag-alert-banner" style={{ marginBottom: '16px' }}>
                    <ShieldAlert size={18} />
                    <span>{modalError}</span>
                  </div>
                )}
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
              {modalError && (
                <div className="plag-alert-banner" style={{ marginBottom: '16px' }}>
                  <ShieldAlert size={18} />
                  <span>{modalError}</span>
                </div>
              )}
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
                {modalError && (
                  <div className="plag-alert-banner" style={{ margin: 0 }}>
                    <ShieldAlert size={18} />
                    <span>{modalError}</span>
                  </div>
                )}
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

              {/* CODE / TEXT Preview: Monospace formatted code viewer with line numbers */}
              {previewDoc.type === 'code' && !previewError && !previewLoading && (
                <div style={{ padding: '24px', maxWidth: '1000px', width: '100%', margin: '0 auto' }}>
                  <div style={{ 
                    background: '#090d16', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(0, 242, 254, 0.2)', 
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }}>
                    <div style={{ 
                      padding: '10px 16px', 
                      background: 'rgba(255,255,255,0.04)', 
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)', fontWeight: '600' }}>
                        {previewDoc.filename}
                      </span>
                      <span className="badge badge-submitted" style={{ fontSize: '10px', padding: '2px 6px' }}>
                        SOURCE CODE
                      </span>
                    </div>
                    <pre style={{ 
                      margin: 0, 
                      padding: '16px 20px', 
                      fontFamily: 'var(--font-mono)', 
                      fontSize: '13px', 
                      lineHeight: '1.6', 
                      color: '#e2e8f0', 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-all',
                      overflowX: 'auto',
                      maxHeight: '65vh'
                    }}>
                      <code>{previewDoc.content}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CLASS SEMESTER & SETTINGS (FOR INSTRUCTORS) */}
      {editClassModal && selectedClass && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: 'var(--neon-cyan)' }} />
                Update Class Semester & Settings
              </h3>
              <button onClick={() => setEditClassModal(false)} className="close-btn">&times;</button>
            </div>
            
            <form onSubmit={handleSaveClassSettings}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {modalError && (
                  <div className="plag-alert-banner" style={{ margin: 0 }}>
                    <ShieldAlert size={18} />
                    <span>{modalError}</span>
                  </div>
                )}
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Managing Class:</span>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--neon-cyan)' }}>{selectedClass.name}</div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Academic Semester</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Default: "unknown"</span>
                  </label>
                  <select 
                    className="form-select" 
                    value={editClassSemester}
                    onChange={(e) => setEditClassSemester(e.target.value)}
                    style={{ background: '#ffffff' }}
                  >
                    <option value="unknown">unknown (Unassigned / No term)</option>
                    {semestersList.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.is_active ? '🌟 (Current Active)' : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                    💡 Choose from the academic terms configured by Admin. Updating will re-group the labs and classes for you and your enrolled students.
                  </p>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description (Optional)</label>
                  <textarea 
                    className="form-input" 
                    rows={3}
                    placeholder="Class objectives, timetable or notes..."
                    value={editClassDesc}
                    onChange={(e) => setEditClassDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setEditClassModal(false)} className="btn btn-secondary">CANCEL</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: PHÂN QUYỀN HIỂN THỊ TÀI LIỆU ĐÍNH KÈM CHO TỪNG SINH VIÊN */}
      {showAttachmentPermModal && activeAttachmentIdx !== null && labAttachments[activeAttachmentIdx] && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: 'var(--neon-cyan)' }} />
                Document Visibility & Permissions
              </h3>
              <button onClick={() => setShowAttachmentPermModal(false)} className="close-btn">&times;</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* File Info Card */}
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Attached File:</span>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', wordBreak: 'break-all', marginTop: '2px' }}>
                  {labAttachments[activeAttachmentIdx].original_filename || labAttachments[activeAttachmentIdx].filename}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Who can view and download this file?
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '10px 14px', 
                    background: (labAttachments[activeAttachmentIdx].visibility_mode || 'all') === 'all' ? 'rgba(0, 242, 254, 0.08)' : '#ffffff',
                    border: (labAttachments[activeAttachmentIdx].visibility_mode || 'all') === 'all' ? '1px solid var(--neon-cyan)' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="radio" 
                      name="visMode"
                      checked={(labAttachments[activeAttachmentIdx].visibility_mode || 'all') === 'all'}
                      onChange={() => {
                        const updated = [...labAttachments]
                        updated[activeAttachmentIdx] = {
                          ...updated[activeAttachmentIdx],
                          visibility_mode: 'all'
                        }
                        setLabAttachments(updated)
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>👥 Whole Class</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>All enrolled students</div>
                    </div>
                  </label>

                  <label style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '10px 14px', 
                    background: labAttachments[activeAttachmentIdx].visibility_mode === 'specific' ? 'rgba(242, 112, 36, 0.08)' : '#ffffff',
                    border: labAttachments[activeAttachmentIdx].visibility_mode === 'specific' ? '1px solid var(--neon-amber)' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="radio" 
                      name="visMode"
                      checked={labAttachments[activeAttachmentIdx].visibility_mode === 'specific'}
                      onChange={() => {
                        const updated = [...labAttachments]
                        updated[activeAttachmentIdx] = {
                          ...updated[activeAttachmentIdx],
                          visibility_mode: 'specific',
                          allowed_students: updated[activeAttachmentIdx].allowed_students || []
                        }
                        setLabAttachments(updated)
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>👤 Specific Students</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Designated students only</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Student Selector when specific */}
              {labAttachments[activeAttachmentIdx].visibility_mode === 'specific' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Select Permitted Students ({((labAttachments[activeAttachmentIdx].allowed_students || []).length)} selected):
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const currentClass = classes.find(c => c.id === parseInt(classId))
                          const allUsernames = (currentClass?.users || []).filter(u => u.role === 'student').map(u => u.username)
                          const updated = [...labAttachments]
                          updated[activeAttachmentIdx] = {
                            ...updated[activeAttachmentIdx],
                            allowed_students: allUsernames
                          }
                          setLabAttachments(updated)
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...labAttachments]
                          updated[activeAttachmentIdx] = {
                            ...updated[activeAttachmentIdx],
                            allowed_students: []
                          }
                          setLabAttachments(updated)
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Search box */}
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by student ID or name..."
                    value={permSearchTerm}
                    onChange={(e) => setPermSearchTerm(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  />

                  {/* Students checklist */}
                  <div style={{ 
                    maxHeight: '220px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: '#ffffff'
                  }}>
                    {(() => {
                      const currentClass = classes.find(c => c.id === parseInt(classId))
                      const classStudents = (currentClass?.users || []).filter(u => u.role === 'student')
                      const allowedList = labAttachments[activeAttachmentIdx].allowed_students || []
                      const filtered = classStudents.filter(s => 
                        !permSearchTerm || 
                        s.username.toLowerCase().includes(permSearchTerm.toLowerCase()) || 
                        (s.full_name && s.full_name.toLowerCase().includes(permSearchTerm.toLowerCase()))
                      )

                      if (classStudents.length === 0) {
                        return (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                            No students enrolled in this class yet.
                          </div>
                        )
                      }

                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                            No students matching search criteria.
                          </div>
                        )
                      }

                      return filtered.map(student => {
                        const isChecked = allowedList.includes(student.username)
                        return (
                          <label 
                            key={student.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '10px', 
                              padding: '6px 10px', 
                              borderRadius: '6px',
                              background: isChecked ? 'rgba(0, 242, 254, 0.05)' : 'transparent',
                              cursor: 'pointer',
                              fontSize: '13px'
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const updated = [...labAttachments]
                                let currentAllowed = [...(updated[activeAttachmentIdx].allowed_students || [])]
                                if (e.target.checked) {
                                  if (!currentAllowed.includes(student.username)) {
                                    currentAllowed.push(student.username)
                                  }
                                } else {
                                  currentAllowed = currentAllowed.filter(u => u !== student.username)
                                }
                                updated[activeAttachmentIdx] = {
                                  ...updated[activeAttachmentIdx],
                                  allowed_students: currentAllowed
                                }
                                setLabAttachments(updated)
                              }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)', fontSize: '12px' }}>
                                {student.username}
                              </span>
                              <span style={{ color: 'var(--text-primary)' }}>
                                {student.full_name || '—'}
                              </span>
                            </div>
                          </label>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setShowAttachmentPermModal(false)} 
                className="btn btn-primary"
                style={{ padding: '6px 18px' }}
              >
                APPLY & CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
      {/* INSTRUCTOR LAB PREVIEW MODAL */}
      {showLabPreviewModal && previewLabData && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '96vw', height: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '14px 20px', background: '#090d16', borderBottom: '1px solid rgba(0, 242, 254, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 'bold' }}>
                  <Eye size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> INSTRUCTOR PREVIEW MODE
                </span>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff', fontWeight: '600' }}>
                  {previewLabData.title}
                </h3>
                <span className="badge badge-draft" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  ID #{previewLabData.id}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowLabPreviewModal(false)
                  setPreviewGuacamoleUrl('')
                  setPreviewVmInfo(null)
                }} 
                className="btn-icon btn-secondary" 
                style={{ width: '30px', height: '30px', color: '#94a3b8' }}
                title="Close Preview"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sub-header Tabs & Banner */}
            <div style={{ background: '#0f172a', padding: '8px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {previewLabData.enable_vm !== false && (
                  <button
                    type="button"
                    onClick={() => setPreviewLabTab('vm')}
                    className={`btn ${previewLabTab === 'vm' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '5px 14px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Monitor size={14} /> VDI Lab Desktop {previewVmInfo ? `(VMID ${previewVmInfo.vmid})` : ''}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewLabTab('guide')}
                  className={`btn ${previewLabTab === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '5px 14px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <BookOpen size={14} /> Lab Instructions & Guide
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLabTab('form')}
                  className={`btn ${previewLabTab === 'form' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '5px 14px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileCheck size={14} /> Questions Form ({(previewLabData.form_schema || []).length})
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {previewLabData.enable_vm !== false && previewLabTab === 'vm' && (
                  <>
                    <button
                      type="button"
                      onClick={() => launchPreviewVmSession(previewLabData.id)}
                      disabled={previewVmLoading}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      title="Reconnect VM Session"
                    >
                      <RefreshCw size={13} className={previewVmLoading ? 'animate-spin' : ''} /> Reconnect
                    </button>
                    <button
                      type="button"
                      onClick={handlePreviewVmRollback}
                      disabled={previewVmLoading}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--neon-ruby)', borderColor: 'rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      title="Rollback VM to clean template snapshot"
                    >
                      <RotateCcw size={13} /> Reset VM
                    </button>
                  </>
                )}
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  ⚡ Mock preview environment — No student grades or submissions affected
                </span>
              </div>
            </div>

            {/* Modal Body: Active Tab View */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#090d16', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              
              {/* TAB 1: Guacamole VDI VM View */}
              {previewLabTab === 'vm' && previewLabData.enable_vm !== false && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                  {previewVmLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#a5f3fc', gap: '14px' }}>
                      <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--neon-cyan)' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '600', fontSize: '15px' }}>Provisioning & Connecting Instructor Preview VM...</div>
                        <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>Communicating with Proxmox VE hypervisor and Guacamole gateway</div>
                      </div>
                    </div>
                  ) : previewVmError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '30px', textAlign: 'center' }}>
                      <AlertCircle size={42} style={{ color: 'var(--neon-ruby)', marginBottom: '12px' }} />
                      <h4 style={{ color: '#fff', marginBottom: '8px' }}>VM Connection Notice</h4>
                      <p style={{ color: '#94a3b8', maxWidth: '480px', fontSize: '13px', marginBottom: '18px' }}>{previewVmError}</p>
                      <button
                        type="button"
                        onClick={() => launchPreviewVmSession(previewLabData.id)}
                        className="btn btn-primary"
                        style={{ padding: '8px 20px' }}
                      >
                        Retry Connection
                      </button>
                    </div>
                  ) : previewGuacamoleUrl ? (
                    <iframe
                      ref={previewGuacRef}
                      key={previewGuacamoleUrl}
                      src={previewGuacamoleUrl}
                      title="Instructor Preview Apache Guacamole VDI"
                      style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
                      allow="clipboard-read; clipboard-write; fullscreen; keyboard-map"
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                      <Monitor size={48} style={{ color: 'var(--neon-cyan)', marginBottom: '16px', opacity: 0.8 }} />
                      <h4 style={{ color: '#fff', marginBottom: '8px' }}>Preview VM is ready to start</h4>
                      <button
                        type="button"
                        onClick={() => launchPreviewVmSession(previewLabData.id)}
                        className="btn btn-primary"
                        style={{ padding: '8px 24px' }}
                      >
                        Launch VM Connection
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Lab Instructions & Guide View */}
              {previewLabTab === 'guide' && (
                <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                  <div className="cyber-card" style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '24px', borderRadius: '10px' }}>
                    <h3 style={{ fontSize: '18px', color: 'var(--neon-cyan)', marginBottom: '14px', borderBottom: '1px solid #1e293b', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={18} /> Lab Instructions & Guide
                    </h3>
                    <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#e2e8f0' }}>
                      {parseMarkdown(previewLabData.description)}
                    </div>
                  </div>

                  {/* Attachments Section if present */}
                  {Array.isArray(previewLabData.attachments) && previewLabData.attachments.length > 0 && (
                    <div className="cyber-card" style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
                      <h4 style={{ fontSize: '15px', color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Paperclip size={16} style={{ color: 'var(--neon-cyan)' }} /> Attached Reference Files & Docs ({previewLabData.attachments.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {previewLabData.attachments.map((att, aIdx) => (
                          <div key={aIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1e293b', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <FileText size={16} style={{ color: 'var(--neon-cyan)' }} />
                              <div>
                                <span style={{ fontWeight: '500', color: '#f8fafc', fontSize: '13.5px' }}>{att.filename}</span>
                                {att.file_size && (
                                  <span style={{ fontSize: '11.5px', color: '#94a3b8', marginLeft: '8px' }}>
                                    ({(att.file_size / 1024).toFixed(1)} KB)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => openAttachmentPreview(att.download_url, att.filename)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                              >
                                <Eye size={13} style={{ marginRight: '4px' }} /> View
                              </button>
                              <a
                                href={`${att.download_url}&download=true`}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download size={13} style={{ marginRight: '4px' }} /> Download
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Dynamic Questions Form Mock */}
              {previewLabTab === 'form' && (
                <div style={{ padding: '28px', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
                  <div className="cyber-card" style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '24px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                      <h3 style={{ fontSize: '17px', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileCheck size={18} style={{ color: 'var(--neon-cyan)' }} /> Student Submission Form Preview
                      </h3>
                      <span className="badge badge-submitted" style={{ fontSize: '11px' }}>
                        {(previewLabData.form_schema || []).length} Questions
                      </span>
                    </div>

                    {(!previewLabData.form_schema || previewLabData.form_schema.length === 0) ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #334155', borderRadius: '8px' }}>
                        This lab currently has no dynamic questions configured. Students submit standard report files.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {previewLabData.form_schema.map((field, fIdx) => (
                          <div key={field.id || fIdx} style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#f1f5f9', fontSize: '14px' }}>
                              <span style={{ color: 'var(--neon-cyan)', marginRight: '6px' }}>Q{fIdx + 1}.</span>
                              {field.label}
                              {field.required && <span style={{ color: 'var(--neon-ruby)', marginLeft: '4px' }}>*</span>}
                              {field.max_score && (
                                <span className="badge badge-draft" style={{ marginLeft: '8px', fontSize: '10px' }}>
                                  {field.max_score} pts
                                </span>
                              )}
                            </label>

                            {field.type === 'text' && (
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Short text answer..."
                                style={{ background: '#090d16', color: '#fff', borderColor: '#475569' }}
                                value={previewAnswers[field.id] || ''}
                                onChange={(e) => setPreviewAnswers({ ...previewAnswers, [field.id]: e.target.value })}
                              />
                            )}

                            {field.type === 'textarea' && (
                              <textarea
                                className="form-input"
                                rows={3}
                                placeholder="Detailed response / analysis findings..."
                                style={{ background: '#090d16', color: '#fff', borderColor: '#475569' }}
                                value={previewAnswers[field.id] || ''}
                                onChange={(e) => setPreviewAnswers({ ...previewAnswers, [field.id]: e.target.value })}
                              />
                            )}

                            {field.type === 'multiple_choice' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                {(field.options || []).map((opt, oIdx) => (
                                  <label key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', cursor: 'pointer', fontSize: '13.5px' }}>
                                    <input
                                      type="radio"
                                      name={`preview_q_${field.id}`}
                                      checked={previewAnswers[field.id] === opt}
                                      onChange={() => setPreviewAnswers({ ...previewAnswers, [field.id]: opt })}
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {field.type === 'file' && (
                              <div style={{ padding: '16px', border: '1px dashed #475569', borderRadius: '6px', textAlign: 'center', background: '#090d16', color: '#94a3b8', fontSize: '13px' }}>
                                <Upload size={20} style={{ color: 'var(--neon-cyan)', marginBottom: '6px' }} />
                                <div>Student file upload field ({field.allowed_types || 'PDF, DOCX, ZIP, PNG'})</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ padding: '12px 20px', background: '#090d16', borderTop: '1px solid rgba(0, 242, 254, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Previewing as Instructor — Close when finished testing
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowLabPreviewModal(false)
                  setPreviewGuacamoleUrl('')
                  setPreviewVmInfo(null)
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 20px' }}
              >
                CLOSE PREVIEW
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}


