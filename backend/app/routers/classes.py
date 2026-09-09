from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database import get_db
from app.models import Class, User, AuditLog
from app.schemas import ClassOut, ClassCreate, ClassWithStudents
from app.security import require_lecturer, require_admin, require_any_user
from app.request_utils import get_client_ip

router = APIRouter(prefix="/classes", tags=["Classes"])

@router.get("/", response_model=List[ClassOut])
def get_classes(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_any_user)
):
    """API Lấy danh sách lớp học phần (Admin: toàn bộ, Giảng viên/Sinh viên: các lớp tham gia)"""
    if current_user.role in ["lecturer", "student"]:
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


@router.get("/{class_id}/analytics")
def get_class_analytics(
    class_id: int,
    lab_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """
    API Thống kê & Phân tích Lớp học phần (có hỗ trợ lọc theo bài lab cụ thể hoặc toàn bộ lớp):
    - Tổng số sinh viên, tổng số bài lab
    - Tỷ lệ nộp bài, tỷ lệ nộp đúng hạn / muộn
    - Điểm trung bình, phân phối điểm số (phổ điểm)
    - Số máy ảo thực tế của lớp đang chạy trên Proxmox
    - Chi tiết hiệu suất theo từng bài lab
    - Bảng tiến độ và tỷ lệ hoàn thành của từng sinh viên
    """
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
        
    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="You do not manage this class")

    students = [u for u in class_.users if u.role == "student"]
    all_labs = class_.labs
    total_students = len(students)
    total_labs = len(all_labs)

    # Nếu người dùng chọn lọc theo lab_id cụ thể
    selected_lab = None
    if lab_id:
        selected_lab = next((l for l in all_labs if l.id == lab_id), None)
        if not selected_lab:
            raise HTTPException(status_code=404, detail="Lab not found in this class")
        target_labs = [selected_lab]
    else:
        target_labs = all_labs
    
    # 1. Truy vấn tài nguyên Proxmox để kiểm tra máy ảo của sinh viên lớp này
    from app.services.vm_service import get_pve_client, _is_vm_owned_by_student, _find_student_vm
    running_vms_count = 0
    total_cloned_vms = 0
    student_vm_status_map = {} # {student_username: {status: 'running'|'stopped'|'none', vmid: int|None}}
    
    try:
        proxmox = get_pve_client()
        if proxmox:
            pve_resources = proxmox.cluster.resources.get(type="vm")
            student_usernames = {s.username for s in students}
            
            for res in pve_resources:
                name = res.get("name", "")
                vmid = int(res.get("vmid", -1))
                status = res.get("status", "")
                
                for s_name in student_usernames:
                    # Nếu lọc theo lab cụ thể, chỉ đếm VM thuộc lab đó
                    if selected_lab:
                        owned = (name == f"lab-{selected_lab.id}-{s_name}" or name.startswith(f"lab-{selected_lab.id}-{s_name}-"))
                    else:
                        owned = _is_vm_owned_by_student(name, s_name)

                    if owned:
                        total_cloned_vms += 1
                        if status == "running":
                            running_vms_count += 1
                            student_vm_status_map[s_name] = {"status": "running", "vmid": vmid}
                        elif s_name not in student_vm_status_map:
                            student_vm_status_map[s_name] = {"status": "stopped", "vmid": vmid}
    except Exception as exc:
        print(f"[!] Warning: Could not collect live Proxmox VM metrics for class analytics: {exc}")

    # 2. Thu thập và tính toán dữ liệu bài nộp (Submissions)
    from app.models import Submission
    target_lab_ids = [lab.id for lab in target_labs]
    all_lab_ids = [lab.id for lab in all_labs]
    
    all_submissions = []
    if all_lab_ids:
        all_submissions = db.query(Submission).filter(Submission.lab_id.in_(all_lab_ids)).all()

    # Lọc submissions thuộc các lab mục tiêu (nếu chọn 1 lab thì chỉ lấy lab đó)
    target_submissions = [s for s in all_submissions if s.lab_id in target_lab_ids]

    # Map submission theo lab và sinh viên
    sub_by_lab = {lid: [] for lid in all_lab_ids}
    sub_by_student = {s.id: [] for s in students}
    
    for sub in all_submissions:
        if sub.lab_id in sub_by_lab:
            sub_by_lab[sub.lab_id].append(sub)
    for sub in target_submissions:
        if sub.student_id in sub_by_student:
            sub_by_student[sub.student_id].append(sub)

    # 3. Tính toán các chỉ số tổng quan (áp dụng theo phạm vi target_labs)
    active_lab_count = len(target_labs)
    total_possible_submissions = total_students * active_lab_count if total_students and active_lab_count else 0
    total_submitted = sum(1 for s in target_submissions if s.status in ['submitted', 'graded'])
    total_graded = sum(1 for s in target_submissions if s.status == 'graded' and s.score is not None)
    total_late = sum(1 for s in target_submissions if s.status in ['submitted', 'graded'] and s.late_penalty > 0)
    total_ontime = total_submitted - total_late

    overall_submission_rate = round((total_submitted / total_possible_submissions * 100), 1) if total_possible_submissions else 0
    ontime_rate = round((total_ontime / total_submitted * 100), 1) if total_submitted else 0

    # Phân phối điểm số (Grade distribution) & Điểm trung bình của target_submissions
    graded_scores = [s.score for s in target_submissions if s.status == 'graded' and s.score is not None]
    avg_score = round(sum(graded_scores) / len(graded_scores), 2) if graded_scores else None
    max_score = max(graded_scores) if graded_scores else None
    min_score = min(graded_scores) if graded_scores else None

    # Phổ điểm: Excellent (9-10), Good (8-8.9), Fair (6.5-7.9), Average (5-6.4), Poor (<5)
    grade_distribution = {
        "excellent": 0,  # 9.0 - 10.0
        "good": 0,       # 8.0 - 8.9
        "fair": 0,       # 6.5 - 7.9
        "average": 0,    # 5.0 - 6.4
        "poor": 0        # < 5.0
    }
    for sc in graded_scores:
        if sc >= 9.0:
            grade_distribution["excellent"] += 1
        elif sc >= 8.0:
            grade_distribution["good"] += 1
        elif sc >= 6.5:
            grade_distribution["fair"] += 1
        elif sc >= 5.0:
            grade_distribution["average"] += 1
        else:
            grade_distribution["poor"] += 1

    # 4. Thống kê chi tiết từng bài Lab
    lab_performance = []
    for lab in sorted(all_labs, key=lambda l: l.id):
        l_subs = sub_by_lab.get(lab.id, [])
        l_submitted = [s for s in l_subs if s.status in ['submitted', 'graded']]
        l_graded = [s.score for s in l_submitted if s.status == 'graded' and s.score is not None]
        l_late = sum(1 for s in l_submitted if s.late_penalty > 0)
        l_plag = sum(1 for s in l_submitted if s.is_plagiarized)
        l_avg = round(sum(l_graded) / len(l_graded), 2) if l_graded else None
        
        lab_performance.append({
            "lab_id": lab.id,
            "title": lab.title,
            "deadline": lab.deadline.isoformat() if lab.deadline else None,
            "is_active": lab.is_active,
            "enable_vm": lab.enable_vm,
            "total_students": total_students,
            "submitted_count": len(l_submitted),
            "submission_rate": round((len(l_submitted) / total_students * 100), 1) if total_students else 0,
            "late_count": l_late,
            "ontime_count": len(l_submitted) - l_late,
            "average_score": l_avg,
            "plagiarism_flags": l_plag
        })

    # 5. Thống kê tiến độ từng sinh viên
    student_progress = []
    comparison_total_labs = len(target_labs)
    for st in sorted(students, key=lambda s: s.full_name):
        s_subs = sub_by_student.get(st.id, [])
        s_completed = [s for s in s_subs if s.status in ['submitted', 'graded']]
        s_scores = [s.score for s in s_completed if s.status == 'graded' and s.score is not None]
        s_late = sum(1 for s in s_completed if s.late_penalty > 0)
        s_avg = round(sum(s_scores) / len(s_scores), 2) if s_scores else None
        completion_pct = round((len(s_completed) / comparison_total_labs * 100), 1) if comparison_total_labs else 0
        
        vm_info = student_vm_status_map.get(st.username, {"status": "none", "vmid": None})

        student_progress.append({
            "student_id": st.id,
            "username": st.username,
            "full_name": st.full_name,
            "email": st.email,
            "completed_labs": len(s_completed),
            "total_labs": comparison_total_labs,
            "completion_percentage": completion_pct,
            "average_score": s_avg,
            "late_submissions": s_late,
            "ontime_submissions": len(s_completed) - s_late,
            "vm_status": vm_info["status"],
            "vm_id": vm_info["vmid"]
        })

    return {
        "class_id": class_.id,
        "class_name": class_.name,
        "description": class_.description,
        "selected_lab": {
            "id": selected_lab.id,
            "title": selected_lab.title
        } if selected_lab else None,
        "summary": {
            "total_students": total_students,
            "total_labs": total_labs,
            "filtered_labs_count": len(target_labs),
            "total_submitted": total_submitted,
            "total_graded": total_graded,
            "total_possible_submissions": total_possible_submissions,
            "overall_submission_rate": overall_submission_rate,
            "ontime_rate": ontime_rate,
            "late_submissions_count": total_late,
            "ontime_submissions_count": total_ontime,
            "average_score": avg_score,
            "highest_score": max_score,
            "lowest_score": min_score,
            "running_vms_count": running_vms_count,
            "total_cloned_vms": total_cloned_vms
        },
        "grade_distribution": grade_distribution,
        "lab_performance": lab_performance,
        "student_progress": student_progress
    }
