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

    def check_rate_limit(self, ip: str, username: str) -> tuple[bool, str]:
        now = time.time()
        with self._lock:
            user_key = username.lower().strip() if username else ""
            pair_key = f"{ip}:{user_key}"

            # Dọn dẹp các mốc thời gian ngoài cửa sổ trượt
            self._global_ip_failures[ip] = self._cleanup(self._global_ip_failures[ip], now)
            if user_key:
                self._user_ip_failures[pair_key] = self._cleanup(self._user_ip_failures[pair_key], now)

            # 1. Check account rate limit from this IP
            if user_key and len(self._user_ip_failures[pair_key]) >= self.max_user_ip_attempts:
                count = len(self._user_ip_failures[pair_key])
                return True, f"Account '{user_key}' exceeded {count}/{self.max_user_ip_attempts} failed attempts from IP {ip}"

            # 2. Check global IP rate limit (DDoS / Credential Stuffing)
            if len(self._global_ip_failures[ip]) >= self.max_global_ip_attempts:
                count = len(self._global_ip_failures[ip])
                return True, f"IP {ip} exceeded {count}/{self.max_global_ip_attempts} failed attempts across accounts"

            return False, ""

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
    """User authentication endpoint returning JWT access token with diagnostic logging."""
    cleaned_username = login_data.username.strip() if login_data.username else ""
    client_ip = get_client_ip(request)

    # 1. Rate Limiting Check
    is_limited, limit_reason = login_limiter.check_rate_limit(client_ip, cleaned_username)
    if is_limited:
        logger.warning(
            f"[SECURITY] [RATE_LIMITED] Login blocked: Username='{cleaned_username}' | IP: {client_ip} | Reason: {limit_reason}"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts ({limit_reason}). Please try again in 5 minutes.",
            headers={"Retry-After": "300"}
        )

    # 2. Find user in database
    user = db.query(User).filter(User.username.ilike(cleaned_username)).first()
    if not user:
        login_limiter.record_failure(client_ip, cleaned_username)
        logger.warning(
            f"[AUTH_FAILED] Reason: USER_NOT_FOUND | Username='{cleaned_username}' | IP: {client_ip}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Verify password
    if not verify_password(login_data.password, user.password_hash):
        login_limiter.record_failure(client_ip, cleaned_username)
        logger.warning(
            f"[AUTH_FAILED] Reason: WRONG_PASSWORD | Username='{cleaned_username}' (UserID: {user.id}, Role: {user.role}) | IP: {client_ip}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Check active status
    if not user.is_active:
        login_limiter.record_failure(client_ip, cleaned_username)
        logger.warning(
            f"[AUTH_FAILED] Reason: ACCOUNT_INACTIVE | Username='{cleaned_username}' (UserID: {user.id}) | IP: {client_ip}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is disabled"
        )
    
    # Successful login -> Reset failures
    login_limiter.reset_on_success(client_ip, cleaned_username)
    logger.info(
        f"[AUTH_SUCCESS] Login SUCCESS: User '{user.username}' (UserID: {user.id}, Role: {user.role}) | IP: {client_ip}"
    )
    
    # Audit log entry
    log = AuditLog(
        user_id=user.id,
        action="login",
        target=f"User {user.username} logged in successfully",
        ip_address=client_ip
    )
    db.add(log)
    db.commit()

    # Issue JWT token
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

# Swagger UI OAuth2 login endpoint
@router.post("/swagger-login")
def swagger_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    cleaned_username = form_data.username.strip() if form_data.username else ""
    user = db.query(User).filter(User.username.ilike(cleaned_username)).first()
    if not user:
        logger.warning(f"[AUTH_FAILED] [SWAGGER] USER_NOT_FOUND: Username='{cleaned_username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    if not verify_password(form_data.password, user.password_hash):
        logger.warning(f"[AUTH_FAILED] [SWAGGER] WRONG_PASSWORD: Username='{cleaned_username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile"""
    return current_user

@router.put("/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update profile information for current user"""
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.email is not None:
        current_user.email = payload.email.strip() or None
    
    db.commit()
    db.refresh(current_user)

    log = AuditLog(
        user_id=current_user.id,
        action="update_profile",
        target=f"User {current_user.username} updated profile information",
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
    """Change personal password for authenticated user"""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()

    log = AuditLog(
        user_id=current_user.id,
        action="change_password",
        target=f"User {current_user.username} changed password",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return {"message": "Password changed successfully!"}

