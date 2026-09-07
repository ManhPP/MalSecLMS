from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Class, AuditLog
from app.schemas import UserOut, UserCreate, UserUpdate
from app.security import require_admin, require_lecturer, get_current_user, get_password_hash
from app.request_utils import get_client_ip

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", response_model=List[UserOut])
def get_users(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_lecturer)
):
    """API Lấy danh sách tài khoản (Admin lấy tất cả, Giảng viên chỉ lấy Sinh viên)"""
    if current_user.role == "lecturer":
        return db.query(User).filter(User.role == "student").order_by(User.id.desc()).all()
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
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """Create a new user account (Admin only)"""
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        password_hash=hashed_password,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=user_data.is_active,
        email=user_data.email
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="create_user",
        target=f"Created user: {new_user.username} (Role: {new_user.role})",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return new_user

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_lecturer)
):
    """Update user account information"""
    if current_user.role == "lecturer":
        student = db.query(User).filter(User.id == user_id, User.role == "student").first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        belongs = db.query(Class).filter(
            Class.users.any(id=current_user.id),
            Class.users.any(id=student.id)
        ).first()
        if not belongs:
            raise HTTPException(status_code=403, detail="You do not manage the class of this student")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if current_user.role == "admin" and user_data.role is not None:
        user.role = user_data.role
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password is not None and user_data.password != "":
        user.password_hash = get_password_hash(user_data.password)
        
    db.commit()
    db.refresh(user)
    
    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="update_user",
        target=f"Updated user: {user.username}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return user

@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """Delete user account (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
        
    db.delete(user)
    db.commit()
    
    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="delete_user",
        target=f"Deleted user: {user.username}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return {"message": "User deleted successfully"}
