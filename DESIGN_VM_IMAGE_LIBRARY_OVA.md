# ĐẶC TẢ THIẾT KẾ — THƯ VIỆN BASE VM (UPLOAD OVA, TEST VM & QUẢN TRỊ ADMIN)

> **Trạng thái:** Thiết kế đã được chốt — CHƯA TRIỂN KHAI BẤT KỲ DÒNG CODE NÀO
> **Ngày:** 2026-08-23
> **Nhánh:** `feature/vm-image-library-ova`
> **Phạm vi:** Backend (FastAPI), Frontend (React), Hạ tầng (Proxmox VE, Docker Compose, SSH)

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
3. **Test VM**: Giảng viên clone thử một base VM về VM test riêng của mình, truy cập qua Guacamole để kiểm chứng image (mạng VLAN 30, qemu-guest-agent, ứng dụng) trước khi giao cho sinh viên.
4. **Quản trị của Admin**: Cấp/thu hồi quyền upload theo từng giảng viên; duyệt danh sách file OVA của tất cả giảng viên; xóa file từng cái hoặc dọn hàng loạt.

### 1.3. Ngoài phạm vi

- Chunked/resumable upload (v1 dùng single-request, xem §16)
- Clone kiểu linked-clone (hệ thống giữ full-clone như hiện tại)
- Mã hóa `vm_password` tại rest (nhất quán với `Lab.vm_password` hiện tại)
- Workflow admin phê duyệt image trước khi dùng (chỉ có visibility private/public)

---

## 2. Yêu cầu chức năng

### FR1 — Upload OVA (giảng viên được cấp quyền)

- Form upload gồm: file `.ova`, tên hiển thị, mô tả, visibility (private/public), credentials mặc định (protocol, port, username, password).
- Upload là 1 request HTTP streaming; sau khi response trả về, import chạy nền (background worker), frontend poll trạng thái.
- Trạng thái: `queued → importing → ready | failed`, kèm `status_message` mô tả lỗi chi tiết khi fail.
- Validate: giới hạn kích thước nén (`OVA_MAX_SIZE_GB`) và giải nén (`OVA_MAX_UNCOMPRESSED_GB`), cấu trúc tar hợp lệ, chống Zip-Slip (§9.2).

### FR2 — Import thành VM template trên Proxmox

- Sau import thành công: VM nằm trong **dải template 1000–2000**, được convert thành PVE template, có `net0` chuẩn hệ thống (`bridge=vmbr1,tag=30`, giữ nguyên model NIC từ OVF), `agent=1`, mount sẵn ISO qemu-ga nếu là Windows.
- File OVA gốc **giữ lại mặc định** trên volume `ova_store` (để admin duyệt); việc xóa file do owner hoặc admin chủ động thực hiện.

### FR3 — Test VM cho giảng viên

- Từ một image bất kỳ (của mình hoặc public), giảng viên tạo VM test: clone full từ template → start → chờ IP VLAN 30 → trả về Guacamole URL (engine mã hóa hiện có, credentials lấy từ metadata image).
- Mỗi giảng viên tối đa 1 VM test cho mỗi image; gọi lại sẽ tái sử dụng (start lại nếu đang tắt).
- Vòng đời: nút Tắt / Xóa thủ công + **TTL tự dọn** (`TEST_VM_TTL_HOURS`, mặc định 4h).

### FR4 — Visibility private/public

- Image `private`: chỉ owner và admin thấy/dùng được.
- Image `public`: mọi giảng viên thấy, chọn được khi tạo lab, test được.
- Visibility kiểm soát **thời điểm chọn template khi tạo/sửa lab**; lab đã tạo với template nào thì tiếp tục dùng template đó kể cả khi visibility đổi sau này.

### FR5 — Phân quyền upload theo từng giảng viên (admin cấp)

- Cờ `users.can_upload_vm_images` (mặc định `false`), chỉ admin đặt được.
- Admin luôn có quyền upload ngầm định.
- Cờ này chặn **cả 2 cửa**: upload OVA và đăng ký VM sẵn có.
- Thu hồi quyền KHÔNG giết job đang chạy — job chạy nốt, chỉ chặn request mới.

### FR6 — Admin duyệt & xóa file

- Admin xem danh sách **toàn bộ** image/file của mọi giảng viên (kể cả private), kèm owner, kích thước file, trạng thái, tổng dung lượng `ova_store`.
- Xóa **file OVA** (giải phóng disk, VM template giữ nguyên): owner hoặc admin; chặn khi đang import.
- Xóa **image** (destroy VM trên PVE + xóa file + record): owner hoặc admin; **chặn nếu có lab đang dùng** template đó (HTTP 409 kèm số lab).
- Dọn hàng loạt mọi file OVA đã import thành công (admin), trả về số GB giải phóng.

### FR7 — Tích hợp tạo Lab

- Modal tạo/sửa lab: danh sách template lấy từ thư viện (của tôi + public) thay vì quét thẳng PVE.
- Chọn image → **prefill** protocol/port/username/password vào form cấu hình VM của lab.
- Backend validate `template_vmid` theo visibility khi `POST/PUT /api/labs`.

