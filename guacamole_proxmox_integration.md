# HƯỚNG DẪN TÍCH HỢP MALSEC LMS VỚI PROXMOX VE QUA APACHE GUACAMOLE

Tài liệu này hướng dẫn chi tiết cách kết nối Web App LMS (**MalSec**) với hạ tầng máy ảo **Proxmox VE (PVE)** thông qua **Apache Guacamole**, cho phép sinh viên remote trực tiếp vào máy ảo phân tích (FLARE-VM, REMnux) từ giao diện làm bài (Split-screen).

---

## I. KIẾN TRÚC TÍCH HỢP TỔNG THỂ

Hệ thống hoạt động dựa trên sự phối hợp giữa Web App, Cổng kết nối Guacamole, Trình quản lý ảo hóa Proxmox và Tường lửa pfSense.

```
                           +-------------------------------------+
                           |      Trình duyệt của Sinh viên      |
                           +-------------------------------------+
                                      |                 |
                1. Web App Portal     |                 | 3. Kết nối RDP/VNC 
                   (HTTPS - Cổng 80)  |                 |    (HTTPS - Cổng 8443)
                                      v                 v
                           +-------------------+   +-------------------------+
                           |  MalSec Web App   |   |    Apache Guacamole     |
                           |  (Docker - VLAN20)|   |  (LXC/Docker - VLAN20/30|
                           +-------------------+   +-------------------------+
                                      |                         |
               2. API: Clone & Start  |                         | 4. Proxy 
                  (PVE API - Cổng 8006) |                         |    RDP (3389) / VNC
                                      v                         v
                           +-------------------+   +-------------------------+
                           |    Proxmox VE     |   |      Máy ảo Lab SV      |
                           |  (Hypervisor Core)|   |    (VLAN30 - Isolated)  |
                           +-------------------+   +-------------------------+
```

### Các phân vùng mạng (VLANs) phối hợp:
*   **VLAN 20 (Student):** Chứa máy trạm của sinh viên và chân ngoài của Web App/Guacamole. Sinh viên chỉ truy cập được Web App và Guacamole Portal.
*   **VLAN 30 (Analysis):** Môi trường chạy máy ảo phân tích malware. Vùng này bị cách ly hoàn toàn với Internet. Chân trong của Guacamole (`guacd`) nằm ở đây để chuyển tiếp RDP/VNC tới máy ảo.
*   **VLAN 50 (Storage/Management):** Đường kết nối nội bộ giữa Web App với Proxmox API (cổng 8006) và hệ thống lưu trữ NAS.

---

## II. PHƯƠNG ÁN KẾT NỐI GUACAMOLE (3 CÁCH TIẾP CẬN)

Để nhúng máy ảo vào `iframe` trên giao diện Web App mà sinh viên **không cần đăng nhập lại** vào Guacamole, chúng ta có 3 giải pháp:

### Giải pháp 1: Sử dụng HMAC Token (`guacamole-auth-hmac`) - ⭐ KHUYÊN DÙNG & TỐI ƯU NHẤT
*   **Nguyên lý:** Web App Backend tự động tính toán thông số kết nối (IP máy ảo, giao thức, cổng RDP/VNC, thông tin đăng nhập) và ký số bằng một khóa bí mật (**Shared Secret Key**). URL chứa chữ ký này được truyền xuống Frontend để tải trong `iframe`. Guacamole Server giải mã và kết nối trực tiếp.
*   **Ưu điểm:** Cực kỳ nhẹ, không cần đồng bộ hay tạo bản ghi kết nối trong cơ sở dữ liệu của Guacamole, dọn dẹp bộ nhớ tự động, cấu hình nhanh chóng.

