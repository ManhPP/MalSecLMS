from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database import get_db
from app.models import Class, User, AuditLog
from app.schemas import ClassOut, ClassCreate, ClassWithStudents
from app.security import require_lecturer, require_admin
from app.request_utils import get_client_ip

router = APIRouter(prefix="/classes", tags=["Classes"])

@router.get("/", response_model=List[ClassOut])
def get_classes(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_lecturer)
):
    """API Lấy danh sách lớp học phần (Giảng viên/Admin)"""
    if current_user.role == "lecturer":
        return db.query(Class).filter(Class.users.any(id=current_user.id)).order_by(Class.id.desc()).all()
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
    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học này")
    return class_

@router.post("/", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    class_data: ClassCreate,
    request: Request,
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
        ip_address=get_client_ip(request)
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
        
    # 1. Xóa các bài nộp thuộc về bài lab của lớp này
    lab_ids = [lab.id for lab in class_.labs]
    if lab_ids:
        from app.models import Submission
        db.query(Submission).filter(Submission.lab_id.in_(lab_ids)).delete(synchronize_session=False)

    # 2. Xóa các bài lab thuộc lớp này
    from app.models import Lab
    db.query(Lab).filter(Lab.class_id == class_id).delete(synchronize_session=False)

    # 3. Xóa lớp học
    db.delete(class_)
    db.commit()
    return {"message": "Xóa lớp học phần thành công"}


@router.post("/{class_id}/students", status_code=status.HTTP_200_OK)
def assign_students_to_class(
    class_id: int,
    payload: Dict[str, Any], # {"usernames": ["sv01", "sv02"]} or {"student_ids": [1, 2]}
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Gán danh sách sinh viên vào lớp theo Username hoặc ID (Giảng viên/Admin)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học này")
        
    student_ids = payload.get("student_ids", [])
    usernames = payload.get("usernames", [])
    
    filters = [User.role == "student"]
    if student_ids and usernames:
        filters.append((User.id.in_(student_ids)) | (User.username.in_(usernames)))
    elif usernames:
        filters.append(User.username.in_(usernames))
    elif student_ids:
        filters.append(User.id.in_(student_ids))
    else:
        return {"message": "Không có sinh viên nào được cung cấp"}

    students = db.query(User).filter(*filters).all()
    
    added_count = 0
    for student in students:
        if student not in class_.users:
            class_.users.append(student)
            added_count += 1
            
    db.commit()
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="assign_students",
        target=f"Gán {added_count} sinh viên vào lớp {class_.name}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return {"message": f"Đã thêm {added_count} sinh viên vào lớp học phần"}

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
        
    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học này")
        
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")
        
    if student in class_.users:
        class_.users.remove(student)
        db.commit()
        
    return {"message": "Đã xóa sinh viên khỏi lớp học phần"}

@router.post("/{class_id}/lecturers", status_code=status.HTTP_200_OK)
def assign_lecturers_to_class(
    class_id: int,
    payload: Dict[str, Any], # {"usernames": ["gv01"]} or {"lecturer_ids": [1]}
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """API Gán giảng viên quản lý lớp theo Username hoặc ID (Chỉ Admin)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
    lecturer_ids = payload.get("lecturer_ids", [])
    usernames = payload.get("usernames", [])
    
    filters = [User.role == "lecturer"]
    if lecturer_ids and usernames:
        filters.append((User.id.in_(lecturer_ids)) | (User.username.in_(usernames)))
    elif usernames:
        filters.append(User.username.in_(usernames))
    elif lecturer_ids:
        filters.append(User.id.in_(lecturer_ids))
    else:
        return {"message": "Không có giảng viên nào được cung cấp"}

    lecturers = db.query(User).filter(*filters).all()
    
    added_count = 0
    for lecturer in lecturers:
        if lecturer not in class_.users:
            class_.users.append(lecturer)
            added_count += 1
    db.commit()
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="assign_lecturers",
        target=f"Gán {added_count} giảng viên vào quản lý lớp {class_.name}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return {"message": f"Đã gán {added_count} giảng viên vào quản lý lớp học phần"}


@router.delete("/{class_id}/lecturers/{lecturer_id}", status_code=status.HTTP_200_OK)
def remove_lecturer_from_class(
    class_id: int,
    lecturer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """API Xóa giảng viên khỏi lớp học phần (Chỉ Admin)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
        
    lecturer = db.query(User).filter(User.id == lecturer_id, User.role == "lecturer").first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Không tìm thấy giảng viên")
        
    if lecturer in class_.users:
        class_.users.remove(lecturer)
        db.commit()
        
    return {"message": "Đã xóa giảng viên khỏi lớp học phần"}