### FR8 — Đăng ký VM sẵn có vào thư viện

- Giảng viên có quyền upload (hoặc admin) đăng ký một VMID trong dải 1000–2000 chưa được đăng ký, gắn metadata + visibility + credentials.
- VMID ngoài dải hoặc đã có record → từ chối.

---

## 3. Yêu cầu phi chức năng & Ràng buộc

| Nhóm | Ràng buộc |
|---|---|
| **Bảo mật vùng VMID** | Tuyệt đối không phát sinh thao tác nào (stop/delete/purge) trên VMID < 1000 (pfSense 100, Guac 103, ubuntu-105/106). Mọi destroy phải qua guard 3 tầng (§9.1). |
| **Dung lượng** | `local-lvm` (LVM-thin ~1.71 TiB, dùng ~7.7%); full-clone cho SV → cảnh báo ước lượng `size × số SV` khi tạo lab. Volume `ova_store` trên ubuntu-105 chịu file OVA vài chục GB. |
| **Hiệu năng import** | Chỉ **1 import cùng lúc** (lock toàn cục, queue tuần tự) để bảo vệ I/O PVE. Kỳ vọng OVA 10GB: ~15–30 phút end-to-end. |
| **Khả năng phục hồi** | Fail giữa chừng phải dọn sạch: destroy VM dở, xóa file tạm trên pve01, trả status `failed` + message. |
| **Kiểm toán** | Mọi thao tác (upload, import x/f, register, test start/stop/purge, xóa file/image, cleanup, cấp quyền) ghi `AuditLog` theo pattern hiện có. |
| **Tương thích ngược** | Không đổi schema bảng `labs`; lab cũ dùng template không có record trong thư viện vẫn hoạt động (coi là "system legacy template", mặc định public). |
| **Mạng** | VM import phải vào được VLAN 30 (`10.30.0.0/24`, DHCP từ pfSense .1) — đây là điều kiện để provisioning SV và Test VM hoạt động. |

---

## 4. Kiến trúc tổng quan

```
Giảng viên                 Backend (ubuntu-105 / malsec-backend)              pve01 (10.0.80.10)
   │                                                                                            │
   │ POST /api/vm-images/upload ──►  validate tar (Zip-Slip, kích thước)                        │
   │   (multipart, streaming)        lưu vào volume ova_store:/app/ova                          │
   │                                 record status=queued, đẩy vào import queue                 │
   │ ◄── response: vm_image id ──┘                                                               │
   │                                 ═══ BACKGROUND WORKER (lock 1 job) ═══                      │
   │                                 1. allocate VMID trống trong 1000–2000                     │
   │                                 2. SFTP push .ova ───────────► /var/lib/vz/malsec-import/  │
   │                                 3. SSH: tar -xf (đã validate members) ──►  thu muc tam     │
   │                                 4. SSH: qm importovf {vmid} {x}.ovf local-lvm ──► VM moi   │
   │                                 5. Proxmox API: set net0=...,bridge=vmbr1,tag=30;          │
   │                                    agent=1; ide2=qemu-ga ISO (nếu Windows);                │
   │                                    bios=ovmf+efidisk0 (nếu OVF EFI)                        │
   │                                 6. Proxmox API: convert → template                          │
   │                                 7. SSH: dọn thư mục tạm trên pve01                         │
   │                                 8. status=ready (file OVA giữ lại trên ova_store)          │
   │                                                                                            │
   │ GET /api/vm-images/{id} ◄───── poll 3–5s (frontend)                                       │
   │                                                                                            │
   │ POST /api/vm-images/{id}/test-session                                                      │
   │                                 clone template → dải 5000–5999 (vmtest-{img}-{user})       │
   │                                 start → chờ qemu-ga báo IP VLAN 30 → verify port RDP       │
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

**Điểm kết nối hạ tầng mới:** backend cần SSH/SFTP tới pve01 (thư viện `paramiko`, key riêng `malsec-backend` mount qua docker secret). Mọi thao tác khác vẫn ưu tiên Proxmox API (proxmoxer) như hiện tại.

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
| `ova_filepath` | String | nullable — NULL = đã xóa file / không phải OVA |
| `ova_original_filename` | String | nullable |
| `ova_size_bytes` | BigInteger | nullable |
| `vm_protocol` | String | `'rdp'` \| `'vnc'` \| `'ssh'` (default từ settings) |
| `vm_port` | Integer | default theo protocol |
| `vm_username` | String | nullable (bắt buộc với rdp/ssh khi dùng) |
| `vm_password` | String | nullable |
| `status` | String | `'queued'` \| `'importing'` \| `'ready'` \| `'failed'` |
| `status_message` | String | nullable — chi tiết lỗi import |
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
```

- Bảng `labs` **không đổi**. `Lab.template_vmid` vẫn là int trỏ VMID Proxmox.

---

## 6. Thiết kế API

