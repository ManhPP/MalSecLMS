# HƯỚNG DẪN VẬN HÀNH & KIỂM THỬ HỆ THỐNG MALSEC LMS

Tài liệu này cung cấp hướng dẫn chi tiết cách khởi động cụm Docker Compose và quy trình kiểm thử từng bước (Walkthrough) cho 3 vai trò: **Quản trị viên (Admin)**, **Giảng viên (Lecturer)**, và **Sinh viên (Student)**.

---

## 1. Khởi động Cụm Docker Compose

Do toàn bộ hệ thống đã được thiết kế đóng gói hoàn hảo, bạn chỉ cần thực hiện một lệnh duy nhất để khởi động cơ sở dữ liệu PostgreSQL, biên dịch React Frontend (Multi-stage build qua Nginx), và chạy FastAPI Backend.

**Lệnh khởi chạy (Chạy tại thư mục `d:\Code\MalSec`):**
```powershell
docker compose up --build -d
```

> [!TIP]
> * **Backend API Docs (Swagger UI):** Truy cập [http://localhost:8000/docs](http://localhost:8000/docs) để kiểm tra toàn bộ danh sách API được tài liệu hóa tự động.
> * **Giao diện Web App (Frontend):** Truy cập [http://localhost](http://localhost) để bắt đầu trải nghiệm giao diện **Deep Space & Neon Cyberpunk** cực kỳ sang trọng.

---

## 2. Thông tin Tài khoản Thử nghiệm (Seeded Accounts)

Hệ thống đã được tự động nạp sẵn dữ liệu mẫu phong phú (Data Seeding) ngay khi khởi động CSDL để bạn có thể đăng nhập thử nghiệm ngay lập tức:

| Tên đăng nhập | Mật khẩu | Vai trò (Role) | Chức năng kiểm thử chính |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | **Quản trị viên** | Quản lý người dùng, Gán lớp, Import CSV, Xem Audit Logs. |
| **`lecturer`** | `lecturer123` | **Giảng viên** | Tạo đề bài Lab động, Chấm điểm Speed Grader chia đôi, Gia hạn cá nhân, Tải Zip. |
| **`sv01`** | `student123` | **Sinh viên 01** | Làm bài Split-Screen, Tải ảnh chứng cứ, Quét zip, Auto-save nháp. |
| **`sv02`** | `student123` | **Sinh viên 02** | Nộp bài thực hành lớp AT16-Malware. |

---

## 3. Quy trình Kiểm thử từng bước (Walkthrough)

### 👣 Bước 1: Quản trị viên quản lý hệ thống & Import sinh viên
1. Truy cập [http://localhost](http://localhost) và đăng nhập bằng tài khoản `admin` / `admin123`.
2. **Quản lý tài khoản:** Xem danh sách người dùng được tải mượt mà. Nhấn "Thêm tài khoản mới" để tạo thử một tài khoản Giảng viên hoặc Sinh viên.
3. **Quản lý lớp học phần:** Chọn lớp `AT16-Malware` ở cột trái. Cột phải hiển thị danh sách 2 sinh viên `sv01` và `sv02`. Bạn có thể nhập mã ID sinh viên mới vào ô để gán thêm vào lớp.
4. **Nhập hàng loạt từ file CSV:** Nhấn "Nhập Excel/CSV hàng loạt". Tải lên một file `.csv` thử nghiệm có nội dung sau để kiểm tra tính năng tự động tạo tài khoản và tự động ánh xạ lớp:
   ```csv
   AT160105,Trần Hoàng Nam,AT16-Malware
   AT160110,Phạm Minh Đức,AT16-Forensics
   ```
   Hệ thống sẽ lập tức trả về bảng tổng hợp kết quả chi tiết từng dòng, tự động băm mật khẩu bảo mật `12345678` cho các tài khoản mới và tạo thêm lớp `AT16-Forensics` nếu chưa có sẵn!
5. **Nhật ký hệ thống:** Chuyển sang tab "Nhật ký Hoạt động" để quan sát toàn bộ nhật ký kiểm toán (Audit Logs) ghi nhận chính xác thời gian, IP và hành động vừa thực hiện.

---

### 👣 Bước 2: Giảng viên ra đề thực hành với Trình thiết kế Form động
1. Đăng xuất tài khoản Admin, đăng nhập bằng tài khoản `lecturer` / `lecturer123`.
2. **Danh sách bài Lab:** Quan sát bài Lab mẫu đã được seed sẵn: *"Lab 01: Phân tích Tĩnh Ransomware WannaCry"*.
3. **Thiết kế bài Lab mới:** Nhấn nút **"Thiết kế bài Lab động mới"**.
   * Nhập tiêu đề bài Lab (ví dụ: `Lab 02: Phân tích hành vi Trojan.Win32`).
   * Chọn lớp nhận bài: `AT16-Malware`.
   * Thiết lập hạn nộp (Deadline) và chính sách nộp muộn (Ví dụ: Phạt 0.5% mỗi giờ nộp muộn).
   * **Dynamic Form Builder:** Tự do thêm/bớt các câu hỏi cho bài báo cáo:
     * Nhấn *"+ Text"* để tạo trường nhập mã MD5/SHA256.
     * Nhấn *"+ Code/Tự luận"* để tạo trường dán mã Assembly.
     * Nhấn *"+ Tải file/Ảnh"* để yêu cầu nộp ảnh chụp Wireshark.
   * Nhấn "Cấu hình & Giao bài Lab". Bài thực hành sẽ ngay lập tức được xuất bản đến lớp học được chọn!

---

### 👣 Bước 3: Sinh viên làm bài Split-Screen & Tự động lưu nháp
1. Đăng xuất, đăng nhập bằng tài khoản sinh viên `sv01` / `student123`.
2. **Dashboard Sinh viên:** Bạn sẽ thấy danh sách bài Lab 01 đang mở cần làm, kèm theo đồng hồ đếm ngược động màu cam hiển thị chính xác thời gian còn lại.
3. **Màn hình làm bài Split-Screen:** Nhấn "Làm bài" tại bài Lab 01:
   * **Bên trái (65%):** Giao diện cổng máy ảo Apache Guacamole kết nối trực tuyến tới FLARE-VM/REMnux. Thử bấm nút **"Rollback VM sạch (PBS)"** để giả lập khôi phục trạng thái đĩa sạch qua Proxmox Backup Server, hoặc bấm "Đổi máy ảo" để luân chuyển giữa Windows và Linux. Quan sát log kết nối mạng nội bộ nhảy liên tục phía dưới.
   * **Bên phải (35%):** Form điền báo cáo động được dựng chính xác theo mẫu bài Lab 01.
4. **Auto-save phía Server:** Hãy gõ thử một vài ký tự vào trường dán mã Assembly. Quan sát góc trên bên phải, cứ mỗi 30 giây đèn xanh neon sẽ nháy sáng kèm trạng thái *"Đã đồng bộ với máy chủ lúc [Thời gian]"*. Thử bấm Refresh (F5) trình duyệt, đăng nhập lại & vào lại bài làm, toàn bộ câu trả lời nháp của bạn đã được khôi phục nguyên vẹn từ PostgreSQL CSDL!
5. **Tải file đính kèm an toàn (Airlock Security):**
   * **Ảnh chụp màn hình:** Nhấp tải lên một file ảnh `.png` tại trường ảnh Wireshark. Ảnh sẽ được Backend tự động làm sạch (Sanitize) cấu hình EXIF và lưu trữ.
   * **File mã hóa zip:** Nhấp tải lên một file `.zip` chứa log phân tích. Thử đặt mật khẩu sai cho file zip, hệ thống sẽ từ chối tải lên và yêu cầu đổi về mật khẩu `infected`. Nếu tệp zip chứa file nguy hại dạng `.exe`, hệ thống sẽ chặn đứng và xóa file lập tức để bảo vệ an toàn.
6. Nhấn **"Nộp báo cáo chính thức"** và xác nhận. Trạng thái bài làm chuyển sang "Đã nộp bài".

---

### 👣 Bước 4: Giảng viên chấm bài chia đôi màn hình (Speed Grader)
1. Đăng xuất, đăng nhập lại bằng tài khoản giảng viên `lecturer` / `lecturer123`.
2. Nhấn nút **"Chấm bài &rarr;"** tại bài Lab 01. Bạn sẽ thấy sinh viên `sv01` đã nộp bài.
3. Nhấp **"Chấm Speed Grader"** cho bài làm của `sv01`:
   * Hệ thống chuyển sang giao diện chia đôi màn hình.
   * **Bên trái:** Kết xuất (render) toàn bộ báo cáo của sinh viên. Ảnh chụp màn hình hiển thị trực tiếp an toàn (nhấp chuột để phóng to xem chi tiết). Đặc biệt, file log `.zip` nộp bài được giải mã và hiển thị chính xác trạng thái quét bảo mật an toàn kèm danh mục các tệp tin bên trong!
   * Hệ thống tự động đối khớp văn bản và hiển thị **Cảnh báo nghi vấn đạo văn** (nếu sinh viên có hành vi sao chép tự luận của bạn khác).
   * **Bên phải:** Bảng chấm điểm hiển thị rõ sinh viên có nộp muộn hay không (ở đây là nộp đúng hạn, mức phạt 0.0%).
4. Nhập điểm số (ví dụ: `9.5`), nhập nhận xét chi tiết, rồi nhấn "Lưu".
5. Đăng nhập lại tài khoản sinh viên `sv01` để xem kết quả điểm số `9.5 / 10` và nhận xét của thầy cô hiển thị trực quan dạng Neon Emerald!
6. Giảng viên cũng có thể kiểm tra nút "Xuất bảng điểm (CSV)" để tải bảng điểm Excel mẫu về máy, hoặc bấm "Tải toàn bộ bài nộp (.ZIP)" để lưu trữ minh chứng đào tạo gồm đầy đủ file tổng hợp `.txt` của từng sinh viên và các file đính kèm tương ứng.

---

## 4. Kiểm tra mã nguồn & Cấu trúc kỹ thuật

* Toàn bộ mã nguồn backend FastAPI nằm tại: [backend/app/](file:///d:/Code/MalSec/backend/app/)
* Toàn bộ mã nguồn React Frontend nằm tại: [frontend/src/](file:///d:/Code/MalSec/frontend/src/)
* Các file cấu hình mạng Nginx nằm tại: [frontend/nginx.conf](file:///d:/Code/MalSec/frontend/nginx.conf)
