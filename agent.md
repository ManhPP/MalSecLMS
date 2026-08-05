# MalSec Agent Handoff Guide

Tệp này là tài liệu bàn giao nhanh cho agent hoặc kỹ sư tiếp quản dự án MalSec. Mục tiêu là giúp người mới hiểu đúng phạm vi, kiến trúc, trạng thái đã xác minh, ràng buộc an toàn và cách thay đổi hệ thống mà không vô tình làm mất dữ liệu hoặc ảnh hưởng các VM khác trên Proxmox.

> Cảnh báo: đây là hệ thống lab phân tích mã độc chạy trên hạ tầng thật. Việc có tên SSH, địa chỉ IP hoặc hướng dẫn vận hành trong tệp này **không tự động cấp quyền thay đổi hệ thống**. Chỉ thực hiện mutation khi yêu cầu hiện tại của người dùng cho phép rõ ràng.

## 1. Tóm tắt nhanh

- Workspace local: repository MalSec hiện tại.
- Nhánh tại thời điểm tạo tài liệu: `dev-multi-vms`.
- Commit nền tại thời điểm tạo tài liệu: `e17630f2de875bb421a84317e6ebf1d71a4a4c0a`.
- Máy triển khai ứng dụng: VM 105, truy cập bằng SSH alias `ubuntu-105`.
- Thư mục deploy trên VM 105: `/home/iahn/malsec`.
- Proxmox node thật: `pve01`; SSH alias dùng để truy cập: `pve01-cf`.
- MalSec chạy bằng Docker Compose gồm PostgreSQL, FastAPI backend và Nginx/React frontend.
- Apache Guacamole chạy riêng trong LXC 103 trên Proxmox.
- pfSense chạy ở VM 100 và làm gateway/DHCP cho VLAN sandbox.
- VM sinh viên được full-clone từ base VM, có MAC riêng, IP DHCP riêng và được tìm lại bằng stable name `lab-{lab_id}-{username}`.
- Tài liệu hiện trạng đầy đủ nhất là `Tai_lieu_van_hanh_MalSec_Proxmox_2026-08-05.md`.
- Bản Word tương ứng là `Tai_lieu_van_hanh_MalSec_Proxmox_2026-08-05.docx`.

Thông tin live trong tài liệu trên được kiểm kê ngày 05/08/2026. Trước mọi thao tác có tác động, phải kiểm tra lại vì VM, IP, snapshot, dung lượng và trạng thái service có thể đã thay đổi.

## 2. Thứ tự ưu tiên nguồn sự thật

Khi các nguồn mâu thuẫn, dùng thứ tự sau:

1. Trạng thái live vừa đọc từ PVE, VM 105, CT 103 hoặc pfSense bằng lệnh chỉ đọc.
2. Mã nguồn hiện tại, `docker-compose.yml`, `.env.example`, runtime Nginx và schema/model backend.
3. `Tai_lieu_van_hanh_MalSec_Proxmox_2026-08-05.md`.
4. `Ho_so_kien_truc_Malware_Lab_v3.docx` làm tài liệu nền/tham khảo.
5. Các tài liệu cũ như `SYSTEM_ARCHITECTURE.md`, `guacamole_proxmox_integration.md`, `walkthrough.md`, `implementation_plan.md` chỉ dùng để hiểu lịch sử.

Không coi `SYSTEM_ARCHITECTURE.md` là nguồn live. Tệp này có các mô tả cũ như công thức VMID, MAC dùng chung, địa chỉ cũ và từng chứa ví dụ thông tin xác thực dạng rõ. Không sao chép credential/secret từ tài liệu lịch sử sang code, log, ticket hoặc câu trả lời.

Nếu chưa kiểm tra live, phải ghi rõ “theo lần kiểm kê ngày 05/08/2026” thay vì khẳng định đó là trạng thái hiện tại.

## 3. Biên quyền hạn và an toàn bắt buộc

### 3.1. Không được tự ý thực hiện

