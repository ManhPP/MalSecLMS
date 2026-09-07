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
        raise HTTPException(status_code=404, detail="Class not found")
    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="You do not manage this class")
    return class_

@router.post("/", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    class_data: ClassCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """Create a new class (Admin only)"""
    existing_class = db.query(Class).filter(Class.name == class_data.name).first()
    if existing_class:
        raise HTTPException(status_code=400, detail="Class name already exists")
        
    new_class = Class(
        name=class_data.name,
        description=class_data.description
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    log = AuditLog(
        user_id=current_user.id,
        action="create_class",
        target=f"Created class: {new_class.name}",
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
    """Update class details (Admin only)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
        
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
    """Delete a class (Admin only)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
        
    # 1. Delete submissions for labs belonging to this class
    lab_ids = [lab.id for lab in class_.labs]
    if lab_ids:
        from app.models import Submission
        db.query(Submission).filter(Submission.lab_id.in_(lab_ids)).delete(synchronize_session=False)

    # 2. Delete labs in this class
    from app.models import Lab
    db.query(Lab).filter(Lab.class_id == class_id).delete(synchronize_session=False)

    # 3. Delete class
    db.delete(class_)
    db.commit()
    return {"message": "Class deleted successfully"}


@router.post("/{class_id}/students", status_code=status.HTTP_200_OK)
def assign_students_to_class(
    class_id: int,
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """Assign students to class by username or ID"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
        
    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="You do not manage this class")
        
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
        return {"message": "No students provided"}

    students = db.query(User).filter(*filters).all()
    
    added_count = 0
    for student in students:
        if student not in class_.users:
            class_.users.append(student)
            added_count += 1
            
    db.commit()
    
    log = AuditLog(
        user_id=current_user.id,
        action="assign_students",
        target=f"Assigned {added_count} students to class {class_.name}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return {"message": f"Added {added_count} students to class"}

@router.delete("/{class_id}/students/{student_id}", status_code=status.HTTP_200_OK)
def remove_student_from_class(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """Remove student from class"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
        
    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="You do not manage this class")
        
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if student in class_.users:
        class_.users.remove(student)
        db.commit()
        
    return {"message": "Student removed from class successfully"}

@router.post("/{class_id}/lecturers", status_code=status.HTTP_200_OK)
def assign_lecturers_to_class(
    class_id: int,
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Assign lecturers to class by username or ID (Admin only)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
        
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
        return {"message": "No lecturers provided"}

    lecturers = db.query(User).filter(*filters).all()
    
    added_count = 0
    for lecturer in lecturers:
        if lecturer not in class_.users:
            class_.users.append(lecturer)
            added_count += 1
    db.commit()
    
    log = AuditLog(
        user_id=current_user.id,
        action="assign_lecturers",
        target=f"Assigned {added_count} lecturers to manage class {class_.name}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return {"message": f"Assigned {added_count} lecturers to class"}


@router.delete("/{class_id}/lecturers/{lecturer_id}", status_code=status.HTTP_200_OK)
def remove_lecturer_from_class(
    class_id: int,
    lecturer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Remove lecturer from class (Admin only)"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
        
    lecturer = db.query(User).filter(User.id == lecturer_id, User.role == "lecturer").first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
        
    if lecturer in class_.users:
        class_.users.remove(lecturer)
        db.commit()
        
    return {"message": "Lecturer removed from class successfully"}
