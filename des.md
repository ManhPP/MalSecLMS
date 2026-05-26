dưới đây là **Bản đặc tả tổng hợp đầy đủ và chi tiết nhất** về các yêu cầu chức năng và phi chức năng cho hệ thống Web App LMS chuyên dụng này.

---

## PHẦN I: YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

Hệ thống được thiết kế xoay quanh 4 phân hệ chính (Admin, Giảng viên, Sinh viên, Hệ thống tự động) nhằm tối ưu hóa quy trình giao bài, làm bài, chấm điểm và quản lý an toàn file mã độc.

### 1. Phân hệ Quản trị viên (Admin Dashboard)

* **Quản lý người dùng và Định danh:**
* Tạo mới, chỉnh sửa, khóa hoặc xóa tài khoản (Giảng viên, Sinh viên).
* Hỗ trợ nhập (Import) danh sách tài khoản sinh viên hàng loạt từ file Excel/CSV (Mã SV, Họ tên, Lớp sinh hoạt).
* **Tích hợp SSO:** Kết nối xác thực tập trung với hệ thống **Keycloak** (đang có sẵn ở Phase 07 của phòng lab) để sinh viên dùng chung 1 tài khoản cho cả Guacamole và Web nộp bài.


* **Quản lý Phân quyền (RBAC):** Định nghĩa vai trò chặt chẽ (Admin, Giảng viên, Sinh viên). Đảm bảo tính cô lập dữ liệu: sinh viên lớp này không thể thấy thông tin hoặc bài nộp của lớp khác.
* **Cấu hình Hệ thống:** Cài đặt dung lượng file tải lên tối đa (Max file size), cấu hình các định dạng file được phép/bị cấm, cấu hình SMTP Server để gửi mail tự động.
* **Nhật ký kiểm toán (Audit Log):** Ghi lại toàn bộ hành vi hệ thống (Ai đăng nhập, ai sửa điểm, thời gian nộp bài, lịch sử thay đổi cấu hình) để phục vụ tra soát khi có khiếu nại.

### 2. Phân hệ Giảng viên (Instructor Dashboard)

* **Quản lý Lớp học phần:** Tạo lớp học, gán danh sách sinh viên vào lớp theo từng học kỳ, theo dõi sĩ số và tiến độ hoàn thành bài tập của cả lớp.
* **Ngân hàng Form & Quản lý Bài tập (Lab Assignment):**
* **Trình thiết kế Form động (Dynamic Form Builder):** Giảng viên tự kéo-thả để tạo các trường nhập liệu riêng cho từng bài lab (ví dụ: Trường nhập text cho *Mã băm MD5/SHA256*, trường chọn *Loại mã độc*, trường nhập vùng code cho *Đoạn mã ASM/Script*, trường tải ảnh cho *Ảnh chụp màn hình Wireshark*...).
* Lưu các form tiêu chuẩn này vào "Ngân hàng bài lab" để tái sử dụng cho các học kỳ sau (Clone bài tập).


* **Cấu hình Thời hạn & Chính sách nộp bài:**
* Cấu hình Thời hạn nộp bài (Deadline).
* Cấu hình chính sách nộp muộn (Late Submission): Cho phép nộp muộn hay không, tự động trừ bao nhiêu % điểm dựa trên số giờ/ngày nộp muộn.
* **Gia hạn cá nhân (Exception):** Cho phép giảng viên gia hạn thêm thời gian làm bài riêng cho một hoặc một nhóm sinh viên gặp sự cố (bệnh tật, lỗi hạ tầng lab...) mà không ảnh hưởng đến cả lớp.


* **Giao diện chấm bài thông minh (Speed Grader):**
* Màn hình chấm bài chia đôi tiện lợi: Bên trái hiển thị form câu trả lời, xem trực tiếp ảnh chụp màn hình/file log; Bên phải là ô nhập điểm, mã phạt muộn (nếu có) và ô nhập nhận xét chi tiết.
* Nút chuyển nhanh "Lưu và sang sinh viên tiếp theo" để tối ưu thời gian chấm bài.
* Cho phép giảng viên yêu cầu sinh viên "Làm lại bài" (Re-submit) nếu bài nộp chưa đạt yêu cầu.


