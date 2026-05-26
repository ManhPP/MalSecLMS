from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
from app.database import get_db
from app.models import Class, User, AuditLog
from app.schemas import ClassOut, ClassCreate, ClassWithStudents
from app.security import require_lecturer, require_admin

router = APIRouter(prefix="/classes", tags=["Classes"])

@router.get("/", response_model=List[ClassOut])
def get_classes(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_lecturer)
):
    """API Lấy danh sách lớp học phần (Giảng viên/Admin)"""
    return db.query(Class).order_by(Class.id.desc()).all()

@router.get("/{class_id}", response_model=ClassWithStudents)
def get_class(
    class_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_lecturer)
):
    """API Lấy thông tin lớp học kèm danh sách sinh viên bên trong"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
    return class_

@router.post("/", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    class_data: ClassCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Tạo lớp học phần mới (Chỉ Admin)"""
    existing_class = db.query(Class).filter(Class.name == class_data.name).first()
    if existing_class:
        raise HTTPException(status_code=400, detail="Tên lớp học phần đã tồn tại")
        
    new_class = Class(
        name=class_data.name,
        description=class_data.description
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="create_class",
        target=f"Tạo lớp học: {new_class.name}",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return new_class

@router.put("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int, 
    class_data: ClassCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Sửa thông tin lớp học phần (Chỉ Admin)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
    class_.name = class_data.name
    class_.description = class_data.description
    db.commit()
    db.refresh(class_)
    return class_

@router.delete("/{class_id}", status_code=status.HTTP_200_OK)
def delete_class(
    class_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """API Xóa lớp học phần (Chỉ Admin)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
    db.delete(class_)
    db.commit()
    return {"message": "Xóa lớp học phần thành công"}

@router.post("/{class_id}/students", status_code=status.HTTP_200_OK)
def assign_students_to_class(
    class_id: int,
    payload: Dict[str, List[int]], # {"student_ids": [1, 2, 3]}
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Gán danh sách sinh viên vào lớp (Giảng viên/Admin)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
    student_ids = payload.get("student_ids", [])
    students = db.query(User).filter(User.id.in_(student_ids), User.role == "student").all()
    
    # Gán sinh viên vào lớp (tránh trùng lặp)
    for student in students:
        if student not in class_.users:
            class_.users.append(student)
            
    db.commit()
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="assign_students",
        target=f"Gán {len(students)} sinh viên vào lớp {class_.name}",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return {"message": f"Đã thêm {len(students)} sinh viên vào lớp học phần"}

@router.delete("/{class_id}/students/{student_id}", status_code=status.HTTP_200_OK)
def remove_student_from_class(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Xóa sinh viên khỏi lớp học phần (Giảng viên/Admin)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")
        
    if student in class_.users:
        class_.users.remove(student)
        db.commit()
        
    return {"message": "Đã xóa sinh viên khỏi lớp học phần"}
