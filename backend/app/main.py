import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import User
from app.security import get_password_hash
from app.routers import auth, users, classes, labs, submissions, admin, configuration

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
    allow_origins=settings.CORS_ORIGINS,
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
app.include_router(configuration.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "MalSec LMS API đang hoạt động ổn định!"}

# --- DATA SEEDING (SỰ KIỆN KHỞI ĐỘNG HỆ THỐNG) ---
@app.on_event("startup")
def seed_data():
    db = SessionLocal()
    try:
        # Auto-migration: Đảm bảo cột template_vmid đã tồn tại trong CSDL PostgreSQL
        try:
            from sqlalchemy import text
            db.execute(text("ALTER TABLE labs ADD COLUMN IF NOT EXISTS template_vmid INTEGER;"))
            db.execute(
                text("UPDATE labs SET template_vmid = :value WHERE template_vmid IS NULL"),
                {"value": settings.DEFAULT_TEMPLATE_VMID},
            )
            db.execute(text("ALTER TABLE labs ALTER COLUMN template_vmid DROP DEFAULT;"))
            db.execute(text("ALTER TABLE labs ALTER COLUMN template_vmid SET NOT NULL;"))
            db.execute(text("ALTER TABLE labs ADD COLUMN IF NOT EXISTS vm_protocol VARCHAR;"))
            db.execute(
                text("UPDATE labs SET vm_protocol = :value WHERE vm_protocol IS NULL"),
                {"value": settings.DEFAULT_VM_PROTOCOL},
            )
            db.execute(text("ALTER TABLE labs ALTER COLUMN vm_protocol DROP DEFAULT;"))
            db.execute(text("ALTER TABLE labs ALTER COLUMN vm_protocol SET NOT NULL;"))
            db.execute(text("ALTER TABLE labs ADD COLUMN IF NOT EXISTS vm_port INTEGER;"))
            db.execute(
                text("UPDATE labs SET vm_port = :value WHERE vm_port IS NULL"),
                {"value": settings.DEFAULT_VM_PORT},
            )
            db.execute(text("ALTER TABLE labs ALTER COLUMN vm_port DROP DEFAULT;"))
            db.execute(text("ALTER TABLE labs ALTER COLUMN vm_port SET NOT NULL;"))
            db.execute(text("ALTER TABLE labs ADD COLUMN IF NOT EXISTS vm_username VARCHAR;"))
            db.execute(text("ALTER TABLE labs ADD COLUMN IF NOT EXISTS vm_password VARCHAR;"))
            db.execute(text("ALTER TABLE labs ALTER COLUMN vm_username DROP DEFAULT;"))
            db.execute(text("ALTER TABLE labs ALTER COLUMN vm_password DROP DEFAULT;"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Auto migration template_vmid: {e}")

        # Chỉ tạo duy nhất tài khoản admin trong database trống lần đầu.
        user_count = db.query(User).count()

        if user_count == 0:
            print("Đang khởi tạo tài khoản quản trị ban đầu...")
            admin_user = User(
                username=settings.INITIAL_ADMIN_USERNAME,
                password_hash=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                full_name=settings.INITIAL_ADMIN_FULL_NAME,
                role="admin",
                email=settings.INITIAL_ADMIN_EMAIL,
                is_active=True
            )
            db.add(admin_user)
            db.commit()

            print("Khởi tạo tài khoản admin hoàn tất!")
    except Exception as e:
        print(f"Lỗi xảy ra trong quá trình khởi tạo admin: {e}")
    finally:
        db.close()
