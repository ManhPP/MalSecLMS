# HƯỚNG DẪN VẬN HÀNH & KIỂM THỬ HỆ THỐNG MALSEC LMS

Tài liệu này cung cấp hướng dẫn chi tiết cách khởi động cụm Docker Compose và quy trình kiểm thử từng bước (Walkthrough) cho 3 vai trò: **Quản trị viên (Admin)**, **Giảng viên (Lecturer)**, và **Sinh viên (Student)**, bao gồm hai tính năng nâng cao vừa cập nhật: **Cyberpunk Markdown Editor** và **Checkbox chọn nhiều hành vi mã độc**.

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

| Tên đăng nhập | Mật khẩu | Địa chỉ Email | Vai trò (Role) | Chức năng kiểm thử chính |
| :--- | :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | `admin@malsec.local` | **Quản trị viên** | Quản lý người dùng, Gán lớp, Import CSV, Xem Audit Logs. |
| **`lecturer`** | `lecturer123` | `lecturer@malsec.local` | **Giảng viên** | Quản lý Lớp & Sinh viên (thêm, sửa, xóa), Tìm kiếm & Lọc bài Lab, Tạo đề bài Lab động, Chấm điểm Speed Grader chia đôi, Gia hạn cá nhân, Tải Zip. |
| **`sv01`** | `student123` | `sv01@malsec.local` | **Sinh viên 01** | Làm bài Split-Screen, Tải ảnh chứng cứ, Quét zip, Auto-save nháp. |
| **`sv02`** | `student123` | `sv02@malsec.local` | **Sinh viên 02** | Nộp bài thực hành lớp AT16-Malware. |

---

## 3. Quy trình Kiểm thử từng bước (Walkthrough)

