import time
import threading
from collections import defaultdict
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, AuditLog
from app.schemas import Token, LoginSchema, UserOut, PasswordChange, ProfileUpdate
from app.security import verify_password, create_access_token, get_current_user, get_password_hash
from app.request_utils import get_client_ip
from app.logging_config import logger


class LoginRateLimiter:
    """Sliding window rate limiter that protects against brute-force while preventing collateral lockout on shared IPs."""
    def __init__(self, max_user_ip_attempts: int = 10, max_global_ip_attempts: int = 50, window_seconds: int = 300):
        self.max_user_ip_attempts = max_user_ip_attempts
        self.max_global_ip_attempts = max_global_ip_attempts
        self.window_seconds = window_seconds
        self._user_ip_failures = defaultdict(list)
        self._global_ip_failures = defaultdict(list)
        self._lock = threading.Lock()

    def _cleanup(self, timestamps: list, now: float) -> list:
        cutoff = now - self.window_seconds
        return [ts for ts in timestamps if ts > cutoff]

    def is_rate_limited(self, ip: str, username: str) -> bool:
        now = time.time()
        with self._lock:
            user_key = username.lower().strip() if username else ""
            pair_key = f"{ip}:{user_key}"

            # Clean up history
            self._global_ip_failures[ip] = self._cleanup(self._global_ip_failures[ip], now)
            if user_key:
                self._user_ip_failures[pair_key] = self._cleanup(self._user_ip_failures[pair_key], now)

            # 1. Check if specific account from this IP exceeded limit (10 failed tries)
            if user_key and len(self._user_ip_failures[pair_key]) >= self.max_user_ip_attempts:
                return True

            # 2. Check if IP is conducting mass credential stuffing across many accounts (50 failed tries)
            if len(self._global_ip_failures[ip]) >= self.max_global_ip_attempts:
                return True

            return False

    def record_failure(self, ip: str, username: str):
        now = time.time()
        with self._lock:
            user_key = username.lower().strip() if username else ""
            pair_key = f"{ip}:{user_key}"
            self._global_ip_failures[ip].append(now)
            if user_key:
                self._user_ip_failures[pair_key].append(now)

    def reset_on_success(self, ip: str, username: str):
        with self._lock:
            user_key = username.lower().strip() if username else ""
            pair_key = f"{ip}:{user_key}"
            if user_key:
                self._user_ip_failures.pop(pair_key, None)


login_limiter = LoginRateLimiter(max_user_ip_attempts=10, max_global_ip_attempts=50, window_seconds=300)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(login_data: LoginSchema, request: Request, db: Session = Depends(get_db)):
    """API Đăng nhập hệ thống, trả về access token (có chống dò quét mật khẩu)"""
    cleaned_username = login_data.username.strip() if login_data.username else ""
    client_ip = get_client_ip(request)

    if login_limiter.is_rate_limited(client_ip, cleaned_username):
        logger.warning(f"[SECURITY] [RATE_LIMITED] Quá nhiều lần đăng nhập thất bại: Username='{cleaned_username}' | IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau 5 phút để đảm bảo an toàn.",
            headers={"Retry-After": "300"}
        )

    user = db.query(User).filter(User.username.ilike(cleaned_username)).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        login_limiter.record_failure(client_ip, cleaned_username)
        logger.warning(f"[SECURITY] Đăng nhập THẤT BẠI: Username='{cleaned_username}' | IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        login_limiter.record_failure(client_ip, cleaned_username)
        logger.warning(f"[SECURITY] Đăng nhập vào tài khoản ĐÃ BỊ KHÓA: Username='{cleaned_username}' | IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị khóa"
        )
    
    # Đăng nhập thành công -> Xóa bộ đếm lỗi
    login_limiter.reset_on_success(client_ip, cleaned_username)
    
    # Ghi lại Audit Log
    log = AuditLog(
        user_id=user.id,
        action="login",
        target=f"User {user.username} đăng nhập thành công",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    # Cấp access token
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email
    }

# Endpoint hỗ trợ OAuth2 Swagger UI login
@router.post("/swagger-login")
def swagger_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    cleaned_username = form_data.username.strip() if form_data.username else ""
    user = db.query(User).filter(User.username.ilike(cleaned_username)).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác"
        )
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """API Lấy thông tin tài khoản hiện tại"""
    return current_user

@router.put("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """API Cập nhật thông tin cá nhân (Họ tên, Email) cho người dùng hiện tại"""
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.email is not None:
        current_user.email = payload.email.strip() or None
    
    db.commit()
    db.refresh(current_user)

    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="update_profile",
        target=f"Người dùng {current_user.username} cập nhật thông tin cá nhân",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return current_user


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """API Đổi mật khẩu cá nhân cho người dùng đang đăng nhập"""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác"
        )
    
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới phải có ít nhất 6 ký tự"
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()

    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="change_password",
        target=f"Người dùng {current_user.username} tự thay đổi mật khẩu",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return {"message": "Đổi mật khẩu thành công!"}

