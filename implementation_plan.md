# KẾ HOẠCH TRIỂN KHAI: WEB APP LMS QUẢN LÝ VÀ NỘP BÁO CÁO LAB MALWARE

Dự án này tập trung vào việc xây dựng một Web App LMS hoàn chỉnh chuyên dụng cho giảng viên và sinh viên thực hành Phân tích mã độc (Malware Analysis). 
Theo yêu cầu mới nhất, chúng ta sẽ **tập trung phát triển Web App hoàn chỉnh và chạy trơn tru thông qua Docker Compose trước**, các vấn đề kết nối mạng vật lý phức tạp (VLAN) và lưu trữ gắn ngoài (NAS) sẽ được cấu hình đấu nối sau.

---

## 1. Kiến trúc Hệ thống đề xuất (Dockerized Stack)

Để chạy độc lập và dễ dàng di trú lên Server Lab sau này, hệ thống sẽ được đóng gói toàn bộ thành một cụm **Docker Compose** gồm 3 dịch vụ chính:

1. **`db` (PostgreSQL 16):** Hệ quản trị cơ sở dữ liệu quan hệ lưu trữ thông tin người dùng, lớp học, bài lab, form động, các bản nộp bài (submission) và bản nháp (auto-save).
2. **`backend` (Python FastAPI):** API RESTful tốc độ cao, xử lý nghiệp vụ, xác thực JWT, giải nén và quét file zip an toàn, làm sạch ảnh (Image Sanitization), và so khớp chống đạo văn.
3. **`frontend` (React + Vite):** Giao diện SPA (Single Page Application) hiện đại, phản hồi nhanh, sử dụng phong cách thiết kế **Deep Space Cyberpunk** (Dark Mode chuyên nghiệp cho an ninh mạng). Sử dụng cơ chế Multi-stage Build để build mã nguồn tĩnh và phục vụ bằng **Nginx**.

```
                           +-----------------------------------+
                           |        Trình duyệt Client         |
                           +-----------------------------------+
                                             |
                                             | HTTPS / API (Port 80/443)
                                             v
                           +-----------------------------------+
                           |     Docker Compose Network        |
                           |                                   |
                           |   +---------------------------+   |
                           |   |      frontend (Nginx)     |   |
                           |   +---------------------------+   |
                           |                 |                 |
                           |                 v                 |
                           |   +---------------------------+   |
                           |   |     backend (FastAPI)     |   |
                           |   +---------------------------+   |
                           |                 |                 |
                           |                 v                 |
                           |   +---------------------------+   |
                           |   |      db (PostgreSQL)      |   |
                           |   +---------------------------+   |
                           +-----------------------------------+
```

---

## 2. Giao diện & Trải nghiệm Người dùng (Design System)

Giao diện sẽ được thiết kế theo phong cách **Deep Space & Neon Cyberpunk** cực kỳ cuốn hút và trực quan:
* **Màu sắc chủ đạo:** Dark Slate `#0b0f19` làm nền, Slate Blue `#1e293b` cho thẻ/bảng điều khiển, xanh neon `#00f2fe` và `#4facfe` cho các thành phần hoạt động, và đỏ ruby `#ff0844` cho các cảnh báo nguy hiểm hoặc mã độc.
* **Font chữ:** Sử dụng font `Outfit` hoặc `Inter` từ Google Fonts.
* **Hiệu ứng:** Bo góc mượt mà, viền mờ (glassmorphism), hover chuyển màu nhẹ nhàng và micro-animations.

---

## 3. Các Phân hệ & Tính năng chi tiết

### A. Phân hệ Xác thực & Phân quyền (Auth & RBAC)
* Sử dụng xác thực bằng **JWT Token** (lưu ở HTTP-only Cookie hoặc LocalStorage).
* Thiết kế module Authentication dạng trừu tượng để dễ dàng cấu hình chuyển sang **Keycloak SSO** sau này bằng cấu hình biến môi trường (`USE_KEYCLOAK=true`).
* 3 Vai trò: **Admin** (Quản trị), **Giảng viên** (Instructor), **Sinh viên** (Student).

### B. Phân hệ Quản trị (Admin Dashboard)
* Quản lý tài khoản (Thêm, sửa, khóa, xóa).
* Nhập danh sách sinh viên hàng loạt bằng việc upload file Excel/CSV.
* Tạo lớp học phần và gán sinh viên vào lớp.
* Nhật ký hoạt động hệ thống (Audit Log).

### C. Phân hệ Giảng viên (Instructor Dashboard)
* **Trình thiết kế Form động (Dynamic Form Builder):** Cho phép giảng viên tạo câu hỏi báo cáo cho từng bài lab bằng giao diện trực quan. Các loại trường hỗ trợ:
  * Text (Mã băm MD5/SHA256, địa chỉ IP...).
  * Textarea với hỗ trợ dán Code Block (mã Assembly, cấu hình script, JSON...).
  * Select/Dropdown (Phân loại mã độc, mức độ nguy hiểm...).
  * File Upload (Ảnh chụp Wireshark, file PCAP, file log...).
