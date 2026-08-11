from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, AuditLog
from app.schemas import Token, LoginSchema, UserOut, PasswordChange, ProfileUpdate
from app.security import verify_password, create_access_token, get_current_user, get_password_hash
from app.request_utils import get_client_ip


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(login_data: LoginSchema, request: Request, db: Session = Depends(get_db)):
    """API Đăng nhập hệ thống, trả về access token"""
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị khóa"
        )
    
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
    user = db.query(User).filter(User.username == form_data.username).first()
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