- Không xóa, purge, stop, reset, snapshot rollback hoặc đổi cấu hình VM/LXC nếu người dùng chỉ yêu cầu kiểm tra, giải thích hoặc chẩn đoán.
- Không chạy `docker compose down -v`, xóa volume, xóa database, xóa upload hoặc reset production nếu chưa có yêu cầu rõ ràng và chưa xác nhận backup/phạm vi.
- Không chạy `git reset --hard`, checkout đè, clean, force-push hoặc xóa thay đổi không thuộc nhiệm vụ.
- Không dùng `rsync --delete` hoặc đồng bộ mù từ local lên VM 105.
- Không chạy lệnh prune Docker có thể xóa volume/image đang cần để rollback.
- Không chỉnh firewall, route, bridge, VLAN, GRE, pfSense hoặc Cloudflare Tunnel ngoài maintenance plan có đường rollback.
- Không thay đổi hoặc xóa VM hạ tầng, base VM hay VM của dự án khác chỉ vì VMID nằm trong inventory.
- Không đưa `.env`, PVE token, JWT secret, Guacamole secret, Cloudflare token, password DB/VM hoặc URL chứa token vào log/chat/tài liệu.
- Không in toàn bộ kết quả `docker compose config`; kết quả này có thể render secret.
- Không dùng `systemctl status cloudflared*` trong output không tin cậy khi token vẫn có thể xuất hiện trên command line.

### 3.2. Khi mutation được cho phép

Trước khi thay đổi production:

1. Đọc `git status` và `git diff`; bảo toàn thay đổi của người dùng.
2. Xác nhận đúng host bằng hostname/IP trước khi chạy lệnh.
3. Ghi lại trạng thái trước thay đổi: VMID, name, config, status, volume, snapshot, container/image và service.
4. Xác định backup/rollback thực sự tồn tại; snapshot cùng storage không phải backup ngoại vi.
5. Giới hạn thao tác vào đúng tài nguyên được yêu cầu.
6. Thực hiện thay đổi nhỏ, có thể kiểm chứng và có đường quay lại.
7. Smoke test cả API, giao diện, WebSocket Guacamole và ít nhất một VM test.
8. Không tuyên bố hoàn tất nếu chỉ thấy process “running”; phải kiểm tra chức năng end-to-end.

## 4. Kiến trúc và topology đã xác minh

### 4.1. Luồng ứng dụng chính

```text
Browser
  -> Cloudflare Edge (HTTPS/WebSocket)
  -> cloudflared trên pve01
  -> VM 105 / Nginx port 80
       -> FastAPI backend
       -> PostgreSQL
       -> Proxmox API 10.0.80.10:8006
       -> CT 103 Guacamole 10.0.80.50:8080
Guacamole/guacd
  -> IP guest VM trên VLAN 30 qua RDP, VNC hoặc SSH
```

Browser không kết nối RDP/VNC/SSH tới Proxmox. Browser chỉ dùng HTTP/WebSocket với Guacamole; `guacd` mới mở protocol connection tới guest VM. Proxmox API chỉ quản lý vòng đời VM và proxy lệnh QEMU Guest Agent.

### 4.2. Các vùng mạng

| Vùng | CIDR/gateway | Thành phần chính | Ràng buộc |
|---|---|---|---|
| Management | `10.0.80.0/24`, router `10.0.80.251` | PVE `.10`, pfSense WAN `.5`, Guac external `.50`, VM 105 `.55` | Đây là control plane; student VM không được phép truy cập tùy ý. |
| Sandbox VLAN 30 | `10.30.0.0/24`, pfSense `.1` | Guac internal `.50`, base VM và student clone | DHCP hoạt động; Internet/DNS bị chặn trong phép thử, nhưng east-west cùng subnet chưa được cô lập. |
| INetSim VLAN 40 | `10.40.0.0/24`, pfSense `.1` | Chưa thấy workload INetSim tại lần kiểm kê | Không tuyên bố INetSim hoạt động nếu chưa có workload/test end-to-end. |
| GRE transit | `10.255.70.0/30` | PVE `.2`, peer `.1` | Liên quan đường egress PVE/VM105; không chỉnh nếu chưa hiểu route/NAT hiện tại. |

Ràng buộc quan trọng: pfSense chỉ kiểm soát traffic đi qua gateway. Hai máy trong cùng VLAN 30 có thể giao tiếp lớp 2 trực tiếp và không đi qua pfSense. Vì vậy “chặn Internet bằng pfSense” không đồng nghĩa “VM sinh viên được cô lập với nhau”.

### 4.3. Các cổng quan trọng