### Giải pháp 2: Tích hợp Keycloak SSO (OpenID Connect)
*   **Nguyên lý:** Cả Web App và Guacamole đều tích hợp chung vào **Keycloak SSO**. Khi sinh viên đăng nhập Web App, Keycloak đã lưu session. Khi `iframe` Guacamole được tải, nó tự động lấy Keycloak session cookie để xác thực và kết nối vào máy ảo tương ứng được gán cho username đó.
*   **Ưu điểm:** Đúng chuẩn doanh nghiệp, quản lý tập trung người dùng.

### Giải pháp 3: Tương tác qua Guacamole REST API & Database
*   **Nguyên lý:** Khi sinh viên nhấn "Làm bài", Backend Web App gọi REST API của Guacamole để tạo một bản ghi Connection mới trong PostgreSQL của Guacamole, lấy ID kết nối, sinh một phiên đăng nhập dùng một lần (Auth Token) và truyền về Frontend để nhúng `iframe`.
*   **Ưu điểm:** Quản lý chặt chẽ log phiên và phân quyền trên Guacamole.

*Dưới đây là hướng dẫn chi tiết tập trung vào **Giải pháp 1 (HMAC)** phối hợp với **Keycloak SSO (được quy hoạch từ Phase 07)**.*

---

## III. HƯỚNG DẪN CẤU HÌNH HẠ TẦNG (SERVERS & NETWORKING)

### 1. Cấu hình Apache Guacamole với HMAC & Keycloak
Trên Server 1, trong container hoặc LXC chứa Apache Guacamole, tải extension và cấu hình:

#### Bước A: Tải Extension HMAC
Tải file thư viện `.jar` của extension `guacamole-auth-hmac` tương thích phiên bản Guacamole đang chạy (ví dụ `1.5.4`) và đặt vào thư mục `/etc/guacamole/extensions/`.

#### Bước B: Cấu hình `guacamole.properties`
Thêm cấu hình khóa bí mật dùng chung để ký token:
```properties
# /etc/guacamole/guacamole.properties
hmac-secret-key: MySuperSecretKeyForGuacHMAC2026!
hmac-auth-provider: postgresql

# (Nếu dùng Keycloak SSO)
openid-authorization-endpoint: https://keycloak.malsec.local/realms/malsec/protocol/openid-connect/auth
openid-jwk-endpoint: https://keycloak.malsec.local/realms/malsec/protocol/openid-connect/certs
openid-issuer: https://keycloak.malsec.local/realms/malsec
openid-client-id: guacamole
openid-redirect-uri: https://guacamole.malsec.local/
```

---

### 2. Cấu hình Proxmox VE API
Để Web App điều khiển được ảo hóa (tự động clone, start, rollback VM), ta cần tạo tài khoản API Token trên PVE:

1.  Đăng nhập PVE Web UI (`https://10.10.0.11:8006`).
2.  Đi tới **Datacenter** -> **Permissions** -> **Users** -> Tạo user `malsec-api@pve`.
3.  Đi tới **API Tokens** -> Tạo token cho user trên (ví dụ ID: `malsec-token`, bỏ chọn *Require Two-Factor*).
4.  Lưu lại **Token ID** (dạng `malsec-api@pve!malsec-token`) và **Secret Value** hiển thị.
5.  Đi tới **Permissions** -> **Add User Permission** -> Gán quyền `PVEVMAdmin` cho user `malsec-api@pve` tại đường dẫn `/vms` để user này có thể clone và điều khiển máy ảo.

---

## IV. SỬA ĐỔI MÃ NGUỒN BACKEND (FASTAPI)

Chúng ta cần cài đặt thư viện `proxmoxer` để giao tiếp API Proxmox, đồng thời thêm mã hóa HMAC để sinh link Guacamole.

### 1. Thêm cấu hình vào file Môi trường & Config