* **Giao diện chấm bài thông minh (Speed Grader):**
  * Thiết kế chia đôi màn hình. Bên trái hiển thị câu trả lời và xem trực tiếp ảnh chụp/file log (Inline Rendering). Bên phải là bảng chấm điểm, áp phạt muộn và nhận xét.
  * Nút "Lưu & Sang sinh viên tiếp theo" nhanh chóng.
  * Xuất bảng điểm lớp ra file Excel/CSV.
  * Tải hàng loạt toàn bộ bài nộp của lớp dưới dạng file `.zip`.

### D. Phân hệ Sinh viên (Student Dashboard)
* Xem danh sách bài tập đang mở, sắp đến hạn (với đồng hồ đếm ngược) và bài tập đã chấm.
* Điền báo cáo theo đúng cấu trúc Form động được cấu hình cho bài Lab đó.
* Trình soạn thảo hỗ trợ hiển thị Code Block rõ ràng đối với mã độc.
* **Auto-save phía Server:** Tự động gửi API lưu nháp trạng thái bài làm sau mỗi 30 giây để chống mất dữ liệu khi máy ảo lab bị rollback.
* Xem lịch sử nộp bài và nhận xét từ giảng viên.

### E. Module An toàn thông tin & Xử lý File (Airlock Security)
* Chỉ cho phép tải lên các định dạng file báo cáo an toàn (ảnh `.png`, `.jpg`, file text `.log`, `.txt`, `.pcap`, `.pdf`).
* Cấm tuyệt đối các file thực thi nguy hiểm (`.exe`, `.elf`, `.bat`, `.sh`...).
* Tự động giải nén và quét file cấu hình nén `.zip` bằng mật khẩu mặc định `infected` trên Backend để phòng chống lây lan malware.
* Làm sạch ảnh (Sanitize Image): Backend sử dụng Python Pillow để tái dựng hình ảnh mới, loại bỏ hoàn toàn mã độc ẩn Steganography và Exif metadata trước khi ghi đĩa.

---

## 4. Cấu trúc Thư mục Dự án

```
d:/Code/MalSec/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── security.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── classes.py
│       │   ├── labs.py
│       │   ├── submissions.py
│       │   └── admin.py
│       └── services/
│           ├── file_service.py
│           └── plagiarism.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── components/
        ├── pages/
        ├── context/
        └── utils/
```

---

## 5. Kế hoạch triển khai & Kiểm thử (Verification Plan)

### Bước 1: Xây dựng Cơ sở dữ liệu và Backend (FastAPI)
* Thiết lập cấu trúc cơ sở dữ liệu trong `models.py` sử dụng SQLAlchemy. Hỗ trợ trường `JSONB` cho cấu trúc câu hỏi động và câu trả lời.
* Triển khai các API endpoint xác thực, quản lý người dùng, lớp học, bài lab.
* Triển khai module xử lý file an toàn và giải nén zip.

### Bước 2: Xây dựng Frontend (React + Vite + CSS)
* Tạo khung ứng dụng SPA với định tuyến React Router.
* Xây dựng giao diện CSS Deep Space Cyberpunk sang trọng.
* Phát triển các màn hình Dashboard tương ứng với 3 Role.
* Phát triển module Kéo-thả Form động và Speed Grader.

### Bước 3: Đóng gói Docker Compose
* Viết cấu hình `Dockerfile` tối ưu hóa cho Backend và Frontend.
* Viết `docker-compose.yml` liên kết 3 dịch vụ và khởi tạo dữ liệu mẫu (Seeding Data: tài khoản Admin, Giảng viên, Sinh viên và bài Lab mẫu để chạy thử ngay lập tức).

### Bước 4: Kiểm thử Tích hợp
* Khởi động cụm Docker Compose: `docker compose up --build -d`
* Kiểm tra việc tạo tài khoản, tạo bài lab bằng Form động.
* Đăng nhập tài khoản sinh viên, thực hiện làm bài, nộp ảnh, nộp file zip mật khẩu `infected`, kiểm tra tính năng Auto-save.
* Đăng nhập tài khoản giảng viên để chấm điểm bằng Speed Grader và xuất Excel.

---

## 6. Câu hỏi làm rõ & Xác nhận từ phía bạn

> [!IMPORTANT]
> 1. **Phương án đóng gói Frontend & Backend:** Bạn có đồng ý với việc chúng ta phát triển đồng bộ cả Frontend và Backend để tạo nên một hệ thống hoàn chỉnh chạy qua **Docker Compose** hay không?
> 2. **Dữ liệu mẫu (Data Seeding):** Bạn có muốn tôi tạo sẵn một số tài khoản mẫu (Admin, 1 Giảng viên, 2 Sinh viên) và 1 bài Lab mẫu cấu hình sẵn để bạn có thể đăng nhập trải nghiệm giao diện và tính năng ngay lập tức khi khởi động Docker?

---

*Vui lòng xem xét bản kế hoạch trên. Nếu bạn đồng ý, hãy phản hồi để tôi bắt đầu tạo danh sách công việc `task.md` và tiến hành viết mã nguồn!*
