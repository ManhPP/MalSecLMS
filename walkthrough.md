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
| **`lecturer`** | `lecturer123` | `lecturer@malsec.local` | **Giảng viên** | Tạo đề bài Lab động, Chấm điểm Speed Grader chia đôi, Gia hạn cá nhân, Tải Zip. |
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

### 👣 Bước 2: Giảng viên ra đề thực hành với Trình thiết kế Form động
1. Đăng xuất tài khoản Admin, đăng nhập bằng tài khoản `lecturer` / `lecturer123`.
2. **Danh sách bài Lab:** Quan sát bài Lab mẫu đã được seed sẵn: *"Lab 01: Phân tích Tĩnh Ransomware WannaCry"*.
3. **Thiết kế bài Lab mới:** Nhấn nút **"Thiết kế bài Lab động mới"**.
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
2. **Dashboard Sinh viên:** Bạn sẽ thấy danh sách bài Lab 01 đang mở cần làm, kèm theo đồng hồ đếm ngược động màu cam hiển thị chính xác thời gian còn lại (kể cả thời hạn gia hạn cá nhân nếu được gán).
3. **Màn hình làm bài Split-Screen:** Nhấn "Làm bài" tại bài Lab 01:
   * **Bên trái (65%):** Giao diện cổng máy ảo Apache Guacamole kết nối trực tuyến tới FLARE-VM/REMnux. Thử bấm nút **"Rollback VM sạch (PBS)"** để phục hồi máy ảo ban đầu qua Proxmox Backup Server, hoặc bấm "Đổi máy ảo" để chuyển hệ điều hành.
   * **Bên phải (35%):** Form điền báo cáo động được dựng chính xác theo cấu hình bài Lab.
4. **Trình soạn thảo Markdown & Live Preview:**
   * Tại trường dán mã Assembly, bạn sẽ thấy thanh công cụ soạn thảo Markdown chuyên dụng phía trên.
   * Thử bôi đen chữ và nhấn các nút để tự động định dạng: **H3 (Tiêu đề)**, **B (Tô đậm)**, **Code (Tạo khối mã Assembly)**, **List (Danh mục)** hoặc **Threat (Cảnh báo đỏ phát sáng)**.
   * Nhấn nút **"Xem trước" (Live Preview)** để thấy kết quả hiển thị được định dạng vô cùng lôi cuốn với các khối mã monospace nền tối và thẻ threat đỏ rực.
5. **Chọn nhiều hành vi mã độc (Checkbox list):**
   * Đối với câu hỏi phân loại hành vi, sinh viên có thể tích chọn đồng thời nhiều ô checkbox (Ví dụ: WannaCry vừa là *Ransomware* vừa là *Worm* để lan truyền).
6. **Auto-save phía Server:** Hãy gõ thử văn bản. Quan sát góc trên bên phải, cứ mỗi 30 giây đèn xanh neon sẽ nháy sáng báo trạng thái *"Đã đồng bộ với máy chủ"*. Thử bấm F5 tải lại trang, toàn bộ bài làm thô, tệp tải lên và các checkbox đã tích đều được khôi phục nguyên vẹn!
7. **Tải file đính kèm an toàn (Airlock Security):**
   * **Ảnh chụp màn hình:** Tải lên file ảnh `.png`. Backend tự động làm sạch metadata (EXIF) để bảo vệ an toàn.
   * **File mã hóa zip:** Tải lên file `.zip` chứa log. Thử đặt mật khẩu sai cho file zip, hệ thống sẽ từ chối tải lên và yêu cầu đổi về mật khẩu `infected`. Hệ thống cũng sẽ chặn đứng và xóa file lập tức nếu phát hiện file nguy hại dạng `.exe` bên trong.
8. Nhấn **"Nộp báo cáo chính thức"** và xác nhận.
9. **Xem lại bài làm đã chấm:** Sau khi Giảng viên chấm điểm bài làm của sinh viên, bài Lab đó sẽ được chuyển xuống phần **"Lịch sử & Kết quả chấm điểm bài Lab"**. Sinh viên có thể click vào nút **"Xem lại bài"** để:
   * Xem điểm số trực quan nhận được và ý kiến nhận xét chi tiết của Giảng viên (tránh lỗi crash hiển thị do thiếu import Icon `Award`).
   * Xem lại toàn bộ câu trả lời, checkbox và báo cáo tự luận Markdown đã nộp.
   * Xem và tải trực tiếp các tệp chứng cứ đã tải lên một cách an toàn bằng cách click vào tên tệp tin tương ứng.

---


### 👣 Bước 4: Giảng viên chấm bài Speed Grader giàu định dạng
1. Đăng xuất, đăng nhập lại bằng tài khoản giảng viên `lecturer` / `lecturer123`.
2. Nhấn nút **"Chấm bài &rarr;"** tại bài Lab 01. Nhấp **"Chấm Speed Grader"** cho bài của `sv01`.
3. **Giao diện chấm bài chia đôi màn hình:**
   * **Bên trái:** Kết xuất (render) toàn bộ báo cáo của sinh viên. 
     * Ảnh chụp màn hình hiển thị trực tuyến an toàn (nhấp chuột để phóng to).
     * Báo cáo tự luận dạng Markdown được kết xuất sang HTML an toàn, làm nổi bật các tiêu đề, danh sách, khối code đơn cách nền tối và các cảnh báo threat đỏ neon.
     * Các checkbox sinh viên chọn được hiển thị dưới dạng **các thẻ tag xanh neon viền sáng rất đẹp mắt**.
     * File log `.zip` được giải mã và hiển thị chính xác trạng thái quét bảo mật an toàn kèm danh mục các tệp tin bên trong!
     * Hệ thống tự động đối khớp văn bản và hiển thị **Cảnh báo nghi vấn đạo văn** (nếu sinh viên có hành vi sao chép của bạn khác).
   * **Bên phải:** Bảng chấm điểm hiển thị rõ sinh viên có nộp muộn hay không để tự áp hình phạt muộn theo cấu hình của bài lab.
4. Nhập điểm số (ví dụ: `9.5`), nhập nhận xét chi tiết, rồi nhấn "Lưu".
5. Giảng viên có thể kiểm tra nút "Xuất bảng điểm (CSV)" để tải bảng điểm Excel mẫu về máy, hoặc bấm "Tải toàn bộ bài nộp (.ZIP)" để lưu trữ minh chứng đào tạo gồm đầy đủ file tổng hợp `.txt` của từng sinh viên và các file đính kèm tương ứng.

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