- PVE API: TCP 8006.
- PVE/VM/CT SSH: TCP 22 theo policy mạng.
- Frontend VM 105: TCP 80; backend 8000 và PostgreSQL 5432 hiện được publish, đây là rủi ro cần thu hẹp.
- Guacamole/Tomcat: TCP 8080.
- guacd: TCP 4822 loopback trong CT 103.
- MariaDB Guacamole: TCP 3306 loopback trong CT 103.
- Postfix CT 103: TCP 25 loopback.
- Student protocol mặc định: RDP 3389, VNC 5900, SSH 22.
- Cloudflare Tunnel outbound: thường dùng TCP/UDP 7844; không mở origin trực tiếp ra Internet.

## 5. Inventory Proxmox cần biết

Snapshot dưới đây chỉ là mốc 05/08/2026; kiểm tra lại bằng `qm list`, `pct list`, `qm config`, `pct config` trước khi hành động.

| ID | Tài nguyên | Vai trò/ràng buộc |
|---:|---|---|
| 100 | QEMU `pfSense-Gateway` | Hạ tầng mạng; ba NIC WAN/VLAN30/VLAN40; không được app purge. Tại mốc kiểm kê chưa có `onboot=1`. |
| 101 | QEMU `Win-1` | Windows legacy, không phải base MalSec hiện tại. |
| 102 | QEMU `ubuntu-1` | Ubuntu legacy. |
| 103 | LXC `apache-guacamole` | Hạ tầng VDI; unprivileged Debian 13; dual NIC; `onboot=1`. |
| 104 | QEMU `Win10` | Windows legacy ở management; không dùng làm sandbox hiện tại. |
| 105 | QEMU `ubuntu-105` | Máy deploy MalSec, IP `10.0.80.55`, QGA và onboot. |
| 1001 | QEMU `Lab1-VM` | Base Windows MalSec hiện tại; stopped, QGA, ISO đã tháo. |
| 1003 | QEMU `Lab1-Ubuntu` | Base Ubuntu MalSec hiện tại; stopped, QGA/XRDP; tại mốc kiểm kê ISO Desktop còn gắn. |
| 11153 | QEMU `lab-3-dattt67` | Student clone Ubuntu đang tồn tại tại mốc kiểm kê. |
| 19171 | QEMU `lab-1-sonnt69` | Student clone Windows đang tồn tại tại mốc kiểm kê. |
| 19828 | QEMU `lab-1-dattt67` | Student clone Windows đang tồn tại tại mốc kiểm kê. |

Không suy luận VM “thừa” chỉ từ việc không thấy trên UI. Trước khi xóa, phải đối chiếu stable name, VMID range, lab/user, DB, PVE description/name và audit/log.

### 5.1. Ranh giới VMID

Giá trị mặc định trong `.env.example`:

- Base/template range: `1000..2000`.
- Student range: `10000..19999`.
- Default base VMID: `1001`.

Range là cấu hình, không phải hằng số vĩnh viễn. Luôn đọc runtime env/config trước khi thao tác.

Các tài nguyên hạ tầng có VMID dưới 1000 và base VM trong range template không được xóa qua luồng quản lý student VM.

Guard hiện tại của `control_student_vm()` chủ yếu kiểm tra VMID nằm trong student range. Guard này **chưa đủ chứng minh ownership**. Agent không được purge một VM chỉ vì VMID hợp lệ; phải xác minh name/owner/lab.

## 6. Hợp đồng cấp phát VM sinh viên

Đây là các invariant không được phá khi sửa `backend/app/services/vm_service.py`:

1. Mỗi cặp `student_username + lab_id` có stable name riêng.
2. Stable name hiện dùng dạng `lab-{lab_id}-{normalized_username}`; username bất thường/dài được normalize và thêm SHA-256 suffix.
3. VMID ưu tiên được hash từ `username + NUL + lab_id` trong student range.
4. Nếu VMID hash bị chiếm, allocator đi tuần tự trong range để tìm VMID trống.
5. Tìm VM hiện hữu bằng **stable name**, không giả định lại VMID hash là VMID cuối cùng.
6. Nếu có hơn một VM cùng stable name, phải fail an toàn thay vì chọn ngẫu nhiên.
7. Source VM phải tồn tại, thuộc range template được phép và phải stopped trước clone.
8. Clone phải là `full=1`; không dùng linked clone cho phiên lab độc lập nếu chưa thiết kế lại storage/lifecycle.
9. Clone phải có disk riêng và MAC local-administered riêng; không copy MAC base cho nhiều sinh viên.
10. Backend bật QGA trong PVE config và chỉ nhận IPv4 nằm trong `LAB_NETWORK_CIDR`.
11. Không fallback sang IP tĩnh giả định hoặc IP cuối cùng đã thấy trong log.
12. Protocol/port/username/password lấy từ cấu hình lab, không hard-code Windows/RDP.
13. Guacamole URL dùng Encrypted JSON; không quay lại generator HMAC cũ.
14. Rollback đúng nghĩa hiện là stop + purge VM stable-name của user/lab; lần vào sau sẽ full-clone lại.
15. Rollback VM không xóa submission/draft trên LMS.

