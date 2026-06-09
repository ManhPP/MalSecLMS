import React, { useState, useEffect, useRef } from 'react'
import { 
  BookOpen, Terminal, Clock, FileCheck, CheckCircle, Award,
  Send, Save, Upload, ShieldAlert, Monitor, ChevronRight, Play, RotateCcw, AlertTriangle 
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
  if (!text) return <span style={{ color: 'var(--text-muted)' }}>(Trống)</span>;
  
  // Tách text theo block code ``` trước
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    // Nếu là khối code
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
    
    // Xử lý văn bản thường dòng bằng dòng (headings, bold, lists, threats)
    const lines = part.split('\n');
    return (
      <div key={index}>
        {lines.map((line, lIdx) => {
          // Tiêu đề 3: ### Title
          if (line.startsWith('### ')) {
            return <h4 key={lIdx} style={{ fontSize: '15px', color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px', fontWeight: '600', borderLeft: '3px solid var(--neon-cyan)', paddingLeft: '8px', textAlign: 'left' }}>{line.slice(4)}</h4>;
          }
          // Tiêu đề 2: ## Title
          if (line.startsWith('## ')) {
            return <h3 key={lIdx} style={{ fontSize: '17px', color: 'var(--text-primary)', marginTop: '18px', marginBottom: '10px', fontWeight: '600', textAlign: 'left' }}>{line.slice(3)}</h3>;
          }
          
          // Danh mục: - Item hoặc * Item
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.slice(2);
            return (
              <li key={lIdx} style={{ marginLeft: '20px', marginBottom: '4px', listStyleType: 'square', color: 'var(--text-primary)', textAlign: 'left' }}>
                {renderInlineFormatting(content)}
              </li>
            );
          }

          // Cảnh báo mã độc: [!] Content
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
            onClick={() => insertText('### ', 'Tiêu đề')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px' }}
            title="Thêm tiêu đề phụ"
          >
            H3
          </button>
          <button 
            type="button" 
            onClick={() => insertText('**', '**')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 'bold' }}
            title="Tô đậm văn bản"
          >
            B
          </button>
          <button 
            type="button" 
            onClick={() => insertText('```assembly\n', '\n```')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
            title="Thêm khối code"
          >
            Code
          </button>
          <button 
            type="button" 
            onClick={() => insertText('- ', 'Danh mục')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px' }}
            title="Thêm danh sách gạch đầu dòng"
          >
            List
          </button>
          <button 
            type="button" 
            onClick={() => insertText('[!] Cảnh báo: ', 'Hành vi độc hại')} 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--neon-ruby)', borderColor: 'rgba(255, 8, 68, 0.2)' }}
            title="Thêm cảnh báo nguy hại"
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
            Viết bài
          </button>
          <button 
            type="button" 
            onClick={() => setIsPreview(true)} 
            className="btn" 
            style={{ padding: '4px 10px', fontSize: '11.5px', background: isPreview ? 'var(--neon-cyan)' : 'transparent', color: isPreview ? '#ffffff' : 'var(--text-secondary)', border: 'none', fontWeight: '600' }}
          >
            Xem trước
          </button>
        </div>
      </div>
      
      {/* Editor or Preview */}
      {!isPreview ? (
        <textarea 
          ref={textareaRef}
          className="form-input form-textarea code-font" 
          style={{ margin: 0, border: 'none', borderRadius: 0, minHeight: '180px', width: '100%', display: 'block' }}
          placeholder="Nhập nội dung phân tích... Dùng công cụ Markdown phía trên để định dạng chữ đậm, tiêu đề và khối code đẹp mắt."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div style={{ padding: '16px', minHeight: '180px', background: 'rgba(5, 8, 15, 0.6)', overflowY: 'auto' }}>
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
  const [saveStatus, setSaveStatus] = useState('Đã đồng bộ với máy chủ') // 'Đang lưu nháp...' | 'Đã đồng bộ với máy chủ' | 'Lỗi lưu nháp!'
  const [lastSavedTime, setLastSavedTime] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // VM Simulator state
  const [vmActive, setVmActive] = useState(true)
  const [vmOs, setVmOs] = useState('FLARE-VM [Windows Security] — RDP Connection Active')
  const [vmLogs, setVmLogs] = useState(['[+] RDP: Connecting to 10.30.0.15:3389...', '[+] SSO: Keycloak OIDC Token accepted.', '[+] Guac: Protocol RDP v1.1.2 Handshake OK.', '[+] VM: System Active. Anti-VM malware isolation standard active.'])

  const autoSaveTimerRef = useRef(null)

  // Fetch initial labs list
  const fetchStudentLabs = async () => {
    setLoading(true)
    setError('')
    const token = localStorage.getItem('malsec_token')

    try {
      const res = await fetch('/api/labs/student/active', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Không thể lấy danh sách bài Lab của bạn')
      const allLabs = await res.json()
      
      // Lấy danh sách submission của sinh viên để phân loại bài đã nộp/chưa nộp
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
  }, [])

  // Auto-save logic (triggers every 30 seconds during doing_lab view)
  const triggerServerSideAutoSave = async (currentAnswers) => {
    if (!selectedLab || submissionStatus === 'submitted' || submissionStatus === 'graded') return
    
    setSaveStatus('Đang tự động lưu nháp ngầm...')
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
        setSaveStatus('Đã đồng bộ với máy chủ')
        const now = new Date()
        setLastSavedTime(now.toLocaleTimeString('vi-VN'))
      } else {
        setSaveStatus('Lỗi tự động lưu!')
      }
    } catch (err) {
      setSaveStatus('Lỗi tự động lưu!')
    }
  }

  // Effect to manage auto-save intervals
  useEffect(() => {
    if (viewState === 'doing_lab' && selectedLab && submissionStatus !== 'submitted' && submissionStatus !== 'graded') {
      // Thiết lập bộ đếm tự động lưu sau mỗi 30 giây
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
      setLastSavedTime(new Date().toLocaleTimeString('vi-VN'))
    } catch (err) {
      setError('Lỗi khi tải trạng thái làm bài')
    } finally {
      setLoading(false)
    }
  }

  // Direct manual save draft
  const handleManualSaveDraft = async () => {
    setActionLoading(true)
    await triggerServerSideAutoSave(answers)
    setActionLoading(false)
    setSuccess('Bản nháp báo cáo đã được lưu trữ an toàn phía Server!')
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
      if (!res.ok) throw new Error(data.detail || 'Lỗi tải lên tệp tin chứng cứ')

      setSuccess(data.message)
      setTimeout(() => setSuccess(''), 5000)

      // Cập nhật lại danh sách file đính kèm hiển thị
      const detailRes = await fetch(`/api/submissions/lab/${selectedLab.id}/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (detailRes.ok) {
        const sub = await detailRes.json()
        if (sub) {
          setFileAttachments(sub.file_attachments || [])
          // Đồng thời update câu trả lời của trường này thành tên file
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
    // Rà soát xem đã điền các trường bắt buộc chưa
    const missingFields = selectedLab.form_fields.filter(
      f => f.required && !answers[f.id]
    )

    if (missingFields.length > 0) {
      setError(`Vui lòng điền đầy đủ các câu hỏi bắt buộc trước khi nộp bài! Các câu hỏi còn thiếu: ${missingFields.map(f => f.label).join(', ')}`)
      return
    }

    // Xác nhận tính phạt nộp muộn trước khi nộp chính thức
    const now = new Date()
    let deadline = new Date(selectedLab.deadline)
    
    // Check personal exception extension
    const extStr = (selectedLab.individual_extensions || {})[user.username]
    if (extStr) {
      deadline = new Date(extStr)
    }

    let warningText = 'Bạn có chắc chắn muốn nộp bài báo cáo chính thức không?'
    if (now > deadline) {
      const policy = selectedLab.late_policy || {}
      const penalty = policy.penalty_per_hour_percent || 0
      const hoursLate = (now - deadline) / 3600000.0
      const calculated = Math.min(hoursLate * penalty, policy.max_penalty_percent || 30)
      warningText = `CẢNH BÁO: Bài làm đã quá hạn! Nộp bài lúc này sẽ bị phạt trừ ${calculated.toFixed(1)}% điểm số chấm. Bạn vẫn muốn nộp bài chứ?`
    }

    if (!confirm(warningText)) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    const token = localStorage.getItem('malsec_token')

    try {
      // Tự động gọi Save Draft lần cuối
      await triggerServerSideAutoSave(answers)

      // Nộp chính thức
      const res = await fetch(`/api/submissions/lab/${selectedLab.id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Lỗi khi nộp báo cáo')

      setSuccess('Nộp báo cáo bài tập Lab thành công! Bài làm của bạn đã chuyển sang trạng thái chờ Giảng viên chấm điểm.')
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
      setSuccess('Máy ảo phân tích malware đã được PBS tự động Rollback về trạng thái sạch thành công!')
      setTimeout(() => setSuccess(''), 4000)
    } else if (cmd === 'change_os') {
      if (vmOs.includes('Windows')) {
        setVmOs('REMnux v7.0 [Linux Malware Analysis] — VNC Connection Active')
        setVmLogs([
          ...vmLogs,
          `[${time}] [-] RDP: Connection closed.`,
          `[${time}] [+] VNC: Connecting to REMnux target (VLAN 30: 10.30.0.22)...`,
          `[${time}] [+] VNC: Handshake OK. Linux GUI Rendered.`
        ])
      } else {
        setVmOs('FLARE-VM [Windows Security] — RDP Connection Active')
        setVmLogs([
          ...vmLogs,
          `[${time}] [-] VNC: Connection closed.`,
          `[${time}] [+] RDP: Connecting to FLARE-VM target (VLAN 30: 10.30.0.15)...`,
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
    if (diff <= 0) return { text: 'Đã quá hạn nộp', isExpired: true }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    let text = ''
    if (days > 0) text += `${days} ngày `
    text += `${hours} giờ ${mins} phút`
    
    return { text: `Còn ${text}`, isExpired: false }
  }

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
            <h2 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>Chào {user.full_name}!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Mã số Sinh viên: <b>{user.username}</b>{user.email && <> | Email: <b>{user.email}</b></>}. Hãy hoàn thành các bài thực hành phân tích mã độc trước thời hạn.</p>
          </div>

          {/* Active labs checklist */}
          <div className="cyber-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} className="brand-icon" /> Các bài Lab thực hành cần làm
            </h3>
            
            <div className="table-container" style={{ margin: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Bài Lab Thực hành</th>
                    <th>Thời hạn khóa bài</th>
                    <th>Thời gian còn lại</th>
                    <th>Trạng thái bài làm</th>
                    <th>Nhận xét cũ</th>
                    <th style={{ textAlign: 'right' }}>Làm bài</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLabs.map(lab => {
                    const timer = getRemainingTime(lab)
                    const sub = lab.submission
                    const isExtension = (lab.individual_extensions || {})[user.username] !== undefined

                    return (
                      <tr key={lab.id}>
                        <td style={{ fontWeight: '600', color: 'var(--neon-cyan)' }}>
                          {lab.title}
                          {isExtension && (
                            <span className="badge badge-submitted" style={{ marginLeft: '8px', fontSize: '9.5px', padding: '2px 6px' }}>
                              Được thầy gia hạn riêng
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                          {isExtension 
                            ? new Date(lab.individual_extensions[user.username]).toLocaleString('vi-VN')
                            : new Date(lab.deadline).toLocaleString('vi-VN')}
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
                            {!sub ? 'Chưa bắt đầu' : 
                             sub.status === 'draft' ? 'Đang viết nháp' : 
                             sub.status === 'submitted' ? 'Đã nộp bài' : 'Cần nộp lại (Re-submit)'}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {sub?.comment ? sub.comment : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleOpenLab(lab)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                            Làm bài &rarr;
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {activeLabs.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tuyệt vời! Bạn không còn bài thực hành nào cần nộp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Graded labs / History */}
          <div className="cyber-card">
            <h3 style={{ fontSize: '18px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={20} style={{ color: 'var(--neon-emerald)' }} /> Lịch sử & Kết quả chấm điểm bài Lab
            </h3>
            
            <div className="table-container" style={{ margin: 0 }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Bài Lab thực hành</th>
                    <th>Thời gian nộp bài</th>
                    <th>Mức phạt muộn</th>
                    <th>Ý kiến nhận xét của Giảng viên</th>
                    <th>Điểm nhận được</th>
                    <th style={{ textAlign: 'right' }}>Xem lại</th>
                  </tr>
                </thead>
                <tbody>
                  {gradedLabs.map(lab => {
                    const sub = lab.submission
                    return (
                      <tr key={lab.id}>
                        <td style={{ fontWeight: '500' }}>{lab.title}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                          {new Date(sub.submitted_at).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ color: sub.late_penalty > 0 ? 'var(--neon-ruby)' : 'var(--text-secondary)' }}>
                          {sub.late_penalty > 0 ? `Bị phạt -${sub.late_penalty}%` : 'Không'}
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sub.comment || 'Không có nhận xét nào'}
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--neon-emerald)', fontSize: '16px' }}>
                          {sub.score} / 10
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleOpenLab(lab)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                            Xem lại bài
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {gradedLabs.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có bài làm nào được chấm điểm.</td>
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
              &larr; Về Dashboard
            </button>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{selectedLab.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>MSSV: {user.username} | Trạng thái: <b>{submissionStatus}</b></p>
            </div>

            {/* Server-Side Auto-save status light */}
            {submissionStatus !== 'submitted' && submissionStatus !== 'graded' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span className="slot active" style={{ display: 'inline-block', width: '8px', height: '8px', border: 'none', padding: 0, margin: 0, borderRadius: '50%' }}>
                    <span className="tick"></span>
                  </span>
                  <span style={{ 
                    color: saveStatus.includes('Lỗi') ? 'var(--neon-ruby)' : saveStatus.includes('Đang') ? 'var(--neon-amber)' : 'var(--neon-emerald)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11.5px' 
                  }}>
                    {saveStatus} {lastSavedTime && `lúc ${lastSavedTime}`}
                  </span>
                </div>
                
                <button onClick={handleManualSaveDraft} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12.5px' }} disabled={actionLoading}>
                  <Save size={14} /> Lưu bản nháp phía Server
                </button>
                <button onClick={handleSubmitSubmission} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '12.5px' }} disabled={actionLoading}>
                  <Send size={14} /> Nộp báo cáo chính thức
                </button>
              </div>
            )}
          </div>

          {/* Split Screen Container */}
          <div className="split-container" style={{ flex: 1, minHeight: 0 }}>
            
            {/* Split Left (65%): Mind-blowing Apache Guacamole RDP connection simulator */}
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
                      onClick={() => runVmCommand('change_os')} 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '11px', background: '#374151', border: 'none', color: '#fff' }}
                    >
                      Đổi máy ảo (Win/Linux)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => runVmCommand('rollback')} 
                      className="btn btn-danger" 
                      style={{ padding: '4px 8px', fontSize: '11px', border: 'none' }}
                      title="Phục hồi trạng thái máy ảo ban đầu qua Proxmox Backup Server"
                    >
                      <RotateCcw size={11} /> Rollback VM sạch (PBS)
                    </button>
                  </div>
                </div>

                {/* Virtual Desktop Display Simulator */}
                <div style={{ 
                  flex: 1, 
                  background: '#090d16', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  position: 'relative',
                  border: '1px solid #1f2937'
                }}>
                  {/* Glowing Grid background inside VM screen to feel virtual */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'linear-gradient(rgba(18, 24, 38, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(18, 24, 38, 0.4) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    pointerEvents: 'none'
                  }} />

                  {/* Windows / Linux Desktop HUD */}
                  <div style={{ textAlign: 'center', zIndex: 1, padding: '24px' }}>
                    <Terminal size={48} style={{ color: 'var(--neon-cyan)', marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(0, 242, 254, 0.5))' }} />
                    <h4 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>APACHE GUACAMOLE MOCK CONSOLE</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 20px' }}>
                      Mô phỏng máy ảo phân tích mã độc VLAN 30 chạy bên trong hạ tầng Proxmox của nhà trường.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <span className="badge badge-graded">Port 443 HTTPS Active</span>
                      <span className="badge badge-submitted">Network Isolation Enforced</span>
                    </div>
                  </div>

                  {/* Virtual RDP Connection Log HUD */}
                  <div style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '16px',
                    right: '16px',
                    background: 'rgba(0,0,0,0.85)',
                    border: '1px solid rgba(0, 242, 254, 0.15)',
                    borderRadius: '6px',
                    padding: '12px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: '#86efac',
                    textAlign: 'left'
                  }}>
                    {vmLogs.map((log, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Split Right (35%): Dynamic Report Submission Form */}
            <div className="split-right" style={{ height: '100%', overflowY: 'auto' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '4px' }}>Phiếu làm báo cáo</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>Điền câu trả lời và đính kèm tệp chứng cứ bên dưới.</p>
              </div>

              {/* Show graded score & comments if graded */}
              {submissionStatus === 'graded' && score !== null && (
                <div className="cyber-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--neon-emerald)', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '15px', color: 'var(--neon-emerald)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Award size={16} /> Báo cáo đã được chấm điểm!
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--neon-emerald)', fontFamily: 'var(--font-title)', marginBottom: '8px' }}>
                    {score} / 10
                  </div>
                  {comment && (
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      <b>Nhận xét:</b> {comment}
                    </div>
                  )}
                </div>
              )}

              {/* Show resubmit request warning */}
              {submissionStatus === 're_submit_requested' && (
                <div className="cyber-card" style={{ background: 'rgba(255, 8, 68, 0.05)', border: '1px solid var(--neon-ruby)', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14.5px', color: 'var(--neon-ruby)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <AlertTriangle size={16} /> Yêu cầu làm lại báo cáo (Re-submit)
                  </h4>
                  {comment && (
                    <div style={{ fontSize: '13px', color: '#fca5a5' }}>
                      <b>Yêu cầu của thầy cô:</b> {comment}
                    </div>
                  )}
                </div>
              )}

              {/* Render dynamic Form fields based on selectedLab layout */}
              {selectedLab.form_fields.map((field) => {
                const isReadOnly = submissionStatus === 'submitted' || submissionStatus === 'graded'
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
                        placeholder="Nhập thông tin..."
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
                        <option value="">-- Chọn một câu trả lời --</option>
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
                            )) : <span style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>(Trống)</span>}
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
                                Tải file khác...
                                <input 
                                  type="file" 
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleFileUpload(field.id, e)}
                                />
                              </label>
                            )}
                          </div>
                        ) : isReadOnly ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>(Trống)</span>
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
                                {uploadingField === field.id ? 'ĐANG QUÉT BẢO MẬT & TẢI FILE...' : 'Chọn file ảnh chụp/zip chứng cứ'}
                              </p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Định dạng an toàn: png, jpg, log, zip. Pass zip: 'infected'.
                              </p>
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