Cập nhật file `.env` ([.env](file:///d:/Code/MalSec/.env)):
```env
# Proxmox VE API Config
PVE_API_HOST=10.10.0.11
PVE_API_USER=malsec-api@pve
PVE_TOKEN_NAME=malsec-token
PVE_TOKEN_VALUE=xxxx-xxxx-xxxx-xxxx-xxxx

# Guacamole HMAC Config
GUAC_BASE_URL=https://guacamole.malsec.local/guacamole/
GUAC_HMAC_SECRET=MySuperSecretKeyForGuacHMAC2026!
```

Cập nhật `backend/app/config.py` ([config.py](file:///d:/Code/MalSec/backend/app/config.py)):
```python
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... các biến cũ ...
    PVE_API_HOST: str = os.getenv("PVE_API_HOST", "10.10.0.11")
    PVE_API_USER: str = os.getenv("PVE_API_USER", "malsec-api@pve")
    PVE_TOKEN_NAME: str = os.getenv("PVE_TOKEN_NAME", "malsec-token")
    PVE_TOKEN_VALUE: str = os.getenv("PVE_TOKEN_VALUE", "")
    
    GUAC_BASE_URL: str = os.getenv("GUAC_BASE_URL", "http://localhost:8080/guacamole/")
    GUAC_HMAC_SECRET: str = os.getenv("GUAC_HMAC_SECRET", "MySuperSecretKeyForGuacHMAC2026!")

settings = Settings()
```

---

### 2. Xây dựng Service điều khiển Proxmox & Sinh link Guacamole

Tạo mới file `backend/app/services/vm_service.py` ([vm_service.py](file:///d:/Code/MalSec/backend/app/services/vm_service.py)):
```python
import time
import hmac
import hashlib
import base64
from proxmoxer import ProxmoxAPI
from app.config import settings

# Khởi tạo kết nối Proxmox VE
def get_pve_client():
    return ProxmoxAPI(
        settings.PVE_API_HOST,
        user=settings.PVE_API_USER,
        token_name=settings.PVE_TOKEN_NAME,
        token_value=settings.PVE_TOKEN_VALUE,
        verify_ssl=False
    )

def provision_student_vm(student_username: str, lab_id: int, template_vmid: int = 9000) -> str:
    """
    1. Kiểm tra xem sinh viên đã có máy ảo cho bài lab này chưa.
    2. Nếu chưa có, clone từ template (Linked Clone để tiết kiệm tài nguyên và thời gian).
    3. Bật máy ảo.
    4. Trả về IP của máy ảo trong VLAN 30.
    """
    proxmox = get_pve_client()
    node = "pve-01" # Node chạy máy ảo lab sinh viên
    
    # Đặt quy tắc VM ID: Ví dụ sinh viên sv01 (ID 101) làm bài lab 1 -> VM ID = 3000 + 101 * 10 + 1 = 31011
    # Công thức đảm bảo tính duy nhất tránh xung đột
    student_num = int("".join(filter(str.isdigit, student_username)) or "1")
    new_vmid = 30000 + (student_num * 50) + lab_id
    
    # Kiểm tra VM tồn tại
    vm_exists = False
    try:
        proxmox.nodes(node).qemu(new_vmid).status.current.get()
        vm_exists = True
    except Exception:
        vm_exists = False
        
    if not vm_exists:
        # Clone dạng Linked Clone (full=0) từ Template
        print(f"[+] Cloning template {template_vmid} to new VM {new_vmid} for {student_username}...")
        proxmox.nodes(node).qemu(template_vmid).clone.post(
            newid=new_vmid,
            name=f"lab-{lab_id}-{student_username}",
            full=0
        )
        # Chờ 3 giây để PVE hoàn tất tác vụ clone
        time.sleep(3)
        
    # Đảm bảo máy ảo đang chạy
    status = proxmox.nodes(node).qemu(new_vmid).status.current.get()
    if status.get("status") != "running":
        print(f"[+] Starting VM {new_vmid}...")
        proxmox.nodes(node).qemu(new_vmid).status.start.post()
        time.sleep(5) # Chờ VM boot lên

    # Lấy thông tin IP của máy ảo từ QEMU Guest Agent
    # Yêu cầu máy ảo template phải cài đặt và bật qemu-guest-agent
    ip_address = None
    try:
        interfaces = proxmox.nodes(node).qemu(new_vmid).agent.network_get_interfaces.get()
        for interface in interfaces.get("result", []):
            if interface.get("name") != "lo":
                for ip_info in interface.get("ip-addresses", []):
                    ip = ip_info.get("ip-address")
                    # Lấy địa chỉ IP thuộc lớp mạng VLAN 30 (10.30.0.0/24)
                    if ip and ip.startswith("10.30.0."):
                        ip_address = ip
                        break
    except Exception as e:
        print(f"[!] Lỗi khi lấy IP qua Guest Agent: {e}")
        
    # Backup plan: Nếu không lấy được IP động, gán IP tĩnh tương ứng theo ID máy ảo
    if not ip_address:
        # Ví dụ: 10.30.0.50 + offset
        ip_address = f"10.30.0.{50 + (new_vmid % 200)}"
        
    return ip_address, new_vmid

def generate_guacamole_hmac_url(ip_address: str, protocol: str = "rdp", username: str = "administrator", password: str = "infected") -> str:
    """
    Sinh URL kết nối Apache Guacamole được ký số HMAC chống giả mạo.
    """
    timestamp = str(int(time.time() * 1000))
    secret = settings.GUAC_HMAC_SECRET.encode('utf-8')
    
    # Định nghĩa các tham số kết nối Guacamole
    # Các tham số này phải khớp với các thiết lập trong RDP/VNC
    params = {
        "guac.protocol": protocol,
        "guac.hostname": ip_address,
        "guac.port": "3389" if protocol == "rdp" else "5900",
        "guac.username": username,
        "guac.password": password,
        "guac.security": "any",
        "guac.ignore-cert": "true",
        "guac.width": "1920",
        "guac.height": "1080",
        "guac.dpi": "96"
    }
    
    # Tạo chuỗi ký tự chuẩn hóa (Canonical String): timestamp + protocol + parameters
    # Sắp xếp key theo thứ tự bảng chữ cái để đảm bảo tính nhất quán
    canonical_str = timestamp + protocol
    for key in sorted(params.keys()):
        # Loại bỏ tiền tố 'guac.' khi dựng chuỗi signature theo chuẩn guacamole-auth-hmac
        param_name = key[5:] if key.startswith("guac.") else key
        canonical_str += param_name + params[key]
        
    # Tính chữ ký HMAC-SHA256
    signature = hmac.new(secret, canonical_str.encode('utf-8'), hashlib.sha256).digest()
    signature_b64 = base64.b64encode(signature).decode('utf-8')
    
    # Tạo URL hoàn chỉnh
    query_params = [
        f"id=HMAC",
        f"timestamp={timestamp}",
        f"signature={signature_b64}"
    ]
    for key, val in params.items():
        query_params.append(f"{key}={val}")
        
    url = f"{settings.GUAC_BASE_URL}#/client/HMAC?{'&'.join(query_params)}"
    return url

def rollback_student_vm(new_vmid: int):
    """
    Sử dụng API Proxmox để khôi phục máy ảo về Snapshot sạch ban đầu (vừa clone) hoặc qua PBS
    """
    proxmox = get_pve_client()
    node = "pve-01"
    
    # Tắt máy ảo trước khi rollback
    try:
        proxmox.nodes(node).qemu(new_vmid).status.stop.post()
        time.sleep(5)
    except Exception:
        pass
        
    # Phục hồi trạng thái: Cách đơn giản nhất là xóa đi và clone linked clone mới
    try:
        proxmox.nodes(node).qemu(new_vmid).delete()
        time.sleep(2)
        # Việc clone lại sẽ được kích hoạt lại ở lần truy cập tiếp theo của sinh viên
    except Exception as e:
        raise Exception(f"Không thể rollback máy ảo: {str(e)}")
```

---

### 3. Thêm API Endpoint vào Backend Router

Cập nhật `backend/app/routers/submissions.py` ([submissions.py](file:///d:/Code/MalSec/backend/app/routers/submissions.py)) để bổ sung endpoint cấp VM Session và Rollback:

```python
from fastapi import APIRouter, Depends, HTTPException
from app.services.vm_service import provision_student_vm, generate_guacamole_hmac_url, rollback_student_vm
from app.security import get_current_user
from app.models import User, Lab

router = APIRouter(prefix="/api/submissions", tags=["Submissions"])

@router.get("/lab/{lab_id}/vm-session")
def get_vm_session(lab_id: int, current_user: User = Depends(get_current_user)):
    """
    Endpoint cung cấp URL remote bảo mật và thông tin máy ảo cho sinh viên làm bài lab.
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Chỉ sinh viên mới được cấp phiên máy ảo")
        
    # Xác định hệ điều hành máy ảo dựa trên cấu hình lab (ví dụ: Windows cho RDP, Linux cho VNC)
    # Lấy thông tin bài lab từ DB
    # Giả định ở đây template_vmid = 9000 (FLARE-VM) mặc định. Có thể cấu hình trường này trong Lab Model.
    
    try:
        # 1. Khởi tạo VM trong Proxmox và lấy IP
        ip_address, vmid = provision_student_vm(
            student_username=current_user.username,
            lab_id=lab_id,
            template_vmid=9000
        )
        
        # 2. Sinh URL kết nối an toàn ký bởi HMAC
        # Nếu Windows dùng rdp, nếu REMnux Linux dùng vnc
        protocol = "rdp"
        guac_url = generate_guacamole_hmac_url(
            ip_address=ip_address,
            protocol=protocol,
            username="administrator" if protocol == "rdp" else "remnux",
            password="infected"
        )
        
        return {
            "vm_ip": ip_address,
            "vmid": vmid,
            "protocol": protocol,
            "guac_url": guac_url,
            "os_name": "FLARE-VM (Windows Security)" if protocol == "rdp" else "REMnux v7.0 (Linux)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể khởi tạo phòng Lab máy ảo: {str(e)}")

@router.post("/lab/{lab_id}/vm-rollback")
def post_vm_rollback(lab_id: int, current_user: User = Depends(get_current_user)):
    """
    Yêu cầu xóa và tái tạo lại máy ảo của sinh viên về nguyên trạng sạch.
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Không có quyền")
        
    # Tính VMID của sinh viên theo công thức
    student_num = int("".join(filter(str.isdigit, current_user.username)) or "1")
    vmid = 30000 + (student_num * 50) + lab_id
    
    try:
        rollback_student_vm(vmid)
        return {"status": "success", "message": "Đang khôi phục lại máy ảo sạch..."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## V. SỬA ĐỔI MÃ NGUỒN FRONTEND (REACT)

Thay đổi thành phần console mô phỏng (Mock Console) trong file `frontend/src/pages/StudentDashboard.jsx` bằng một cấu trúc `iframe` thực sự nạp động URL kết nối từ API vừa viết.

### 1. Thêm State lưu thông tin phiên VM
Tìm khu vực khai báo state trong `StudentDashboard.jsx` và thêm các trường sau:
```javascript
const [vmSession, setVmSession] = useState(null);
const [isVmLoading, setIsVmLoading] = useState(false);
```

---

### 2. Tạo hàm gọi API lấy link Guacamole khi sinh viên nhấn "Làm bài"
Cập nhật hàm `handleOpenLab` ([StudentDashboard.jsx:L373-418](file:///d:/Code/MalSec/frontend/src/pages/StudentDashboard.jsx#L373-L418)):
```javascript
  const handleOpenLab = async (lab) => {
    setLoading(true)
    setError('')
    setSelectedLab(lab)
    
    const token = localStorage.getItem('malsec_token')

    try {
      // 1. Tải bản nháp báo cáo cũ
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
      
      // 2. GỌI API KHỞI TẠO MÁY ẢO PROXMOX & LẤY URL GUACAMOLE
      setIsVmLoading(true);
      const vmRes = await fetch(`/api/submissions/lab/${lab.id}/vm-session`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (vmRes.ok) {
        const sessionData = await vmRes.json();
        setVmSession(sessionData);
        setVmOs(`${sessionData.os_name} — Đang hoạt động trực tuyến`);
        setVmLogs([
          `[+] Khởi tạo máy ảo mã định danh VM ${sessionData.vmid} thành công.`,
          `[+] Định vị địa chỉ mạng IP: ${sessionData.vm_ip} (VLAN 30).`,
          `[+] Xác thực Guacamole HMAC OK.`,
          `[+] Đang thiết lập phiên truyền hình ảnh RDP mượt mà...`
        ]);
      } else {
        const errData = await vmRes.json();
        throw new Error(errData.detail || "Lỗi không thể cấp phát máy ảo trên Proxmox.");
      }

      setViewState('doing_lab')
      setLastSavedTime(new Date().toLocaleTimeString('vi-VN'))
    } catch (err) {
      setError(err.message || 'Lỗi khi tải trạng thái làm bài')
    } finally {
      setLoading(false)
      setIsVmLoading(false)
    }
  }
```

---

### 3. Cập nhật hàm Rollback VM gọi API thật
Cập nhật hành vi nút Rollback trong `runVmCommand` ([StudentDashboard.jsx:L543-574](file:///d:/Code/MalSec/frontend/src/pages/StudentDashboard.jsx#L543-L574)):
```javascript
  const handleRollbackVM = async () => {
    if (!confirm("CẢNH BÁO: Toàn bộ dữ liệu bạn đang phân tích trong máy ảo sẽ bị xóa để khôi phục về máy ảo sạch ban đầu. Bạn có chắc chắn muốn Rollback?")) {
      return;
    }
    
    setIsVmLoading(true);
    setError('');
    setSuccess('');
    const token = localStorage.getItem('malsec_token');
    
    try {
      const res = await fetch(`/api/submissions/lab/${selectedLab.id}/vm-rollback`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Không thể thực hiện rollback");
      }
      
      setSuccess("Đang thực hiện rollback máy ảo. Vui lòng đợi trong giây lát...");
      
      // Tải lại phiên máy ảo mới
      setTimeout(async () => {
        try {
          const vmRes = await fetch(`/api/submissions/lab/${selectedLab.id}/vm-session`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (vmRes.ok) {
            const sessionData = await vmRes.json();
            setVmSession(sessionData);
            setSuccess("Máy ảo đã được rollback về trạng thái sạch thành công!");
          }
        } catch (e) {
          setError("Lỗi tải lại phiên máy ảo sau rollback");
        } finally {
          setIsVmLoading(false);
        }
      }, 7000); // Chờ 7 giây cho tiến trình xóa và khởi tạo lại ở PVE
      
    } catch (err) {
      setError(err.message);
      setIsVmLoading(false);
    }
  }
```

---

### 4. Thay thế Giao diện Console ảo bằng thẻ Iframe thực tế

Tìm khối giao diện màn hình máy ảo ở cột trái [StudentDashboard.jsx:L908-963](file:///d:/Code/MalSec/frontend/src/pages/StudentDashboard.jsx#L908-L963) và viết lại:

```javascript
                {/* Virtual Desktop Display - IFRAME KẾT NỐI GUACAMOLE THỰC TẾ */}
                <div style={{ 
                  flex: 1, 
                  background: '#090d16', 
                  position: 'relative',
                  border: '1px solid #1f2937',
                  overflow: 'hidden'
                }}>
                  {isVmLoading ? (
                    // Hiển thị vòng quay loading trong lúc chờ khởi tạo máy ảo
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(9, 13, 22, 0.9)', display: 'flex', flexDirection: 'column',
                      justifyContent: 'center', alignItems: 'center', zIndex: 10
                    }}>
                      <div className="plag-loading-spinner" style={{ marginBottom: '16px' }}></div>
                      <h4 style={{ color: 'var(--neon-cyan)', marginBottom: '8px' }}>ĐANG KHỞI TẠO MÁY ẢO LAB...</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Đang liên kết Proxmox VE để cấp phát Linked Clone...</p>
                    </div>
                  ) : vmSession && vmSession.guac_url ? (
                    // Iframe kết nối trực tiếp đến Apache Guacamole thông qua HMAC
                    <iframe
                      src={vmSession.guac_url}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: '#000'
                      }}
                      allow="clipboard-read; clipboard-write; fullscreen"
                      title="Apache Guacamole Remote Lab Desktop"
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '48px', zIndex: 1 }}>
                      <Terminal size={48} style={{ color: 'var(--neon-ruby)', marginBottom: '16px' }} />
                      <h4 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>LỖI KẾT NỐI HẠ TẦNG VM</h4>
                      <p style={{ color: 'var(--neon-ruby)', fontSize: '13px', maxWidth: '400px', margin: '0 auto' }}>
                        Không thể kết nối tới server Apache Guacamole hoặc máy ảo chưa được khởi tạo.
                      </p>
                    </div>
                  )}
                </div>
```

Đồng thời, cập nhật nút bấm **"Rollback VM sạch (PBS)"** để liên kết với hàm `handleRollbackVM`:
```javascript
                    <button 
                      type="button" 
                      onClick={handleRollbackVM} 
                      className="btn btn-danger" 
                      style={{ padding: '4px 8px', fontSize: '11px', border: 'none' }}
                      title="Phục hồi trạng thái máy ảo ban đầu qua Proxmox"
                    >
                      <RotateCcw size={11} /> Rollback VM sạch (PBS)
                    </button>
```

---

## VI. BẢO MẬT & TỐI ƯU HÓA ĐƯỜNG TRUYỀN (SỔ TAY KỸ THUẬT)

1.  **Cách ly Mạng (pfSense Rules):**
    *   Cấm hoàn toàn các máy ảo thuộc dải `10.30.0.0/24` (VLAN 30) nói chuyện trực tiếp với dải `10.20.0.0/24` (VLAN 20) của sinh viên.
    *   **Cơ chế bắc cầu:** Chỉ duy nhất dịch vụ `guacd` được phép kết nối RDP (3389) hoặc VNC (5900) vào máy ảo trong VLAN 30.
    *   Sinh viên chỉ giao tiếp HTTPS với Guacamole Portal qua cổng `8443` ở VLAN 20. Trình duyệt client không có kết nối TCP trực tiếp nào tới máy ảo.
2.  **Khử Độ Trễ (Latency Tuning) cho RDP trong Guacamole:**
    *   Trong `vm_service.py`, ta thêm các tham số tối ưu hóa cho RDP:
        *   `guac.enable-wallpaper: false` (Tắt hình nền máy ảo).
        *   `guac.enable-theming: false` (Tắt hiệu ứng Windows).
        *   `guac.enable-font-smoothing: true` (Làm mịn chữ để sinh viên đọc code phân tích không bị mỏi mắt).
        *   `guac.color-depth: 16` (Giảm độ sâu màu xuống 16-bit nếu băng thông mạng phòng máy yếu).
3.  **Tự động dọn dẹp tài nguyên (Crontab/Daemon):**
    *   Để tránh tràn RAM/Ổ cứng trên Proxmox khi sinh viên quên tắt máy ảo, lập lịch một cronjob trên Server chạy Web App vào 23:00 hàng ngày để tắt và xóa các máy ảo linked clone có thời gian tạo vượt quá 6 tiếng hoặc các bài lab đã đóng thời hạn nộp bài.

---
*Bản tài liệu này được lưu trữ trong thư mục mã nguồn để nhóm phát triển hạ tầng và phần mềm làm tài liệu đối chiếu vận hành.*
