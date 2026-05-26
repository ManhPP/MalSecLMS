from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, AuditLog
from app.schemas import UserOut, UserCreate, UserUpdate
from app.security import require_admin, get_current_user, get_password_hash

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", response_model=List[UserOut])
def get_users(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Lấy toàn bộ danh sách tài khoản (Chỉ Admin)"""
    return db.query(User).order_by(User.id.desc()).all()

@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Lấy chi tiết tài khoản (Chỉ Admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return user

@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Tạo tài khoản mới (Chỉ Admin)"""
    # Kiểm tra trùng lặp username
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")
        
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        password_hash=hashed_password,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=user_data.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="create_user",
        target=f"Tạo người dùng: {new_user.username} (Role: {new_user.role})",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return new_user

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, 
    user_data: UserUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Cập nhật thông tin tài khoản (Chỉ Admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password is not None and user_data.password != "":
        user.password_hash = get_password_hash(user_data.password)
        
    db.commit()
    db.refresh(user)
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="update_user",
        target=f"Cập nhật tài khoản: {user.username}",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return user

@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Xóa tài khoản (Chỉ Admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa tài khoản của chính mình")
        
    db.delete(user)
    db.commit()
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="delete_user",
        target=f"Xóa tài khoản: {user.username}",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return {"message": "Xóa người dùng thành công"}
