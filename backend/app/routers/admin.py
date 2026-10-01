from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from io import StringIO
import csv
from app.database import get_db
from app.models import User, Class, AuditLog, user_class_association, VmToolFile
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

@router.post("/vms/clean-orphaned")
def clean_orphaned_vms(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Quét và dọn dẹp các máy ảo sinh viên trên Proxmox thuộc các bài lab không còn tồn tại trong hệ thống.
    Chỉ tác động trong dải VMID sinh viên (STUDENT_VMID_MIN - STUDENT_VMID_MAX).
    """
    from app.models import Lab
    from app.services.vm_service import clean_orphaned_student_vms

    active_labs = db.query(Lab.id).all()
    active_lab_ids = [l[0] for l in active_labs]

    result = clean_orphaned_student_vms(active_lab_ids)

    log = AuditLog(
        user_id=current_user.id,
        action="clean_orphaned_vms",
        target=f"Orphaned VMs Purged: {result.get('purged_count', 0)}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return result


@router.get("/vm-tools/files", response_model=List[Dict[str, Any]])
def list_vm_tool_files(
    scope: str = "common",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """API Liệt kê danh sách các file trong ổ đĩa chia sẻ D:\ (kho chung hoặc kho riêng giảng viên) kèm thông tin owner"""
    from app.services.iso_tool_service import IsoToolService
    try:
        files = IsoToolService.list_files(scope=scope)
        records = db.query(VmToolFile).filter(VmToolFile.scope == scope).all()
        owner_map = {}
        for rec in records:
            owner_map[rec.filename] = {
                "owner_id": rec.uploaded_by_id,
                "owner_username": rec.uploaded_by.username if rec.uploaded_by else "admin",
                "owner_name": rec.uploaded_by.full_name if rec.uploaded_by else "Administrator"
            }

        enriched_files = []
        for f in files:
            fname = f["filename"]
            info = owner_map.get(fname)
            if info:
                f["owner_id"] = info["owner_id"]
                f["owner_username"] = info["owner_username"]
                f["owner_name"] = info["owner_name"]
            else:
                f["owner_id"] = None
                f["owner_username"] = "system"
                f["owner_name"] = "System / Admin"
            f["can_delete"] = True  # Admin có quyền xóa tất cả file
            enriched_files.append(f)
        return enriched_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vm-tools/files")
def upload_vm_tool_file(
    request: Request,
    file: UploadFile = File(...),
    scope: str = "common",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """API Upload file công cụ/mã độc mới lên ổ đĩa chia sẻ D:\ (kho chung hoặc kho riêng)"""
    from app.services.iso_tool_service import IsoToolService
    try:
        result = IsoToolService.upload_file(file, scope=scope)
        
        # Cập nhật record owner trong CSDL
        existing_rec = db.query(VmToolFile).filter(
            VmToolFile.filename == result['filename'],
            VmToolFile.scope == scope
        ).first()

        if existing_rec:
            existing_rec.uploaded_by_id = current_user.id
            existing_rec.size_bytes = result['size_bytes']
        else:
            new_rec = VmToolFile(
                filename=result['filename'],
                scope=scope,
                uploaded_by_id=current_user.id,
                size_bytes=result['size_bytes']
            )
            db.add(new_rec)

        log = AuditLog(
            user_id=current_user.id,
            action="vm_tool_upload",
            target=f"Uploaded {result['filename']} ({result['size_bytes']} bytes) to Drive D: [{result.get('scope', 'common')}]",
            ip_address=get_client_ip(request)
        )
        db.add(log)
        db.commit()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/vm-tools/files/{filename}")
def delete_vm_tool_file(
    filename: str,
    request: Request,
    scope: str = "common",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """API Xóa file khỏi ổ đĩa chia sẻ D:\ (kho chung hoặc kho riêng)"""
    from app.services.iso_tool_service import IsoToolService
    try:
        IsoToolService.delete_file(filename, scope=scope)
        
        db.query(VmToolFile).filter(
            VmToolFile.filename == filename,
            VmToolFile.scope == scope
        ).delete(synchronize_session=False)

        log = AuditLog(
            user_id=current_user.id,
            action="vm_tool_delete",
            target=f"Deleted {filename} from Drive D: [{scope}]",
            ip_address=get_client_ip(request)
        )
        db.add(log)
        db.commit()
        return {"success": True, "message": f"Successfully deleted {filename} from Drive D: ({scope})"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vm-tools/sync-vms")
def sync_vm_tools_to_active_vms(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """API Đồng bộ remount ổ đĩa D:\ cho tất cả các máy ảo sinh viên đang hoạt động"""
    from app.services.iso_tool_service import IsoToolService
    try:
        result = IsoToolService.sync_to_running_vms()
        
        log = AuditLog(
            user_id=current_user.id,
            action="vm_tool_sync",
            target=f"Synced Drive D: to {result.get('synced_count', 0)} active student VMs",
            ip_address=get_client_ip(request)
        )
        db.add(log)
        db.commit()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
