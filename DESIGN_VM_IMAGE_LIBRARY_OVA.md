# ĐẶC TẢ THIẾT KẾ — THƯ VIỆN BASE VM (UPLOAD OVA, TEST VM & QUẢN TRỊ ADMIN)

> **Trạng thái:** Thiết kế đã được hiệu chỉnh an toàn (Safe V2) — CHƯA TRIỂN KHAI CODE
> **Ngày cập nhật:** 2026-09-08 (Bổ sung an toàn dung lượng PVE/NFS, kiểm soát đĩa ubuntu-105, và kiểm định QEMU Agent)
> **Nhánh:** `feature/vm-image-library-ova`
> **Phạm vi:** Backend (FastAPI), Frontend (React), Hạ tầng (Proxmox VE, NFS Storage, Docker Compose, SSH)

---

## MỤC LỤC

1. [Mục tiêu & Phạm vi](#1-mục-tiêu--phạm-vi)
2. [Yêu cầu chức năng](#2-yêu-cầu-chức-năng)
3. [Yêu cầu phi chức năng & Ràng buộc](#3-yêu-cầu-phi-chức-năng--ràng-buộc)
4. [Kiến trúc tổng quan](#4-kiến-trúc-tổng-quan)
5. [Thiết kế CSDL](#5-thiết-kế-csdl)
6. [Thiết kế API](#6-thiết-kế-api)
7. [Import Pipeline chi tiết](#7-import-pipeline-chi-tiết)
8. [Test VM cho Giảng viên](#8-test-vm-cho-giảng-viên)
9. [An toàn bảo mật](#9-an-toàn-bảo-mật)
10. [Cấu hình & Hạ tầng mới](#10-cấu-hình--hạ-tầng-mới)
11. [Thay đổi Frontend](#11-thay-đổi-frontend)
12. [Edge cases & Quyết định đã chốt](#12-edge-cases--quyết-định-đã-chốt)
13. [Rủi ro & Giảm thiểu](#13-rủi-ro--giảm-thiểu)
14. [Lộ trình triển khai & Ước lượng](#14-lộ-trình-triển-khai--ước-lượng)
15. [Kế hoạch Deploy & Kiểm thử E2E](#15-kế-hoạch-deploy--kiểm-thử-e2e)
16. [Công việc trong tương lai (ngoài phạm vi)](#16-công-việc-trong-tương-lai-ngoài-phạm-vi)

---

## 1. Mục tiêu & Phạm vi

### 1.1. Bối cảnh

Hiện tại Base Template cho bài lab là các VM dựng thủ công trên Proxmox (dải VMID 1000–2000), giảng viên chỉ có thể chọn template từ danh sách quét trực tiếp từ PVE (`GET /api/labs/templates/proxmox`). Không có cơ chế nào đưa image mới vào hệ thống nếu không qua tay admin thao tác trực tiếp trên node.

### 1.2. Mục tiêu

1. **Upload OVA**: Giảng viên (được admin cấp quyền) upload file `.ova` qua giao diện LMS; hệ thống tự động import thành VM template trên Proxmox.
2. **Thư viện Base VM (VM Image Library)**: Quản lý tập trung các base VM — gồm cả image import từ OVA lẫn VM template sẵn có — với metadata, credentials kết nối mặc định và **trạng thái private/public**.
3. **Test VM & Kiểm định (Verification)**: Giảng viên clone thử một base VM về VM test riêng của mình, truy cập qua Guacamole để kiểm chứng image (mạng VLAN 30, qemu-guest-agent, ứng dụng) trước khi gán vào bài lab sinh viên.
4. **Quản trị an toàn của Admin**: Cấp/thu hồi quyền upload theo từng giảng viên; giám sát dung lượng storage; dọn dẹp file OVA tự động/thủ công bảo vệ hệ thống.

### 1.3. Ngoài phạm vi

- Chunked/resumable upload (v1 dùng streaming single-request có pre-check dung lượng đĩa, xem §16)
- Clone kiểu linked-clone (hệ thống giữ full-clone như hiện tại)
- Mã hóa `vm_password` tại rest (nhất quán với `Lab.vm_password` hiện tại)
- Workflow admin phê duyệt image trước khi dùng (chỉ có visibility private/public và cờ kiểm định `is_tested`)

---

## 2. Yêu cầu chức năng

### FR1 — Upload OVA (giảng viên được cấp quyền)

- Form upload gồm: file `.ova`, tên hiển thị, mô tả, visibility (private/public), credentials mặc định (protocol, port, username, password).
- **Pre-check dung lượng đĩa trước khi nhận file**: Backend kiểm tra dung lượng còn trống trên `ubuntu-105`. Yêu cầu tối thiểu `file_size + 15GB` dự phòng an toàn cho PostgreSQL và hệ điều hành. Nếu không đủ, trả lỗi HTTP 507 Insufficient Storage ngay lập tức.
- Giới hạn kích thước nén: **`OVA_MAX_SIZE_GB = 40`** và giải nén **`OVA_MAX_UNCOMPRESSED_GB = 100`**.
- Validate cấu trúc tar hợp lệ, đúng 1 file `.ovf`, chống Zip-Slip (§9.2).
- Upload streaming trực tiếp vào thư mục tạm; sau khi upload xong đẩy vào import queue, trả ngay `status=queued`.

### FR2 — Import thành VM template trên Proxmox (An toàn Storage & I/O)

- **Sử dụng Storage NFS cho thư mục tạm**: Thao tác SFTP và giải nén `tar -xf` được thực hiện hoàn toàn trên NFS `nas-templates` (`/mnt/pve/nas-templates/malsec-import/`), **tuyệt đối không ghi file tạm vào ổ root PVE (`/var/lib/vz`)** để tránh nguy cơ tràn đĩa làm sập Proxmox.
- **I/O Throttling**: Lệnh `qm importovf` được bọc bằng `ionice -c2 -n7` để giảm tải I/O lên `local-lvm`, bảo vệ độ mượt mà cho các máy ảo sinh viên đang hoạt động.
- Sau khi import thành công: VM nằm trong **dải template 1000–2000**, convert thành PVE template, `net0` chuẩn hệ thống (`bridge=vmbr1,tag=30`), `agent=1`, mount sẵn ISO `qemu-ga-win.iso` nếu là Windows.
- **Tự động dọn dẹp file OVA**: Mặc định tự động xóa file `.ova` gốc trên `ubuntu-105` sau khi import thành công (`OVA_AUTO_DELETE_AFTER_IMPORT = true`) nhằm bảo vệ ổ đĩa 79GB của App Server khỏi nguy cơ tràn đĩa gây sập DB PostgreSQL.

### FR3 — Test VM & Kiểm định bắt buộc trước khi giao bài Lab

- Từ một image bất kỳ (của mình hoặc public), giảng viên tạo VM test: clone full từ template → start → chờ IP VLAN 30 qua QEMU Guest Agent → verify port RDP/SSH → trả về Guacamole URL.
- **Ghi nhận trạng thái kiểm định (`is_tested`)**: Khi phiên Test VM khởi động thành công và xác nhận lấy được IP `10.30.0.x` + mở được port RDP/SSH, image được tự động đánh dấu `is_tested = true`.
- Vòng đời: Nút Tắt / Xóa thủ công + **TTL tự dọn** (`TEST_VM_TTL_HOURS`, mặc định 4h).

### FR4 — Visibility private/public

- Image `private`: chỉ owner và admin thấy/dùng được.
- Image `public`: mọi giảng viên thấy, chọn được khi tạo lab, test được.
- Visibility kiểm soát **thời điểm chọn template khi tạo/sửa lab**; lab đã tạo với template nào thì tiếp tục dùng template đó kể cả khi visibility đổi sau này.

### FR5 — Phân quyền upload theo từng giảng viên (admin cấp)

- Cờ `users.can_upload_vm_images` (mặc định `false`), chỉ admin đặt được.
- Admin luôn có quyền upload ngầm định.
- Cờ này chặn **cả 2 cửa**: upload OVA và đăng ký VM sẵn có.
- Thu hồi quyền KHÔNG giết job đang chạy — job chạy nốt, chỉ chặn request mới.

### FR6 — Admin duyệt & dọn dẹp lưu trữ

- Admin xem danh sách **toàn bộ** image/file của mọi giảng viên (kể cả private), kèm owner, kích thước file, trạng thái kiểm định `is_tested`, dung lượng lưu trữ.
- Xóa **file OVA** (nếu còn giữ): giải phóng disk, giữ nguyên VM template.
- Xóa **image** (destroy VM trên PVE + xóa file + record): owner hoặc admin; **chặn nếu có lab đang dùng** template đó (HTTP 409 kèm số lab).
- Dọn hàng loạt mọi file OVA còn tồn đọng (admin), trả về số GB giải phóng.

### FR7 — Tích hợp tạo Lab & Cảnh báo Template chưa kiểm định

- Modal tạo/sửa lab: danh sách template lấy từ thư viện (của tôi + public) thay vì quét thẳng PVE.
- Chọn image → **prefill** protocol/port/username/password vào form cấu hình VM của lab.
- **Cảnh báo an toàn (Safety Guard)**: Nếu giảng viên chọn template chưa được kiểm định (`is_tested == false`), hệ thống hiển thị cảnh báo cứng: *"Template này chưa được kiểm thử QEMU Guest Agent & kết nối RDP. Sinh viên có thể không mở được máy ảo nếu sử dụng template này!"*.
- Backend validate `template_vmid` theo visibility khi `POST/PUT /api/labs`.

### FR8 — Đăng ký VM sẵn có vào thư viện

- Giảng viên có quyền upload (hoặc admin) đăng ký một VMID trong dải 1000–2000 chưa được đăng ký, gắn metadata + visibility + credentials.
- VMID ngoài dải hoặc đã có record → từ chối.

---

## 3. Yêu cầu phi chức năng & Ràng buộc

| Nhóm | Ràng buộc |
|---|---|
| **Bảo mật vùng VMID** | Tuyệt đối không phát sinh thao tác nào (stop/delete/purge) trên VMID < 1000 (pfSense 100, Guac 103, ubuntu-105/106). Mọi destroy phải qua guard 3 tầng (§9.1). |
| **An toàn dung lượng PVE** | **Bảo vệ ổ root PVE**: Thư mục tạm import bắt buộc nằm trên NFS storage `nas-templates` (`/mnt/pve/nas-templates/malsec-import/`, dung lượng 20 TB, còn trống >20 TB). **Tuyệt đối không dùng `/var/lib/vz`** (chỉ còn 66 GB trống) để tránh tràn đĩa root làm sập Proxmox cluster. |
| **An toàn dung lượng App Server** | `ubuntu-105` chỉ còn trống 79 GB (chứa Docker, PostgreSQL WAL, logs). Giới hạn OVA tối đa **`40 GB`**. Bắt buộc **Pre-check dung lượng** (yêu cầu đĩa trống ≥ `file_size + 15 GB`) và **tự động xóa file OVA gốc sau khi import thành công** (`OVA_AUTO_DELETE_AFTER_IMPORT = true`) để bảo vệ DB PostgreSQL không bị crash do đầy đĩa. |
| **Bảo vệ I/O sinh viên** | Chỉ **1 import cùng lúc** (lock toàn cục, queue tuần tự). Bọc lệnh import bằng `ionice -c2 -n7` để giảm độ ưu tiên I/O, không chiếm dụng 100% IOPS của `local-lvm`, bảo đảm máy ảo của sinh viên đang học không bị giật lag/timeout. |
| **Khả năng phục hồi** | Fail giữa chừng phải dọn sạch: destroy VM dở, xóa file tạm trên NFS pve01, xóa file tạm trên ubuntu-105, trả status `failed` + message. |
| **Kiểm toán** | Mọi thao tác (upload, import x/f, register, test start/stop/purge, xóa file/image, cleanup, cấp quyền) ghi `AuditLog` theo pattern hiện có. |
| **Tương thích ngược** | Không đổi schema bảng `labs`; lab cũ dùng template không có record trong thư viện vẫn hoạt động (coi là "system legacy template", mặc định public). |
| **Mạng & QEMU Agent** | VM import bắt buộc phải nhận IP từ VLAN 30 (`10.30.0.0/24`, DHCP từ pfSense .1) và phải cài QEMU Guest Agent để báo IP về cho hệ thống. Bắt buộc kiểm định qua Test VM trước khi gán vào Lab. |

---

## 4. Kiến trúc tổng quan

```
Giảng viên                 Backend (ubuntu-105 / malsec-backend)              pve01 (10.0.80.10)
   │                                                                                            │
   │ POST /api/vm-images/upload ──►  1. Pre-check đĩa ubuntu-105 (free ≥ size + 15GB)           │
   │   (multipart, streaming)        2. Validate tar (Zip-Slip, ≤ 40GB nén, ≤ 100GB giải nén)   │
   │                                 3. Lưu vào volume ova_store:/app/ova                       │
   │                                 4. Record status=queued, is_tested=false                   │
   │ ◄── response: vm_image id ──┘                                                               │
   │                                 ═══ BACKGROUND WORKER (lock 1 job) ═══                      │
   │                                 1. Allocate VMID trống trong 1000–2000                     │
   │                                 2. SFTP push .ova ───────────► /mnt/pve/nas-templates/     │
   │                                                                malsec-import/{uuid}/       │
   │                                 3. SSH: tar -xf (NFS storage 20TB an toàn, không đầy root) │
   │                                 4. SSH: ionice -c2 -n7 qm importovf {vmid} {x}.ovf         │
   │                                         local-lvm ──► VM mới (giảm tải I/O PVE)            │
   │                                 5. Proxmox API: set net0=...,bridge=vmbr1,tag=30;          │
   │                                    agent=1; ide2=qemu-ga ISO (nếu Windows);                │
   │                                    bios=ovmf+efidisk0 (nếu OVF EFI)                        │
   │                                 6. Proxmox API: convert → template                          │
   │                                 7. SSH: dọn thư mục tạm trên NFS pve01                     │
   │                                 8. Dọn dẹp: xóa file OVA gốc trên ubuntu-105               │
   │                                    (giải phóng đĩa cho App Server & PostgreSQL)             │
   │                                 9. status=ready, is_tested=false (chờ kiểm thử)            │
   │                                                                                            │
   │ GET /api/vm-images/{id} ◄───── poll 3–5s (frontend)                                       │
   │                                                                                            │
   │ POST /api/vm-images/{id}/test-session (BẮT BUỘC KIỂM ĐỊNH)                                 │
   │                                 clone template → dải 5000–5999 (vmtest-{img}-{user})       │
   │                                 start → chờ qemu-ga báo IP VLAN 30 → verify port RDP/SSH   │
   │                                 THÀNH CÔNG ──► Cập nhật is_tested=true, tested_at=NOW()    │
   │ ◄── guacamole_url (HMAC+AES, engine hiện có) ── iframe Guacamole                           │
```

**Thành phần mới trong backend:**

```
backend/app/
├── routers/vm_images.py          # Router mới (CRUD, upload, test VM, admin ops)
├── services/
│   ├── vm_image_service.py       # Import pipeline + validate OVA + SSH/SFTP client
│   └── vm_service.py             # Refactor: generalize provision + guards mới (KHÔNG đổi hành vi student hiện tại)
└── models.py                     # + VMImage, + User.can_upload_vm_images
```

**Điểm kết nối hạ tầng mới:** backend cần SSH/SFTP tới pve01 (thư viện `paramiko`, key riêng `malsec-backend` mount qua docker secret). Mọi thao tác khác vẫn ưu tiên Proxmox API (proxmoxer) như hiện tại. Trên pve01 có script wrapper hạn quyền cho backend key (§9.3).

---

## 5. Thiết kế CSDL

### 5.1. Bảng mới `vm_images`

| Cột | Kiểu | Ràng buộc / Ghi chú |
|---|---|---|
| `id` | Integer PK | |
| `name` | String | NOT NULL, tên hiển thị |
| `description` | String | nullable |
| `owner_id` | Integer FK `users.id` | `ondelete=SET NULL` — image mồ côi do admin quản |
| `visibility` | String | `'private'` \| `'public'`, default `'private'` |
| `origin` | String | `'ova'` \| `'registered'` |
| `vmid` | Integer | NOT NULL, UNIQUE, nằm trong dải 1000–2000 |
| `ova_filepath` | String | nullable — NULL = đã tự động xóa / xóa thủ công |
| `ova_original_filename` | String | nullable |
| `ova_size_bytes` | BigInteger | nullable |
| `vm_protocol` | String | `'rdp'` \| `'vnc'` \| `'ssh'` (default từ settings) |
| `vm_port` | Integer | default theo protocol |
| `vm_username` | String | nullable (bắt buộc với rdp/ssh khi dùng) |
| `vm_password` | String | nullable |
| `status` | String | `'queued'` \| `'importing'` \| `'ready'` \| `'failed'` |
| `status_message` | String | nullable — chi tiết lỗi import |
| `is_tested` | Boolean | DEFAULT FALSE — chỉ chuyển TRUE khi Test VM thành công |
| `tested_at` | DateTime | nullable — thời điểm kiểm định thành công gần nhất |
| `created_at`, `updated_at` | DateTime | |

### 5.2. Thay đổi bảng `users`

| Cột mới | Kiểu | Ghi chú |
|---|---|---|
| `can_upload_vm_images` | Boolean | DEFAULT FALSE; chỉ có ý nghĩa với role `lecturer` |

### 5.3. Chiến lược migration

- Không dùng Alembic (dự án chưa có). Tận dụng đúng pattern auto-migration startup trong `main.py`:

```sql
-- Chạy trong seed_data() startup, theo style hiện tại:
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_upload_vm_images BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS vm_images ( ... );  -- qua Base.metadata.create_all tự tạo
-- Migration bổ sung nếu bảng đã tồn tại:
ALTER TABLE vm_images ADD COLUMN IF NOT EXISTS is_tested BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vm_images ADD COLUMN IF NOT EXISTS tested_at TIMESTAMP NULL;
```

- Bảng `labs` **không đổi**. `Lab.template_vmid` vẫn là int trỏ VMID Proxmox.

---

## 6. Thiết kế API

### 6.1. Router mới `vm_images.py` — prefix `/api/vm-images`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | lecturer, admin | Thư viện của tôi + public. Admin thấy tất cả. Query `?view=files` (admin): chỉ các record còn file OVA + tổng dung lượng. Merge trạng thái thực tế từ PVE (running/stopped/template) và cờ `is_tested`. |
| `POST` | `/upload` | lecturer có `can_upload_vm_images`, admin | Multipart: `file` (.ova) + metadata. **Pre-check đĩa trống ubuntu-105**: nếu dung lượng khả dụng < `file_size + 15GB` → trả HTTP 507 Insufficient Storage. Giới hạn `OVA_MAX_SIZE_GB = 40`. Trả ngay record `status=queued, is_tested=false`. |
| `POST` | `/register` | lecturer có `can_upload_vm_images`, admin | Body: `vmid` (1000–2000, chưa bị đăng ký), name, visibility, credentials. Tạo record `status=ready`, `origin=registered`, `is_tested=false`. |
| `GET` | `/{id}` | owner, admin, hoặc mọi lecturer nếu public | Chi tiết + trạng thái import (frontend poll) + cờ `is_tested`. |
| `PATCH` | `/{id}` | owner, admin | Sửa `name`, `description`, `visibility`, `vm_protocol`, `vm_port`, `vm_username`, `vm_password`. Không sửa khi `status` ∈ {`queued`,`importing`}. |
| `DELETE` | `/{id}` | owner, admin | **Xóa image**: 409 nếu có lab dùng `template_vmid` này; destroy VM qua guard `destroy_image_vm`; xóa file OVA (nếu còn); soft-delete record. |
| `DELETE` | `/{id}/ova-file` | owner, admin | **Chỉ xóa file OVA** (giải phóng disk), set `ova_filepath=NULL`. Chặn khi đang import. |
| `POST` | `/{id}/test-session` | lecturer, admin (image public hoặc của mình) | Clone → start VM test → kiểm tra IP VLAN 30 + verify RDP/SSH → **cập nhật `is_tested=true, tested_at=NOW()`** → trả `{vmid, ip_address, guacamole_url, expires}`. |
| `POST` | `/test-vms/{vmid}/control` | lecturer, admin | `{"action": "start"\|"stop"\|"purge"}` — chỉ trên VM test **của chính mình**, guard §9.1. |
| `POST` | `/admin/cleanup-imported` | admin | Dọn mọi file OVA còn sót của record `status=ready`. Trả số file + GB giải phóng. |

### 6.2. Response mẫu

```jsonc
// GET /api/vm-images — item
{
  "id": 7,
  "name": "FLARE-VM customize 2026",
  "description": "Image phân tích malware đã cài sẵn FLARE-VM",
  "owner_id": 12,
  "owner_name": "Nguyễn Văn A",
  "visibility": "public",
  "origin": "ova",
  "vmid": 1042,
  "ova_original_filename": "flarevm-2026.ova",
  "ova_size_bytes": 12884901888,
  "has_ova_file": false,           // Đã tự động xóa giải phóng đĩa cho ubuntu-105
  "vm_protocol": "rdp",
  "vm_port": 3389,
  "vm_username": "analyst",
  "vm_password": "lab-password",   // như Lab hiện tại — plaintext, xem §9.6
  "status": "ready",
  "status_message": null,
  "is_tested": true,               // Đã test thành công QEMU Agent và RDP
  "tested_at": "2026-09-08T10:15:00",
  "pve_status": "template",        // merge từ Proxmox: template|stopped|running|...
  "created_at": "2026-09-08T10:00:00"
}
```

```jsonc
// POST /api/vm-images/7/test-session
{
  "vmid": 5007,
  "ip_address": "10.30.0.77",
  "guacamole_url": "/guacamole/#/client/c/VMTest-...?data=...",
  "expires_at": "2026-09-08T14:15:00",
  "is_verified": true
}
```

### 6.3. Sửa endpoint hiện có

| Endpoint | Thay đổi |
|---|---|
| `PUT /api/users/{id}` | Thêm field `can_upload_vm_images` (chỉ admin đặt được). UserOut thêm field này để render badge. |
| `POST /api/labs`, `PUT /api/labs/{id}` | Validate `template_vmid`: có record `vm_images` → phải `public` hoặc `owner == current_user` (admin được hết); nếu `is_tested == false` → trả warning header hoặc cảnh báo frontend; không có record + trong dải 1000–2000 → legacy system template (cho phép). Ngoài dải → 422. |
| `GET /api/labs/templates/proxmox` | **Giữ nguyên** cho tương thích, đánh dấu deprecated; frontend Instructor chuyển sang `/api/vm-images`. |

### 6.4. Thay đổi service `vm_service.py` (refactor, không đổi hành vi)

- `_student_vm_name(username, scope_key, prefix)` — tham số hoá prefix (`lab-` cho SV giữ nguyên, `vmtest-` cho test).
- `_allocate_vmid(resources, key, vmid_min, vmid_max)` — khái quát từ `_allocate_student_vmid`.
- `provision_vm(username, scope_key, prefix, vmid_min, vmid_max, template_vmid, protocol, port)` — `provision_student_vm` trở thành wrapper gọi `provision_vm` với cấu hình student → **hành vi provisioning sinh viên không đổi**.
- Guards mới: `control_test_vm`, `destroy_image_vm` (§9.1). `control_student_vm` giữ nguyên.

---

## 7. Import Pipeline chi tiết

Chạy trong **ThreadPoolExecutor singleton (1 worker) + queue trong bộ nhớ**; nếu restart backend giữa chừng, job `queued`/`importing` bị "bỏ rơi" → khi startup, quét các record kẹt `queued`/`importing` quá 1 giờ → đánh dấu `failed` với message "bị gián đoạn do restart, hãy upload lại".

| Bước | Nơi chạy | Chi tiết an toàn & Giảm tải |
|---|---|---|
| 1. Validate OVA | ubuntu-105 (python `tarfile`) | Là tar hợp lệ; đúng 1 file `.ovf` + ≥1 đĩa `.vmdk`/`.vhd` (cho phép `.mf`, `.cert`); mọi member: path relative, không `..`, không symlink/hardlink; tổng kích thước giải nén ≤ `OVA_MAX_UNCOMPRESSED_GB` (100GB); kích thước file ≤ `OVA_MAX_SIZE_GB` (40GB). |
| 2. Allocate VMID | Proxmox API | `cluster/resources` → slot nhỏ nhất trống trong [1000, 2000] và chưa có trong `vm_images`. |
| 3. Transfer | SFTP (paramiko) | `ova_store/{uuid}.ova` → `pve01:{PVE_IMPORT_TMP_DIR}/{uuid}/source.ova`. **BẮT BUỘC đặt trên NFS storage `nas-templates` (`/mnt/pve/nas-templates/malsec-import/`, 20TB free)**, TUYỆT ĐỐI KHÔNG dùng `/var/lib/vz` (chỉ còn 66GB) để tránh làm sập đĩa root của PVE. |
| 4. Extract + Import | SSH (Wrapper) | `tar -xf source.ova -C .` trong thư mục tạm NFS → **`ionice -c2 -n7 qm importovf {vmid} {ovf} {PVE_IMPORT_STORAGE}`**. Cờ `ionice -c2 -n7` hạ mức ưu tiên I/O để không làm nghẽn `local-lvm`, bảo vệ độ mượt của các VM sinh viên đang làm bài. |
| 5. Post-config | **Proxmox API** | `PUT /nodes/{node}/qemu/{vmid}/config`: `net0=<model từ OVF>,bridge={LAB_VM_BRIDGE},tag={LAB_VLAN_TAG}` (giữ model NIC, không ép virtio); `agent=enabled=1`; nếu OVF là Windows → `ide2=local:iso/qemu-ga-win.iso,media=cdrom`; nếu OVF khai báo EFI → `bios=ovmf` + tạo `efidisk0`. |
| 6. Convert template | Proxmox API | `PUT /nodes/{node}/qemu/{vmid}/template`. |
| 7. Cleanup pve01 | SSH (Wrapper) | Xóa thư mục tạm `{PVE_IMPORT_TMP_DIR}/{uuid}/` trên NFS. |
| 8. Finalize & Disk Cleanup | ubuntu-105 | **Tự động xóa file `.ova` gốc** trên `ova_store` (`OVA_AUTO_DELETE_AFTER_IMPORT=true` mặc định) để giải phóng đĩa 79GB của App Server, set `ova_filepath=NULL`. Cập nhật `status=ready`, `is_tested=false`. Ghi AuditLog `import_ova_ready`. |
| Fail-path | cả 2 đầu | Destroy VM dở (chỉ VMID vừa allocate, đúng dải) + xóa tạm NFS pve01 + xóa file tạm ubuntu-105 + `status=failed` + `status_message`. Ghi AuditLog `import_ova_failed`. |

---

## 8. Test VM cho Giảng viên & Kiểm định QEMU Agent

### 8.1. Thông số

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| Dải VMID | **5000–5999** | env `LECTURER_VMID_MIN/MAX`; tách bạch với template (1000–2000) và student (10000–19999) |
| Tên ownership | `vmtest-{image_id}-{username}` | Cùng thuật toán chuẩn hóa + digest sha256 như `_student_vm_name` (giới hạn 63 ký tự) |
| TTL | 4 giờ | env `TEST_VM_TTL_HOURS` |
| Credentials | Từ record `vm_images` | protocol/port/username/password của image |

### 8.2. Luồng `POST /{id}/test-session` & Xác nhận Kiểm định

1. Check quyền image (public hoặc owner; admin được hết).
2. **TTL sweep**: quét và stop + destroy VM test cũ quá hạn của user.
3. Tìm VM test hiện có của (user, image): có → start nếu đang tắt; không → full-clone từ template → set MAC unique.
4. Chờ qemu-ga báo IP thuộc `10.30.0.0/24` → **verify port RDP/SSH mở**.
5. **Đánh dấu kiểm định thành công**: Cập nhật `vm_images.is_tested = true`, `tested_at = datetime.utcnow()`. Image chính thức đủ điều kiện an toàn để đưa vào bài lab.
6. Sinh Guacamole URL bằng engine hiện tại (`generate_guacamole_auth_json_url`), username Guac session: `{username}-test`.

### 8.3. Điều khiển & dọn dẹp

- `POST /test-vms/{vmid}/control` — start/stop/purge, chỉ VM của mình (admin: mọi VM test).
- Frontend: modal Test VM có nút Tắt / Xóa VM test / Tải lại kết nối.
- Cleanup lazy khi gọi test-session + nút thủ công.

---

## 9. An toàn bảo mật

### 9.1. Guard VMID — 3 tầng theo mục đích (mở rộng cơ chế hiện tại)

| Guard hàm | Dải cho phép | Điều kiện bổ sung bắt buộc | Caller |
|---|---|---|---|
| `control_student_vm` (hiện có, giữ nguyên) | 10000–19999 | — | lab VM manager |
| `control_test_vm(vmid, username)` | 5000–5999 | Tên VM trên PVE phải khớp `vmtest-*-{username}` (ownership) | test-session control |
| `destroy_image_vm(vmid)` | 1000–2000 | Tồn tại record `vm_images` với đúng vmid; không có lab đang dùng | DELETE /vm-images/{id} |

Nguyên tắc bất di bất dịch: **không endpoint nào được gọi Proxmox destroy/stop trực tiếp với tham số vmid do client kiểm soát mà không qua một guard trên**; mọi guard từ chối tuyệt đối dải VMID < 1000.

### 9.2. OVA là input không tin cậy

- Validate member chặt (bước 1, §7) trước khi đưa đi giải nén trên PVE — chống **Zip-Slip** (path traversal qua `../`, symlink), chống tar-bomb (giới hạn giải nén ≤ 100GB).
- Giải nén chỉ trong thư mục tạm biệt lập `{PVE_IMPORT_TMP_DIR}/{uuid}/` trên NFS, xóa ngay sau import.
- Không bao giờ execute nội dung OVA; `qm importovf` chỉ parse OVF (XML) + ghi disk image.

### 9.3. Bảo mật SSH & Command Wrapper hạn quyền trên Hypervisor

- Key pair mới `malsec-backend` (ed25519), **không tái dùng** key cá nhân `manhpp_ed25519` trong repo.
- Private key mount vào container qua docker secret (`/run/secrets/pve_ssh_key`, chmod 600).
- **SSH Command Wrapper trên PVE**: Trong `~/.ssh/authorized_keys` của pve01, cấu hình hạn chế lệnh (`command="/usr/local/bin/malsec-import-helper.sh"`). Script wrapper này chỉ cho phép:
  - SFTP subsystem (chỉ đọc/ghi trong thư mục `/mnt/pve/nas-templates/malsec-import/`).
  - Lệnh giải nén tar an toàn trong thư mục con hợp lệ.
  - Lệnh `ionice -c2 -n7 qm importovf` với tham số VMID thuộc [1000, 2000].
  - Lệnh dọn dẹp `rm -rf` thư mục tạm có định dạng UUID hợp lệ.
  - **Chặn hoàn toàn việc mở interactive shell hoặc thực thi các lệnh hệ thống tùy ý**, bảo vệ an toàn máy chủ vật lý ngay cả khi container backend bị tấn công.
- Known_hosts pin fingerprint của pve01 (mount kèm secret) — không dùng `StrictHostKeyChecking=no`.

### 9.4. Chống IDOR

- Mọi endpoint kiểm tra visibility/ownership **cả khi list lẫn khi hành động**: giảng viên A không GET/PATCH/test/xóa được image private của B dù đoán `id` hay `vmid`.
- Validate `template_vmid` khi tạo/sửa lab là lớp chặn thứ hai (không thể "lách" visibility bằng cách nhét vmid private vào lab).

### 9.5. Phân quyền upload

- `require_upload_permission` dependency: `role == 'admin'` HOẶC `can_upload_vm_images == True`.
- Thu hồi quyền: job đang chạy/chờ chạy nốt; request mới bị 403.

### 9.6. Lưu ý công khai (đã chấp nhận trong thiết kế)

- `vm_password` lưu plaintext trong DB — nhất quán với `Lab.vm_password` hiện tại; mã hóa at-rest là mục tiêu tương lai (§16).
- URL Guacamole chứa token phiên có TTL (`GUAC_SESSION_TTL_SECONDS`) — cơ chế hiện có, không đổi.

### 9.7. AuditLog

Actions mới: `upload_ova`, `import_ova_ready`, `import_ova_failed`, `register_vm_image`, `update_vm_image`, `delete_vm_image`, `delete_ova_file`, `cleanup_ova_files`, `test_vm_start`, `test_vm_stop`, `test_vm_purge`, (cấp quyền upload đi qua `update_user` hiện có).

---

## 10. Cấu hình & Hạ tầng mới

### 10.1. Biến môi trường mới (đều required-style như `config.py` hiện tại)

| Env | Giá trị đề xuất | Ý nghĩa |
|---|---|---|
| `PVE_SSH_HOST` | `10.0.80.10` | Địa chỉ SSH pve01 từ backend |
| `PVE_SSH_USER` | `root` | User SSH |
| `PVE_SSH_KEY_PATH` | `/run/secrets/pve_ssh_key` | Private key (docker secret) |
| `PVE_SSH_KNOWN_HOSTS_PATH` | `/run/secrets/pve_known_hosts` | Pin fingerprint pve01 |
| `PVE_IMPORT_STORAGE` | `local-lvm` | Storage nhập đĩa VM (LVM-thin) |
| `PVE_IMPORT_TMP_DIR` | `/mnt/pve/nas-templates/malsec-import` | **Thư mục tạm trên NFS `nas-templates` (20TB free)**, TUYỆT ĐỐI KHÔNG dùng `/var/lib/vz` |
| `LAB_VM_BRIDGE` | `vmbr1` | Bridge chuẩn cho VM import |
| `LAB_VLAN_TAG` | `30` | VLAN tag sandbox |
| `LECTURER_VMID_MIN` / `LECTURER_VMID_MAX` | `5000` / `5999` | Dải VM test giảng viên |
| `TEST_VM_TTL_HOURS` | `4` | TTL VM test |
| `OVA_MAX_SIZE_GB` | `40` | Giới hạn kích thước file nén OVA |
| `OVA_MAX_UNCOMPRESSED_GB` | `100` | Giới hạn tổng giải nén các đĩa vmdk/vhd |
| `OVA_AUTO_DELETE_AFTER_IMPORT` | `true` | **Mặc định bật tự động xóa file OVA sau import** để bảo vệ đĩa 79GB của App Server |
| `DISK_SAFETY_MARGIN_GB` | `15` | Dự phòng tối thiểu cho ubuntu-105 (PostgreSQL WAL & OS logs) |
| `OVA_UPLOAD_DIR` | `/app/ova` | Thư mục lưu OVA trong container |

### 10.2. Thay đổi `docker-compose.yml`

- Volume mới: `ova_store:/app/ova`.
- Secrets mới: `pve_ssh_key`, `pve_known_hosts` (file-based secrets mount vào backend).
- Frontend nginx: nâng `CLIENT_MAX_BODY_SIZE` (≈ `45000M` cho trần 40GB) và `PROXY_CONNECT/SEND/READ_TIMEOUT` (đề xuất `3600s`) — đã env-driven, chỉ đổi giá trị `.env` khi deploy.

### 10.3. Thay đổi `backend/requirements.txt`

- Thêm `paramiko>=3.4` (SSH/SFTP client pure-python, container không có ssh binary).

### 10.4. Chuẩn bị một lần trên hạ tầng (thủ công, bởi admin)

1. Gen key `malsec-backend` trên ubuntu-105: `ssh-keygen -t ed25519 -f malsec-backend -N ""`.
2. Tạo thư mục tạm trên NFS storage của pve01: `mkdir -p /mnt/pve/nas-templates/malsec-import && chmod 700 /mnt/pve/nas-templates/malsec-import`.
3. Cài đặt SSH Command Wrapper `/usr/local/bin/malsec-import-helper.sh` trên pve01 để hạn chế quyền cho key backend.
4. Thêm public key vào `root@pve01:~/.ssh/authorized_keys` với tiền tố:
   `command="/usr/local/bin/malsec-import-helper.sh",no-pty,no-port-forwarding,no-X11-forwarding ssh-ed25519 ... malsec-backend-service`.
5. Ghi fingerprint: `ssh-keyscan -H 10.0.80.10 > pve_known_hosts`.
6. Kiểm tra `pvesm status` xác nhận `nas-templates` (NFS) và `local-lvm` đều active.

---

## 11. Thay đổi Frontend

### 11.1. InstructorDashboard — tab mới "Thư viện Máy ảo"

- Tách component riêng `frontend/src/pages/components/VmLibraryTab.jsx`.
- Bảng images: VMID, tên, nguồn (OVA/Đăng ký), visibility badge (Private/Public), owner, kích thước file, trạng thái import, trạng thái PVE.
- **Badge Kiểm định an toàn**:
  - `Đã kiểm định (Verified)` màu xanh ngọc: Đã Test VM thành công, sẵn sàng gán bài lab.
  - `Chưa kiểm định (Unverified)` màu vàng cam: Cần chạy Test VM trước khi sử dụng.
- Actions theo quyền: **Test VM**, Sửa (metadata/visibility/credentials), Xóa image, Xóa file OVA (nếu chưa tự xóa).
- **Modal Upload OVA**: Form metadata + pre-check file picker (cảnh báo nếu file > 40GB) + progress bar (XHR upload progress) + kỳ vọng thời gian 15–30 phút.
- **Modal Test VM**: iframe Guacamole + nút Tắt / Xóa VM test / Tải lại kết nối. Khi mở thành công sẽ tự động cập nhật badge thành "Đã kiểm định".

### 11.2. InstructorDashboard — modal tạo/sửa Lab

- Select "Base VM" chuyển nguồn sang `GET /api/vm-images` (của tôi + public).
- Chọn image → prefill `vm_protocol`, `vm_port`, `vm_username`, `vm_password`.
- **Safety Warning**: Nếu chọn template có `is_tested == false`, hiển thị hộp cảnh báo:
  > ⚠️ **LƯU Ý:** Template này chưa được kiểm thử QEMU Guest Agent & RDP. Sinh viên có thể gặp lỗi màn hình đen nếu template chưa nhận IP hoặc chưa bật dịch vụ Remote Desktop.

### 11.3. AdminDashboard

- **Tab "Quản lý Máy ảo Proxmox"** mở rộng thành "Thư viện & Máy ảo":
  - Bảng toàn bộ image của mọi giảng viên (kèm cờ `is_tested`).
  - Tổng dung lượng lưu trữ đang dùng.
  - Nút: Test VM, Xóa file, Xóa image, "Dọn các file đã import thành công" (bulk cleanup).
- **Tab "Quản lý Tài khoản"**: modal Sửa user thêm checkbox "Được phép upload OVA" (chỉ hiện với role lecturer); bảng users thêm badge chìa khóa 🔑 cho lecturer có quyền.

---

## 12. Edge cases & Quyết định đã chốt

| # | Tình huống | Quyết định |
|---|---|---|
| 1 | Ai được upload OVA? | Lecturer được admin bật `can_upload_vm_images`; admin luôn được. |
| 2 | File OVA sau import? | **Tự động xóa mặc định (`OVA_AUTO_DELETE_AFTER_IMPORT=true`)** để giải phóng ổ cứng 79GB của App Server, tránh sập PostgreSQL. |
| 3 | Thư mục tạm trên PVE? | **Bắt buộc dùng NFS `nas-templates` (20TB free)**, cấm dùng `/var/lib/vz` (chỉ còn 66GB) để tránh làm sập đĩa root của cụm PVE. |
| 4 | Giới hạn dung lượng? | **Tối đa 40 GB nén, 100 GB giải nén**. Pre-check đĩa trống ubuntu-105 ≥ `file_size + 15 GB`. |
| 5 | Tải I/O khi import? | Bọc lệnh bằng **`ionice -c2 -n7`** để không làm giật lag các máy ảo sinh viên đang làm bài lab. |
| 6 | Kiểm định VM mới? | Cờ `is_tested`: Bắt buộc qua Test VM xác nhận QEMU Guest Agent + Port RDP/SSH trước khi khuyến khích dùng trong bài lab. |
| 7 | SSH root hay hạn quyền? | **Key riêng + SSH Command Wrapper** trên PVE (`/usr/local/bin/malsec-import-helper.sh`) — chặn toàn bộ interactive shell tự do. |
| 8 | Đụng dải VMID < 1000? | Tuyệt đối không — mọi guard từ chối; đây là quy tắc bất di bất dịch của hệ thống (AGENTS.md). |

---

## 13. Rủi ro & Giảm thiểu

| # | Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|---|
| 1 | Image thiếu QEMU Guest Agent hoặc driver NIC → Sinh viên bị timeout lấy IP VLAN 30 | **Cao** | Bắt buộc kiểm định qua Test VM; ghi nhận `is_tested`; cảnh báo cứng khi tạo lab với template chưa test; checklist chuẩn bị OVA (§Phụ lục C). |
| 2 | Tràn ổ đĩa ROOT của Proxmox (`/var/lib/vz`) | **Cực cao** | **ĐÃ KHẮC PHỤC**: Chuyển toàn bộ thư mục tạm và giải nén sang NFS storage `nas-templates` (dung lượng 20 TB, còn trống >20 TB). |
| 3 | Tràn ổ đĩa App Server `ubuntu-105` làm sập DB PostgreSQL | **Cực cao** | **ĐÃ KHẮC PHỤC**: Đặt trần OVA 40GB, pre-check đĩa trống (yêu cầu ≥ size + 15GB), và bật tự động xóa file OVA gốc sau khi import thành công. |
| 4 | Import làm nghẽn I/O (High IO Wait) gây lag máy ảo sinh viên | **Trung bình** | Lock 1 job tuần tự + bọc lệnh import bằng `ionice -c2 -n7` hạ mức ưu tiên I/O. |
| 5 | Lạm dụng quyền SSH root từ backend container | **Cao** | Sử dụng SSH Command Wrapper trên PVE, cấm interactive shell, chỉ cho phép SFTP và các lệnh import theo cú pháp cố định. |
| 6 | Tar-bomb / Zip-Slip qua file OVA | **Trung bình** | Validate members chặt chẽ bằng Python trước khi đẩy sang PVE; giới hạn giải nén tối đa 100GB. |
| 7 | OVA UEFI không boot sau import (thiếu efidisk0) | **Trung bình** | Detect firmware từ OVF → set `bios=ovmf` + `efidisk0`; fail thì `status_message` hướng dẫn export lại ở BIOS mode. |

---

## 14. Lộ trình triển khai & Ước lượng

| Phase | Nội dung | Kết quả nghiệm thu | Ước lượng |
|---|---|---|---|
| **0 — Spike hạ tầng & An toàn** | Cài SSH wrapper trên pve01; xác nhận đường dẫn NFS `/mnt/pve/nas-templates/malsec-import/`; test `ionice qm importovf` với OVA mẫu; đo tốc độ I/O | Memo kết quả spike an toàn lưu trữ và I/O — quyết định go/no-go | 1 ngày |
| **1 — Nền tảng dữ liệu & CRUD** | Model `VMImage` (thêm `is_tested`, `tested_at`) + cột `users.can_upload_vm_images` + auto-migration; router vm_images; validate lab theo visibility | Upload permission cấp được; CRUD + visibility hoạt động qua Swagger | 1–1.5 ngày |
| **2 — Import pipeline an toàn** | `vm_image_service.py` với Pre-check đĩa, transfer qua NFS, ionice importovf, auto-cleanup file OVA; worker queue | Upload OVA 40GB qua Swagger → template PVE lên chuẩn, đĩa PVE root và ubuntu-105 không bị đầy | 2 ngày |
| **3 — Test VM + Kiểm định** | Refactor `provision_vm`; test-session endpoint; cập nhật cờ `is_tested=true` khi verify thành công; TTL sweep | Test VM mở qua Guacamole, xác nhận IP và port, cập nhật trạng thái kiểm định | 1 ngày |
| **4 — Frontend & Cảnh báo an toàn** | `VmLibraryTab` (badge kiểm định, upload progress bar, test VM modal); cảnh báo template chưa kiểm định khi tạo Lab; AdminDashboard | Luồng giảng viên + admin hoàn chỉnh, trực quan | 1.5–2 ngày |
| **5 — Deploy staging & E2E** | Deploy ubuntu-106; setup secrets/wrapper; E2E với OVA thật; nghiệm thu toàn checklist | Checklist §15 pass hết trên staging | 1 ngày |

**Tổng: ~7.5–9.5 ngày làm việc.**

---

## 15. Kế hoạch Deploy & Kiểm thử E2E

### 15.1. Trình tự deploy staging (ubuntu-106)

1. Chuẩn bị hạ tầng một lần (§10.4): Cài SSH command wrapper trên pve01, tạo thư mục NFS `/mnt/pve/nas-templates/malsec-import`.
2. Cập nhật `.env`: Thêm env §10.1 (`PVE_IMPORT_TMP_DIR` trỏ NFS, `OVA_MAX_SIZE_GB=40`, `OVA_AUTO_DELETE_AFTER_IMPORT=true`).
3. Đưa secrets vào server (key + known_hosts, chmod 600).
4. Deploy theo quy trình chuẩn AGENTS.md (`tar` -> `scp` -> `docker compose up -d --build`).
5. Verify: container backend lên, database migrate thêm bảng và cột mới.

### 15.2. Checklist E2E nghiệm thu (trên staging)

- [ ] Admin bật quyền upload cho lecturer.
- [ ] Pre-check đĩa: Thử upload khi đĩa giả lập không đủ dung lượng → trả lỗi HTTP 507 rõ ràng.
- [ ] Upload OVA thật (tối đa 40GB): File được đẩy lên NFS `nas-templates`, ổ root PVE (`/var/lib/vz`) giữ nguyên dung lượng không tăng.
- [ ] `ionice` hoạt động: Quá trình convert disk không làm tăng I/O wait đột biến trên các VM đang chạy.
- [ ] Sau khi import: File OVA gốc trên `ubuntu-105` được tự động xóa sạch, giải phóng đĩa cho App Server.
- [ ] Trạng thái ban đầu: Template mới có `is_tested = false` (Chưa kiểm định).
- [ ] Test VM: Giảng viên mở Test VM → nhận IP `10.30.0.x` qua QEMU Guest Agent → mở desktop qua Guacamole → hệ thống chuyển `is_tested = true`.
- [ ] Tạo Lab: Nếu chọn template có `is_tested = false`, giao diện hiển thị cảnh báo cứng.
- [ ] Guard: Mọi thao tác ngoài dải quy định đều bị chặn và log `[SECURITY BLOCKED]`.

---

## 16. Công việc trong tương lai (ngoài phạm vi)

1. **Chunked/resumable upload** (tus.io) — tăng độ tin cậy khi đường truyền mạng yếu.
2. **Chuẩn hóa NIC sang virtio** cho image đã cài driver — tăng hiệu năng mạng.
3. **Mã hóa `vm_password` at-rest** (kéo theo cả `Lab.vm_password`).
4. **Giám sát dung lượng tự động**: cảnh báo thin-pool `local-lvm`, NFS `nas-templates` và `ubuntu-105` qua UI admin.

---

## Phụ lục A — Tham chiếu code hiện tại liên quan

| Vị trí | Vai trò trong thiết kế này |
|---|---|
| `backend/app/services/vm_service.py` | Tái sử dụng logic cấp phát IP, MAC unique, verify connection và sinh Guacamole URL |
| `backend/app/routers/labs.py` | Nơi bổ sung validate visibility và cảnh báo template chưa kiểm định |
| `backend/app/main.py` | Auto-migration thêm cột và bảng mới |
| `frontend/src/pages/InstructorDashboard.jsx` | Tích hợp Tab Thư viện và cảnh báo khi tạo bài lab |

## Phụ lục B — Tham chiếu hạ tầng thực tế

- **Proxmox VE 9.2.11**, node đơn `pve01` (10.0.80.10, bridge quản trị `vmbr0`).
- **NFS Storage `nas-templates`**: Mount tại `/mnt/pve/nas-templates`, dung lượng **20 TB** (còn trống > 20.4 TB) — Sử dụng làm nơi chứa file tạm và giải nén OVA an toàn.
- **Storage `local-lvm`**: LVM-thin ~1.79 TB (đang dùng ~45.6%, còn trống ~975 GB) — Lưu trữ đĩa chạy VM.
- **Storage `local` (`/var/lib/vz`)**: Nằm trên phân vùng root PVE, **chỉ còn trống 66 GB** — CẤM DÙNG LÀM THƯ MỤC IMPORT TẠM.
- **App Server `ubuntu-105`**: 10.0.80.55, ổ cứng root 97 GB (còn trống **79 GB**) — Cần cơ chế tự động dọn dẹp file OVA sau import để bảo vệ PostgreSQL.

---

## Phụ lục C — Hướng dẫn Chuẩn bị file OVA cho Giảng viên (Best Practices)

Để đảm bảo máy ảo import từ OVA hoạt động mượt mà 100% với hệ thống MalSec và Guacamole, Giảng viên cần tuân thủ các bước sau trước khi Export file OVA:

1. **Cấu hình Card mạng (Network):**
   - Đặt card mạng ở chế độ **DHCP** (Nhận IP tự động). Tuyệt đối không đặt IP tĩnh (Static IP) để máy ảo tự nhận IP từ pfSense Gateway (`10.30.0.1`).
2. **Cài đặt QEMU Guest Agent:**
   - **Với Windows:** Cài đặt `qemu-ga` (từ VirtIO ISO). Đảm bảo service `QEMU Guest Agent` ở chế độ `Automatic` và đang `Running`.
   - **Với Linux (Ubuntu/Debian):** Chạy `sudo apt-get install -y qemu-guest-agent && sudo systemctl enable --now qemu-guest-agent`.
   - *Đây là điều kiện tiên quyết để MalSec tự động lấy IP máy ảo và mở kết nối.*
3. **Cấu hình Remote Desktop / SSH:**
   - **Với Windows:** Bật **Remote Desktop** (Settings > Remote Desktop > Enable), cho phép tài khoản đăng nhập có quyền Remote Desktop Users.
   - **Với Linux:** Cài đặt và bật dịch vụ `xrdp` (Port 3389) hoặc SSH (Port 22).
4. **Firewall máy khách:**
   - Đảm bảo Windows Firewall hoặc UFW không chặn cổng 3389 từ dải mạng nội bộ.
5. **Định dạng Export:**
   - Export sang định dạng **OVF 1.0 hoặc 2.0 (.ova)** từ VMware hoặc VirtualBox.
   - Ưu tiên chế độ BIOS thông thường (Legacy) thay vì UEFI để quá trình convert đĩa sang Proxmox đạt độ tương thích cao nhất.
