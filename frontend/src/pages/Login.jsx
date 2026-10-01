import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App.jsx'
import { 
  ShieldAlert, Key, User, Cpu, ShieldCheck, Binary, Activity, 
  Radar, Bug, AlertTriangle, Database, Zap, CheckCircle2, Lock
} from 'lucide-react'

// Canvas Background with Disassembly / Hex / Memory Stream and Circuit Nodes + Threat Detection Pulses
const ReverseAnimationCanvas = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Reverse engineering opcode snippets & PE header hex & malware signatures
    const opcodes = [
      '4D 5A 90 00 ; MZ_MAGIC',
      'xor eax, eax ; CLEAR_REG',
      'push rbp',
      'mov rsp, rbp',
      'call sub_004012A0',
      'test eax, eax',
      'jz loc_004018F0',
      'sub esp, 0x20',
      'mov [ebp-4], 0x1',
      'nop ; 0x90 SLEDS',
      'int 3 ; BREAKPOINT',
      'lea rax, [rdi+8]',
      'jmp short 0x12',
      '0x75 0x07 ; jne',
      'PE32+ Section .text (R-X)',
      'Section .rsrc (Entropy: 7.92)',
      'VirtualProtect(PAGE_EXEC_RW)',
      'CreateRemoteThread -> Injection',
      'IsDebuggerPresent() -> Bypassed',
      'YARA: Win32.Trojan.AgentTesla',
      'Hook: ntdll!NtQuerySystemInfo',
      'Heuristic: High-Entropy Section',
      'API Unhooking detected'
    ]

    // Create floating stream particles
    const columns = Math.floor(width / 80)
    const streamItems = []

    for (let i = 0; i < columns; i++) {
      streamItems.push({
        x: i * 80 + Math.random() * 25,
        y: Math.random() * height,
        speed: 0.6 + Math.random() * 0.9,
        text: opcodes[Math.floor(Math.random() * opcodes.length)],
        opacity: 0.12 + Math.random() * 0.22,
        colorType: Math.random() > 0.65 ? 'orange' : (Math.random() > 0.5 ? 'ruby' : 'gray')
      })
    }

    // Circuit graph nodes for malware sandbox topology
    const nodes = []
    const nodeCount = Math.min(30, Math.floor(width / 55))
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: 2 + Math.random() * 2.5,
        isThreatNode: Math.random() > 0.75
      })
    }

    // Crawling Malware / Bug Agents exploring the circuit grid
    const bugAgents = []
    const bugCount = 7
    for (let i = 0; i < bugCount; i++) {
      bugAgents.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.9,
        size: 14 + Math.random() * 6,
        label: ['[VIRUS]', '[TROJAN]', '[WORM]', '[EXPLOIT]', '[ROOTKIT]', '[SPYWARE]', '[RANSOM]'][i % 7],
        color: i % 2 === 0 ? 'rgba(220, 38, 38, 0.75)' : 'rgba(242, 112, 36, 0.85)',
        legAngle: 0
      })
    }

    let mouse = { x: -1000, y: -1000 }
    const handleMouseMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // 1. Draw subtle circuit grid lines connecting nodes
      ctx.lineWidth = 0.7
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 160) {
            const alpha = (1 - dist / 160) * 0.15
            if (nodes[i].isThreatNode || nodes[j].isThreatNode) {
              ctx.strokeStyle = `rgba(220, 38, 38, ${alpha * 1.2})`
            } else {
              ctx.strokeStyle = `rgba(242, 112, 36, ${alpha})`
            }
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw and update circuit nodes
      for (let node of nodes) {
        node.x += node.vx
        node.y += node.vy

        if (node.x < 0 || node.x > width) node.vx *= -1
        if (node.y < 0 || node.y > height) node.vy *= -1

        // Mouse interaction: push away slightly
        const dx = node.x - mouse.x
        const dy = node.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 130) {
          node.x += (dx / dist) * 1.2
          node.y += (dy / dist) * 1.2
        }

        if (node.isThreatNode) {
          ctx.fillStyle = 'rgba(220, 38, 38, 0.4)'
        } else {
          ctx.fillStyle = 'rgba(242, 112, 36, 0.3)'
        }
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // 2. Draw Disassembly / Hex stream column tickers
      ctx.font = '500 11px "JetBrains Mono", Courier, monospace'
      for (let item of streamItems) {
        item.y += item.speed
        if (item.y > height + 30) {
          item.y = -30
          item.x = Math.random() * width
          item.text = opcodes[Math.floor(Math.random() * opcodes.length)]
        }

        if (item.colorType === 'orange') {
          ctx.fillStyle = `rgba(242, 112, 36, ${item.opacity * 1.3})`
        } else if (item.colorType === 'ruby') {
          ctx.fillStyle = `rgba(220, 38, 38, ${item.opacity * 1.4})`
        } else {
          ctx.fillStyle = `rgba(100, 116, 139, ${item.opacity})`
        }

        ctx.fillText(item.text, item.x, item.y)
      }

      // 3. Draw Cyber Bugs / Malware Insects crawling around
      for (let bug of bugAgents) {
        bug.x += bug.vx
        bug.y += bug.vy
        bug.legAngle += 0.15

        if (bug.x < -30) bug.x = width + 30
        if (bug.x > width + 30) bug.x = -30
        if (bug.y < -30) bug.y = height + 30
        if (bug.y > height + 30) bug.y = -30

        ctx.save()
        ctx.translate(bug.x, bug.y)
        const angle = Math.atan2(bug.vy, bug.vx)
        ctx.rotate(angle)

        // Draw Bug Body
        ctx.fillStyle = bug.color
        ctx.beginPath()
        ctx.ellipse(0, 0, bug.size * 0.6, bug.size * 0.4, 0, 0, Math.PI * 2)
        ctx.fill()

        // Draw Bug Head
        ctx.beginPath()
        ctx.arc(bug.size * 0.55, 0, bug.size * 0.25, 0, Math.PI * 2)
        ctx.fill()

        // Draw Legs (animated wiggle)
        ctx.strokeStyle = bug.color
        ctx.lineWidth = 1.2
        const legWiggle = Math.sin(bug.legAngle) * 3
        // Left legs
        ctx.beginPath()
        ctx.moveTo(0, -bug.size * 0.35)
        ctx.lineTo(-bug.size * 0.2 + legWiggle, -bug.size * 0.8)
        ctx.moveTo(bug.size * 0.3, -bug.size * 0.3)
        ctx.lineTo(bug.size * 0.2 - legWiggle, -bug.size * 0.75)
        ctx.moveTo(-bug.size * 0.3, -bug.size * 0.3)
        ctx.lineTo(-bug.size * 0.45 - legWiggle, -bug.size * 0.75)
        // Right legs
        ctx.moveTo(0, bug.size * 0.35)
        ctx.lineTo(-bug.size * 0.2 - legWiggle, bug.size * 0.8)
        ctx.moveTo(bug.size * 0.3, bug.size * 0.3)
        ctx.lineTo(bug.size * 0.2 + legWiggle, bug.size * 0.75)
        ctx.moveTo(-bug.size * 0.3, bug.size * 0.3)
        ctx.lineTo(-bug.size * 0.45 + legWiggle, bug.size * 0.75)
        ctx.stroke()

        // Label above bug
        ctx.rotate(-angle)
        ctx.font = '600 9.5px "JetBrains Mono", monospace'
        ctx.fillStyle = bug.color
        ctx.textAlign = 'center'
        ctx.fillText(bug.label, 0, -bug.size - 2)

        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  )
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const { user, login } = useAuth()
  const navigate = useNavigate()

  // Load Remembered Credentials from LocalStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('malsec_saved_username')
      const savedPass = localStorage.getItem('malsec_saved_password')
      if (savedUser) {
        setUsername(savedUser)
        setRememberMe(true)
      }
      if (savedPass) {
        setPassword(atob(savedPass))
      }
    } catch {
      // Ignore if decoding fails
    }
  }, [])

  // Check for session expired banner
  useEffect(() => {
    const expiredMsg = sessionStorage.getItem('malsec_session_expired')
    if (expiredMsg) {
      setError(expiredMsg)
      sessionStorage.removeItem('malsec_session_expired')
    }
  }, [])

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (user.role === 'lecturer') {
        navigate('/lecturer', { replace: true })
      } else {
        navigate('/student', { replace: true })
      }
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Please enter both username and password')
      return
    }

    // Handle Remember Password
    if (rememberMe) {
      localStorage.setItem('malsec_saved_username', username)
      localStorage.setItem('malsec_saved_password', btoa(password))
    } else {
      localStorage.removeItem('malsec_saved_username')
      localStorage.removeItem('malsec_saved_password')
    }

    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed')
      }

      // Store session in AuthContext
      login({
        username: data.username,
        full_name: data.full_name,
        role: data.role
      }, data.access_token)

      // Navigate by role
      if (data.role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (data.role === 'lecturer') {
        navigate('/lecturer', { replace: true })
      } else {
        navigate('/student', { replace: true })
      }

    } catch (err) {
      setError(err.message || 'Connection error to security server')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page-container">
      {/* Dynamic Malware & Reverse Analysis Stream Canvas with crawling bugs */}
      <ReverseAnimationCanvas />

      {/* Centered Clean Login Card */}
      <div className="login-card-interactive">
        
        {/* Animated Radar Sweep & Logo */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div className="radar-logo-wrapper">
            <div className="radar-ring" />
            <div className="radar-sweep-beam" />
            <div className="radar-inner-icon">
              <Cpu size={30} style={{ animation: 'pulseRadarRing 3s ease-in-out infinite' }} />
            </div>
          </div>

          <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
            MALSEC PORTAL
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Malware Analysis & Lab Learning Management System
          </p>

          {/* Reverse Engineering Ticker Badges on single row */}
          <div className="asm-ticker-bar">
            <span className="opcode-badge">
              <Binary size={12} /> x86_64 Disasm
            </span>
            <span className="opcode-badge blue">
              <Activity size={12} /> Dynamic Sandbox
            </span>
            <span className="opcode-badge green">
              <ShieldCheck size={12} /> Isolated VDI
            </span>
          </div>
        </div>

        {error && (
          <div className="plag-alert-banner" style={{ marginBottom: '20px' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="username">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> Student ID / Lecturer Username
              </span>
            </label>
            <input
              type="text"
              id="username"
              className="form-input"
              placeholder="e.g. SE170000 / lecturer"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              autoComplete="username"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="password">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} /> Access Password
              </span>
            </label>
            <input
              type="password"
              id="password"
              className="form-input"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoComplete="current-password"
            />
          </div>

          {/* Remember Password Checkbox */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            fontSize: '13px'
          }}>
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none',
              color: 'var(--text-secondary)'
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--neon-cyan)',
                  cursor: 'pointer'
                }}
              />
              <span>Remember password</span>
            </label>

            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} /> Auto-save
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', fontSize: '15px' }}
            disabled={submitting}
          >
            {submitting ? 'DECRYPTING & AUTHENTICATING...' : 'SIGN IN TO SYSTEM'}
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}>
          <span style={{ animation: 'subtleBlink 2s infinite' }}>[!]</span> Active monitoring & isolated sandbox session.
        </div>
      </div>
    </div>
  )
}