### 👣 Bước 1: Quản trị viên quản lý hệ thống & Import sinh viên
1. Truy cập [http://localhost](http://localhost) và đăng nhập bằng tài khoản `admin` / `admin123`.
2. **Quản lý tài khoản:** Xem danh sách người dùng được tải mượt mà. Nhấn "Thêm tài khoản mới" để tạo thử một tài khoản Giảng viên hoặc Sinh viên.
3. **Quản lý lớp học phần:** Chọn lớp `AT16-Malware` ở cột trái. Cột phải hiển thị danh sách 2 sinh viên `sv01` và `sv02`. Bạn có thể nhập mã ID sinh viên mới vào ô để gán thêm vào lớp.
4. **Nhập hàng loạt từ file CSV:** Nhấn "Nhập Excel/CSV hàng loạt". Tải lên một file `.csv` thử nghiệm có nội dung sau để kiểm tra tính năng tự động tạo tài khoản, ánh xạ lớp và nạp địa chỉ Email (cột thứ 4, tùy chọn):
   ```csv
   AT160105,Trần Hoàng Nam,AT16-Malware,namth@malsec.local
   AT160110,Phạm Minh Đức,AT16-Forensics,duchm@malsec.local
   ```
   Hệ thống sẽ lập tức trả về bảng tổng hợp kết quả chi tiết từng dòng, tự động băm mật khẩu bảo mật `12345678` cho các tài khoản mới và tạo thêm lớp `AT16-Forensics` nếu chưa có sẵn!
5. **Nhật ký hệ thống:** Chuyển sang tab "Nhật ký Hoạt động" để quan sát toàn bộ nhật ký kiểm toán (Audit Logs) ghi nhận chính xác thời gian, IP và hành động vừa thực hiện.

---

### 👣 Bước 2: Giảng viên quản lý lớp học, quản lý sinh viên & ra đề
1. Đăng xuất tài khoản Admin, đăng nhập bằng tài khoản `lecturer` / `lecturer123`.
2. **Tìm kiếm & Lọc bài Lab:**
   * Ngay tại trang chủ, giảng viên có thể nhập từ khóa để tìm kiếm bài Lab, hoặc sử dụng các dropdown lọc theo Lớp học phần, lọc theo Trạng thái (Đang mở / Đã đóng), và sắp xếp (Mới nhất, Hạn nộp tăng/giảm dần, Tiêu đề A-Z).
3. **Quản lý Lớp & Sinh viên:**
   * Nhấp chọn tab **"Quản lý Lớp & Sinh viên"** trên thanh điều hướng.
   * Chọn lớp `AT16-Malware` ở cột bên trái để tải thông tin lớp và danh sách sinh viên hiện tại trong lớp.
   * **Thêm sinh viên:**
     * *Cách 1:* Nhập từ khóa tên sinh viên hoặc MSSV vào ô *"Tìm & Thêm sinh viên vào lớp"*. Hệ thống sẽ hiển thị các tài khoản chưa có trong lớp, nhấp nút **"Thêm"** để gán nhanh vào lớp.
     * *Cách 2:* Nhập chuỗi mã ID sinh viên cách nhau bằng dấu phẩy/khoảng trắng vào ô *"Thêm hàng loạt bằng mã ID"* và bấm xác nhận.
   * **Sửa thông tin sinh viên:** Nhấn biểu tượng nút **Sửa** (Edit) trên dòng của sinh viên `sv01`. Tại modal hiện ra, giảng viên có thể thay đổi Họ và tên, Email, đặt Mật khẩu mới, hoặc khóa/mở khóa Trạng thái hoạt động của sinh viên này. Bấm lưu để cập nhật (giảng viên chỉ có quyền sửa thông tin sinh viên thuộc các lớp mình phụ trách).
   * **Xóa sinh viên khỏi lớp:** Nhấn biểu tượng nút **Xóa** (Trash) để gỡ gán sinh viên ra khỏi lớp học phần.
4. **Thiết kế bài Lab mới:** Nhấn nút **"Thiết kế bài Lab động mới"**.
   * Nhập tiêu đề bài Lab (ví dụ: `Lab 02: Phân tích hành vi Trojan.Win32`).
   * Chọn lớp nhận bài: `AT16-Malware`.
   * Thiết lập hạn nộp (Deadline) và chính sách nộp muộn (Ví dụ: Phạt 0.5% mỗi giờ nộp muộn).
   * **Dynamic Form Builder:** Tự do thêm/bớt các câu hỏi cho bài báo cáo với đa dạng loại trường:
     * Nhấn *"+ Text"* để tạo trường nhập mã MD5/SHA256.
     * Nhấn *"+ Chọn một"* để tạo câu hỏi dropdown chọn duy nhất 1 phương án.
     * Nhấn *"+ Chọn nhiều"* để tạo câu hỏi **Checkbox chọn nhiều hành vi** độc hại cùng lúc. Thử thiết lập câu hỏi này và nhập các phương án: `Ransomware`, `Worm`, `Trojan`, `Rootkit`.
     * Nhấn *"+ Code/Tự luận"* để tạo trường dán **Markdown Code Block** tự luận.
     * Nhấn *"+ Tải file/Ảnh"* để yêu cầu nộp ảnh chụp Wireshark.
   * Nhấn "Cấu hình & Giao bài Lab". Bài thực hành sẽ ngay lập tức được xuất bản đến lớp học được chọn!

---

### 👣 Bước 3: Sinh viên làm bài Split-Screen & Trình soạn thảo Markdown
1. Đăng xuất, đăng nhập bằng tài khoản sinh viên `sv01` / `student123`.
2. **Dashboard Sinh viên & Phân nhóm lớp học:**
   * Tại trang chủ, toàn bộ bài lab được phân nhóm trực quan theo từng Lớp học phần (`Class`). Sinh viên tham gia nhiều lớp sẽ thấy các khối lớp riêng biệt, dễ dàng tìm kiếm và lọc bài theo môn học.
   * Mã `lab_id` thô được ẩn hoàn toàn để giữ giao diện tinh gọn, tập trung vào tên bài lab và thời hạn làm bài.
   * Đồng hồ đếm ngược động hiển thị chính xác thời gian còn lại (bao gồm cả thời hạn gia hạn cá nhân nếu có).
3. **Màn hình làm bài Split-Screen & Tối ưu mở máy ảo (< 1s):** Nhấn "Start Lab" / "Làm bài":
   * **Mở VM tức thì:** Nếu máy ảo đã được tạo và đang chạy (`running`), phiên kết nối Guacamole xuất hiện ngay lập tức trong vòng chưa đầy 1 giây mà không phải chờ đợi.
   * **Bên trái (65%):** Giao diện cổng máy ảo Apache Guacamole kết nối trực tuyến tới FLARE-VM/REMnux. Hỗ trợ rollback máy ảo sạch hoặc đổi máy ảo.
   * **Bên phải (35%):** Form điền báo cáo động được dựng chính xác theo cấu hình bài Lab.
4. **Trình soạn thảo Markdown & Live Preview:**
   * Hỗ trợ định dạng tiêu đề, danh sách, khối mã phân tích và cảnh báo mối đe dọa (Threat).
5. **Đính kèm tài liệu & Xem trước file (Word, PDF, Ảnh):**
   * Cho phép đính kèm file ảnh, file nén mã độc có mật khẩu, file PDF và file `.docx`.
   * Nhấp chuột vào tên file `.docx` đã tải lên: Hệ thống mở ngay modal xem trước văn bản Word trực tuyến với **nền giấy trắng tinh khiết, chữ đen đậm nét và đổ bóng chân thực**, không bị tối màu hay lỗi giao diện.
6. **Auto-save phía Server & Nộp bài:**
   * Tự động lưu bản nháp mỗi 30 giây lên máy chủ.
   * Nhấn "Nộp báo cáo chính thức" và xác nhận.
7. **Chỉnh sửa bài nộp (Edit Submission before Deadline):**
   * Nếu đã nộp bài nhưng vẫn còn trong thời hạn nộp và bài chưa bị chấm điểm, sinh viên có thể nhấn nút **"Edit Submission"** để mở lại form, chỉnh sửa câu trả lời, thay đổi file minh chứng và nộp lại phiên bản mới nhất.

---

### 👣 Bước 4: Giảng viên chấm bài Speed Grader với bộ chuyển sinh viên nhanh
1. Đăng xuất, đăng nhập lại bằng tài khoản giảng viên `lecturer` / `lecturer123`.
2. Nhấn nút **"Chấm bài &rarr;"** tại bài Lab. Nhấp **"Chấm Speed Grader"**.
3. **Bộ chọn sinh viên nhanh (Fast Student Switcher):**
   * Ngay trên thanh tiêu đề của Speed Grader, giảng viên có thể:
     * Dùng dropdown để chọn trực tiếp bất kỳ sinh viên nào trong lớp mà không cần phải thoát ra ngoài.
     * Sử dụng hai nút điều hướng mũi tên `<` và `>` để chuyển nhanh giữa các bài làm.
     * Tính năng tự động chuyển sang sinh viên tiếp theo sau khi chấm điểm thành công vẫn được giữ nguyên vẹn.
4. **Xem trước tài liệu bài nộp trực tiếp:**
   * Xem trước văn bản Word (`.docx`), PDF và ảnh chụp màn hình ngay trong giao diện chấm điểm.
5. Nhập điểm số, nhận xét chi tiết và nhấn "Lưu". Toàn bộ thao tác diễn ra liền mạch, tối ưu UX cho giảng viên khi chấm cả lớp.

---

## 4. Kiến trúc CSDL linh hoạt không cần Migration (PostgreSQL JSONB)

Một trong những điểm sáng nhất về thiết kế kỹ thuật của hệ thống LMS này là khả năng mở rộng không giới hạn:
* Kiểu dữ liệu **JSONB** của PostgreSQL được cấu hình cho trường `form_fields` trong bảng `labs` và trường `answers` trong bảng `submissions`.
* Nhờ vậy, khi chúng ta nâng cấp thêm các loại trường câu hỏi mới (như từ chỉ chọn Dropdown đơn sang **Checkbox chọn nhiều phương án** hay **Markdown Editor**), hệ thống **hoàn toàn tương thích ngược 100%** và **không cần thực hiện thay đổi schema CSDL hay chạy lệnh SQL Migration phức tạp**. Dữ liệu mới được tự động đóng gói dưới dạng cấu trúc JSON linh hoạt và lưu trữ tức thì.

---

## 5. Kiểm tra mã nguồn & Cấu trúc kỹ thuật

* Toàn bộ mã nguồn backend FastAPI nằm tại: [backend/app/](file:///d:/Code/MalSec/backend/app/)
* Toàn bộ mã nguồn React Frontend nằm tại: [frontend/src/](file:///d:/Code/MalSec/frontend/src/)
* Các file cấu hình mạng Nginx nằm tại: [frontend/nginx.conf](file:///d:/Code/MalSec/frontend/nginx.conf)
* File đặc tả kiến trúc gốc: [des.md](file:///d:/Code/MalSec/des.md)
