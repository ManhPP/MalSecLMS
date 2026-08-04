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
        raise HTTPException(status_code=400, detail="Chỉ cho phép nhập file định dạng .csv")

    try:
        content = file.file.read().decode('utf-8')
        f = StringIO(content)
        reader = csv.reader(f)
        
        # Đọc dòng tiêu đề (nếu có) và xác nhận
        header = next(reader)
        # Giả lập bỏ qua dòng tiêu đề nếu khớp
        if header and "mssv" not in header[0].lower() and "mã" not in header[0].lower():
            # Trỏ lại từ đầu hoặc parse dòng đầu tiên này luôn
            f.seek(0)
            reader = csv.reader(f)

        imported_count = 0
        skipped_count = 0
        created_classes_count = 0
        details = []

        default_hashed_password = get_password_hash(settings.DEFAULT_STUDENT_PASSWORD)

        for row in reader:
            if not row or len(row) < 3:
                continue
                
            username = row[0].strip() # MSSV làm username
            full_name = row[1].strip()
            class_name = row[2].strip()
            email = row[3].strip() if len(row) >= 4 else None

            if not username or not full_name or not class_name:
                skipped_count += 1
                continue

            # 1. Tìm hoặc tạo lớp học phần tương ứng
            class_ = db.query(Class).filter(Class.name == class_name).first()
            if not class_:
                class_ = Class(name=class_name, description=f"Lớp học phần tự động tạo cho sinh viên khóa {class_name}")
                db.add(class_)
                db.commit()
                db.refresh(class_)
                created_classes_count += 1

            # 2. Tạo tài khoản sinh viên nếu chưa tồn tại
            student = db.query(User).filter(User.username == username).first()
            is_new_student = False
            
            if not student:
                student = User(
                    username=username,
                    password_hash=default_hashed_password,
                    full_name=full_name,
                    role="student",
                    email=email,
                    is_active=True
                )
                db.add(student)
                db.commit()
                db.refresh(student)
                is_new_student = True
                imported_count += 1
            else:
                skipped_count += 1

            # 3. Gán sinh viên vào lớp học phần
            if student not in class_.users:
                class_.users.append(student)
                db.commit()
                details.append({
                    "username": username,
                    "full_name": full_name,
                    "email": email,
                    "class": class_name,
                    "status": "Tạo mới & Gán lớp" if is_new_student else "Đã tồn tại & Gán thêm lớp"
                })

        # Ghi log hoạt động
        log = AuditLog(
            user_id=current_user.id,
            action="import_users",
            target=f"Nhập hàng loạt sinh viên từ file {file.filename} (Thêm mới: {imported_count}, Bỏ qua: {skipped_count})",
            ip_address=get_client_ip(request)
        )
        db.add(log)
        db.commit()

        return {
            "success": True,
            "message": f"Nhập dữ liệu thành công! Thêm mới {imported_count} sinh viên, bỏ qua {skipped_count} bản ghi cũ, tạo mới {created_classes_count} lớp học phần.",
            "details": details
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Lỗi cấu trúc file CSV hoặc dữ liệu: {str(e)}"
        )