### 6.1. Router mới `vm_images.py` — prefix `/api/vm-images`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | lecturer, admin | Thư viện của tôi + public. Admin thấy tất cả. Query `?view=files` (admin): chỉ các record còn file OVA + tổng dung lượng. Merge trạng thái thực tế từ PVE (running/stopped/template). |
| `POST` | `/upload` | lecturer có `can_upload_vm_images`, admin | Multipart: `file` (.ova) + `name`, `description`, `visibility`, `vm_protocol`, `vm_port`, `vm_username`, `vm_password`. Trả ngay record `status=queued`. **Không đi qua FileService** (giới hạn riêng `OVA_MAX_SIZE_GB`, bỏ qua `ALLOWED_EXTENSIONS`). |
| `POST` | `/register` | lecturer có `can_upload_vm_images`, admin | Body: `vmid` (1000–2000, chưa bị đăng ký), name, visibility, credentials. Tạo record `status=ready`, `origin=registered`. |
| `GET` | `/{id}` | owner, admin, hoặc mọi lecturer nếu public | Chi tiết + trạng thái import (frontend poll). |
| `PATCH` | `/{id}` | owner, admin | Sửa `name`, `description`, `visibility`, `vm_protocol`, `vm_port`, `vm_username`, `vm_password`. Không sửa khi `status` ∈ {`queued`,`importing`}. |
| `DELETE` | `/{id}` | owner, admin | **Xóa image**: 409 nếu có lab dùng `template_vmid` này; destroy VM qua guard `destroy_image_vm`; xóa file OVA; soft-delete record. |
| `DELETE` | `/{id}/ova-file` | owner, admin | **Chỉ xóa file OVA** (giải phóng disk), set `ova_filepath=NULL`. Chặn khi đang import. |
| `POST` | `/{id}/test-session` | lecturer, admin (image public hoặc của mình) | Clone → start VM test → trả `{vmid, ip_address, guacamole_url, expires}`. Kèm TTL sweep các VM test cũ của user. |
| `POST` | `/test-vms/{vmid}/control` | lecturer, admin | `{"action": "start"\|"stop"\|"purge"}` — chỉ trên VM test **của chính mình**, guard §9.1. |
| `POST` | `/admin/cleanup-imported` | admin | Dọn mọi file OVA của record `status=ready` (chỉ file, không đụng VM). Trả số file + GB giải phóng. |

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
  "has_ova_file": true,
  "vm_protocol": "rdp",
  "vm_port": 3389,
  "vm_username": "analyst",
  "vm_password": "lab-password",   // như Lab hiện tại — plaintext, xem §9.6
  "status": "ready",
  "status_message": null,
  "pve_status": "template",        // merge từ Proxmox: template|stopped|running|...
  "created_at": "2026-08-23T10:00:00"
}
```

```jsonc
// POST /api/vm-images/7/test-session
{
  "vmid": 5007,
  "ip_address": "10.30.0.77",
  "guacamole_url": "/guacamole/#/client/c/VMTest-...?data=...",
  "expires_at": "2026-08-23T14:00:00"
}
```

### 6.3. Sửa endpoint hiện có

| Endpoint | Thay đổi |
|---|---|
| `PUT /api/users/{id}` | Thêm field `can_upload_vm_images` (chỉ admin đặt được — clone pattern field `role` hiện tại). UserOut thêm field này để render badge. |
| `POST /api/labs`, `PUT /api/labs/{id}` | Validate `template_vmid`: có record `vm_images` → phải `public` hoặc `owner == current_user` (admin được hết); không có record + trong dải 1000–2000 → legacy system template (cho phép). Ngoài dải → 422 (như hiện tại). |
| `GET /api/labs/templates/proxmox` | **Giữ nguyên** cho tương thích, đánh dấu deprecated trong docstring; frontend Instructor chuyển sang `/api/vm-images`. |

### 6.4. Thay đổi service `vm_service.py` (refactor, không đổi hành vi)

- `_student_vm_name(username, scope_key, prefix)` — tham số hoá prefix (`lab-` cho SV giữ nguyên, `vmtest-` cho test).
- `_allocate_vmid(resources, key, vmid_min, vmid_max)` — khái quát từ `_allocate_student_vmid`.
- `provision_vm(username, scope_key, prefix, vmid_min, vmid_max, template_vmid, protocol, port)` — `provision_student_vm` trở thành wrapper gọi `provision_vm` với cấu hình student → **hành vi provisioning sinh viên không đổi**.
- Guards mới: `control_test_vm`, `destroy_image_vm` (§9.1). `control_student_vm` giữ nguyên.

---

## 7. Import Pipeline chi tiết

Chạy trong **ThreadPoolExecutor singleton (1 worker) + queue trong bộ nhớ**; nếu restart backend giữa chừng, job `queued`/`importing` bị "bỏ rơi" → khi startup, quét các record kẹt `queued`/`importing` quá 1 giờ → đánh dấu `failed` với message "bị gián đoạn do restart, hãy upload lại" (không tự destroy vì không chắc bước đang dở).

| Bước | Nơi chạy | Chi tiết |
|---|---|---|
| 1. Validate OVA | ubuntu-105 (python `tarfile`) | Là tar hợp lệ; đúng 1 file `.ovf` + ≥1 đĩa `.vmdk`/`.vhd` (cho phép `.mf`, `.cert`); mọi member: path relative, không `..`, không symlink/hardlink, không absolute; tổng kích thước giải nén ≤ `OVA_MAX_UNCOMPRESSED_GB`; kích thước file ≤ `OVA_MAX_SIZE_GB` (check cả khi upload lẫn trước import). |
| 2. Allocate VMID | Proxmox API | `cluster/resources` → slot nhỏ nhất trống trong [1000, 2000] và chưa có trong `vm_images`. |
| 3. Transfer | SFTP (paramiko) | `ova_store/{uuid}.ova` → `pve01:{PVE_IMPORT_TMP_DIR}/{uuid}/source.ova`. Thư mục trên storage `local` (directory-based, KHÔNG dùng `/tmp` — có thể là tmpfs chặn file lớn). |
| 4. Extract + Import | SSH | `tar -xf source.ova -C .` trong thư mục tạm riêng → `qm importovf {vmid} {ovf} {PVE_IMPORT_STORAGE}` (importovf tự tạo config VM từ OVF). |
| 5. Post-config | **Proxmox API** | `PUT /nodes/{node}/qemu/{vmid}/config`: `net0=<model từ OVF>,bridge={LAB_VM_BRIDGE},tag={LAB_VLAN_TAG}` (giữ model NIC, không ép virtio); `agent=enabled=1`; nếu OVF là Windows → `ide2=local:iso/qemu-ga-win.iso,media=cdrom`; nếu OVF khai báo EFI → `bios=ovmf` + tạo `efidisk0`. |
| 6. Convert template | Proxmox API | `PUT /nodes/{node}/qemu/{vmid}/template`. |
| 7. Cleanup pve01 | SSH | Xóa `{PVE_IMPORT_TMP_DIR}/{uuid}/`. |
| 8. Finalize | ubuntu-105 | `status=ready`. File OVA **giữ lại** trên `ova_store` (trừ khi `OVA_AUTO_DELETE_AFTER_IMPORT=true`). Ghi AuditLog `import_ova_ready`. |
| Fail-path | cả 2 đầu | Destroy VM dở (chỉ VMID mình vừa allocate, đúng dải) + xóa tạm pve01 + `status=failed` + `status_message` (VD: *"Import thất bại: OVF khai báo EFI nhưng không tạo được efidisk0 — hãy export lại ở chế độ BIOS hoặc liên hệ admin"*). Ghi AuditLog `import_ova_failed`. |

**Tại sao SSH là bắt buộc:** Proxmox HTTP API không có endpoint import OVF/OVA; `qm importovf` chỉ tồn tại trên CLI node. Mọi bước có thể dùng API thì dùng API (bước 5, 6); SSH chỉ dùng cho SFTP + tar + importovf.

---

## 8. Test VM cho Giảng viên

### 8.1. Thông số

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| Dải VMID | **5000–5999** | env `LECTURER_VMID_MIN/MAX`; tách bạch với template (1000–2000) và student (10000–19999) |
| Tên ownership | `vmtest-{image_id}-{username}` | Cùng thuật toán chuẩn hóa + digest sha256 như `_student_vm_name` (giới hạn 63 ký tự) |
| TTL | 4 giờ | env `TEST_VM_TTL_HOURS` |
| Credentials | Từ record `vm_images` | protocol/port/username/password của image |

### 8.2. Luồng `POST /{id}/test-session`

1. Check quyền image (public hoặc owner; admin được hết).
2. **TTL sweep**: với mọi image, tìm VM tên `vmtest-*-{username}` của user quá TTL (dựa `createtime` từ PVE config) → stop + destroy (guard §9.1).
3. Tìm VM test hiện có của (user, image): có → start nếu đang tắt; không → full-clone từ template (cùng code path `provision_vm` với prefix/dải test) → set MAC unique (tái dùng `_net0_with_unique_mac`).
4. Chờ qemu-ga báo IP thuộc `10.30.0.0/24` → **verify port RDP/SSH bật** (bật verify cho test session bất kể `VM_VERIFY_CONNECTION`, vì mục đích của test là kiểm chứng đúng luồng sinh viên sẽ gặp).
5. Sinh Guacamole URL bằng đúng engine hiện tại (`generate_guacamole_auth_json_url`), username Guac session: `{username}-test`.

### 8.3. Điều khiển & dọn dẹp

- `POST /test-vms/{vmid}/control` — start/stop/purge, chỉ VM của mình (admin: mọi VM test).
- Frontend: modal Test VM có nút Tắt / Xóa VM test / Tải lại kết nối.
- Không có cron dọn định kỳ — cleanup lazy khi gọi test-session + nút thủ công (đủ cho quy mô hiện tại, không thêm dependency).

---

## 9. An toàn bảo mật

### 9.1. Guard VMID — 3 tầng theo mục đích (mở rộng cơ chế hiện tại)

Hệ thống hiện mới chỉ có guard dải student (`control_student_vm`, kiểm tra `STUDENT_VMID_MIN..MAX` cả ở router `labs.py` lẫn service). Bổ sung:

| Guard hàm | Dải cho phép | Điều kiện bổ sung bắt buộc | Caller |
|---|---|---|---|
| `control_student_vm` (hiện có, giữ nguyên) | 10000–19999 | — | lab VM manager |
| `control_test_vm(vmid, username)` | 5000–5999 | Tên VM trên PVE phải khớp `vmtest-*-{username}` (ownership) | test-session control |
| `destroy_image_vm(vmid)` | 1000–2000 | Tồn tại record `vm_images` với đúng vmid; không có lab đang dùng | DELETE /vm-images/{id} |

Nguyên tắc bất di bất dịch: **không endpoint nào được gọi Proxmox destroy/stop trực tiếp với tham số vmid do client kiểm soát mà không qua một guard trên**; mọi guard từ chối tuyệt đối dải VMID < 1000.

### 9.2. OVA là input không tin cậy

- Validate member chặt (bước 1, §7) trước khi đưa đi giải nén trên PVE — chống **Zip-Slip** (path traversal qua `../`, symlink), chống tar-bomb (giới hạn giải nén).
- Giải nén chỉ trong thư mục tạm biệt lập `{PVE_IMPORT_TMP_DIR}/{uuid}/`, xóa ngay sau import.
- Không bao giờ execute nội dung OVA; `qm importovf` chỉ parse OVF (XML) + ghi disk image.

### 9.3. SSH riêng cho backend

- Key pair mới `malsec-backend` (ed25519), **không tái dùng** key cá nhân `manhpp_ed25519` trong repo.
- Private key mount vào container qua docker secret (`/run/secrets/pve_ssh_key`, chmod 600), user SSH `root@10.0.80.10` (PVE không hỗ trợ shell hạn quyền cho user thường vì `qm` cần root — đã cân nhắc, xem §12).
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
| `PVE_IMPORT_STORAGE` | `local-lvm` | Storage nhập đĩa VM |
| `PVE_IMPORT_TMP_DIR` | `/var/lib/vz/malsec-import` | Thư mục tạm trên pve01 (storage `local`) |
| `LAB_VM_BRIDGE` | `vmbr1` | Bridge chuẩn cho VM import |
| `LAB_VLAN_TAG` | `30` | VLAN tag sandbox |
| `LECTURER_VMID_MIN` / `LECTURER_VMID_MAX` | `5000` / `5999` | Dải VM test giảng viên |
| `TEST_VM_TTL_HOURS` | `4` | TTL VM test |
| `OVA_MAX_SIZE_GB` | `60` | Giới hạn file nén |
| `OVA_MAX_UNCOMPRESSED_GB` | `150` | Giới hạn tổng giải nén |
| `OVA_AUTO_DELETE_AFTER_IMPORT` | `false` | Tự xóa file sau import (mặc định tắt — admin duyệt thủ công) |
| `OVA_UPLOAD_DIR` | `/app/ova` | Thư mục lưu OVA trong container |

### 10.2. Thay đổi `docker-compose.yml`

- Volume mới: `ova_store:/app/ova`.
- Secrets mới: `pve_ssh_key`, `pve_known_hosts` (file-based secrets mount vào backend).
- Frontend nginx: nâng `CLIENT_MAX_BODY_SIZE` (≈ `61440M`) và `PROXY_CONNECT/SEND/READ_TIMEOUT` (đề xuất `3600s`) — đã env-driven, chỉ đổi giá trị `.env` khi deploy.

### 10.3. Thay đổi `backend/requirements.txt`

- Thêm `paramiko>=3.4` (SSH/SFTP client pure-python, container không có ssh binary).

### 10.4. Chuẩn bị một lần trên hạ tầng (thủ công, bởi admin)

1. Gen key `malsec-backend` trên ubuntu-105: `ssh-keygen -t ed25519 -f malsec-backend -N ""`.
2. Thêm public key vào `root@pve01:~/.ssh/authorized_keys` (entry riêng, comment `malsec-backend-service`).
3. Ghi fingerprint: `ssh-keyscan -H 10.0.80.10 > pve_known_hosts`.
4. Tạo thư mục trên pve01: `mkdir -p /var/lib/vz/malsec-import && chmod 700 /var/lib/vz/malsec-import`.
5. Kiểm tra `pvesm status` còn dư dung lượng `local` (tạm OVA + extract) và `local-lvm` (đĩa VM).

---

## 11. Thay đổi Frontend

### 11.1. InstructorDashboard — tab mới "Thư viện Máy ảo"

- Tách component riêng `frontend/src/pages/components/VmLibraryTab.jsx` (InstructorDashboard đã ~2200 dòng, không nhét thêm).
- Bảng images: VMID, tên, nguồn (OVA/Đăng ký), visibility badge (Private/Public), owner, kích thước file, trạng thái import (queued/importing có spinner + poll 3–5s / ready / failed + message), trạng thái PVE (template/stopped/...).
- Actions theo quyền: **Test VM**, Sửa (metadata/visibility/credentials), Xóa image, Xóa file OVA (nếu còn file).
- **Modal Upload OVA**: các trường metadata + file picker `.ova` + progress bar (XHR upload progress) + kỳ vọng thời gian "15–30 phút" sau khi upload xong, poll trạng thái import.
- **Modal Đăng ký VM sẵn có**: chọn VMID từ danh sách PVE trong dải 1000–2000 chưa đăng ký.
- **Modal Test VM**: iframe Guacamole (tái dùng pattern `StudentDashboard`: focus bàn phím, clipboard permission, reload) + nút Tắt / Xóa VM test / Tải lại kết nối.

### 11.2. InstructorDashboard — modal tạo/sửa Lab

- Select "Base VM" chuyển nguồn từ `GET /api/labs/templates/proxmox` sang `GET /api/vm-images` (của tôi + public), hiển thị `(private)` cho image của mình.
- Chọn image → prefill `vm_protocol`, `vm_port`, `vm_username`, `vm_password`.
- Hiển thị cảnh báo ước lượng dung lượng khi template lớn (nếu có dữ liệu size).

### 11.3. AdminDashboard

- **Tab "Quản lý Máy ảo Proxmox"** mở rộng thành "Thư viện & Máy ảo":
  - Bảng **toàn bộ** image của mọi giảng viên (kể cả private): owner, visibility, file size, trạng thái.
  - Tổng dung lượng `ova_store` + số file đang giữ.
  - Nút: Test VM, Xóa file, Xóa image, **"Dọn các file đã import thành công"** (bulk cleanup, confirm + hiện số GB sẽ giải phóng).
- **Tab "Quản lý Tài khoản"**: modal Sửa user thêm checkbox "Được phép upload OVA" (chỉ hiện với role lecturer); bảng users thêm badge chìa khóa 🔑 cho lecturer có quyền.

---

## 12. Edge cases & Quyết định đã chốt

| # | Tình huống | Quyết định |
|---|---|---|
| 1 | Ai được upload OVA? | Lecturer được admin bật `can_upload_vm_images`; admin luôn được. |
| 2 | File OVA sau import? | **Giữ mặc định** để admin duyệt; owner/admin xóa tay; bulk cleanup; env `OVA_AUTO_DELETE_AFTER_IMPORT` (tắt) cho tương lai. |
| 3 | Dải VMID test? | 5000–5999, TTL 4h, env chỉnh được. |
| 4 | SSH root hay user riêng? | **root + key riêng `malsec-backend`** — `qm` cần root, PVE không có shell hạn quyền cho user thường; bù lại key riêng + known_hosts pin + secret mount. |
| 5 | "Đăng ký VM sẵn có" làm khi nào? | Phase 1 (công sức nhỏ, chỉ tạo record + validate). |
| 6 | Thu hồi quyền upload giữa chừng? | Job đang chạy chạy nốt; chỉ chặn request mới. |
| 7 | Xóa user sở hữu image? | `owner_id SET NULL` → image mồ côi, chỉ admin quản; không chặn việc xóa tài khoản. |
| 8 | Đổi visibility sau khi lab đã dùng? | Lab cũ tiếp tục dùng (visibility chỉ chặn **lựa chọn mới**). |
| 9 | Backend restart giữa import? | Startup sweep: record kẹt `queued/importing` quá 1h → `failed` + message; không tự destroy VM (an toàn hơn đoán mò bước dở — admin xử thủ công qua PVE nếu có rác). |
| 10 | NIC model từ OVF (E1000…)? | **Giữ nguyên model**, chỉ ép bridge/vlan — ép virtio sẽ làm mất mạng trên image không có driver; virtio là tối ưu hóa sau (§16). |
| 11 | Đụng dải VMID < 1000? | Tuyệt đối không — mọi guard từ chối; đây là quy tắc bất di bất dịch của hệ thống (AGENTS.md). |

---

## 13. Rủi ro & Giảm thiểu

| # | Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|---|
| 1 | Image thiếu qemu-guest-agent hoặc driver NIC → provisioning SV treo ở bước chờ IP VLAN 30 | **Cao** | Test VM là công cụ kiểm chứng bắt buộc nên dùng; post-import mount sẵn ISO qemu-ga; UI cảnh báo khi active lab dùng template "chưa từng test" (soft warning); checklist trong modal upload. |
| 2 | Dung lượng thin pool do full-clone (60GB × 30 SV ≈ 1.8TB over-commit trên 1.71TB thin) | Cao | Hiển thị size image + ước lượng khi tạo lab; theo dõi dung lượng (đã có khuyến nghị trong tài liệu vận hành); 3 NVMe 2TB dự phòng chưa đưa vào. |
| 3 | OVA UEFI không boot sau import (thiếu efidisk0) | Trung bình | Detect firmware từ OVF → set `bios=ovmf` + `efidisk0`; fail thì `status_message` hướng dẫn export lại ở BIOS mode. |
| 4 | Upload đứt giữa chừng phải upload lại từ đầu | Trung bình | Chấp nhận ở v1 (mạng nội bộ LAN); chunked/resumable ở §16. |
| 5 | SSH từ backend container chưa verify thông | **Cao (chặn Phase 0)** | Spike Phase 0 bắt buộc trước (§14); nếu port 22 không reach được từ VLAN management → phải mở rule/đường đi trước khi code. |
| 6 | Import đồng thời nhiều job quá tải PVE I/O | Trung bình | Lock 1 job + queue tuần tự; 429/queue hiển thị trên UI. |
| 7 | Tar-bomb / Zip-Slip qua OVA độc hại | Trung bình | Validate members chặt trước transfer (§9.2); giới hạn giải nén; giải nén trong thư mục tạm riêng. |
| 8 | File OVA giữ lại làm đầy disk ubuntu-105 | Trung bình | Admin view tổng dung lượng + bulk cleanup + cảnh báo ngưỡng (VD >80% volume) khi duyệt. |
| 9 | `qm importovf` thay đổi hành vi giữa phiên bản PVE | Thấp | Pin theo tài liệu PVE 9.2; Phase 0 test với OVA thật; nếu lỗi format → status_message rõ ràng. |

---

## 14. Lộ trình triển khai & Ước lượng

| Phase | Nội dung | Kết quả nghiệm thu | Ước lượng |
|---|---|---|---|
| **0 — Spike hạ tầng** | SSH từ backend container (staging) → pve01 với key mới; `qm importovf` với OVA nhỏ (1–2GB) vào local-lvm; đo thời gian từng bước; xác nhận `/var/lib/vz` đủ chỗ; chụp lại output làm tài liệu | Memo kết quả spike (thông/không thông + số liệu) — quyết định go/no-go | 0.5–1 ngày |
| **1 — Nền tảng dữ liệu & CRUD** | Model `VMImage` + cột `users.can_upload_vm_images` + auto-migration; router vm_images với GET/PATCH/register; validate lab theo visibility; endpoint users mở rộng; AuditLog | Upload permission cấp được; CRUD + visibility hoạt động qua Swagger | 1–1.5 ngày |
| **2 — Import pipeline** | `vm_image_service.py` đầy đủ 8 bước (§7); worker queue; validate OVA; fail-path cleanup; paramiko client; config env mới | Upload OVA thật qua Swagger → template xuất hiện trên PVE đúng chuẩn (net0 tag 30, agent, template) | 1.5–2 ngày |
| **3 — Test VM + guards** | Refactor `provision_vm`; `control_test_vm` + `destroy_image_vm`; test-session endpoint; TTL sweep | Test VM mở qua Guacamole, tắt/xóa/TTL hoạt động; guard chặn đúng mọi VMID ngoài phạm vi | 1 ngày |
| **4 — Frontend** | `VmLibraryTab` (upload + register + poll + edit + delete); modal Test VM; lab modal tích hợp; AdminDashboard (permission checkbox, badge, duyệt file, cleanup) | Luồng giảng viên + admin hoàn chỉnh trên UI | 1.5–2 ngày |
| **5 — Deploy staging & E2E** | Deploy ubuntu-106; setup key/secrets/env; E2E với OVA thật (Windows có RDP); hiệu chỉnh nginx timeouts; nghiệm thu toàn FR | Checklist §15 pass hết trên staging | 0.5–1 ngày |

**Tổng: ~7–9 ngày làm việc.** Triển khai code theo thứ tự phase; mỗi phase merge отдель commit có thể revert độc lập. Deploy production (ubuntu-105) chỉ sau khi staging nghiệm thu xong.

---

## 15. Kế hoạch Deploy & Kiểm thử E2E

### 15.1. Trình tự deploy staging (ubuntu-106)

1. Chuẩn bị hạ tầng một lần (§10.4) — **trên pve01 thật** vì staging dùng chung cụm PVE (lưu ý: import staging cũng tốn dung lượng thật của `local-lvm`).
2. Cập nhật `.env` trên server: thêm toàn bộ env §10.1, nâng `CLIENT_MAX_BODY_SIZE=61440M`, `PROXY_*_TIMEOUT=3600s`.
3. Đưa secrets vào server (key + known_hosts, chmod 600).
4. Deploy theo quy trình chuẩn AGENTS.md (tar → scp → `docker compose up -d --build`).
5. Verify: container backend lên, `docker logs malsec-backend` không lỗi env, bảng `vm_images` được tạo.

### 15.2. Checklist E2E nghiệm thu (trên staging)

- [ ] Admin bật quyền upload cho 1 lecturer → lecturer đó thấy nút Upload, lecturer kia không thấy; lecturer không quyền gọi thẳng API → 403.
- [ ] Upload OVA 10GB: progress bar chạy, record `queued → importing → ready`; tổng thời gian ghi nhận.
- [ ] Sau import: PVE có template VMID trong 1000–2000, `qm config` đúng (`net0=...,bridge=vmbr1,tag=30`, `agent=1`, template flag).
- [ ] Upload OVA lỗi (file fake / zip-slip / quá dung lượng) → `failed` + message rõ; không để lại rác trên pve01.
- [ ] Test VM: mở Guacamole bằng credentials của image; đăng nhập được desktop; tắt/xóa hoạt động; VM nằm dải 5000–5999.
- [ ] TTL: chỉnh `TEST_VM_TTL_HOURS=0.01` trên staging → VM test quá hạn bị dọn khi gọi test-session kế tiếp.
- [ ] Visibility: lecturer B không thấy image private của A (list + GET + PATCH + test + đoán vmid vào lab → đều chặn); B thấy và dùng được khi A chuyển public.
- [ ] Admin: duyệt danh sách tất cả file; xóa file (VM còn nguyên, lab vẫn chạy); xóa image đang có lab dùng → 409; bulk cleanup trả đúng số GB.
- [ ] Tạo lab với template từ thư viện → prefill credentials; sinh viên mở lab → provisioning clone từ template đó hoạt động như template hệ thống.
- [ ] Lab cũ (template legacy không có record) vẫn tạo/chạy bình thường.
- [ ] Guard: mọi thao tác delete/purge với VMID ngoài dải quy hoạch (thử 103, 1001 qua API test-vm control, 5000 qua destroy_image...) → bị chặn, có log `[SECURITY BLOCKED]`.
- [ ] AuditLog ghi đủ 12 action mới.
- [ ] Khởi động lại backend giữa import → record bị đánh dấu failed đúng (§12.9), không treo vĩnh viễn.

### 15.3. Deploy production (ubuntu-105)

Lặp lại 15.1 sau khi staging pass toàn checklist; kiểm tra thêm dung lượng `local-lvm` và `ova_store` trước giờ-upload đầu tiên.

---

## 16. Công việc trong tương lai (ngoài phạm vi)

1. **Chunked/resumable upload** (tus.io hoặc tự viết) — chống đứt mạng với OVA lớn.
2. **Chuẩn hóa NIC sang virtio** cho image đã cài driver — tăng hiệu năng mạng.
3. **Mã hóa `vm_password` at-rest** (kéo theo cả `Lab.vm_password`).
4. **Workflow phê duyệt**: image mới import mặc định "chờ duyệt" trước khi public.
5. **Giám sát dung lượng tự động**: cảnh báo thin-pool `local-lvm` + volume `ova_store` qua UI admin.
6. **Đưa 3 NVMe 2TB dự phòng** vào PVE storage riêng cho template/OVA (tách khỏi data live).
7. **Tái sử dụng code markdown/parser, modal VM Manager** đang trùng lặp giữa các dashboard (dọn nợ kỹ thuật chung).

---

## Phụ lục A — Tham chiếu code hiện tại liên quan

| Vị trí | Vai trò trong thiết kế này |
|---|---|
| `backend/app/services/vm_service.py` — `_student_vm_name`, `_allocate_student_vmid`, `provision_student_vm`, `_net0_with_unique_mac`, `_get_guest_vlan_ip`, `_wait_for_connection`, `generate_guacamole_auth_json_url` | Tái sử dụng / tham số hóa cho Test VM; không đổi hành vi student |
| `backend/app/services/vm_service.py` — `control_student_vm` | Pattern cho 2 guard mới |
| `backend/app/routers/labs.py` — `create_lab`/`update_lab` (validate template_vmid), `get_or_create_vm_session` | Nơi bổ sung validate visibility; pattern cho test-session endpoint |
| `backend/app/main.py` — `seed_data()` auto-migration | Nơi thêm ALTER TABLE users + tạo bảng qua `create_all` |
| `backend/app/services/file_service.py` | **Không dùng** cho OVA (giới hạn riêng); giữ nguyên cho bài nộp |
| `frontend/src/pages/StudentDashboard.jsx` — iframe Guacamole + focus + reload | Pattern tái sử dụng cho modal Test VM |
| `frontend/src/pages/InstructorDashboard.jsx` — lab modal cấu hình VM, VM Manager | Nơi tích hợp thư viện + prefill |
| `frontend/src/pages/AdminDashboard.jsx` — users modal, VM tab | Nơi thêm permission checkbox + duyệt file |

## Phụ lục B — Tham chiếu hạ tầng (từ tài liệu vận hành 2026-08-05)

- Proxmox VE 9.2.2, node đơn `pve01` (10.0.80.10, bridge quản trị `vmbr0` 10.0.80.0/24).
- `vmbr1`: VLAN-aware, không IP — mang VLAN 30 (sandbox 10.30.0.0/24, DHCP từ pfSense 10.30.0.1) và VLAN 40 (INetSim).
- Storage: `local-lvm` (LVM-thin ~1.71 TiB, dùng ~7.7%), `local` (directory, chứa ISO — có sẵn `local:iso/qemu-ga-win.iso` 11.6 MiB).
- `ubuntu-105` = 10.0.80.55 (production), `ubuntu-106` (staging), cùng subnet management với pve01.
- **Lưu ý từ tài liệu vận hành:** không có backup PVE — mọi thao tác destroy phải qua guard, tuyệt đối không `docker compose down -v`.
