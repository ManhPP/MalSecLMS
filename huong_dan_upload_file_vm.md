# HƯỚNG DẪN CHI TIẾT CÁC PHƯƠNG PHÁP UPLOAD FILE LÊN MÁY ẢO (MALSEC LMS)

Tài liệu này hướng dẫn chi tiết các cách truyền file/dữ liệu/công cụ vào các máy ảo **Base Template (`VMID 1000–2000`)** và **Máy ảo Sinh viên (`VMID 10000–20000`)** trong hệ thống MalSec.

---

## 📌 Tổng quan các phương pháp

| Phương pháp | Đối tượng | Phụ thuộc mạng/Agent | Trường hợp sử dụng phù hợp |
|---|---|---|---|
| **1. Đóng gói ISO & Mount CD-ROM** | Admin / Giảng viên | **Không** | Chuẩn bị máy ảo Template, đưa công cụ/file dung lượng lớn vào máy ảo an toàn tuyệt đối. |
| **2. Guacamole Web UI (Drag & Drop)** | Sinh viên / Giảng viên | Cần RDP/VDI active | Đưa file nhỏ, tài liệu làm bài khi đang thực hành trực tiếp trên trình duyệt. |
| **3. RDP Shared Drive (Local Resource)** | Admin (Bảo trì) | Cần mở cổng RDP | Copy file nhanh trong quá trình dựng và cấu hình máy ảo mẫu từ máy quản trị. |
| **4. HTTP Download qua Web Server** | Admin / Giảng viên | Cần mạng nội bộ VLAN 30 | Tải nhanh file/script từ máy server `ubuntu-105` vào máy ảo. |

---

## 🛠️ PHƯƠNG PHÁP 1: Đóng gói đĩa ISO & Mount đĩa CD-ROM (Khuyên dùng cho Admin)

Đây là phương pháp **tin cậy nhất**, không bị ảnh hưởng bởi dịch vụ QEMU Guest Agent hay cài đặt mạng trong máy ảo.

### Các bước thực hiện:

#### Bước 1: Upload file từ máy local lên Proxmox Node (`pve01-cf`)
Mở PowerShell/Terminal ở máy quản trị và tải file lên thư mục tạm của Proxmox Node:
```powershell
# Tạo thư mục tạm trên Proxmox
ssh pve01-cf "mkdir -p /tmp/tools_upload"

# Tải các file cần chuyển vào máy ảo lên thư mục tạm
scp D:\Path\To\File1.exe D:\Path\To\File2.zip pve01-cf:/tmp/tools_upload/
```

#### Bước 2: Đóng gói file thành đĩa ISO trên Proxmox Node
Sử dụng công cụ `genisoimage` trên node Proxmox để tạo file `.iso` lưu tại storage `local`:
```bash
ssh pve01-cf "genisoimage -o /var/lib/vz/template/iso/tools_vm.iso -J -r /tmp/tools_upload/ && rm -rf /tmp/tools_upload"
```

#### Bước 3: Gắn (Mount) đĩa ISO vào máy ảo (Ví dụ VMID 1001)
Chạy lệnh gán file ISO vừa tạo vào ổ đĩa CD-ROM ảo (`ide2`) của máy ảo:
```bash
ssh pve01-cf "qm set 1001 -ide2 local:iso/tools_vm.iso,media=cdrom"
```

> [!NOTE]
> Khi mở máy ảo (qua Web VDI hoặc RDP), truy cập vào **This PC / File Explorer** $\rightarrow$ mở ổ CD-ROM (`D:` hoặc `E:`) để lấy file.

#### Bước 4: Gỡ (Unmount) đĩa ISO sau khi hoàn tất (Tùy chọn)
Nếu không muốn các máy ảo clone của sinh viên tiếp tục giữ ổ CD-ROM này:
```bash
ssh pve01-cf "qm set 1001 -ide2 none"
```

---

## 🌐 PHƯƠNG PHÁP 2: Truyền file qua Web VDI Apache Guacamole

Phương pháp này dùng cho Sinh viên hoặc Giảng viên đang làm việc trên giao diện trình duyệt.

### Cách 1: Sử dụng Guacamole Menu (`Ctrl + Alt + Shift`)
1. Trên cửa sổ trình duyệt đang mở máy ảo, nhấn tổ hợp phím **`Ctrl + Alt + Shift`**.
2. Một thanh menu bên trái sẽ xuất hiện. Tìm đến mục **File Transfer** (Tải file).
3. Bấm nút **Upload Files** và chọn file từ máy thật của bạn.
4. File tải lên sẽ nằm trong ổ đĩa ảo chia sẻ (*Guacamole Shared Drives* / *My Computer*).

### Cách 2: Kéo và Thả (Drag & Drop)
1. Chọn file trên máy tính của bạn.
2. Kéo và thả file trực tiếp vào vùng màn hình iFrame của máy ảo trên trình duyệt.
3. Hệ thống Guacamole sẽ tự động chuyển file vào đĩa ảo.

---

## 💻 PHƯƠNG PHÁP 3: Truyền file qua RDP Native Shared Drives

Dành cho Admin kết nối bằng phần mềm **Remote Desktop Connection (`mstsc`)** từ máy cá nhân vào máy ảo trong giai đoạn bảo trì.

1. Mở `mstsc.exe` trên máy tính cá nhân.
2. Nhấp chọn **Show Options** $\rightarrow$ chuyển sang tab **Local Resources**.
3. Trong mục *Local devices and resources*, nhấp chọn **More...**
4. Đánh dấu tích vào mục **Drives** (hoặc chọn thư mục cụ thể).
5. Kết nối RDP vào máy ảo. Trong File Explorer của máy ảo sẽ xuất hiện ổ đĩa của máy thật để bạn copy-paste file.

---

## 📡 PHƯƠNG PHÁP 4: Tải file từ Web Server nội bộ (`ubuntu-105`)

Dành cho việc phân phối file hàng loạt trong mạng Sandbox:

1. Copy file lên máy server ứng dụng `ubuntu-105` tại thư mục công khai (ví dụ Nginx `/var/www/html/downloads/`).
2. Mở **PowerShell** hoặc **Terminal** bên trong máy ảo và thực hiện lệnh tải về:

**Trên Windows VM (PowerShell):**
```powershell
Invoke-WebRequest -Uri "http://10.30.0.105/downloads/sample.zip" -OutFile "C:\Users\Public\Downloads\sample.zip"
```

**Trên Linux VM (Bash):**
```bash
wget http://10.30.0.105/downloads/sample.zip -O /tmp/sample.zip
```

---

## ⚠️ LƯU Ý BẢO MẬT & VẬN HÀNH BẮT BUỘC

1. **Mẫu Mã độc (Malware Samples)**:
   - Tuyệt đối **không** nộp trực tiếp file thực thi nguy hiểm (`.exe`, `.dll`, `.bat`, `.vbs`...) qua form upload của LMS vì backend sẽ tự động từ chối theo chính sách bảo mật (`file_service.py`).
   - Mẫu mã độc bắt buộc phải nén thành file **.ZIP có mật khẩu** (mật khẩu mặc định quy ước theo cấu hình hệ thống).
2. **Dọn dẹp Template trước khi Clone**:
   - Trước khi chốt Base VM thành Template để clone cho sinh viên, hãy kiểm tra và xóa các file rác, lịch sử duyệt web, thông tin cá nhân và gỡ các đĩa ISO không cần thiết.