* **Xuất báo cáo và Dữ liệu:**
* **Xuất bảng điểm:** Xuất kết quả điểm số của lớp ra file Excel/CSV theo form chuẩn của phòng đào tạo (Mã SV, Họ tên, Điểm, Điểm phạt muộn, Nhận xét).
* **Tải bài nộp hàng loạt (Bulk Download):** Cho phép tải về toàn bộ file báo cáo hoặc file đính kèm của cả lớp gom trong 1 file `.zip` duy nhất để lưu trữ minh chứng đào tạo.



### 3. Phân hệ Sinh viên (Student Dashboard)

* **Bảng điều khiển tổng quan (Student Dashboard):** Theo dõi danh sách bài lab cần làm, bài lab sắp đến hạn (đếm ngược thời gian), và danh sách bài đã có điểm kèm lời nhận xét của thầy cô.
* **Làm bài và Điền báo cáo:**
* Giao diện điền báo cáo theo đúng Form động mà giảng viên đã thiết kế cho bài lab đó.
* **Trình soạn thảo hỗ trợ Code Block:** Cho phép sinh viên dán các đoạn mã assembly, log chuỗi hex, chuỗi hành vi mạng... định dạng rõ ràng, dễ nhìn.
* Tải lên ảnh chụp màn hình (PNG, JPG) và các file đính kèm phục vụ minh chứng (PDF, log file, pcap...).
* **Tính năng lưu nháp tự động (Auto-save):** Tự động lưu bài làm của sinh viên sau mỗi 30 giây vào bộ nhớ trình duyệt (LocalStorage) để tránh mất dữ liệu khi máy ảo lab bị crash hoặc mất kết nối giữa chừng.


* **Lịch sử và Minh chứng:** Xem lại nội dung và các file mình đã nộp, thời gian nộp chính xác để làm minh chứng khi cần đối chiếu.

### 4. Chức năng Hệ thống và Thông báo tự động

* **Hệ thống gửi Email tự động (Email Notification):**
* *Gửi cho Sinh viên:* Gửi mail xác nhận ngay khi sinh viên bấm nộp bài thành công (đính kèm mã giao dịch/thời gian nộp); Gửi mail thông báo ngay khi bài làm được giảng viên chấm điểm và nhận xét.
* *Gửi cho Giảng viên:* Gửi mail nhắc nhở khi sắp hết hạn bài lab mà tỉ lệ nộp bài của lớp còn thấp; Gửi mail tổng hợp (Digest) số lượng bài nộp mới vào cuối ngày.


* **Hệ thống Cảnh báo Sao chép bài (Plagiarism Detection):** Tự động so sánh các trường dữ liệu mang tính đặc trưng duy nhất (ví dụ: Các mã băm MD5/SHA256 của file log cá nhân, hoặc các chuỗi text phân tích hành vi dài). Nếu phát hiện trùng lặp hoàn toàn giữa 2 sinh viên khác nhau, hệ thống sẽ tự động gắn cờ cảnh báo (Flag) trên giao diện của giảng viên để kiểm tra gian lận.

---

## PHẦN II: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

Để ứng dụng vận hành ổn định trong môi trường phân tích mã độc và không trở thành một "lỗ hổng" an ninh mạng, các yêu cầu phi chức năng sau cần được tuân thủ tuyệt đối:

### 1. Tính bảo mật và An toàn thông tin (Security) — *Ưu tiên tối cao*

* **Mã hóa đường truyền:** Toàn bộ dữ liệu truyền tải giữa người dùng và Web App phải được mã hóa qua **HTTPS (TLS 1.3)**.
* **An toàn cổng nộp file (Airlock Security):**
* **Bộ lọc định dạng nghiêm ngặt:** Hệ thống *tuyệt đối cấm* tải lên trực tiếp các file có nguy cơ thực thi nguy hiểm (`.exe`, `.bat`, `.sh`, `.elf`, `.msi`, `.scr`...).
* Nếu giảng viên yêu cầu nộp file log hoặc mã nguồn cấu hình, hệ thống buộc sinh viên phải nén thành file `.zip` có đặt mật khẩu mặc định (ví dụ: `infected` theo quy ước quốc tế) để tránh trình duyệt của giảng viên tự động kích hoạt file khi tải về.
* **Quét mã độc tự động (Antivirus Gateway):** Tích hợp ClamAV API hoặc Yara rules để quét toàn bộ file đính kèm ngay khi tải lên, đảm bảo sinh viên không vô tình hoặc cố ý đẩy ngược mã độc "sống" từ VLAN Lab lên máy chủ Web App.
* **Xử lý ảnh an toàn (Safe Image Sanitization):** Loại bỏ toàn bộ Metadata (Exif data) của các file ảnh chụp màn hình do sinh viên tải lên nhằm phòng chống các lỗ hổng khai thác qua thư viện xử lý ảnh của trình duyệt (ví dụ: lỗi thực thi mã độc ẩn trong file ảnh - Steganography).


