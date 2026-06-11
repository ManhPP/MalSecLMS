from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models import Lab, User, Class, AuditLog
from app.schemas import LabOut, LabCreate, LabUpdate
from app.security import require_lecturer, require_student, get_current_user, require_any_user

router = APIRouter(prefix="/labs", tags=["Labs"])

@router.get("/", response_model=List[LabOut])
def get_all_labs(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_lecturer)
):
    """API Lấy toàn bộ danh sách bài lab (Giảng viên/Admin)"""
    if current_user.role == "lecturer":
        class_ids = [c.id for c in current_user.classes]
        return db.query(Lab).filter(Lab.class_id.in_(class_ids)).order_by(Lab.id.desc()).all()
    return db.query(Lab).order_by(Lab.id.desc()).all()

@router.get("/class/{class_id}", response_model=List[LabOut])
def get_labs_by_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """API Lấy danh sách bài lab theo lớp học phần"""
    if current_user.role == "student":
        belongs = db.query(Class).filter(
            Class.id == class_id, 
            Class.users.any(id=current_user.id)
        ).first()
        if not belongs:
            raise HTTPException(status_code=403, detail="Bạn không thuộc lớp học phần này")
        return db.query(Lab).filter(Lab.class_id == class_id, Lab.is_active == True).order_by(Lab.id.desc()).all()
    elif current_user.role == "lecturer":
        belongs = db.query(Class).filter(
            Class.id == class_id,
            Class.users.any(id=current_user.id)
        ).first()
        if not belongs:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần này")
        return db.query(Lab).filter(Lab.class_id == class_id).order_by(Lab.id.desc()).all()
    else: # admin
        return db.query(Lab).filter(Lab.class_id == class_id).order_by(Lab.id.desc()).all()

@router.get("/student/active", response_model=List[LabOut])
def get_active_student_labs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """API Lấy danh sách toàn bộ các bài lab đang hoạt động cho tất cả lớp của Sinh viên hiện tại"""
    class_ids = [c.id for c in current_user.classes]
    if not class_ids:
        return []
    return db.query(Lab).filter(
        Lab.class_id.in_(class_ids), 
        Lab.is_active == True
    ).order_by(Lab.deadline.asc()).all()

@router.get("/{lab_id}", response_model=LabOut)
def get_lab_detail(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """API Lấy thông tin chi tiết bài lab (bao gồm cấu trúc Form câu hỏi)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    # Nếu sinh viên xem, kiểm tra quyền lớp học
    if current_user.role == "student":
        belongs = db.query(Class).filter(
            Class.id == lab.class_id, 
            Class.users.any(id=current_user.id)
        ).first()
        if not belongs:
            raise HTTPException(status_code=403, detail="Bạn không thuộc lớp học phần chứa bài lab này")
            
    return lab

@router.post("/", response_model=LabOut, status_code=status.HTTP_201_CREATED)
def create_lab(
    lab_data: LabCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Tạo bài tập Lab mới kèm thiết kế Form câu hỏi động (Giảng viên/Admin)"""
    # Đảm bảo lớp học phần tồn tại
    class_exists = db.query(Class).filter(Class.id == lab_data.class_id).first()
    if not class_exists:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học phần")
        
    if current_user.role == "lecturer" and current_user not in class_exists.users:
        raise HTTPException(status_code=403, detail="Bạn không có quyền tạo bài lab cho lớp học phần này")
        
    new_lab = Lab(
        title=lab_data.title,
        description=lab_data.description,
        form_fields=lab_data.form_fields,
        deadline=lab_data.deadline,
        late_policy=lab_data.late_policy,
        individual_extensions=lab_data.individual_extensions,
        class_id=lab_data.class_id,
        created_by_id=current_user.id,
        is_active=lab_data.is_active,
        enable_vm=lab_data.enable_vm
    )
    db.add(new_lab)
    db.commit()
    db.refresh(new_lab)
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="create_lab",
        target=f"Tạo bài lab: {new_lab.title} (Lớp: {class_exists.name})",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return new_lab

@router.put("/{lab_id}", response_model=LabOut)
def update_lab(
    lab_id: int,
    lab_data: LabUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Sửa đổi thông tin bài lab (Giảng viên/Admin)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if current_user.role == "lecturer":
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp chứa bài lab này")
            
    if lab_data.title is not None:
        lab.title = lab_data.title
    if lab_data.description is not None:
        lab.description = lab_data.description
    if lab_data.form_fields is not None:
        lab.form_fields = lab_data.form_fields
    if lab_data.deadline is not None:
        lab.deadline = lab_data.deadline
    if lab_data.late_policy is not None:
        lab.late_policy = lab_data.late_policy
    if lab_data.individual_extensions is not None:
        lab.individual_extensions = lab_data.individual_extensions
    if lab_data.is_active is not None:
        lab.is_active = lab_data.is_active
    if lab_data.enable_vm is not None:
        lab.enable_vm = lab_data.enable_vm
    if lab_data.class_id is not None:
        # Check class exists
        class_exists = db.query(Class).filter(Class.id == lab_data.class_id).first()
        if not class_exists:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học phần")
        if current_user.role == "lecturer" and current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần mới này")
        lab.class_id = lab_data.class_id
        
    db.commit()
    db.refresh(lab)
    return lab

@router.delete("/{lab_id}", status_code=status.HTTP_200_OK)
def delete_lab(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Xóa bài lab (Giảng viên/Admin)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if current_user.role == "lecturer":
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp chứa bài lab này")
            
    db.delete(lab)
    db.commit()
    return {"message": "Xóa bài lab thành công"}

@router.post("/{lab_id}/extensions", response_model=LabOut)
def update_individual_extensions(
    lab_id: int,
    extensions: Dict[str, str], # {"sv_username": "2026-05-30T23:59:59"}
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Cấu hình gia hạn riêng cho cá nhân sinh viên (Giảng viên/Admin)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if current_user.role == "lecturer":
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp chứa bài lab này")
            
    # Cập nhật gia hạn cá nhân
    current_extensions = dict(lab.individual_extensions or {})
    for student_username, deadline_str in extensions.items():
        # Kiểm tra sinh viên có tồn tại hay không
        student = db.query(User).filter(User.username == student_username, User.role == "student").first()
        if not student:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy sinh viên có tên đăng nhập '{student_username}'")
            
        current_extensions[student_username] = deadline_str
        
    lab.individual_extensions = current_extensions
    db.commit()
    db.refresh(lab)
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="grant_extension",
        target=f"Gia hạn bài lab ID {lab.id} cho {', '.join(extensions.keys())}",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return lab