Lỗi nghiêm trọng cần test hồi quy: hai user khác nhau không được nhận cùng VM/disk/IP/MAC. Test tối thiểu phải tạo hai clone từ cùng base, tạo file khác nhau và chứng minh file không xuất hiện chéo.

## 7. Hợp đồng của base VM/template

Trước khi cho giảng viên chọn một base VM:

- VMID nằm trong range template runtime.
- VM đang stopped.
- Có `net0` trên đúng bridge/VLAN sandbox, hiện là `vmbr1` tag 30.
- DHCP hoạt động; không để clone dùng chung static IP.
- QEMU Guest Agent đã cài trong guest, service active và PVE config bật agent.
- Protocol đã chọn trong lab thực sự listen: RDP, VNC hoặc SSH.
- Credential do giảng viên nhập phải đúng với guest; không hard-code credential trong code.
- Firewall guest chỉ mở tối thiểu protocol cần thiết, ưu tiên chỉ cho nguồn Guacamole `10.30.0.50`.
- ISO cài đặt phải tháo/eject sau khi hoàn tất, trừ khi có lý do vận hành được ghi lại.
- Base phải có version, snapshot/baseline và backup ngoại vi; snapshot local không đủ làm backup.
- Clone thử tối thiểu hai VM để kiểm tra disk, MAC, IP và OS identity khác nhau.

### 7.1. Windows base

- Cài VirtIO/QEMU Guest Agent từ media PVE, hiện có `local:iso/qemu-ga-win.iso` và `local:iso/virtio-tools-win.iso`.
- Bật Remote Desktop, service RDP và rule Windows Firewall phù hợp.
- Chuẩn bị Sysprep/unattend đúng nếu generalize; bảo đảm OOBE không làm clone kẹt trước khi RDP sẵn sàng.
- Kiểm tra QGA, RDP 3389, layout bàn phím, wallpaper/graphics và credential qua Guacamole.
- SMB/NetBIOS không nên mở giữa các VM sinh viên.

### 7.2. Ubuntu/Linux base

- Cài `qemu-guest-agent` và bật service.
- Nếu dùng RDP, cài desktop + `xrdp`/`xorgxrdp`, kiểm tra `xrdp` và `xrdp-sesman`.
- Nếu dùng SSH, bảo đảm sshd chạy và host key được regenerate an toàn theo instance; không để mọi clone dùng chung SSH host key.
- Không đưa user/password cố định vào source code; credential là cấu hình lab.
- Kiểm tra session desktop thực sự render qua Guacamole, không chỉ kiểm tra TCP connect.

## 8. Ứng dụng MalSec

### 8.1. Thành phần

- `frontend`: React 18 + Vite; Nginx phục vụ SPA và reverse proxy `/api` cùng `/guacamole`.
- `backend`: FastAPI/Uvicorn, SQLAlchemy, Proxmoxer và Guacamole Encrypted JSON.
- `db`: PostgreSQL 16.
- Upload: Docker volume `student_uploads` mount tại `/app/uploads`.
- Database: Docker volume `postgres_data`.
- Guacamole không nằm trong Compose MalSec; nó là CT 103 riêng.

### 8.2. Database chính

- `users`.
- `classes`.
- `user_class` association N:N.
- `labs`.
- `submissions`.
- `audit_logs`.

Quan hệ đúng: user N:N class; class 1:N lab; user 1:N lab qua `created_by_id`; user 1:N submission; lab 1:N submission; user 1:N audit log. Không có foreign key từ submission sang audit log.

### 8.3. Seed lần đầu

Backend chỉ seed **một admin duy nhất** khi `db.query(User).count() == 0`.

