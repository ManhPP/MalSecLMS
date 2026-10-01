import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  BookOpen, Terminal, Clock, FileCheck, CheckCircle, Award,
  Send, Save, Upload, ShieldAlert, Monitor, ChevronRight, Play, RotateCcw, AlertTriangle,
  School, Layers, ChevronDown, Calendar, Trash2, Code, FileText, Lock,
  Download, Eye, Paperclip, X, RefreshCw, ArrowLeft, ArrowRight, Camera,
  Maximize2, Minimize2
} from 'lucide-react'
import { renderAsync } from 'docx-preview'
import { useAuth } from '../App.jsx'

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
  
  // Split text by code blocks ``` first
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    // If it is a code block
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
    
    // Headings, bold, lists, threats
    const lines = part.split('\n');
    return (
      <div key={index}>
        {lines.map((line, lIdx) => {
          // H3: ### Title
          if (line.startsWith('### ')) {
            return <h4 key={lIdx} style={{ fontSize: '15px', color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px', fontWeight: '600', borderLeft: '3px solid var(--neon-cyan)', paddingLeft: '8px', textAlign: 'left' }}>{line.slice(4)}</h4>;
          }
          // H2: ## Title
          if (line.startsWith('## ')) {
            return <h3 key={lIdx} style={{ fontSize: '17px', color: 'var(--text-primary)', marginTop: '18px', marginBottom: '10px', fontWeight: '600', textAlign: 'left' }}>{line.slice(3)}</h3>;
          }
          
          // Lists: - Item or * Item
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.slice(2);
            return (
              <li key={lIdx} style={{ marginLeft: '20px', marginBottom: '4px', listStyleType: 'square', color: 'var(--text-primary)', textAlign: 'left' }}>
                {renderInlineFormatting(content)}
              </li>
            );
          }

          // Threat alert: [!] Content
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

// --- CYBERPUNK MARKDOWN EDITOR COMPONENT ---
const MarkdownEditor = ({ value, onChange, disabled }) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef(null);

  if (disabled) {
    return (
      <div style={{ 
        padding: '14px', 
        background: 'rgba(5, 8, 15, 0.4)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '8px', 
        minHeight: '100px',
        textAlign: 'left'
      }}>
        {parseMarkdown(value)}
      </div>
    );
  }

  const insertText = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const replacement = text.substring(0, start) + before + (selected || after) + (selected ? after : '') + text.substring(end);
    
    onChange(replacement);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + (selected || after).length);
    }, 0);
  };

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-dark)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-color)', padding: '6px 12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => insertText('### ', 'Subheading')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px' }}
            title="Add subheading"
          >
            H3
          </button>
          <button 
            type="button" 
            onClick={() => insertText('**', '**')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 'bold' }}
            title="Bold text"
          >
            B
          </button>
          <button 
            type="button" 
            onClick={() => insertText('```assembly\n', '\n```')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
            title="Add code block"
          >
            Code
          </button>
          <button 
            type="button" 
            onClick={() => insertText('- ', 'List item')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px' }}
            title="Add bullet list"
          >
            List
          </button>
          <button 
            type="button" 
            onClick={() => insertText('[!] Warning: ', 'Malicious activity')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--neon-ruby)', borderColor: 'rgba(255, 8, 68, 0.2)' }}
            title="Add threat warning"
          >
            Threat
          </button>
        </div>
        
        {/* Toggle buttons */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <button 
            type="button" 
            onClick={() => setIsPreview(false)} 
            className="btn" 
            style={{ padding: '4px 10px', fontSize: '11.5px', background: !isPreview ? 'var(--neon-cyan)' : 'transparent', color: !isPreview ? '#ffffff' : 'var(--text-secondary)', border: 'none', fontWeight: '600' }}
          >
            Write
          </button>
          <button 
            type="button" 
            onClick={() => setIsPreview(true)} 
            className="btn" 
            style={{ padding: '4px 10px', fontSize: '11.5px', background: isPreview ? 'var(--neon-cyan)' : 'transparent', color: isPreview ? '#ffffff' : 'var(--text-secondary)', border: 'none', fontWeight: '600' }}
          >
            Preview
          </button>
        </div>
      </div>
      
      {/* Editor or Preview */}
      {!isPreview ? (
        <textarea 
          ref={textareaRef}
          className="form-input form-textarea code-font" 
          style={{ margin: 0, border: 'none', borderRadius: 0, minHeight: '180px', width: '100%', display: 'block' }}
          placeholder="Enter analysis findings... Use markdown tools above to format text, headings, and code blocks."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div style={{ padding: '16px', minHeight: '180px', background: '#f8fafc', borderTop: '1px solid var(--border-color)', color: '#0f172a', overflowY: 'auto' }}>
          {parseMarkdown(value)}
        </div>
      )}
    </div>
  );
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

export default function StudentDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [activeLabs, setActiveLabs] = useState([])
  const [gradedLabs, setGradedLabs] = useState([])
  
  // View states: 'dashboard' | 'doing_lab'
  const [viewState, setViewState] = useState('dashboard')
  const [selectedLab, setSelectedLab] = useState(null)
  
  // Submission & Answers state
  const [answers, setAnswers] = useState({})
  const [fileAttachments, setFileAttachments] = useState([])
  const [submissionStatus, setSubmissionStatus] = useState('draft') // draft, submitted, graded
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [latePenalty, setLatePenalty] = useState(0.0)

  // In-Browser Document Preview Modal State (DOCX, PDF, Code, Images)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const docxContainerRef = useRef(null)
  
  // UI indicators
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [uploadingField, setUploadingField] = useState(null)
  const [saveStatus, setSaveStatus] = useState('Synced with server') // 'Auto-saving draft in background...' | 'Synced with server' | 'Auto-save error!'
  const [lastSavedTime, setLastSavedTime] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search & Filter state for Labs
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [activeClassTab, setActiveClassTab] = useState('labs') // 'labs' | 'scores'
  const [classSearchQuery, setClassSearchQuery] = useState('')
  const [semestersList, setSemestersList] = useState([])
  const [labGroupByClass, setLabGroupByClass] = useState(true)
  const [collapsedClassGroups, setCollapsedClassGroups] = useState({})
  const [studentSemesterFilter, setStudentSemesterFilter] = useState('all')
  const [hidePastSemesters, setHidePastSemesters] = useState(false)
  const [collapsedSemesterGroups, setCollapsedSemesterGroups] = useState({})
  const [studentLabClassFilter, setStudentLabClassFilter] = useState('')
  const [studentLabSearch, setStudentLabSearch] = useState('')
  const [studentLabStatusFilter, setStudentLabStatusFilter] = useState('all') // 'all' | 'not_started' | 'draft' | 'resubmit'
  const [studentLabSort, setStudentLabSort] = useState('deadline_asc') // 'deadline_asc' | 'deadline_desc' | 'title_asc'

  // VM Simulator & Real Proxmox Guacamole state
  const [vmActive, setVmActive] = useState(true)
  const [vmOs, setVmOs] = useState('Lab VM — Session not initialized')
  const [vmLogs, setVmLogs] = useState(['[+] Waiting for lab VM configuration...'])
  const [runtimeConfig, setRuntimeConfig] = useState(null)
  const [guacamoleUrl, setGuacamoleUrl] = useState('')
  const [vmLoading, setVmLoading] = useState(false)
  const [vmError, setVmError] = useState('')
  const [vmInfo, setVmInfo] = useState(null)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [screenshotNotice, setScreenshotNotice] = useState('')
  const [isVmFullscreen, setIsVmFullscreen] = useState(false)
  const guacamoleFrameRef = useRef(null)
  const vmWrapperRef = useRef(null)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsVmFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleVmFullscreen = () => {
    if (!vmWrapperRef.current) return
    if (!document.fullscreenElement) {
      vmWrapperRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err)
      })
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Error attempting to exit fullscreen:', err)
      })
    }
  }

  const focusIframe = () => {
    try {
      if (guacamoleFrameRef.current) {
        guacamoleFrameRef.current.focus()
        if (guacamoleFrameRef.current.contentWindow) {
          guacamoleFrameRef.current.contentWindow.focus()
        }
      }
    } catch (e) {
      // ignore cross-origin focus errors if any
    }
  }

  const fetchVmSession = async (labId) => {
    setVmLoading(true)
    setVmError('')
    setGuacamoleUrl('')
    setVmInfo(null)
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
          throw new Error(`VM is being initialized on Proxmox (HTTP ${res.status}). Please wait 15-30 seconds and click "Reload VM Session".`)
        }
      }

      if (!res.ok) throw new Error(data.detail || 'Unable to create VM session')
      setGuacamoleUrl(data.guacamole_url)
      setVmInfo(data)
      setVmOs(`Lab VM ${data.vmid} — ${data.protocol.toUpperCase()} — ${data.ip_address}`)
    } catch (err) {
      setVmError(err.message)
    } finally {
      setVmLoading(false)
    }
  }

  const handleRollbackVm = async () => {
    if (!selectedLab) return
    if (!confirm('Are you sure you want to revert this VM to a clean state?')) return
    setVmLoading(true)
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/${selectedLab.id}/vm-rollback`, {
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
          throw new Error(`VM rollback is currently in progress on Proxmox (HTTP ${res.status}). Please wait 15-30 seconds.`)
        }
      }

      if (!res.ok) throw new Error(data.detail || 'Unable to rollback VM')
      setGuacamoleUrl('')
      setVmInfo(null)
      await fetchVmSession(selectedLab.id)
    } catch (err) {
      alert('VM rollback error: ' + err.message)
      setVmLoading(false)
    }
  }

  const handleTakeScreenshot = async () => {
    if (!selectedLab || !guacamoleUrl) return
    setScreenshotLoading(true)
    setScreenshotNotice('')
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch(`/api/labs/${selectedLab.id}/vm-screenshot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not capture VM screenshot')
      setScreenshotNotice(`📸 ${data.message || 'Screenshot saved to Desktop inside your VM!'}`)
      setTimeout(() => setScreenshotNotice(''), 6000)
    } catch (err) {
      alert('Screenshot error: ' + err.message)
    } finally {
      setScreenshotLoading(false)
    }
  }

  const autoSaveTimerRef = useRef(null)

  const fetchRuntimeConfig = async () => {
    const token = localStorage.getItem('malsec_token')
    try {
      const res = await fetch('/api/config/client', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) setRuntimeConfig(await res.json())
    } catch (err) {
      console.error('Failed to fetch runtime config:', err)
    }
  }


  // Fetch initial labs list & student enrolled classes
  const fetchStudentLabs = async () => {
    setLoading(true)
    setError('')
    const token = localStorage.getItem('malsec_token')

    try {
      // Fetch classes for class metadata and grouping
      try {
        const clsRes = await fetch('/api/classes/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (clsRes.ok) {
          const clsData = await clsRes.json()
          setClasses(clsData)
        }
      } catch (clsErr) {
        console.error('Failed to fetch student classes:', clsErr)
      }

      // Fetch semesters list for accurate current active term
      try {
        const semRes = await fetch('/api/semesters/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (semRes.ok) {
          const semData = await semRes.json()
          setSemestersList(semData)
        }
      } catch (semErr) {
        console.error('Failed to fetch semesters:', semErr)
      }

      const res = await fetch('/api/labs/student/active', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Unable to fetch your assigned lab list')
      const allLabs = await res.json()
      
      // Categorize active vs graded labs
      const active = []
      const graded = []

      for (const lab of allLabs) {
        const subRes = await fetch(`/api/submissions/lab/${lab.id}/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        let sub = null
        if (subRes.ok) {
          sub = await subRes.json()
        }

        const labWithSub = { ...lab, submission: sub }

        if (sub && sub.status === 'graded') {
          graded.push(labWithSub)
        } else {
          active.push(labWithSub)
        }
      }

      setActiveLabs(active)
      setGradedLabs(graded)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudentLabs()
    fetchRuntimeConfig()
  }, [])

  // Sync state FROM URL query params on mount & when searchParams / classes / activeLabs change
  useEffect(() => {
    const paramClassId = searchParams.get('classId')
    const paramTab = searchParams.get('tab')
    const paramLabId = searchParams.get('labId')

    // 1. Doing lab view via URL: ?labId=123 (or ?classId=10&labId=123)
    if (paramLabId) {
      const allStudentLabs = [...activeLabs, ...gradedLabs]
      if (allStudentLabs.length > 0) {
        const foundLab = allStudentLabs.find(l => String(l.id) === String(paramLabId))
        if (foundLab && (!selectedLab || String(selectedLab.id) !== String(paramLabId))) {
          handleOpenLab(foundLab)
        }
      }
      return
    }

    // 2. Class Hub view via URL: ?classId=10&tab=labs (or scores)
    if (paramClassId) {
      if (viewState !== 'dashboard') {
        setViewState('dashboard')
        setSelectedLab(null)
      }
      if (paramTab && ['labs', 'scores'].includes(paramTab)) {
        if (activeClassTab !== paramTab) setActiveClassTab(paramTab)
      }
      if (classes.length > 0) {
        const found = classes.find(c => String(c.id) === String(paramClassId))
        if (found && (!selectedClass || String(selectedClass.id) !== String(paramClassId))) {
          setSelectedClass(found)
        }
      }
    } else {
      // Home classes grid
      if (viewState === 'dashboard' && selectedClass) {
        setSelectedClass(null)
      }
    }
  }, [classes, activeLabs, gradedLabs, searchParams])

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      // URL searchParams change will trigger sync effect above
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Helper tính hạn chót thực tế của sinh viên (kể cả gia hạn cá nhân)
  const getEffectiveDeadline = (lab) => {
    if (!lab) return null
    const extStr = (lab.individual_extensions || {})[user?.username]
    return extStr ? parseVietnamDate(extStr) : (lab.deadline ? parseVietnamDate(lab.deadline) : null)
  }

  const isLabPastDeadline = (lab) => {
    const d = getEffectiveDeadline(lab)
    if (!d) return false
    return new Date() > d
  }

  // Quyền chỉnh sửa bài làm: được phép sửa nếu chưa chấm điểm VÀ (chưa hết hạn nộp HOẶC đang là nháp/yêu cầu nộp lại)
  const canEditSubmission = () => {
    if (!selectedLab) return false
    if (submissionStatus === 'graded') return false
    if (submissionStatus === 'draft' || submissionStatus === 're_submit_requested') return true
    // Nếu status === 'submitted', chỉ được sửa khi chưa quá hạn nộp
    return !isLabPastDeadline(selectedLab)
  }

  // Auto-save logic (triggers every 30 seconds during doing_lab view)
  const triggerServerSideAutoSave = async (currentAnswers) => {
    if (!selectedLab || !canEditSubmission()) return
    
    setSaveStatus('Auto-saving draft in background...')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/submissions/lab/${selectedLab.id}/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answers: currentAnswers })
      })

      if (res.ok) {
        setSaveStatus('Synced with server')
        const now = new Date()
        setLastSavedTime(now.toLocaleTimeString('en-US'))
      } else {
        setSaveStatus('Auto-save error!')
      }
    } catch (err) {
      setSaveStatus('Auto-save error!')
    }
  }

  // Effect to manage auto-save intervals
  useEffect(() => {
    if (viewState === 'doing_lab' && selectedLab && canEditSubmission()) {
      autoSaveTimerRef.current = setInterval(() => {
        triggerServerSideAutoSave(answers)
      }, 30000)
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [viewState, selectedLab, answers, submissionStatus])

  // Open Lab details and enter split-screen doing mode
  const handleOpenLab = async (lab) => {
    setLoading(true)
    setError('')
    setSelectedLab(lab)
    
    const token = localStorage.getItem('malsec_token')

    try {
      // 1. Fetch current student submission/draft if exists
      const res = await fetch(`/api/submissions/lab/${lab.id}/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const initialAnswers = {}
      lab.form_fields.forEach(f => {
        initialAnswers[f.id] = ''
      })

      if (res.ok) {
        const sub = await res.json()
        if (sub) {
          setAnswers({ ...initialAnswers, ...sub.answers })
          setFileAttachments(sub.file_attachments || [])
          setSubmissionStatus(sub.status)
          setScore(sub.score)
          setComment(sub.comment)
          setLatePenalty(sub.late_penalty)
        } else {
          setAnswers(initialAnswers)
          setFileAttachments([])
          setSubmissionStatus('draft')
          setScore(null)
          setComment('')
          setLatePenalty(0.0)
        }
      }
      
      setViewState('doing_lab')
      if (lab.class_id) {
        setSearchParams({ classId: lab.class_id, labId: lab.id })
      } else {
        setSearchParams({ labId: lab.id })
      }
      setLastSavedTime(new Date().toLocaleTimeString('en-US'))

      if (lab.enable_vm !== false) {
        fetchVmSession(lab.id)
      }
    } catch (err) {
      setError('Error loading lab submission state')
    } finally {
      setLoading(false)
    }
  }


  // In-Browser Document Preview Handler (DOCX, PDF, Code, Images)
  const handleOpenDocPreview = async (attachment) => {
    if (!attachment || !attachment.filepath) return
    const token = localStorage.getItem('malsec_token')
    const fileUrl = `/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${token}`
    const filename = attachment.original_filename || attachment.filename || 'document'
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

  // Direct manual save draft
  const handleManualSaveDraft = async () => {
    setActionLoading(true)
    await triggerServerSideAutoSave(answers)
    setActionLoading(false)
    setSuccess('Report draft saved securely on the server!')
    setTimeout(() => setSuccess(''), 3000)
  }

  // Answer field change handler
  const handleAnswerChange = (fieldId, value) => {
    const updated = { ...answers, [fieldId]: value }
    setAnswers(updated)
  }

  // Secure File upload (with Airlock anti-virus/metadata sanitize checks - supports multiple files)
  const handleFileUpload = async (fieldId, e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploadingField(fieldId)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      let lastUploadedName = ''
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/submissions/lab/${selectedLab.id}/upload/${fieldId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || `Upload failed for file ${file.name}`)
        lastUploadedName = data.filename
      }

      setSuccess(files.length > 1 ? `Successfully uploaded ${files.length} files!` : 'File uploaded successfully and verified!')
      setTimeout(() => setSuccess(''), 5000)

      // Refresh submission detail & attachments
      const detailRes = await fetch(`/api/submissions/lab/${selectedLab.id}/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (detailRes.ok) {
        const sub = await detailRes.json()
        if (sub) {
          setFileAttachments(sub.file_attachments || [])
          setAnswers(sub.answers || {})
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingField(null)
      // Reset input element value so user can re-upload same file name if needed
      e.target.value = ''
    }
  }

  // Delete attachment handler
  const handleDeleteAttachment = async (fieldId, filepath) => {
    if (!window.confirm('Are you sure you want to remove this attachment?')) return
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch(`/api/submissions/lab/${selectedLab.id}/attachment/${fieldId}?filepath=${encodeURIComponent(filepath)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error deleting attachment')

      setSuccess('Attachment removed successfully!')
      setTimeout(() => setSuccess(''), 3000)

      // Refresh attachments list
      const detailRes = await fetch(`/api/submissions/lab/${selectedLab.id}/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (detailRes.ok) {
        const sub = await detailRes.json()
        if (sub) {
          setFileAttachments(sub.file_attachments || [])
          setAnswers(sub.answers || {})
        }
      }
    } catch (err) {
      setError(err.message)
    }
  }

  // Final submission handler
  const handleSubmitSubmission = async () => {
    // Check required fields
    const missingFields = selectedLab.form_fields.filter(
      f => f.required && !answers[f.id]
    )

    if (missingFields.length > 0) {
      setError(`Please answer all required questions before submitting! Missing questions: ${missingFields.map(f => f.label).join(', ')}`)
      return
    }

    // Confirm late penalty before final submission
    const now = new Date()
    let deadline = parseVietnamDate(selectedLab.deadline)
    
    // Check personal exception extension
    const extStr = (selectedLab.individual_extensions || {})[user.username]
    if (extStr) {
      deadline = parseVietnamDate(extStr)
    }

    let warningText = 'Are you sure you want to submit your final report?'
    if (deadline && now > deadline) {
      const policy = selectedLab.late_policy || {}
      const penalty = policy.penalty_per_hour_percent || 0
      const hoursLate = (now - deadline) / 3600000.0
      const calculated = Math.min(hoursLate * penalty, policy.max_penalty_percent || 30)
      warningText = `WARNING: Submission is overdue! Submitting now incurs a late penalty of ${calculated.toFixed(1)}%. Do you still want to proceed?`
    }

    if (!confirm(warningText)) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      await triggerServerSideAutoSave(answers)
      const res = await fetch(`/api/submissions/lab/${selectedLab.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error submitting report')

      setSuccess('Your lab report has been submitted successfully!')
      setSubmissionStatus(data.status)
      fetchStudentLabs()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!vdiContainerRef.current) return
    if (!document.fullscreenElement) {
      vdiContainerRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting to enable full-screen mode:', err.message)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Switch VM Protocol Mode (VNC <-> RDP)
  const handleSwitchProtocol = async (newProtocol) => {
    if (!vmInfo || vmInfo.status !== 'running') return
    if (newProtocol === vmProtocolMode) return

    setSwitchingProtocol(true)
    setVmProtocolMode(newProtocol)
    
    const time = new Date().toLocaleTimeString('en-GB')
    if (newProtocol === 'vnc') {
      setVmOs('Standard Display (VNC Console)')
      setVmLogs([
        ...vmLogs,
        `[${time}] [-] RDP: Disconnecting session...`,
        `[${time}] [+] VNC: Establishing WebSocket display stream to port ${vmInfo?.ports?.vnc || 5900}...`,
        `[${time}] [+] VNC: Stream ready.`
      ])
    } else {
      setVmOs('FLARE-VM [Windows Security] — RDP Connection Active')
      setVmLogs([
        ...vmLogs,
        `[${time}] [-] VNC: Connection closed.`,
        `[${time}] [+] RDP: Connecting to configured lab target${vmInfo?.ip_address ? ` (${vmInfo.ip_address})` : ''}...`,
        `[${time}] [+] RDP: Connection OK.`
      ])
    }
  }

  // VM Simulator command execute simulation
  const runVmCommand = (cmd) => {
    const time = new Date().toLocaleTimeString()
    if (cmd === 'rollback') {
      setVmLogs([
        ...vmLogs,
        `[${time}] [!] GUI: Requesting PBS snapshot restoration...`,
        `[${time}] [!] Proxmox: Rolling back VM template to original clean state...`,
        `[${time}] [!] PBS: Restoration OK. RAM state purged. VM rebooting...`,
        `[${time}] [+] RDP: Connection re-established cleanly.`
      ])
      setSuccess('Malware analysis VM rolled back to clean state successfully!')
      setTimeout(() => setSuccess(''), 4000)
    } else if (cmd === 'change_os') {
      if (vmOs.includes('Windows')) {
        setVmOs('REMnux v7.0 [Linux Malware Analysis] — VNC Connection Active')
        setVmLogs([
          ...vmLogs,
          `[${time}] [-] RDP: Connection closed.`,
          `[${time}] [+] VNC: Connecting to configured lab target${vmInfo?.ip_address ? ` (${vmInfo.ip_address})` : ''}...`,
          `[${time}] [+] VNC: Handshake OK. Linux GUI Rendered.`
        ])
      } else {
        setVmOs('FLARE-VM [Windows Security] — RDP Connection Active')
        setVmLogs([
          ...vmLogs,
          `[${time}] [-] VNC: Connection closed.`,
          `[${time}] [+] RDP: Connecting to configured lab target${vmInfo?.ip_address ? ` (${vmInfo.ip_address})` : ''}...`,
          `[${time}] [+] RDP: Connection OK.`
        ])
      }
    }
  }

  // Countdown timer calculator helper (with personal exception support)
  const getRemainingTime = (lab) => {
    let deadline = parseVietnamDate(lab.deadline)
    const extStr = (lab.individual_extensions || {})[user.username]
    if (extStr) {
      deadline = parseVietnamDate(extStr)
    }

    if (!deadline) return { text: 'No Deadline', isExpired: false }
    const diff = deadline - new Date()
    if (diff <= 0) return { text: 'Overdue / Expired', isExpired: true }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    let text = ''
    if (days > 0) text += `${days}d `
    text += `${hours}h ${mins}m remaining`
    
    return { text: text, isExpired: false }
  }

  // Filter and sort active labs
  const filteredActiveLabs = activeLabs.filter(lab => {
    const matchesSearch = lab.title.toLowerCase().includes(studentLabSearch.toLowerCase()) || 
                          (lab.description && lab.description.toLowerCase().includes(studentLabSearch.toLowerCase()))
    
    const matchesClass = studentLabClassFilter === '' ? true : lab.class_id === parseInt(studentLabClassFilter)

    const sub = lab.submission
    let matchesStatus = true
    const labClass = classes.find(c => c.id === lab.class_id)
    const labSemester = labClass ? (labClass.semester || 'unknown') : 'unknown'

    // Semester filter
    if (studentSemesterFilter !== 'all' && labSemester !== studentSemesterFilter) {
      return false
    }

    // Hide past semesters toggle
    if (hidePastSemesters && studentAvailableSemesters.length > 1) {
      if (labSemester !== studentCurrentSemester && labSemester !== 'unknown') {
        return false
      }
    }

    if (studentLabStatusFilter === 'not_started') {
      matchesStatus = !sub
    } else if (studentLabStatusFilter === 'draft') {
      matchesStatus = sub && sub.status === 'draft'
    } else if (studentLabStatusFilter === 'resubmit') {
      matchesStatus = sub && sub.status === 're_submit_requested'
    }
    
    return matchesSearch && matchesClass && matchesStatus
  }).sort((a, b) => {
    if (studentLabSort === 'deadline_asc') {
      const da = parseVietnamDate(a.deadline)
      const db = parseVietnamDate(b.deadline)
      return (da?.getTime() || 0) - (db?.getTime() || 0)
    }
    if (studentLabSort === 'deadline_desc') {
      const da = parseVietnamDate(a.deadline)
      const db = parseVietnamDate(b.deadline)
      return (db?.getTime() || 0) - (da?.getTime() || 0)
    }
    if (studentLabSort === 'title_asc') {
      return a.title.localeCompare(b.title)
    }
    return 0
  })

  // Current active semester configured by Admin
  const studentCurrentSemester = React.useMemo(() => {
    const activeSem = semestersList.find(s => s.is_active)
    if (activeSem?.name) return activeSem.name
    const semSet = new Set()
    classes.forEach(c => semSet.add(c.semester || 'unknown'))
    const arr = Array.from(semSet).filter(s => s !== 'unknown').sort((a, b) => b.localeCompare(a))
    return arr[0] || 'unknown'
  }, [semestersList, classes])

  // List of unique semesters from student classes (Current active semester sorted first)
  const studentAvailableSemesters = React.useMemo(() => {
    const semSet = new Set()
    classes.forEach(c => {
      semSet.add(c.semester || 'unknown')
    })
    return Array.from(semSet).sort((a, b) => {
      // 1. Current active semester always comes first
      if (a === studentCurrentSemester && b !== studentCurrentSemester) return -1
      if (b === studentCurrentSemester && a !== studentCurrentSemester) return 1
      // 2. Unknown semester always comes last
      if (a === 'unknown') return 1
      if (b === 'unknown') return -1
      // 3. Otherwise sort reverse alphabetical (e.g. SP26, FA25)
      return b.localeCompare(a)
    })
  }, [classes, studentCurrentSemester])

  // Hierarchical Grouping for Students: Semester -> Class -> Labs (Current active semester on top)
  const studentGroupedSemesters = React.useMemo(() => {
    const semMap = {}
    filteredActiveLabs.forEach(lab => {
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
          className: cls ? cls.name : `Class #${cid}`,
          classDesc: cls?.description || '',
          semester,
          labs: []
        }
      }
      semMap[semester].classes[cid].labs.push(lab)
    })

    return Object.values(semMap).map(s => ({
      semester: s.semester,
      totalLabs: Object.values(s.classes).reduce((acc, c) => acc + c.labs.length, 0),
      classes: Object.values(s.classes)
    })).sort((a, b) => {
      // 1. Current active semester always first
      if (a.semester === studentCurrentSemester && b.semester !== studentCurrentSemester) return -1
      if (b.semester === studentCurrentSemester && a.semester !== studentCurrentSemester) return 1
      // 2. Unknown semester always last
      if (a.semester === 'unknown') return 1
      if (b.semester === 'unknown') return -1
      // 3. Otherwise reverse alphabetical
      return b.semester.localeCompare(a.semester)
    })
  }, [filteredActiveLabs, classes, studentCurrentSemester])

  // Backward compatibility alias for single group
  const groupedActiveLabs = React.useMemo(() => {
    const groups = {}
    filteredActiveLabs.forEach(lab => {
      const cid = lab.class_id || 0
      if (!groups[cid]) {
        const cls = classes.find(c => c.id === cid)
        groups[cid] = {
          classId: cid,
          className: cls ? cls.name : `Class #${cid}`,
          classDesc: cls?.description || '',
          semester: cls?.semester || 'unknown',
          labs: []
        }
      }
      groups[cid].labs.push(lab)
    })
    return Object.values(groups)
  }, [filteredActiveLabs, classes])

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

  // Filter and sort graded labs
  const filteredGradedLabs = gradedLabs.filter(lab => {
    const matchesSearch = lab.title.toLowerCase().includes(studentLabSearch.toLowerCase()) || 
                          (lab.description && lab.description.toLowerCase().includes(studentLabSearch.toLowerCase()))
    const matchesClass = studentLabClassFilter === '' ? true : lab.class_id === parseInt(studentLabClassFilter)
    return matchesSearch && matchesClass
  }).sort((a, b) => {
    return new Date(b.submission?.submitted_at) - new Date(a.submission?.submitted_at)
  })

  return (
    <div>
      {/* Toast Alerts */}
      {success && (
        <div className="plag-alert-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--neon-emerald)', color: 'var(--neon-emerald)', marginBottom: '20px' }}>
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="plag-alert-banner" style={{ marginBottom: '20px' }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW 1: STUDENT DASHBOARD GENERAL VIEW */}
      {viewState === 'dashboard' && (
        <div>
          {!selectedClass ? (
            /* ========================================================================= */
            /* MODE A: GOOGLE CLASSROOM CARD GRID (ALL ENROLLED CLASSES)                 */
            /* ========================================================================= */
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>Welcome, {user.full_name}!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Student ID: <b>{user.username}</b>{user.email && <> | Email: <b>{user.email}</b></>}. Select a class below to view assigned labs, launch VMs, and track your grades.
                </p>
              </div>

              {/* Search and Filters Bar */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                  <Terminal size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neon-cyan)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ paddingLeft: '36px', margin: 0 }}
                    placeholder="Search enrolled classes or subjects..."
                    value={classSearchQuery}
                    onChange={(e) => setClassSearchQuery(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Semester Filter */}
                  {studentAvailableSemesters.length > 0 && (
                    <select 
                      className="form-select" 
                      style={{ width: '160px', margin: 0 }}
                      value={studentSemesterFilter}
                      onChange={(e) => setStudentSemesterFilter(e.target.value)}
                      title="Filter classes by academic semester"
                    >
                      <option value="all">All Semesters</option>
                      {studentAvailableSemesters.map(sem => (
                        <option key={sem} value={sem}>{sem === 'unknown' ? 'Unknown Term' : `Semester ${sem}`}</option>
                      ))}
                    </select>
                  )}

                  {/* Hide Past Semesters Toggle */}
                  {studentAvailableSemesters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setHidePastSemesters(!hidePastSemesters)}
                      className={`btn ${hidePastSemesters ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Hide classes from previous semesters"
                    >
                      <Calendar size={14} />
                      {hidePastSemesters ? 'Active Sem Only' : 'Show All Sems'}
                    </button>
                  )}
                </div>
              </div>

              {/* Semester-Grouped Classroom Cards Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {(() => {
                  const filteredClasses = classes.filter(cls => {
                    const matchesSearch = cls.name.toLowerCase().includes(classSearchQuery.toLowerCase()) ||
                                         (cls.description && cls.description.toLowerCase().includes(classSearchQuery.toLowerCase()))
                    const matchesSemester = studentSemesterFilter === 'all' || (cls.semester || 'unknown') === studentSemesterFilter
                    const matchesActiveSem = !hidePastSemesters || (cls.semester || 'unknown') === studentCurrentSemester || (cls.semester || 'unknown') === 'unknown'
                    return matchesSearch && matchesSemester && matchesActiveSem
                  })

                  // Group by semester
                  const groupedBySem = {}
                  filteredClasses.forEach(c => {
                    const sem = c.semester || 'unknown'
                    if (!groupedBySem[sem]) groupedBySem[sem] = []
                    groupedBySem[sem].push(c)
                  })

                  const sortedSemesters = Object.keys(groupedBySem).sort((a, b) => {
                    if (a === studentCurrentSemester && b !== studentCurrentSemester) return -1
                    if (b === studentCurrentSemester && a !== studentCurrentSemester) return 1
                    if (a === 'unknown') return 1
                    if (b === 'unknown') return -1
                    return b.localeCompare(a)
                  })

                  if (sortedSemesters.length === 0) {
                    return (
                      <div className="cyber-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <School size={48} style={{ opacity: 0.3, marginBottom: '12px', color: 'var(--neon-cyan)' }} />
                        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>No Classes Found</h3>
                        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>You are not enrolled in any classes matching the current filters.</p>
                      </div>
                    )
                  }

                  const bannerThemes = [
                    { gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#3b82f6' },
                    { gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#10b981' },
                    { gradient: 'linear-gradient(135deg, #581c87 0%, #8b5cf6 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#8b5cf6' },
                    { gradient: 'linear-gradient(135deg, #9a3412 0%, #f97316 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#f97316' },
                    { gradient: 'linear-gradient(135deg, #831843 0%, #ec4899 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#ec4899' },
                    { gradient: 'linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)', badgeBg: 'rgba(255,255,255,0.2)', accent: '#14b8a6' },
                  ]

                  return sortedSemesters.map(semester => {
                    const semClasses = groupedBySem[semester]
                    const isCollapsed = !!collapsedSemesterGroups[semester]

                    return (
                      <div 
                        key={semester} 
                        style={{ 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '16px', 
                          overflow: 'hidden', 
                          background: '#ffffff',
                          boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        {/* Semester Header */}
                        <div 
                          onClick={() => toggleSemesterGroup(semester)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 20px',
                            background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)',
                            cursor: 'pointer',
                            userSelect: 'none',
                            borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isCollapsed ? <ChevronRight size={18} style={{ color: 'var(--neon-cyan)' }} /> : <ChevronDown size={18} style={{ color: 'var(--neon-cyan)' }} />}
                            <Calendar size={18} style={{ color: 'var(--neon-cyan)' }} />
                            <span style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
                              {semester === 'unknown' ? 'Unknown Academic Semester' : `Semester: ${semester}`}
                            </span>
                            {semester === studentCurrentSemester && (
                              <span className="badge badge-submitted" style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 'bold' }}>
                                Current Active Term
                              </span>
                            )}
                          </div>
                          <span className="badge badge-draft" style={{ fontSize: '12px', fontWeight: '600' }}>
                            {semClasses.length} {semClasses.length === 1 ? 'class' : 'classes'}
                          </span>
                        </div>

                        {/* Grid of Class Cards */}
                        {!isCollapsed && (
                          <div style={{
                            padding: '24px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                            gap: '24px',
                            background: '#f8fafc'
                          }}>
                            {semClasses.map((cls, idx) => {
                              const theme = bannerThemes[cls.id % bannerThemes.length]
                              const classActiveLabs = activeLabs.filter(l => l.class_id === cls.id)
                              const classGradedLabs = gradedLabs.filter(l => l.class_id === cls.id)
                              const totalClassLabs = classActiveLabs.length + classGradedLabs.length
                              
                              // Calculate student's average score in this class if any graded
                              let avgScore = null
                              if (classGradedLabs.length > 0) {
                                const validScores = classGradedLabs.map(l => l.submission?.score).filter(s => s !== null && s !== undefined)
                                if (validScores.length > 0) {
                                  avgScore = (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
                                }
                              }

                              return (
                                <div
                                  key={cls.id}
                                  onClick={() => {
                                    setSelectedClass(cls)
                                    setActiveClassTab('labs')
                                    setSearchParams({ classId: cls.id, tab: 'labs' })
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 6px -1px rgba(0, 0, 0, 0.06)',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)'
                                    e.currentTarget.style.boxShadow = '0 8px 16px -2px rgba(0, 0, 0, 0.1)'
                                    e.currentTarget.style.borderColor = theme.accent
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 2px 6px -1px rgba(0, 0, 0, 0.06)'
                                    e.currentTarget.style.borderColor = '#e2e8f0'
                                  }}
                                >
                                  {/* Google Classroom Banner */}
                                  <div style={{
                                    background: theme.gradient,
                                    padding: '20px',
                                    color: '#ffffff',
                                    minHeight: '110px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                  }}>
                                    <div>
                                      <h3 style={{ 
                                        fontSize: '18px', 
                                        fontWeight: '700', 
                                        color: '#ffffff', 
                                        margin: 0,
                                        lineHeight: '1.3'
                                      }}>
                                        {cls.name}
                                      </h3>
                                      <span style={{ 
                                        fontSize: '12px', 
                                        color: 'rgba(255,255,255,0.85)', 
                                        marginTop: '4px', 
                                        display: 'inline-block',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '100%'
                                      }}>
                                        {cls.description || 'Cybersecurity Practice Lab'}
                                      </span>
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

                                  {/* Card Body: Key Student Metrics */}
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
                                          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            {classActiveLabs.length}
                                          </div>
                                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Active Labs</div>
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
                                        <div style={{ color: '#10b981' }}>
                                          <FileCheck size={18} />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>
                                            {classGradedLabs.length}
                                          </div>
                                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Graded Labs</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Average Score / Status */}
                                    <div style={{ 
                                      fontSize: '12px', 
                                      color: 'var(--text-secondary)', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      marginTop: 'auto',
                                      paddingTop: '6px'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Award size={14} style={{ color: avgScore ? '#059669' : 'var(--text-muted)' }} />
                                        <span>Average Score:</span>
                                      </div>
                                      {avgScore !== null ? (
                                        <span style={{ fontWeight: '700', color: avgScore >= 8 ? '#059669' : avgScore >= 5 ? '#d97706' : '#dc2626', fontSize: '13px' }}>
                                          {avgScore} / 10
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>Not graded yet</span>
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
                                          setSelectedClass(cls)
                                          setActiveClassTab('labs')
                                          setSearchParams({ classId: cls.id, tab: 'labs' })
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}
                                      >
                                        <BookOpen size={12} style={{ marginRight: '3px' }} /> Labs ({totalClassLabs})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedClass(cls)
                                          setActiveClassTab('scores')
                                          setSearchParams({ classId: cls.id, tab: 'scores' })
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}
                                      >
                                        <Award size={12} style={{ marginRight: '3px' }} /> Scores ({classGradedLabs.length})
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
                  })
                })()}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* MODE B: CLASS HUB FOR STUDENT (SELECTED CLASS)                            */
            /* ========================================================================= */
            <div>
              {/* Back navigation & Class Header */}
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

                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '6px', marginBottom: 0 }}>
                      {selectedClass.description || 'Cybersecurity Practice Lab'}
                    </p>
                  </div>
                </div>

                {/* Sub-tabs within this Class: Labs vs Scores */}
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
                    Assigned Labs ({activeLabs.filter(l => l.class_id === selectedClass.id).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveClassTab('scores')
                      setSearchParams({ classId: selectedClass.id, tab: 'scores' })
                    }}
                    className={`btn ${activeClassTab === 'scores' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 16px', fontSize: '13px', fontWeight: activeClassTab === 'scores' ? '600' : '500' }}
                  >
                    <Award size={15} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
                    Grading History & Scores ({gradedLabs.filter(l => l.class_id === selectedClass.id).length})
                  </button>
                </div>
              </div>

              {/* SUB-TAB 1: ASSIGNED LABS IN THIS CLASS */}
              {activeClassTab === 'labs' && (
                <div className="cyber-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ fontSize: '18px', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={20} className="brand-icon" />
                      Assigned Practical Labs in {selectedClass.name}
                    </h3>

                    {/* Filter by status / search inside class */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select 
                        className="form-select" 
                        style={{ width: '150px', margin: 0, fontSize: '12.5px' }}
                        value={studentLabStatusFilter}
                        onChange={(e) => setStudentLabStatusFilter(e.target.value)}
                      >
                        <option value="all">All Statuses</option>
                        <option value="not_started">Not Started</option>
                        <option value="draft">Drafting</option>
                        <option value="resubmit">Resubmission Required</option>
                      </select>

                      <select 
                        className="form-select" 
                        style={{ width: '170px', margin: 0, fontSize: '12.5px' }}
                        value={studentLabSort}
                        onChange={(e) => setStudentLabSort(e.target.value)}
                      >
                        <option value="deadline_asc">Deadline (Earliest first)</option>
                        <option value="deadline_desc">Deadline (Latest first)</option>
                        <option value="title_asc">Lab Title (A-Z)</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const classActiveLabs = filteredActiveLabs.filter(l => l.class_id === selectedClass.id)

                    if (classActiveLabs.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                          <BookOpen size={36} style={{ opacity: 0.3, marginBottom: '10px', color: 'var(--neon-cyan)' }} />
                          <p style={{ margin: 0 }}>No active or pending practical labs in this class.</p>
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
                              <th>Time Remaining</th>
                              <th>Status</th>
                              <th>Instructor Feedback</th>
                              <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classActiveLabs.map(lab => {
                              const timer = getRemainingTime(lab)
                              const sub = lab.submission
                              const isExtension = (lab.individual_extensions || {})[user.username] !== undefined

                              return (
                                <tr key={lab.id}>
                                  <td style={{ fontWeight: '600', color: 'var(--neon-cyan)', maxWidth: '320px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '15px', color: 'var(--neon-cyan)' }}>
                                        {lab.title}
                                      </span>
                                      <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontSize: '11px', fontWeight: '600', padding: '1px 6px' }}>
                                        🏷️ {lab.grade_tag || 'Default'}
                                      </span>
                                    </div>
                                    {lab.description && (
                                      <div style={{ 
                                        fontSize: '12.5px', 
                                        color: 'var(--text-secondary)', 
                                        fontWeight: 'normal',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        lineHeight: '1.45',
                                        marginTop: '2px'
                                      }}>
                                        {lab.description}
                                      </div>
                                    )}
                                    {isExtension && (
                                      <span className="badge badge-submitted" style={{ marginTop: '4px', display: 'inline-block', fontSize: '9.5px', padding: '2px 6px' }}>
                                        Individual Extension Granted
                                      </span>
                                    )}
                                  </td>

                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                                    {isExtension 
                                      ? formatLocalTime(lab.individual_extensions[user.username])
                                      : formatLocalTime(lab.deadline)}
                                  </td>
                                  <td style={{ 
                                    color: timer.isExpired ? 'var(--neon-ruby)' : 'var(--neon-amber)',
                                    fontWeight: '500'
                                  }}>
                                    {timer.text}
                                  </td>
                                  <td>
                                    <span className={`badge ${
                                      !sub ? 'badge-draft' : 
                                      sub.status === 'draft' ? 'badge-draft' : 
                                      sub.status === 'submitted' ? 'badge-submitted' : 'badge-resubmit'
                                    }`}>
                                      {!sub ? 'Not Started' : 
                                       sub.status === 'draft' ? 'Draft' : 
                                       sub.status === 'submitted' ? 'Submitted' : 'Resubmission Requested'}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {sub?.comment ? sub.comment : '—'}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button onClick={() => handleOpenLab(lab)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                                      Start Lab &rarr;
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* SUB-TAB 2: GRADING HISTORY & SCORES IN THIS CLASS */}
              {activeClassTab === 'scores' && (
                <div className="cyber-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ fontSize: '18px', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={20} style={{ color: 'var(--neon-emerald)' }} />
                      Lab Grading History & Scores in {selectedClass.name}
                    </h3>
                  </div>

                  {(() => {
                    const classGradedLabs = filteredGradedLabs.filter(l => l.class_id === selectedClass.id)

                    if (classGradedLabs.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                          <Award size={36} style={{ opacity: 0.3, marginBottom: '10px', color: '#10b981' }} />
                          <p style={{ margin: 0 }}>No graded submissions found for this class yet.</p>
                        </div>
                      )
                    }

                    return (
                      <div className="table-container" style={{ margin: 0 }}>
                        <table className="cyber-table">
                          <thead>
                            <tr>
                              <th>Lab Assignment</th>
                              <th>Submission Time</th>
                              <th>Late Penalty</th>
                              <th>Instructor Feedback</th>
                              <th>Score</th>
                              <th style={{ textAlign: 'right' }}>Review</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classGradedLabs.map(lab => {
                              const sub = lab.submission
                              return (
                                <tr key={lab.id}>
                                  <td style={{ fontWeight: '500' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{lab.title}</span>
                                      <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontSize: '10.5px', fontWeight: '600', padding: '1px 6px' }}>
                                        🏷️ {lab.grade_tag || 'Default'}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                                    {formatLocalTime(sub.submitted_at)}
                                  </td>
                                  <td style={{ color: sub.late_penalty > 0 ? 'var(--neon-ruby)' : 'var(--text-secondary)' }}>
                                    {sub.late_penalty > 0 ? `Penalty: -${sub.late_penalty}%` : 'None'}
                                  </td>
                                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {sub.comment || 'No comments provided'}
                                  </td>
                                  <td style={{ fontWeight: '700', color: 'var(--neon-emerald)', fontSize: '16px' }}>
                                    {sub.score} / 10
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button onClick={() => handleOpenLab(lab)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                                      Review Submission
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SPLIT-SCREEN WORK BENCH INTERFACE */}
      {viewState === 'doing_lab' && selectedLab && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
          {/* Header navigation bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px', flexShrink: 0 }}>
            <button 
              onClick={() => { 
                setViewState('dashboard'); 
                const targetCId = selectedLab?.class_id || selectedClass?.id;
                setSelectedLab(null); 
                if (targetCId) {
                  setSearchParams({ classId: targetCId, tab: activeClassTab || 'labs' })
                } else {
                  setSearchParams({})
                }
              }} 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px' }}
            >
              &larr; Back to Dashboard
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>{selectedLab.title}</h3>
                {classes.find(c => c.id === selectedLab.class_id) && (
                  <span className="badge badge-submitted" style={{ fontSize: '11px' }}>
                    {classes.find(c => c.id === selectedLab.class_id)?.name}
                  </span>
                )}
                <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontSize: '11px', fontWeight: '600', padding: '1px 6px' }}>
                  🏷️ {selectedLab.grade_tag || 'Default'}
                </span>
                <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '500', padding: '2px 8px', border: '1px solid #cbd5e1' }} title="Submission Deadline">
                  ⏰ Deadline: <b>{formatLocalTime(getEffectiveDeadline(selectedLab))}</b>
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>Student ID: {user.username} | Status: <b>{submissionStatus}</b></p>
            </div>

            {/* Server-Side Auto-save status light & action buttons */}
            {canEditSubmission() ? (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span className="slot active" style={{ display: 'inline-block', width: '8px', height: '8px', border: 'none', padding: 0, margin: 0, borderRadius: '50%' }}>
                    <span className="tick"></span>
                  </span>
                  <span style={{ 
                    color: saveStatus.includes('error') || saveStatus.includes('Error') ? 'var(--neon-ruby)' : saveStatus.includes('Auto-saving') ? 'var(--neon-amber)' : 'var(--neon-emerald)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11.5px' 
                  }}>
                    {saveStatus} {lastSavedTime && `at ${lastSavedTime}`}
                  </span>
                </div>
                
                <button onClick={handleManualSaveDraft} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12.5px' }} disabled={actionLoading}>
                  <Save size={14} /> Save Draft
                </button>
                <button onClick={handleSubmitSubmission} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '12.5px' }} disabled={actionLoading}>
                  <Send size={14} /> {submissionStatus === 'submitted' ? 'Resubmit Report' : 'Submit Final Report'}
                </button>
              </div>
            ) : (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`badge badge-${submissionStatus}`} style={{ fontSize: '12px', padding: '5px 12px' }}>
                  {submissionStatus === 'graded' ? 'Graded (Read Only)' : 'Submitted (Locked - Past Deadline)'}
                </span>
              </div>
            )}
          </div>

          {/* Split Screen Container */}
          <div 
            className="split-container" 
            style={{ 
              flex: 1, 
              minHeight: 0,
              ...(selectedLab.enable_vm === false ? { display: 'flex', justifyContent: 'center' } : {})
            }}
          >
            
            {/* Split Left (65%): Mind-blowing Apache Guacamole RDP connection simulator */}
            {selectedLab.enable_vm !== false && (
              <div className="split-left" style={{ height: '100%' }}>
                <div 
                  ref={vmWrapperRef} 
                  className={`vm-screen-wrapper ${isVmFullscreen ? 'vm-fullscreen-mode' : ''}`} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    height: '100%',
                    background: '#090d16'
                  }}
                >
                  
                  {/* RDP Window Top bar */}
                  <div className="vm-header-bar" style={isVmFullscreen ? { background: '#0f172a', borderBottom: '1px solid #334155' } : {}}>
                    <div className="vm-title">
                      <Monitor size={15} />
                      <span>{vmOs} {isVmFullscreen && '(Full Screen)'}</span>
                    </div>
                    <div className="vm-actions">
                      <button 
                        type="button" 
                        onClick={() => fetchVmSession(selectedLab.id)} 
                        className="btn btn-secondary" 
                        disabled={vmLoading}
                        style={{ padding: '4px 8px', fontSize: '11px', background: '#374151', border: 'none', color: '#fff' }}
                      >
                        {vmLoading ? 'Initializing VM...' : 'Reload VM Session'}
                      </button>
                      <button
                        type="button"
                        onClick={focusIframe}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        disabled={!guacamoleUrl}
                        title="Click to focus keyboard on VM (switch IME/Unikey/EVKey to English [E] mode to prevent sticking keys)"
                      >
                        Capture Keyboard
                      </button>
                      <button
                        type="button"
                        onClick={handleTakeScreenshot}
                        className="btn btn-secondary"
                        style={{ padding: '4px 9px', fontSize: '11px', background: '#0284c7', border: 'none', color: '#fff', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        disabled={!guacamoleUrl || screenshotLoading}
                        title="Capture VM Screen and save directly to Desktop inside your VM (Sandbox safe)"
                      >
                        <Camera size={12} /> {screenshotLoading ? 'Capturing...' : 'Capture to VM Desktop'}
                      </button>
                      <button
                        type="button"
                        onClick={toggleVmFullscreen}
                        className="btn btn-secondary"
                        style={{ padding: '4px 9px', fontSize: '11px', background: '#059669', border: 'none', color: '#fff', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        disabled={!guacamoleUrl}
                        title={isVmFullscreen ? 'Exit Full Screen (ESC)' : 'Full Screen Mode (Keeping Toolbar & Screenshot)'}
                      >
                        {isVmFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        {isVmFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                      </button>
                      {guacamoleUrl && !isVmFullscreen && (
                        <a 
                          href={guacamoleUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--neon-cyan)', border: 'none', color: '#000', fontWeight: 'bold', textDecoration: 'none' }}
                        >
                          New Window ↗
                        </a>
                      )}
                      <button 
                        type="button" 
                        onClick={handleRollbackVm} 
                        className="btn btn-danger" 
                        disabled={vmLoading}
                        style={{ padding: '4px 8px', fontSize: '11px', border: 'none' }}
                        title="Revert VM to initial clean state on Proxmox"
                      >
                        <RotateCcw size={11} /> Rollback Clean VM (Proxmox)
                      </button>
                    </div>
                  </div>

                  {screenshotNotice && (
                    <div style={{ background: '#064e3b', color: '#6ee7b7', padding: '6px 14px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #059669' }}>
                      <span>{screenshotNotice}</span>
                      <button type="button" onClick={() => setScreenshotNotice('')} style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                    </div>
                  )}

                  {/* Real Guacamole RDP / Proxmox VM Display */}
                  <div 
                    onClick={focusIframe}
                    onMouseDown={focusIframe}
                    style={{ 
                      flex: 1, 
                      background: '#090d16', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      position: 'relative',
                      border: '1px solid #1f2937',
                      overflow: 'hidden',
                      cursor: guacamoleUrl ? 'crosshair' : 'default'
                    }}
                  >


                    {vmLoading ? (
                      <div style={{ textAlign: 'center', color: 'var(--neon-cyan)', padding: '24px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>⚡ Initializing Proxmox VM & Authorizing Guacamole...</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Connecting Linked Clone inside isolated VLAN 30 network...</p>
                      </div>
                    ) : vmError ? (
                      <div style={{ textAlign: 'center', color: 'var(--neon-ruby)', padding: '24px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>⚠️ {vmError}</div>
                        <button type="button" onClick={() => fetchVmSession(selectedLab.id)} className="btn btn-primary" style={{ padding: '6px 16px', marginTop: '12px' }}>
                          Retry Connection
                        </button>
                      </div>
                    ) : guacamoleUrl ? (
                      <iframe 
                        ref={guacamoleFrameRef}
                        key={guacamoleUrl}
                        src={guacamoleUrl} 
                        title="Apache Guacamole Proxmox VDI Desktop"
                        tabIndex="0"
                        onLoad={focusIframe}
                        onMouseEnter={focusIframe}
                        onClick={focusIframe}
                        style={{ width: '100%', height: '100%', border: 'none', outline: 'none' }}
                        allow="clipboard-read; clipboard-write; fullscreen; keyboard-map"
                      />
                    ) : (
                      <div style={{ textAlign: 'center', zIndex: 1, padding: '24px' }}>
                        <Terminal size={48} style={{ color: 'var(--neon-cyan)', marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(0, 242, 254, 0.5))' }} />
                        <h4 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>APACHE GUACAMOLE VDI LAB</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 20px' }}>
                          Malware analysis VM running inside isolated VLAN 30 on Proxmox VE.
                        </p>
                        <button type="button" onClick={() => fetchVmSession(selectedLab.id)} className="btn btn-primary" style={{ padding: '8px 20px' }}>
                          Launch VM Connection
                        </button>
                      </div>
                    )}
                  </div>


                </div>
              </div>
            )}

            {/* Split Right (35%): Dynamic Report Submission Form */}
            <div 
              className="split-right" 
              style={{ 
                height: '100%', 
                overflowY: 'auto',
                ...(selectedLab.enable_vm === false ? { width: '100%', maxWidth: '800px' } : {})
              }}
            >
              {/* Lab Description / Instructions Card */}
              {selectedLab.description && (
                <div className="cyber-card" style={{ 
                  marginBottom: '20px', 
                  padding: '16px', 
                  background: 'rgba(0, 242, 254, 0.03)', 
                  border: '1px solid rgba(0, 242, 254, 0.25)',
                  borderRadius: '8px'
                }}>
                  <h4 style={{ 
                    fontSize: '14.5px', 
                    color: 'var(--neon-cyan)', 
                    fontWeight: '600', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    marginBottom: '10px',
                    borderBottom: '1px dashed rgba(0, 242, 254, 0.2)',
                    paddingBottom: '8px'
                  }}>
                    <BookOpen size={16} /> Lab Guide & Instructions
                  </h4>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: '1.65' }}>
                    {parseMarkdown(selectedLab.description)}
                  </div>
                </div>
              )}

              {/* Lab Materials / Instructor Attachments (Tài liệu học liệu đính kèm do Giảng viên cung cấp) */}
              {/* Lab Materials / Instructor Attachments */}
              {selectedLab.attachment_files && selectedLab.attachment_files.length > 0 && (
                <div className="cyber-card" style={{
                  marginBottom: '20px',
                  padding: '16px',
                  background: 'rgba(242, 112, 36, 0.04)',
                  border: '1px solid rgba(242, 112, 36, 0.3)',
                  borderRadius: '8px'
                }}>
                  <h4 style={{
                    fontSize: '14.5px',
                    color: 'var(--neon-cyan)',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px',
                    borderBottom: '1px dashed rgba(242, 112, 36, 0.2)',
                    paddingBottom: '8px'
                  }}>
                    <Paperclip size={16} /> Lab Reference Materials & Attachments
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 10px 0' }}>
                    Reference documents, malware samples, or practice files provided by the instructor for this lab:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedLab.attachment_files.map((item, idx) => {
                      const fname = item.original_filename || item.filename || 'Document'
                      const ext = (fname || '').split('.').pop().toLowerCase()
                      const isCode = ['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go', 'txt', 'log'].includes(ext)
                      const isPdf = ext === 'pdf'
                      const isDocx = ext === 'docx'
                      const isImg = ['png', 'jpg', 'jpeg'].includes(ext)
                      const canPreview = isPdf || isDocx || isCode || isImg
                      const fileUrl = `/api/submissions/file?path=${encodeURIComponent(item.filepath)}&token=${localStorage.getItem('malsec_token')}`

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                            {isCode ? (
                              <Code size={16} style={{ color: 'var(--neon-amber)', flexShrink: 0 }} />
                            ) : isImg ? (
                              <CheckCircle size={16} style={{ color: 'var(--neon-emerald)', flexShrink: 0 }} />
                            ) : (
                              <FileText size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                            )}
                            <span style={{ fontWeight: '500', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                              {fname}
                            </span>
                            {item.size_bytes && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                ({(item.size_bytes / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                            {canPreview && (
                              <button
                                type="button"
                                onClick={() => handleOpenDocPreview({ filepath: item.filepath, original_filename: fname })}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Preview directly in browser"
                              >
                                <Eye size={13} /> View
                              </button>
                            )}
                            <a
                              href={`${fileUrl}&download=true`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '11.5px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Download to computer"
                            >
                              <Download size={13} /> Download
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '4px' }}>Lab Report Submission</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>Answer questions and attach evidence files below.</p>
              </div>


              {/* Show graded score & comments if graded */}
              {submissionStatus === 'graded' && score !== null && (
                <div className="cyber-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--neon-emerald)', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '15px', color: 'var(--neon-emerald)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Award size={16} /> Report Graded!
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--neon-emerald)', fontFamily: 'var(--font-title)', marginBottom: '8px' }}>
                    {score} / 10
                  </div>
                  {comment && (
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      <b>Feedback:</b> {comment}
                    </div>
                  )}
                </div>
              )}

              {/* Show resubmit request warning */}
              {submissionStatus === 're_submit_requested' && (
                <div className="cyber-card" style={{ background: 'rgba(255, 8, 68, 0.05)', border: '1px solid var(--neon-ruby)', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14.5px', color: 'var(--neon-ruby)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <AlertTriangle size={16} /> Resubmission Requested
                  </h4>
                  {comment && (
                    <div style={{ fontSize: '13px', color: '#fca5a5' }}>
                      <b>Instructor comments:</b> {comment}
                    </div>
                  )}
                </div>
              )}

              {/* Show edit permission banner if already submitted but before deadline */}
              {submissionStatus === 'submitted' && canEditSubmission() && (
                <div className="cyber-card" style={{ background: 'rgba(0, 243, 255, 0.05)', border: '1px solid var(--neon-cyan)', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14.5px', color: 'var(--neon-cyan)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <CheckCircle size={16} /> Submitted - Editing Enabled
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    You have submitted this report. Because the lab deadline <b>has not passed yet</b>, you can continue modifying your answers, re-upload evidence files, and click <b>"Resubmit Report"</b> to update your final submission.
                  </p>
                </div>
              )}

              {/* Show locked submission banner if submitted and past deadline */}
              {submissionStatus === 'submitted' && !canEditSubmission() && (
                <div className="cyber-card" style={{ background: 'rgba(255, 170, 0, 0.05)', border: '1px solid var(--neon-amber)', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14.5px', color: 'var(--neon-amber)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Lock size={16} /> Submitted (Submission Locked)
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Your report has been submitted and the deadline has passed. This submission is now in read-only mode.
                  </p>
                </div>
              )}

              {/* Render dynamic Form fields based on selectedLab layout */}
              {selectedLab.form_fields.map((field) => {
                const isReadOnly = !canEditSubmission()
                const ans = answers[field.id] || ''
                const fieldAttachments = (fileAttachments || []).filter(a => a.field_id === field.id)

                return (
                  <div key={field.id} className="form-group" style={{ marginBottom: '24px' }}>
                    <label className="form-label">
                      {field.label} {field.required && <span style={{ color: 'var(--neon-ruby)' }}>*</span>}
                    </label>

                    {/* FIELD TYPE: TEXT */}
                    {field.type === 'text' && (
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Enter answer..."
                        disabled={isReadOnly}
                        value={ans}
                        onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                      />
                    )}

                    {/* FIELD TYPE: SELECT dropdown */}
                    {field.type === 'select' && (
                      <select 
                        className="form-select"
                        disabled={isReadOnly}
                        value={ans}
                        onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                      >
                        <option value="">-- Select an answer --</option>
                        {field.options?.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {/* FIELD TYPE: CHECKBOX list (Select multiple) */}
                    {field.type === 'checkbox' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {isReadOnly ? (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {ans ? ans.split(', ').map((item, idx) => (
                              <span key={idx} className="badge badge-submitted" style={{ fontSize: '12px', border: '1px solid var(--neon-cyan)' }}>
                                {item}
                              </span>
                            )) : <span style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>(Empty)</span>}
                          </div>
                        ) : (
                          field.options?.map((opt, i) => {
                            const isChecked = (ans ? ans.split(', ').map(x => x.trim()) : []).includes(opt);
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
                                <input 
                                  type="checkbox" 
                                  id={`check-${field.id}-${i}`}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentVal = ans || '';
                                    let currentList = currentVal ? currentVal.split(', ').map(x => x.trim()) : [];
                                    if (e.target.checked) {
                                      if (!currentList.includes(opt)) currentList.push(opt);
                                    } else {
                                      currentList = currentList.filter(x => x !== opt);
                                    }
                                    handleAnswerChange(field.id, currentList.join(', '));
                                  }}
                                />
                                <label htmlFor={`check-${field.id}-${i}`} style={{ fontSize: '14.5px', cursor: 'pointer', color: isChecked ? 'var(--neon-cyan)' : 'var(--text-primary)' }}>
                                  {opt}
                                </label>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* FIELD TYPE: TEXTAREA (Cyberpunk Markdown Editor with Live Preview) */}
                    {field.type === 'textarea' && (
                      <MarkdownEditor 
                        value={ans}
                        onChange={(val) => handleAnswerChange(field.id, val)}
                        disabled={isReadOnly}
                      />
                    )}

                    {/* FIELD TYPE: FILE UPLOAD (Screenshots, PCAPs, Code, Word/PDF) */}
                    {field.type === 'file' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* List of currently attached files for this field */}
                        {fieldAttachments.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {fieldAttachments.map((att, attIdx) => {
                              const ext = (att.original_filename || '').split('.').pop().toLowerCase();
                              const isCode = ['c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh', 'ps1', 'rs', 'go'].includes(ext);
                              return (
                                <div 
                                  key={attIdx} 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    padding: '10px 14px', 
                                    background: 'rgba(0,0,0,0.25)', 
                                    borderRadius: '6px', 
                                    border: '1px solid var(--border-color)', 
                                    fontSize: '13px' 
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                                    {isCode ? (
                                      <Code size={16} style={{ color: 'var(--neon-amber)', flexShrink: 0 }} />
                                    ) : ['png', 'jpg', 'jpeg'].includes(ext) ? (
                                      <CheckCircle size={16} style={{ color: 'var(--neon-emerald)', flexShrink: 0 }} />
                                    ) : (
                                      <FileText size={16} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                                    )}
                                    <a 
                                      href={`/api/submissions/file?path=${encodeURIComponent(att.filepath)}&token=${localStorage.getItem('malsec_token')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: 'var(--neon-cyan)', textDecoration: 'underline', fontWeight: '500', wordBreak: 'break-all' }}
                                    >
                                      {att.original_filename}
                                    </a>
                                    {isCode && (
                                      <span className="badge badge-submitted" style={{ fontSize: '10px', padding: '1px 5px' }}>CODE</span>
                                    )}
                                  </div>

                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAttachment(field.id, att.filepath)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--neon-ruby)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginLeft: '10px'
                                      }}
                                      title="Delete this file"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Upload Zone (Multiple Files Supported) */}
                        {!isReadOnly ? (
                          <div className="upload-zone" style={{ padding: '16px 24px', marginTop: fieldAttachments.length > 0 ? '6px' : '0' }}>
                            <input 
                              type="file" 
                              multiple
                              style={{ display: 'none' }} 
                              id={`fileInput-${field.id}`}
                              onChange={(e) => handleFileUpload(field.id, e)}
                              disabled={uploadingField !== null}
                            />
                            <label htmlFor={`fileInput-${field.id}`} style={{ cursor: 'pointer', display: 'block' }}>
                              <Upload size={20} className="upload-icon" style={{ margin: '0 auto 6px' }} />
                              <p style={{ fontSize: '13px', fontWeight: '500' }}>
                                {uploadingField === field.id 
                                  ? 'SECURITY SCANNING & UPLOADING...' 
                                  : fieldAttachments.length > 0 
                                    ? '+ Attach another file (supports multiple files, code files, images, docx, pdf, zip)...'
                                    : 'Select attachment files (supports multiple files, code files, images, docx, pdf, zip)'}
                              </p>
                              {runtimeConfig?.uploads && (
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Allowed formats: {runtimeConfig.uploads.allowed_extensions.join(', ')}.
                                  {runtimeConfig.uploads.zip_password ? ` ZIP password if compressing samples: '${runtimeConfig.uploads.zip_password}'.` : ''}
                                </p>
                              )}
                            </label>
                          </div>
                        ) : fieldAttachments.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>(Empty)</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL (PDF / DOCX / CODE / IMAGE) */}
      {previewDoc && (
        <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
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
                <span className="badge" style={{ background: previewDoc.type === 'pdf' ? '#ef4444' : previewDoc.type === 'docx' ? '#2563eb' : '#059669', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>
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
                  title="Close document preview"
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
                  <p style={{ fontSize: '14px', margin: 0 }}>Loading document preview...</p>
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

              {/* IMAGE Preview */}
              {previewDoc.type === 'image' && !previewError && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px', height: '100%', overflow: 'auto', background: '#090d16' }}>
                  <img 
                    src={previewDoc.url} 
                    alt={previewDoc.filename} 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} 
                  />
                </div>
              )}

              {/* CODE / TEXT Preview */}
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
    </div>
  )
}
