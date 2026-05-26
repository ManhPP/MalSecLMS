import time
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import User, Class, Lab, Submission
from app.security import get_password_hash
from app.routers import auth, users, classes, labs, submissions, admin

# Khởi tạo bảng CSDL (Tự động đồng bộ Schema)
# Thử kết nối nhiều lần phòng trường hợp Postgres Container khởi động chậm hơn FastAPI
for i in range(5):
    try:
        Base.metadata.create_all(bind=engine)
        break
    except Exception as e:
        print(f"Chưa kết nối được CSDL, đang thử lại lần {i+1}/5... Lỗi: {e}")
        time.sleep(3)

app = FastAPI(
    title="MalSec LMS API",
    description="Hệ thống quản lý học tập nộp bài và chấm điểm Lab phân tích mã độc",
    version="1.0.0"
)

# Cấu hình CORS để cho phép Frontend React giao tiếp API mượt mà
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép tất cả trong môi trường phát triển
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn các API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(classes.router, prefix="/api")
app.include_router(labs.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "MalSec LMS API đang hoạt động ổn định!"}

# --- DATA SEEDING (SỰ KIỆN KHỞI ĐỘNG HỆ THỐNG) ---
@app.on_event("startup")
def seed_data():
    db = SessionLocal()
    try:
        # Kiểm tra xem đã có người dùng nào chưa, nếu chưa thì seed dữ liệu mẫu
        user_count = db.query(User).count()
        if user_count == 0:
            print("Đang khởi tạo dữ liệu mẫu (Seeding Data)...")

            # 1. Tạo các tài khoản mẫu
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin123"),
                full_name="Quản trị viên Hệ thống",
                role="admin",
                is_active=True
            )
            
            lecturer_user = User(
                username="lecturer",
                password_hash=get_password_hash("lecturer123"),
                full_name="TS. Nguyễn Văn A (Giảng viên)",
                role="lecturer",
                is_active=True
            )
            
            student1 = User(
                username="sv01",
                password_hash=get_password_hash("student123"),
                full_name="Trần Văn Minh (Sinh viên 01)",
                role="student",
                is_active=True
            )
            
            student2 = User(
                username="sv02",
                password_hash=get_password_hash("student123"),
                full_name="Lê Thị Mai (Sinh viên 02)",
                role="student",
                is_active=True
            )

            db.add_all([admin_user, lecturer_user, student1, student2])
            db.commit()

            # 2. Tạo lớp học phần mẫu
            class_at16 = Class(
                name="AT16-Malware",
                description="Lớp An toàn Thông tin khóa 16 - Học phần Kỹ thuật Phân tích Mã độc"
            )
            db.add(class_at16)
            db.commit()
            db.refresh(class_at16)

            # Gán sinh viên vào lớp
            class_at16.users.append(student1)
            class_at16.users.append(student2)
            db.commit()

            # 3. Tạo bài Lab mẫu kèm Thiết kế Form động hoàn chỉnh
            sample_form_fields = [
                {
                    "id": "q_md5",
                    "type": "text",
                    "label": "Mã băm MD5 & SHA256 của mẫu độc hại",
                    "required": True
                },
                {
                    "id": "q_type",
                    "type": "select",
                    "label": "Phân loại hành vi mã độc",
                    "options": ["Ransomware (Mã hóa)", "Trojan/Spyware (Gián điệp)", "Worm (Lây nhiễm mạng)", "Rootkit (Ẩn mình)"],
                    "required": True
                },
                {
                    "id": "q_assembly",
                    "type": "textarea",
                    "label": "Phân tích đoạn mã Assembly chính kiểm tra VM (Anti-VM)",
                    "required": True
                },
                {
                    "id": "q_screenshot",
                    "type": "file",
                    "label": "Ảnh chụp màn hình Wireshark ghi nhận IP C2 Callback",
                    "required": True
                },
                {
                    "id": "q_pcaps",
                    "type": "file",
                    "label": "Tải lên tệp log mạng hoặc pcap nén mật khẩu 'infected'",
                    "required": False
                }
            ]

            sample_lab = Lab(
                title="Lab 01: Phân tích Tĩnh Ransomware WannaCry",
                description="Thực hành phân tích mẫu WannaCry trong môi trường FLARE-VM cô lập. Yêu cầu sinh viên tìm ra Entry Point, hàm Anti-VM, mã băm MD5, phân tích Wireshark và nộp báo cáo chi tiết.",
                form_fields=sample_form_fields,
                deadline=datetime.utcnow() + timedelta(days=7),
                late_policy={
                    "allow_late": True,
                    "penalty_per_hour_percent": 0.5, # Phạt 0.5% mỗi giờ nộp muộn
                    "max_penalty_percent": 30.0     # Phạt tối đa 30% điểm
                },
                individual_extensions={},
                is_active=True,
                class_id=class_at16.id,
                created_by_id=lecturer_user.id
            )
            db.add(sample_lab)
            db.commit()

            print("Khởi tạo dữ liệu mẫu hoàn tất thành công!")
    except Exception as e:
        print(f"Lỗi xảy ra trong quá trình seed dữ liệu mẫu: {e}")
    finally:
        db.close()