- Dùng các biến `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_FULL_NAME`.
- Không seed lecturer/student/demo user tự động.
- Nếu DB đã có bất kỳ user nào, đổi biến seed rồi restart sẽ không cập nhật admin.
- Không ghi password admin thật vào Git hoặc tài liệu này.
- Sau bootstrap phải đổi/rotate password theo quy trình vận hành.

CSV import student hiện dùng chung `DEFAULT_STUDENT_PASSWORD`. Đây là rủi ro đã biết; không mô tả nó là cơ chế an toàn. Hướng mục tiêu là password tạm riêng hoặc activation/reset bắt buộc.

### 8.4. Lab VM configuration

Mỗi lab lưu:

- `enable_vm`.
- `template_vmid`.
- `vm_protocol`.
- `vm_port`.
- `vm_username`.
- `vm_password`.

Giảng viên phải được chọn protocol và nhập credential; không sửa UI/backend để quay lại RDP/port/user/password cố định.

Credential VM hiện lưu plaintext trong bảng `labs`; đây là rủi ro tồn tại, không phải thiết kế mục tiêu. Nếu thay đổi, cần migration và tương thích dữ liệu cũ.

## 9. Cấu hình và nguyên tắc không hard-code

Các giá trị môi trường được định nghĩa trong `.env.example` và nối vào Compose. Mọi agent phải:

- Không đọc/in `.env` thật vào output nếu không cần thiết.
- Không commit `.env`.
- Không thêm IP, port, credential, VMID range, timeout hoặc upstream production trực tiếp vào source nếu đã có biến cấu hình phù hợp.
- Khi thêm biến mới, cập nhật đồng bộ `config.py`, `.env.example`, `docker-compose.yml`, runtime template Nginx và tài liệu.
- Dùng validation fail-fast như các helper `_required_env`, `_required_int`, `_required_bool`.
- Không cho phép wildcard CORS khi credentials được bật.

Nhóm cấu hình chính:

- Database và JWT.
- Bootstrap admin và password import student.
- Upload path/size/extension/ZIP convention.
- PVE host/user/token/node/TLS/range/network/timeouts.
- VM protocol-to-port mapping.
- Guacamole base URL/secret/TTL/RDP flags.
- Nginx listen/server/upstreams/body size/timeouts.
- Vite dev/build proxy.

`MALWARE_ZIP_PASSWORD` hiện được trả cho mọi user đã đăng nhập qua `/api/config/client`; vì vậy nó là course convention, không phải secret bảo mật. Không tái sử dụng giá trị này làm credential quan trọng.

## 10. Quyền người dùng và khoảng trống authorization

Role danh nghĩa:

- `admin`: quản lý user/class/lab/audit và toàn hệ thống.
- `lecturer`: quản lý class/lab/submission được giao.
- `student`: xem lab thuộc class, chạy VM và nộp bài của mình.

Không dùng việc frontend ẩn button làm security boundary. Backend phải enforce quyền.

Các khoảng trống đã biết tại mốc kiểm kê:

- Lecturer có thể thấy toàn bộ student qua `GET /api/users/`.
- Lecturer biết ID có thể đọc một số lab ngoài class.
- `vm-session` và `vm-rollback` hiện cho mọi role đã đăng nhập; thiếu kiểm tra role/membership/lab active đầy đủ.
- Submission draft/upload/submit còn thiếu class-membership check ở một số endpoint.
- Gia hạn cá nhân chưa bảo đảm student thuộc class của lab.
- Control VM theo VMID chưa chứng minh stable name thuộc đúng lab/student.

Nếu sửa authorization, phải có negative tests cho cross-class, cross-lab, cross-user, inactive lab, lecturer enumeration và VMID/name mismatch.

## 11. Deadline và timezone

Có lỗi thiết kế đã biết giữa `datetime-local`, UTC ISO và datetime naive:

- Deadline chính ở frontend được chuyển bằng `toISOString()`.
- Individual extension có luồng gửi raw local datetime.
- Backend/database còn so sánh datetime UTC-naive.
- Ở UTC+7 có thể lệch 7 giờ giữa deadline và extension.

Không vá bằng cộng/trừ 7 giờ hard-code. Mục tiêu là datetime timezone-aware, lưu UTC, API ISO 8601 có timezone và render local ở frontend. Mọi thay đổi phải có integration test tại `Asia/Ho_Chi_Minh`/UTC+7.