* **Phòng chống lỗ hổng Web:** Cam kết chặn hoàn toàn các lỗ hổng theo tiêu chuẩn **OWASP Top 10** (SQL Injection tại các trường điền form, Cross-Site Scripting (XSS) khi giảng viên xem chuỗi mã độc sinh viên dán vào báo cáo, Broken Object Level Authorization để sinh viên không xem được bài của nhau bằng cách sửa ID trên URL).

### 2. Kiến trúc và Tích hợp mạng (Deployment & Network Integration)

* **Mô hình triển khai:** Web App nên được đóng gói dưới dạng Docker Container chạy trên Server 2 (hoặc một VM riêng biệt).
* **Cấu hình Network Interface (Dual-Homed):** Máy chủ Web App cần cấu hình 2 chân mạng:
* *Chân 1 kết nối VLAN 30 (Analysis) hoặc VLAN 20 (Guacamole):* Chỉ mở cổng API cần thiết (ví dụ: port 443) để máy của sinh viên có thể truy cập nộp bài từ trong môi trường lab cô lập.
* *Chân 2 kết nối VLAN 50 (Storage):* Để lưu trữ trực tiếp toàn bộ hình ảnh, file báo cáo nặng của sinh viên vào đúng dataset quy hoạch trên NAS (ví dụ: `pool/student-work`).


* **Ghi nhận IP mạng nội bộ:** Hệ thống cần ghi lại IP kết nối của sinh viên để xác định sinh viên đang nộp bài từ máy ảo bên trong Lab (VLAN 30) hay truy cập từ ngoài (nếu có mở cổng VPN/Public).

### 3. Hiệu năng và Khả năng mở rộng (Performance & Scalability)

* **Khả năng chịu tải đồng thời (Concurrency):** Hệ thống phải đáp ứng tốt từ **50 – 100 người dùng hoạt động đồng thời** mà không bị nghẽn (đáp ứng kịch bản 1-2 lớp lab cùng nộp bài dồn dập vào 15 phút cuối giờ trước khi khóa deadline).
* **Tối ưu hóa tài nguyên mạng:** Do lượng ảnh chụp màn hình sinh viên gửi lên rất lớn, hệ thống cần tích hợp thư viện tự động tối ưu hóa/nén dung lượng ảnh (Client-side compression) trước khi đẩy lên Server để tiết kiệm băng thông và dung lượng lưu trữ trên NAS.

### 4. Tính khả dụng và Trải nghiệm người dùng (Usability)

* **Thiết kế đáp ứng (Responsive Design):** Sinh viên làm bài chủ yếu trên máy tính (giao diện web trên máy ảo), nhưng giảng viên có thể linh hoạt chấm bài, xem báo cáo mượt mà trên cả Máy tính bảng (Tablet) hoặc Máy tính cá nhân ở nhà.
* **Giao diện trực quan:** Form điền của sinh viên và màn hình chấm điểm của giảng viên phải có hướng dẫn rõ ràng, hạn chế tối đa việc phải click chuyển trang nhiều lần (Single Page Application - SPA).

---

### Đề xuất lựa chọn Công nghệ (Tech Stack) khuyến nghị:

* **Backend:** **Python (FastAPI hoặc Django)**. *Lý do:* Python rất mạnh về xử lý file, xử lý chuỗi (rất cần để check log mã độc) và dễ dàng tích hợp các thư viện an toàn thông tin (như quét ClamAV, kiểm tra mã băm, phân tích file định dạng).
* **Frontend:** **ReactJS hoặc VueJS** kết hợp với **TailwindCSS**. Thích hợp nhất để xây dựng tính năng "Trình thiết kế form động" cho giảng viên và tính năng tự động lưu nháp (Auto-save) cho sinh viên.
* **Cơ sở dữ liệu:** **PostgreSQL** (Có thể deploy thành container riêng bên cạnh database của Apache Guacamole để dễ quản lý).