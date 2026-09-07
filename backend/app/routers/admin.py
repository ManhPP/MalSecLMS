from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from io import StringIO
import csv
from app.database import get_db
from app.models import User, Class, AuditLog, user_class_association
from app.schemas import AuditLogOut, UserOut
from app.security import require_admin, get_password_hash
from app.config import settings
from app.request_utils import get_client_ip

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """API Lấy toàn bộ lịch sử hoạt động hệ thống (Nhật ký kiểm toán - Audit Log)"""
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(200).all()

@router.post("/users/import", response_model=Dict[str, Any])
def import_students_csv(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    API Nhập danh sách tài khoản sinh viên hàng loạt từ file CSV
    Định dạng file CSV yêu cầu: MSSV, Họ và Tên, Lớp học phần
    Hệ thống sẽ tự động tạo tài khoản với mật khẩu đã cấu hình và gán đúng lớp học phần!
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only .csv files are allowed")

    try:
        content = file.file.read().decode('utf-8-sig')
        f = StringIO(content)
        reader = csv.reader(f)
        
        header = next(reader)
        if header and "mssv" not in header[0].lower() and "mã" not in header[0].lower():
            f.seek(0)
            reader = csv.reader(f)

        imported_count = 0
        skipped_count = 0
        created_classes_count = 0
        details = []

        for row in reader:
            if not row or len(row) < 2:
                continue

            username = row[0].strip()
            full_name = row[1].strip()
            class_name = row[2].strip() if len(row) >= 3 else "General"
            email = f"{username.lower()}@fpt.edu.vn"

            if not username or not full_name:
                continue

            # 1. Get or create class
            class_ = db.query(Class).filter(Class.name == class_name).first()
            if not class_:
                class_ = Class(name=class_name, description=f"Class {class_name} imported from CSV")
                db.add(class_)
                db.commit()
                db.refresh(class_)
                created_classes_count += 1

            # 2. Get or create student
            student = db.query(User).filter(User.username == username).first()
            is_new_student = False

            if not student:
                hashed_password = get_password_hash(settings.DEFAULT_STUDENT_PASSWORD)
                student = User(
                    username=username,
                    password_hash=hashed_password,
                    full_name=full_name,
                    role="student",
                    email=email,
                    is_active=True
                )
                db.add(student)
                db.commit()
                db.refresh(student)
                imported_count += 1
                is_new_student = True
            else:
                skipped_count += 1

            # 3. Enroll student in class
            if student not in class_.users:
                class_.users.append(student)
                db.commit()
                details.append({
                    "username": username,
                    "full_name": full_name,
                    "email": email,
                    "class": class_name,
                    "status": "Created & Enrolled" if is_new_student else "Existing & Enrolled"
                })

        log = AuditLog(
            user_id=current_user.id,
            action="import_users",
            target=f"Imported students from file {file.filename} (New: {imported_count}, Skipped: {skipped_count})",
            ip_address=get_client_ip(request)
        )
        db.add(log)
        db.commit()

        return {
            "success": True,
            "message": f"Data import successful! Created {imported_count} new students, skipped {skipped_count} existing records, created {created_classes_count} classes.",
            "details": details
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"CSV file structure or data error: {str(e)}"
        )