## 12. Upload và dữ liệu

- Extension allowlist không phải malware scan.
- Size limit, MIME/magic, ZIP bomb, archive traversal, quarantine và antivirus/YARA cần được xử lý thật nếu tuyên bố upload an toàn.
- Backend/upload hiện chạy root trong container tại mốc kiểm kê; đây là rủi ro cần chuyển sang UID/GID riêng.
- Xóa row DB hoặc upload lại chưa chắc xóa file vật lý cũ.
- Xóa lab/class/user không tự động purge mọi VM tương ứng.
- Cần cleanup queue idempotent, ownership verification, retention/quarantine và reconciliation DB ↔ PVE ↔ volume.

Không xóa file/VM mồ côi chỉ dựa trên một nguồn. Luôn chạy dry-run inventory trước.

## 13. Deployment trên VM 105

### 13.1. Kiểm tra trước deploy

```bash
ssh ubuntu-105
hostnamectl
cd /home/iahn/malsec
docker compose version
docker compose config --quiet
docker compose ps
```

Không in `docker compose config` đầy đủ.

### 13.2. Quy trình khuyến nghị

1. Xác nhận local branch/commit và diff cần deploy.
2. Xác nhận source remote có thể đã có thay đổi riêng; không ghi đè mù `.env`.
3. Backup DB, uploads và file cấu hình cần thiết.
4. Copy đúng các file thay đổi vào `/home/iahn/malsec` theo quy trình có checksum.
5. Chạy `docker compose config --quiet`.
6. Build có kiểm soát; ghi lại image cũ để rollback.
7. Chạy `docker compose up -d`.
8. Kiểm tra `docker compose ps` và log giới hạn dòng.
9. Smoke test login, role, class/lab, `/api`, `/guacamole/`, WebSocket và VM test.
10. Kiểm tra DB/upload vẫn còn và không có seed user ngoài ý muốn.

Remote deploy directory không có Git metadata tại lần kiểm kê. Không giả định có thể rollback bằng `git checkout`; cần lưu image/source/config trước deploy.

### 13.3. Reset toàn bộ

Chỉ thực hiện khi người dùng nói rõ cần reset và đã thống nhất dữ liệu sẽ mất.

- `docker compose down -v` sẽ xóa volume DB và upload của Compose.
- Việc xóa volume không tự purge student VM trên Proxmox.
- Việc purge VM không xóa submission/upload DB.
- Sau DB trống, startup chỉ seed admin ban đầu từ env.
- Trước reset phải backup hoặc ghi rõ người dùng chấp nhận mất dữ liệu.
- Sau reset phải kiểm kê và xử lý VM/file mồ côi riêng, có ownership check.

## 14. Guacamole và lỗi kết nối

Khi iframe reconnect liên tục, kiểm tra theo thứ tự:

1. Backend có trả đúng VMID/IP/protocol/port không.
2. QGA có báo IP trong VLAN 30 không.
3. Guest service RDP/VNC/SSH đã ready chưa.
4. Credential và protocol của lab có đúng guest không.
5. Từ CT 103 có TCP connect tới guest port không.
6. `guacd`, Tomcat và JSON auth có active không.
7. Nginx `/guacamole/` proxy có WebSocket header/timeouts đúng không.
8. Token Guacamole có hết hạn hoặc bị ghi/cached sai không.

`VM_VERIFY_CONNECTION=false` có thể làm backend trả link trước khi XRDP/RDP sẵn sàng. Nếu bật verify, phải bảo đảm probe chạy từ nơi có network policy tương đương Guacamole; probe từ VM 105 có thể bị policy chặn dù CT 103 kết nối được.

Keyboard không hoạt động có thể do iframe focus hoặc Guacamole keyboard layout. Nền đen có thể do RDP policy/graphics flags, session shell hoặc wallpaper option. Không kết luận template lỗi chỉ từ TCP 3389 mở.

## 15. Hạ tầng hiện còn rủi ro cao

Không tuyên bố hệ thống “an toàn để chạy malware production” cho đến khi các mục sau được xử lý hoặc có risk acceptance:

- PVE token live từng thuộc root/privsep không phù hợp.
- PVE firewall và host filtering chưa tạo micro-segmentation hiệu quả.
- VM sinh viên và Guacamole cùng VLAN 30; east-west chưa cô lập.
- Tunnel token từng có nguy cơ xuất hiện trên command line/log.
- Chưa có backup job/PBS/replication được cấu hình tại mốc kiểm kê.
- DB 5432/backend 8000 publish rộng.
- VM credential lưu plaintext.
- Guacamole/JWT token có thể xuất hiện trong URL/log và TTL dài.
- Authorization còn khoảng trống IDOR/cross-class.
- Upload chưa phải pipeline scan malware hoàn chỉnh.
- pfSense chưa onboot và rule/NAT/DHCP/DNS chưa được audit từ sanitized config export.
- CT 103 rootfs nhỏ và đã dùng nhiều.
- Dependency/image chưa lock/pin đầy đủ; chưa có SBOM/reproducible build.
- Không có health endpoint chuẩn và healthcheck đầy đủ.
- Không có test suite tự động toàn diện.

Ưu tiên P0 là rotate secret/token đã lộ, least-privilege PVE token, cô lập east-west, chặn control plane, backup/restore drill, thu hẹp port publish và bảo vệ log/token.

## 16. pfSense: điều đã biết và chưa biết

Đã xác minh:

- VM 100, pfSense CE 2.7.0.
- WAN `10.0.80.5/24`.
- LAN `10.30.0.1/24`.
- OPT1 `10.40.0.1/24`.
- DHCP VLAN 30 hoạt động trong phép thử.
- WebConfigurator truy cập được từ VLAN 30 tại thời điểm kiểm kê; đây là rủi ro.
- Internet/DNS từ student clone bị timeout trong phép thử.

Chưa được chứng minh đầy đủ:

- Toàn bộ firewall rule và thứ tự rule.
- NAT mode/rule/port-forward.
- DHCP pool/reservation/options.
- DNS Resolver/Forwarder/override.
- Admin ACL/listen interface.
- Package, schedule, log retention và backup.

Muốn chốt phải export `config.xml` đã sanitized hoặc chạy lệnh chỉ đọc như `pfctl -sr`, `pfctl -sn`, `netstat -rn`, `sockstat -4 -6 -l`, sau đó đối chiếu bằng test matrix. Không đưa private key, certificate key, password hash, PSK, API key hoặc token vào repo.

## 17. Storage và backup

- `local`: directory `/var/lib/vz`, chứa ISO/template/backup/import.
- `local-lvm`: LVM-thin cho disk VM/LXC.
- Tại mốc kiểm kê không có NFS/CIFS/Ceph/PBS, backup job hoặc replication job.
- Node live phụ thuộc chủ yếu vào một NVMe; ba NVMe khác chưa tham gia storage/redundancy.
- Không xóa ISO chỉ vì chưa gắn vào VM; có thể là media rebuild được giữ chủ đích.
- Theo dõi cả data và metadata của thin pool.
- Backup phải nằm trên thiết bị/hệ thống khác và phải restore thử.

Danh sách đầy đủ 9 ISO và 1 LXC template nằm trong tài liệu vận hành chính.

## 18. Kiểm thử tối thiểu sau thay đổi

### 18.1. Code/config

- `docker compose config --quiet`.
- Frontend: `npm run build`.
- Backend: import/compile check phù hợp và startup với đầy đủ required env.
- Không có test suite tự động toàn diện; không được coi một script lẻ là coverage đầy đủ.

### 18.2. Ứng dụng

- Login admin/lecturer/student.
- Role navigation và negative authorization.
- Tạo/sửa class/lab.
- Lab form/deadline/extension tại UTC+7.
- Draft/upload/submit/grade/export.
- Client config không lộ secret thật.

### 18.3. VM end-to-end

- Chọn base/protocol/port/credential từ UI.
- Tạo hai VM cho hai user trên cùng lab.
- Stable name, VMID, disk, MAC và IP khác nhau.
- QGA báo đúng IP VLAN 30.
- Guacamole mở được RDP/VNC/SSH.
- Keyboard và wallpaper/session desktop hoạt động.
- Tạo file trên VM A và chứng minh VM B không thấy file đó.
- Rollback VM A không ảnh hưởng VM B và không xóa submission.
- Purge/control từ chối VM ngoài ownership/range.

### 18.4. Vận hành

- Container/service active không có nghĩa là app healthy.
- Kiểm tra Cloudflare HTTPS, origin, WebSocket và reconnect.
- Kiểm tra log không chứa token/query nhạy cảm.
- Kiểm tra disk, DB, upload và CT 103 usage.
- Có bằng chứng rollback/restore khi thay đổi rủi ro cao.

