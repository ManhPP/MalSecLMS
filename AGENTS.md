# MalSec - AI Coding Agents Guide & Protocol (AGENTS.md)

This file is the **single unified guide and protocol** for all **AI Coding Agents** (Antigravity, Cursor, Windsurf, Cline / Roo Code, Claude Code, GitHub Copilot, Aider, etc.) working on the MalSec LMS repository.

---

## 🚀 Quick Reference Commands

### Local Development & Build
```powershell
# Frontend Development (Vite)
cd frontend
npm install
npm run dev

# Backend Development (FastAPI)
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Production Deployment to `ubuntu-105` (Main Production)
```powershell
tar -czf malsec_deploy.tar.gz --exclude=".git" --exclude="node_modules" --exclude="dist" --exclude="malsec_deploy.tar.gz" .
scp malsec_deploy.tar.gz ubuntu-105:/home/iahn/malsec_deploy.tar.gz
ssh ubuntu-105 "mkdir -p /home/iahn/malsec && tar -xzf /home/iahn/malsec_deploy.tar.gz -C /home/iahn/malsec && rm /home/iahn/malsec_deploy.tar.gz && cd /home/iahn/malsec && echo 'KhongQuanLieu' | sudo -S docker compose up -d --build"
Remove-Item -Path "malsec_deploy.tar.gz" -Force
```

### Staging Deployment to `ubuntu-106` (Test Environment)
```powershell
tar -czf malsec_deploy.tar.gz --exclude=".git" --exclude="node_modules" --exclude="dist" --exclude="malsec_deploy.tar.gz" .
scp malsec_deploy.tar.gz ubuntu-106:/home/iahn/malsec_deploy.tar.gz
ssh ubuntu-106 "mkdir -p /home/iahn/malsec && tar -xzf /home/iahn/malsec_deploy.tar.gz -C /home/iahn/malsec && rm /home/iahn/malsec_deploy.tar.gz && cd /home/iahn/malsec && echo 'KhongQuanLieu' | sudo -S docker compose up -d --build"
Remove-Item -Path "malsec_deploy.tar.gz" -Force
```

### Proxmox VE Administration & Diagnostics
```bash
# SSH Access to Proxmox Node
ssh pve01-cf

# Proxmox QEMU VM List & Control
qm list
qm config <vmid>
qm start <vmid>
qm stop <vmid>
qm destroy <vmid> --purge 1
qm guest cmd <vmid> network-get-interfaces
```

---

## 🏗️ System Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 18 (Vite), Vanilla CSS, Lucide React | Cyberpunk dark theme UI, responsive VDI canvas, Markdown viewer, dynamic form builder, UserProfileModal |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy ORM, Pydantic v2 | JWT Auth, REST API, Proxmoxer API client, Guacamole HMAC/AES-128-CBC Token engine |
| **Database** | PostgreSQL 16 | Relational store for Users, Classes, Labs, Submissions, Audit Logs |
| **VDI Proxy** | Apache Guacamole 1.6.0 (LXC 103) | `guacamole-auth-json` plugin, guacd daemon, RDP (3389) protocol translation |
| **Hypervisor** | Proxmox VE (pve01) | Full-clone orchestration, MAC sync, isolated VLAN 30 network |

---

## 📐 VMID Allocation & Security Boundary Scheme

1. **`VMID < 1000` (Infrastructure Segment)**:
   - Reserved for system hosts (`pfSense Gateway 100`, `Guacamole LXC 103`, `Ubuntu 105`, `Ubuntu Staging 106`).
   - **SECURITY RULE**: AI agents MUST NEVER issue delete/purge/stop commands for VMIDs in this range.

2. **`1000 <= VMID <= 2000` (Master Templates)**:
   - Reserved for Lab Master Templates (e.g. `1001 Win-1`, `1004 Custom FLARE-VM`, `1002 ubuntu-1`).
   - Instructors select templates from this range when creating labs.

3. **`10000 <= VMID <= 20000` (Student Cloned VMs)**:
   - Dynamically generated via formula: `10000 + (student_num * 10) + lab_id`.
   - Strictly enforced by backend security guards (`control_student_vm` and `rollback_student_vm`).

---

## 📁 Repository Directory Structure

```text
MalSec/
├── AGENTS.md                   # Unified AI Agent Guide & Rules (Single Source of Truth)
├── DEVELOPMENT_GUIDE.md        # Comprehensive Dev & Ops Guide
├── agent.md                    # Detailed handoff & inventory reference
├── docker-compose.yml          # Container orchestration (Backend, Frontend, PostgreSQL)
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint & middleware
│   │   ├── config.py           # Environment settings & VMID ranges
│   │   ├── database.py         # SQLAlchemy DB session engine
│   │   ├── models.py           # Database models (User, Class, Lab, Submission, AuditLog)
│   │   ├── schemas.py          # Pydantic schemas for request/response validation
│   │   ├── security.py         # Password hashing & JWT token creation
│   │   ├── request_utils.py    # IP helper utilities
│   │   ├── routers/            # API Endpoints (auth, users, classes, labs, submissions, admin)
│   │   └── services/
│   │       ├── vm_service.py   # Proxmox API orchestration & Guacamole Encrypted JSON generator
│   │       └── file_service.py # Uploads & ZIP packaging
│   ├── Dockerfile
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx             # React router, AuthContext, UserProfileModal
    │   ├── main.jsx            # React mount point
    │   ├── index.css           # Cyberpunk design system tokens & CSS variables
    │   └── pages/
    │       ├── StudentDashboard.jsx     # Student portal, Markdown Lab guide, VDI iFrame
    │       ├── InstructorDashboard.jsx  # Instructor portal, Speed Grader, VM Manager
    │       ├── AdminDashboard.jsx       # Admin portal, User management, Class management
    │       └── Login.jsx                # Login page
    ├── nginx.conf              # Production Nginx reverse proxy configuration
    ├── Dockerfile
    └── package.json
```

---

## 🔒 Safety Rules for AI Coding Agents

1. **Preserve Database & Volume Data**:
   - Never run destructive commands like `docker compose down -v` or `DROP DATABASE` on production.
2. **Respect VM Security Boundaries**:
   - All VM delete/purge operations MUST validate `10000 <= vmid <= 20000`.
3. **No Unnecessary State Changes**:
   - Never mutate production data unless explicitly requested by the user.
4. **End-to-End Verification**:
   - After updating code, always test the build and verify the deployment on `ubuntu-105` or `ubuntu-106`.
