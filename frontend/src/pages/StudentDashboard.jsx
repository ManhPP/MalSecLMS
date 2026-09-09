import React, { useState, useEffect, useRef } from 'react'
import { 
  BookOpen, Terminal, Clock, FileCheck, CheckCircle, Award,
  Send, Save, Upload, ShieldAlert, Monitor, ChevronRight, Play, RotateCcw, AlertTriangle,
  School, Layers, ChevronDown, Calendar
} from 'lucide-react'
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

export default function StudentDashboard() {
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
  const guacamoleFrameRef = useRef(null)

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

  // Helper tính hạn chót thực tế của sinh viên (kể cả gia hạn cá nhân)
  const getEffectiveDeadline = (lab) => {
    if (!lab) return null
    const extStr = (lab.individual_extensions || {})[user?.username]
    return extStr ? new Date(extStr) : (lab.deadline ? new Date(lab.deadline) : null)
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

  // Secure File upload (with Airlock anti-virus/metadata sanitize checks)
  const handleFileUpload = async (fieldId, e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingField(fieldId)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/submissions/lab/${selectedLab.id}/upload/${fieldId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error uploading evidence file')

      setSuccess(data.message)
      setTimeout(() => setSuccess(''), 5000)

      // Refresh attachment list
      const detailRes = await fetch(`/api/submissions/lab/${selectedLab.id}/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (detailRes.ok) {
        const sub = await detailRes.json()
        if (sub) {
          setFileAttachments(sub.file_attachments || [])
          setAnswers({ ...answers, [fieldId]: data.filename })
        }
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingField(null)
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
    let deadline = new Date(selectedLab.deadline)
    
    // Check personal exception extension
    const extStr = (selectedLab.individual_extensions || {})[user.username]
    if (extStr) {
      deadline = new Date(extStr)
    }

    let warningText = 'Are you sure you want to submit your final report?'
    if (now > deadline) {
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

      // Submit final
      const res = await fetch(`/api/submissions/lab/${selectedLab.id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error submitting report')

      setSuccess('Lab report submitted successfully! Your submission is now awaiting instructor grading.')
      setSubmissionStatus(data.status)
      setLatePenalty(data.late_penalty)
      fetchStudentLabs()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
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
    let deadline = new Date(lab.deadline)
    const extStr = (lab.individual_extensions || {})[user.username]
    if (extStr) {
      deadline = new Date(extStr)
    }

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
      return new Date(a.deadline) - new Date(b.deadline)
    }
    if (studentLabSort === 'deadline_desc') {
      return new Date(b.deadline) - new Date(a.deadline)
    }
    if (studentLabSort === 'title_asc') {
      return a.title.localeCompare(b.title)
    }
    return 0
  })

  // List of unique semesters from student classes
  const studentAvailableSemesters = React.useMemo(() => {
    const semSet = new Set()
    classes.forEach(c => {
      semSet.add(c.semester || 'unknown')
    })
    return Array.from(semSet).sort((a, b) => {
      if (a === 'unknown') return 1
      if (b === 'unknown') return -1
      return b.localeCompare(a)
    })
  }, [classes])

  // Current active semester configured by Admin
  const studentCurrentSemester = React.useMemo(() => {
    const activeSem = semestersList.find(s => s.is_active)
    if (activeSem?.name) return activeSem.name
    return studentAvailableSemesters.find(s => s !== 'unknown') || studentAvailableSemesters[0] || 'unknown'
  }, [semestersList, studentAvailableSemesters])

  // Hierarchical Grouping for Students: Semester -> Class -> Labs
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
      if (a.semester === 'unknown') return 1
      if (b.semester === 'unknown') return -1
      return b.semester.localeCompare(a.semester)
    })
  }, [filteredActiveLabs, classes])

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
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>Welcome, {user.full_name}!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Student ID: <b>{user.username}</b>{user.email && <> | Email: <b>{user.email}</b></>}. Complete your assigned malware analysis practical labs before deadlines.</p>
          </div>

          {/* Search and Filters Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <Terminal size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neon-cyan)' }} />
              <input 
                type="text" 
                className="form-input" 
                style={{ paddingLeft: '36px', margin: 0 }}
                placeholder="Search labs..."
                value={studentLabSearch}
                onChange={(e) => setStudentLabSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Semester Filter */}
              {studentAvailableSemesters.length > 0 && (
                <select 
                  className="form-select" 
                  style={{ width: '150px', margin: 0 }}
                  value={studentSemesterFilter}
                  onChange={(e) => setStudentSemesterFilter(e.target.value)}
                  title="Filter by academic semester"
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
                  style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Hide labs from previous semesters"
                >
                  <Calendar size={13} />
                  {hidePastSemesters ? 'Active Sem Only' : 'Show All Sems'}
                </button>
              )}

              {/* Class Filter */}
              {classes.length > 1 && (
                <select 
                  className="form-select" 
                  style={{ width: '160px', margin: 0 }}
                  value={studentLabClassFilter}
                  onChange={(e) => setStudentLabClassFilter(e.target.value)}
                >
                  <option value="">All Classes</option>
                  {classes
                    .filter(c => !hidePastSemesters || (c.semester || 'unknown') === studentCurrentSemester || (c.semester || 'unknown') === 'unknown')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.semester && c.semester !== 'unknown' ? `(${c.semester})` : ''}
                      </option>
                    ))}
                </select>
              )}

              {/* Filter Lab Status */}
              <select 
                className="form-select" 
                style={{ width: '150px', margin: 0 }}
                value={studentLabStatusFilter}
                onChange={(e) => setStudentLabStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="draft">Drafting</option>
                <option value="resubmit">Resubmission Required</option>
              </select>

              {/* Sort */}
              <select 
                className="form-select" 
                style={{ width: '170px', margin: 0 }}
                value={studentLabSort}
                onChange={(e) => setStudentLabSort(e.target.value)}
              >
                <option value="deadline_asc">Deadline (Earliest first)</option>
                <option value="deadline_desc">Deadline (Latest first)</option>
                <option value="title_asc">Lab Title (A-Z)</option>
              </select>

              {/* Group By Class Toggle */}
              <button
                type="button"
                onClick={() => setLabGroupByClass(!labGroupByClass)}
                className={`btn ${labGroupByClass ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Toggle hierarchical grouping by semester and class"
              >
                <Layers size={14} />
                {labGroupByClass ? 'Hierarchical Grouping' : 'Flat List'}
              </button>
            </div>
          </div>

          {/* Active labs checklist */}
          <div className="cyber-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} className="brand-icon" /> Assigned Practical Labs
            </h3>
            
            {labGroupByClass ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {studentGroupedSemesters.map(semGroup => {
                  const isSemCollapsed = !!collapsedSemesterGroups[semGroup.semester]
                  return (
                    <div 
                      key={semGroup.semester}
                      style={{ 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        background: '#ffffff',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      {/* Tier 1: Semester Header */}
                      <div 
                        onClick={() => toggleSemesterGroup(semGroup.semester)}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '12px 18px', 
                          background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%)', 
                          cursor: 'pointer',
                          borderBottom: isSemCollapsed ? 'none' : '1px solid #cbd5e1',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isSemCollapsed ? <ChevronRight size={18} style={{ color: 'var(--neon-cyan)' }} /> : <ChevronDown size={18} style={{ color: 'var(--neon-cyan)' }} />}
                          <Calendar size={18} style={{ color: 'var(--neon-cyan)' }} />
                          <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                            {semGroup.semester === 'unknown' ? 'Academic Term: Unknown' : `Academic Semester: ${semGroup.semester}`}
                          </span>
                          {semGroup.semester === studentCurrentSemester && (
                            <span className="badge badge-submitted" style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                              Current Active Term
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-draft" style={{ fontSize: '11.5px', fontWeight: '600' }}>
                            {semGroup.classes.length} {semGroup.classes.length === 1 ? 'class' : 'classes'}
                          </span>
                          <span className="badge badge-submitted" style={{ fontSize: '11.5px', fontWeight: '600' }}>
                            {semGroup.totalLabs} {semGroup.totalLabs === 1 ? 'lab' : 'labs'}
                          </span>
                        </div>
                      </div>

                      {/* Tier 2: Classes within Semester */}
                      {!isSemCollapsed && (
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
                          {semGroup.classes.map(clsGroup => {
                            const isClassCollapsed = !!collapsedClassGroups[clsGroup.classId]
                            return (
                              <div 
                                key={clsGroup.classId}
                                style={{ 
                                  border: '1px solid var(--border-color)', 
                                  borderRadius: '8px', 
                                  overflow: 'hidden', 
                                  background: '#ffffff',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                                }}
                              >
                                {/* Class Header */}
                                <div 
                                  onClick={() => toggleClassGroup(clsGroup.classId)}
                                  style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    padding: '12px 16px', 
                                    background: '#ffffff', 
                                    cursor: 'pointer',
                                    borderBottom: isClassCollapsed ? 'none' : '1px solid var(--border-color)',
                                    userSelect: 'none'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isClassCollapsed ? <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
                                    <School size={16} style={{ color: 'var(--neon-cyan)' }} />
                                    <span style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                      {clsGroup.className}
                                    </span>
                                    {clsGroup.classDesc && (
                                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        — {clsGroup.classDesc}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="badge badge-submitted" style={{ fontSize: '11px', fontWeight: '600' }}>
                                      {clsGroup.labs.length} {clsGroup.labs.length === 1 ? 'lab' : 'labs'}
                                    </span>
                                  </div>
                                </div>

                                {/* Tier 3: Labs Table */}
                                {!isClassCollapsed && (
                                  <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                                    <table className="cyber-table">
                                      <thead>
                                        <tr>
                                          <th>Lab Assignment</th>
                                          <th>Deadline</th>
                                          <th>Time Remaining</th>
                                          <th>Status</th>
                                          <th>Previous Feedback</th>
                                          <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {clsGroup.labs.map(lab => {
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
                                                  ? new Date(lab.individual_extensions[user.username]).toLocaleString('en-US')
                                                  : new Date(lab.deadline).toLocaleString('en-US')}
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
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {studentGroupedSemesters.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No matching practical labs found.
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
                      <th>Time Remaining</th>
                      <th>Status</th>
                      <th>Previous Feedback</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActiveLabs.map(lab => {
                      const timer = getRemainingTime(lab)
                      const sub = lab.submission
                      const isExtension = (lab.individual_extensions || {})[user.username] !== undefined
                      const cls = classes.find(c => c.id === lab.class_id)

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

                          <td>
                            <span className="badge badge-submitted" style={{ fontSize: '11px' }}>
                              {cls ? cls.name : `Class #${lab.class_id}`}
                            </span>
                          </td>

                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                            {isExtension 
                              ? new Date(lab.individual_extensions[user.username]).toLocaleString('en-US')
                              : new Date(lab.deadline).toLocaleString('en-US')}
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
                    {filteredActiveLabs.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No matching practical labs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Graded labs / History */}
          <div className="cyber-card">
            <h3 style={{ fontSize: '18px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={20} style={{ color: 'var(--neon-emerald)' }} /> Lab Grading History & Scores
            </h3>
            
            <div className="table-container" style={{ margin: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Lab Assignment</th>
                    <th>Class</th>
                    <th>Submission Time</th>
                    <th>Late Penalty</th>
                    <th>Instructor Feedback</th>
                    <th>Score</th>
                    <th style={{ textAlign: 'right' }}>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGradedLabs.map(lab => {
                    const sub = lab.submission
                    const cls = classes.find(c => c.id === lab.class_id)
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
                        <td>
                          <div>
                            <span className="badge badge-submitted" style={{ fontSize: '11px' }}>
                              {cls ? cls.name : `Class #${lab.class_id}`}
                            </span>
                          </div>
                          {cls?.semester && (
                            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px', marginTop: '3px', display: 'inline-block' }}>
                              📅 {cls.semester}
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                          {new Date(sub.submitted_at).toLocaleString('en-US')}
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
                  {filteredGradedLabs.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No graded submissions or matching labs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SPLIT-SCREEN WORK BENCH INTERFACE */}
      {viewState === 'doing_lab' && selectedLab && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
          {/* Header navigation bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px', flexShrink: 0 }}>
            <button onClick={() => { setViewState('dashboard'); setSelectedLab(null); }} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
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
                <div className="vm-screen-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  
                  {/* RDP Window Top bar */}
                  <div className="vm-header-bar">
                    <div className="vm-title">
                      <Monitor size={15} />
                      <span>{vmOs}</span>
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
                        onClick={() => guacamoleFrameRef.current?.focus()}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        disabled={!guacamoleUrl}
                        title="Direct keyboard focus to virtual machine"
                      >
                        Capture Keyboard
                      </button>
                      {guacamoleUrl && (
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

                  {/* Real Guacamole RDP / Proxmox VM Display */}
                  <div style={{ 
                    flex: 1, 
                    background: '#090d16', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    position: 'relative',
                    border: '1px solid #1f2937',
                    overflow: 'hidden'
                  }}>
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
                        onLoad={() => guacamoleFrameRef.current?.focus()}
                        onMouseEnter={() => guacamoleFrameRef.current?.focus()}
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
                const attachment = fileAttachments.find(a => a.field_id === field.id)

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

                    {/* FIELD TYPE: FILE UPLOAD (Screenshots, PCAPs) */}
                    {field.type === 'file' && (
                      <div>
                        {attachment ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                            <span style={{ color: 'var(--neon-cyan)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle size={15} />
                              <a 
                                href={`/api/submissions/file?path=${encodeURIComponent(attachment.filepath)}&token=${localStorage.getItem('malsec_token')}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--neon-cyan)', textDecoration: 'underline' }}
                              >
                                {attachment.original_filename}
                              </a>
                            </span>
                            {!isReadOnly && (
                              <label style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>
                                Upload different file...
                                <input 
                                  type="file" 
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleFileUpload(field.id, e)}
                                />
                              </label>
                            )}
                          </div>
                        ) : isReadOnly ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>(Empty)</span>
                        ) : (
                          <div className="upload-zone" style={{ padding: '16px 24px' }}>
                            <input 
                              type="file" 
                              style={{ display: 'none' }} 
                              id={`fileInput-${field.id}`}
                              onChange={(e) => handleFileUpload(field.id, e)}
                              disabled={uploadingField !== null}
                            />
                            <label htmlFor={`fileInput-${field.id}`} style={{ cursor: 'pointer', display: 'block' }}>
                              <Upload size={20} className="upload-icon" style={{ margin: '0 auto 6px' }} />
                              <p style={{ fontSize: '13px', fontWeight: '500' }}>
                                {uploadingField === field.id ? 'SCANNING SECURITY & UPLOADING...' : 'Choose document (PDF, DOCX), image or ZIP file'}
                              </p>
                              {runtimeConfig?.uploads && (
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Allowed formats: {runtimeConfig.uploads.allowed_extensions.join(', ')}.
                                  {runtimeConfig.uploads.zip_password ? ` ZIP password: '${runtimeConfig.uploads.zip_password}'.` : ''}
                                </p>
                              )}
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