## 19. Ràng buộc khi cập nhật tài liệu Word

`Tai_lieu_van_hanh_MalSec_Proxmox_2026-08-05.md` là nguồn nội dung dễ diff; DOCX là bản phát hành cho người dùng.

Khi tạo lại DOCX:

- Ảnh/sơ đồ phải là PNG nhúng trực tiếp.
- Không để external `file:///` relationship.
- Không để `asvg:svgBlip` rỗng; một số phiên bản Word sẽ báo không hiển thị ảnh dù PNG fallback tồn tại.
- Trong Word, mỗi sơ đồ phải có type Picture và không có LinkFormat.
- Kiểm tra DOCX bằng chính Microsoft Word, không chỉ kiểm tra ZIP/OpenXML.
- Giữ liên kết tới hồ sơ Word v3 ở dạng relative nếu cần.
- Không đưa secret/password/token thật vào tài liệu.

Bản DOCX hiện tại đã được sửa theo nguyên tắc PNG-only: 4 ảnh embedded, không SVG blip và không file link ngoài.

## 20. Git và vệ sinh workspace

- Luôn đọc `git status --short` trước và sau nhiệm vụ.
- Thay đổi có sẵn là của người dùng nếu chưa chứng minh ngược lại.
- Không sửa file ngoài phạm vi chỉ để làm sạch diff.
- Không commit `.env`, upload, DB volume, SSH material hoặc build artifact tạm.
- Dùng patch nhỏ, dễ review.
- Sau khi tạo tài liệu/binary, xóa script/thư mục build tạm.
- Không commit `frontend/node_modules` hoặc output build.
- Commit message phải mô tả outcome, không ghi secret.

## 21. Checklist tiếp quản cho agent mới

Trước khi bắt đầu:

- [ ] Đọc yêu cầu mới nhất của người dùng; không tự suy rộng quyền hạn.
- [ ] Đọc tệp này và tài liệu vận hành chính.
- [ ] Kiểm tra branch, commit, status và diff.
- [ ] Xác định nhiệm vụ là read-only, diagnose, change, deploy hay destructive reset.
- [ ] Nếu cần live state, kiểm tra lại host/VM thay vì dùng snapshot 05/08/2026.
- [ ] Không đọc/in secret không cần thiết.
- [ ] Xác định backup và rollback trước mutation.
- [ ] Bảo vệ VM hạ tầng/base và tài nguyên ngoài ownership.
- [ ] Viết test cho isolation/authorization nếu sửa VM hoặc RBAC.
- [ ] Smoke test end-to-end sau deploy.
- [ ] Cập nhật tài liệu nếu kiến trúc/config/runtime thay đổi.

Khi bàn giao lại:

- [ ] Nêu rõ file/code/config nào đã thay đổi.
- [ ] Nêu rõ host/tài nguyên live nào đã bị tác động.
- [ ] Liệt kê lệnh kiểm thử và kết quả quan trọng.
- [ ] Nêu phần chưa kiểm tra hoặc giả định còn lại.
- [ ] Không tuyên bố “an toàn/hoàn tất” nếu acceptance criteria chưa đạt.
- [ ] Không để file tạm, secret hoặc log nhạy cảm trong workspace.

## 22. Định nghĩa hoàn tất

Một thay đổi chỉ được coi là hoàn tất khi:

1. Đúng yêu cầu người dùng và không mở rộng phạm vi ngoài ủy quyền.
2. Không phá invariant VM ownership, unique disk/MAC/IP hoặc protocol cấu hình theo lab.
3. Không làm mất DB/upload/VM ngoài phạm vi.
4. Có kiểm thử tương xứng với rủi ro.
5. Nếu deploy, ứng dụng và Guacamole/VM flow hoạt động end-to-end.
6. Nếu thay đổi security boundary, có negative test và rollback plan.
7. Config mới không bị hard-code và `.env.example`/Compose/docs được cập nhật đồng bộ.
8. Không có secret/token/password thật trong Git, log hoặc tài liệu.
9. Tài liệu hiện trạng được cập nhật nếu hành vi/runtime thay đổi.
10. Workspace sạch khỏi artifact tạm và trạng thái Git được báo trung thực.

