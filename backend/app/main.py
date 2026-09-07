import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import User
from app.security import get_password_hash
from app.routers import auth, users, classes, labs, submissions, admin, configuration
from app.logging_config import setup_logging, logger
from app.request_utils import get_client_ip, extract_user_from_request

# Khởi tạo hệ thống logging
setup_logging()

# Khởi tạo bảng CSDL (Tự động đồng bộ Schema)
# Thử kết nối nhiều lần phòng trường hợp Postgres Container khởi động chậm hơn FastAPI
for i in range(5):
    try:
        Base.metadata.create_all(bind=engine)
        break
    except Exception as e:
        logger.warning(f"Chưa kết nối được CSDL, đang thử lại lần {i+1}/5... Lỗi: {e}")
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


@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    client_ip = get_client_ip(request)
    user_str = extract_user_from_request(request)
    path = request.url.path
    method = request.method
    query = f"?{request.url.query}" if request.url.query else ""

    try:
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        status_code = response.status_code

        # Bỏ qua log spam endpoint healthcheck gốc nếu thành công
        if path == "/" and status_code == 200:
            return response

        log_msg = f"[API] {status_code} | {method} {path}{query} | User: {user_str} | IP: {client_ip} | {duration_ms:.1f}ms"
        if status_code >= 500:
            logger.error(log_msg)
        elif status_code >= 400:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        if duration_ms > 1500:
            logger.warning(
                f"[SLOW_REQUEST] {method} {path}{query} took {duration_ms:.1f}ms (>1500ms) | User: {user_str} | IP: {client_ip}"
            )

        return response
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            f"[EXCEPTION] 500 | {method} {path}{query} | User: {user_str} | IP: {client_ip} | {duration_ms:.1f}ms | Error: {exc}",
            exc_info=True
        )
        raise exc


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    client_ip = get_client_ip(request)
    user_str = extract_user_from_request(request)
    logger.error(
        f"[UNHANDLED] {request.method} {request.url.path} | User: {user_str} | IP: {client_ip} | {type(exc).__name__}: {exc}",
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Lỗi máy chủ nội bộ: {str(exc)}"}
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
