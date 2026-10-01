import os
import shutil
import zipfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Query, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.config import settings
from app.logging_config import logger
from app.models import Lab, User, Class, AuditLog, VmToolFile
from app.request_utils import get_client_ip
from app.schemas import LabOut, LabCreate, LabUpdate, LabClone
from app.security import require_lecturer, require_student, get_current_user, require_any_user
from app.services.file_service import FileService

router = APIRouter(prefix="/labs", tags=["Labs"])

def _filter_lab_attachments_for_user(lab: Lab, user: User) -> LabOut:
    """Nếu là sinh viên, lọc chỉ hiển thị các attachment_files mà sinh viên này được phép xem"""
    lab_out = LabOut.model_validate(lab)
    if user.role == "student":
        filtered_files = []
        for att in (lab.attachment_files or []):
            vis_mode = att.get("visibility_mode", "all")
            allowed_students = att.get("allowed_students", [])
            if vis_mode == "all" or user.username in allowed_students:
                filtered_files.append(att)
        lab_out.attachment_files = filtered_files
    return lab_out


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
        labs = db.query(Lab).filter(Lab.class_id == class_id, Lab.is_active == True).order_by(Lab.id.desc()).all()
        return [_filter_lab_attachments_for_user(l, current_user) for l in labs]
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
    labs = db.query(Lab).filter(
        Lab.class_id.in_(class_ids), 
        Lab.is_active == True
    ).order_by(Lab.deadline.asc()).all()
    return [_filter_lab_attachments_for_user(l, current_user) for l in labs]

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
        return _filter_lab_attachments_for_user(lab, current_user)
            
    return lab

@router.post("/", response_model=LabOut, status_code=status.HTTP_201_CREATED)
def create_lab(
    lab_data: LabCreate,
    request: Request,
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

    vm_username = (lab_data.vm_username or "").strip() or None
    vm_password = lab_data.vm_password or None
    if lab_data.enable_vm:
        if lab_data.template_vmid is None or not (
            settings.TEMPLATE_VMID_MIN
            <= lab_data.template_vmid
            <= settings.TEMPLATE_VMID_MAX
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "VM template phải nằm trong dải "
                    f"{settings.TEMPLATE_VMID_MIN} - {settings.TEMPLATE_VMID_MAX}"
                ),
            )
        if lab_data.vm_protocol in {"rdp", "ssh"} and not vm_username:
            raise HTTPException(
                status_code=422,
                detail="RDP/SSH yêu cầu tên đăng nhập máy ảo",
            )
        if not vm_password:
            raise HTTPException(
                status_code=422,
                detail="Vui lòng nhập mật khẩu kết nối máy ảo",
            )
        
    new_lab = Lab(
        title=lab_data.title,
        description=lab_data.description,
        grade_tag=lab_data.grade_tag.strip() if lab_data.grade_tag and lab_data.grade_tag.strip() else None,
        form_fields=lab_data.form_fields,
        attachment_files=lab_data.attachment_files or [],
        deadline=lab_data.deadline,
        late_policy=lab_data.late_policy,
        individual_extensions=lab_data.individual_extensions,
        class_id=lab_data.class_id,
        created_by_id=current_user.id,
        is_active=lab_data.is_active,
        enable_vm=lab_data.enable_vm,
        template_vmid=lab_data.template_vmid,
        is_linked_clone=lab_data.is_linked_clone if lab_data.is_linked_clone is not None else True,
        vm_protocol=lab_data.vm_protocol,
        vm_port=lab_data.vm_port,
        vm_username=vm_username,
        vm_password=vm_password,
        vm_drive_mode=lab_data.vm_drive_mode or "default",
        vm_drive_files=lab_data.vm_drive_files or [],
        disable_vm_copy=bool(lab_data.disable_vm_copy) if lab_data.disable_vm_copy is not None else False,
        disable_vm_paste=bool(lab_data.disable_vm_paste) if lab_data.disable_vm_paste is not None else False,
        is_exam_mode=bool(lab_data.is_exam_mode) if lab_data.is_exam_mode is not None else False,
        cpu_cores=lab_data.cpu_cores,
        ram_mb=lab_data.ram_mb,
    )
    db.add(new_lab)
    db.commit()
    db.refresh(new_lab)

    # Nếu lab chọn custom drive files, tự động biên dịch lab-{id}.iso trên Proxmox
    if new_lab.vm_drive_mode == "custom" and new_lab.vm_drive_files:
        try:
            from app.services.iso_tool_service import IsoToolService
            IsoToolService.build_lab_iso(new_lab.id, new_lab.vm_drive_files)
        except Exception as e:
            logger.error(f"[LABS] Failed to build custom lab ISO for Lab {new_lab.id}: {e}")
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="create_lab",
        target=f"Created lab: {new_lab.title} (Class: {class_exists.name})",
        ip_address=get_client_ip(request)
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
    if lab_data.grade_tag is not None:
        lab.grade_tag = lab_data.grade_tag.strip() or None
    if lab_data.form_fields is not None:
        lab.form_fields = lab_data.form_fields
    if lab_data.attachment_files is not None:
        lab.attachment_files = lab_data.attachment_files
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
    if lab_data.template_vmid is not None:
        lab.template_vmid = lab_data.template_vmid
    if lab_data.is_linked_clone is not None:
        lab.is_linked_clone = lab_data.is_linked_clone
    if lab_data.vm_protocol is not None:
        lab.vm_protocol = lab_data.vm_protocol
    if lab_data.vm_port is not None:
        lab.vm_port = lab_data.vm_port
    if lab_data.vm_username is not None:
        lab.vm_username = lab_data.vm_username.strip() or None
    if lab_data.vm_password is not None:
        lab.vm_password = lab_data.vm_password
    if lab_data.class_id is not None:

        # Check class exists
        class_exists = db.query(Class).filter(Class.id == lab_data.class_id).first()
        if not class_exists:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học phần")
        if current_user.role == "lecturer" and current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần mới này")
        lab.class_id = lab_data.class_id

    if lab_data.vm_drive_mode is not None:
        lab.vm_drive_mode = lab_data.vm_drive_mode
    if lab_data.vm_drive_files is not None:
        lab.vm_drive_files = lab_data.vm_drive_files
    if lab_data.disable_vm_copy is not None:
        lab.disable_vm_copy = bool(lab_data.disable_vm_copy)
    if lab_data.disable_vm_paste is not None:
        lab.disable_vm_paste = bool(lab_data.disable_vm_paste)
    if lab_data.is_exam_mode is not None:
        lab.is_exam_mode = bool(lab_data.is_exam_mode)
    if lab_data.cpu_cores is not None:
        lab.cpu_cores = lab_data.cpu_cores
    if lab_data.ram_mb is not None:
        lab.ram_mb = lab_data.ram_mb

    if lab.enable_vm:
        if lab.template_vmid is None or not (
            settings.TEMPLATE_VMID_MIN
            <= lab.template_vmid
            <= settings.TEMPLATE_VMID_MAX
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "VM template phải nằm trong dải "
                    f"{settings.TEMPLATE_VMID_MIN} - {settings.TEMPLATE_VMID_MAX}"
                ),
            )
        if lab.vm_protocol in {"rdp", "ssh"} and not lab.vm_username:
            raise HTTPException(
                status_code=422,
                detail="RDP/SSH yêu cầu tên đăng nhập máy ảo",
            )
        if not lab.vm_password:
            raise HTTPException(
                status_code=422,
                detail="Vui lòng nhập mật khẩu kết nối máy ảo",
            )
        
    db.commit()
    db.refresh(lab)

    # Nếu lab chọn custom drive files, tự động biên dịch lại lab-{id}.iso và sync tới các VM đang chạy của bài lab
    if lab.vm_drive_mode == "custom" and lab.vm_drive_files:
        try:
            from app.services.iso_tool_service import IsoToolService
            IsoToolService.build_lab_iso(lab.id, lab.vm_drive_files)
            iso_name = IsoToolService.get_lab_iso_basename(lab.id)
            IsoToolService.sync_to_running_vms(lab_id=lab.id, iso_name=iso_name)
        except Exception as e:
            logger.error(f"[LABS] Failed to rebuild custom lab ISO for Lab {lab.id}: {e}")

    return lab

@router.delete("/{lab_id}", status_code=status.HTTP_200_OK)
def delete_lab(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Xóa bài lab (Giảng viên/Admin) - Tự động xóa file vật lý đính kèm và máy ảo sinh viên trên Proxmox"""
    import os
    from app.models import Submission
    from app.services.vm_service import get_pve_client, control_student_vm

    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if current_user.role == "lecturer":
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp chứa bài lab này")

    # 1. Xóa sạch các file vật lý đính kèm của bài lab này và các bài nộp thuộc lab này
    lab_attachments = lab.attachment_files or []
    for att in lab_attachments:
        filepath = att.get("filepath")
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass

    submissions = db.query(Submission).filter(Submission.lab_id == lab_id).all()
    for sub in submissions:
        attachments = sub.file_attachments or []
        for att in attachments:
            filepath = att.get("filepath")
            if filepath and os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception:
                    pass

    # Xóa toàn bộ thư mục bài nộp và workspace của sinh viên cho lab này
    try:
        lab_sub_dir = os.path.join(settings.UPLOAD_DIR, "submissions", f"lab_{lab_id}")
        if os.path.exists(lab_sub_dir):
            shutil.rmtree(lab_sub_dir, ignore_errors=True)
    except Exception as e:
        logger.warning(f"Error removing submissions folder for lab {lab_id}: {e}")

    try:
        lab_ws_dir = os.path.join(settings.UPLOAD_DIR, "exam_workspaces", f"lab_{lab_id}")
        if os.path.exists(lab_ws_dir):
            shutil.rmtree(lab_ws_dir, ignore_errors=True)
    except Exception as e:
        logger.warning(f"Error removing exam workspace folder for lab {lab_id}: {e}")

    # 2. Thu dọn và xóa hoàn toàn các máy ảo (VM) sinh viên thuộc lab này trên Proxmox
    proxmox = get_pve_client()
    if proxmox:
        try:
            resources = proxmox.cluster.resources.get(type="vm")
            for res in resources:
                vm_name = res.get("name", "")
                vmid = int(res.get("vmid", -1))
                if vm_name == f"lab-{lab_id}" or vm_name.startswith(f"lab-{lab_id}-"):
                    try:
                        control_student_vm(vmid, "purge")
                    except Exception:
                        pass
        except Exception:
            pass

    # 3. Thu dọn file ISO custom của lab nếu có
    try:
        from app.services.iso_tool_service import IsoToolService
        IsoToolService.build_lab_iso(lab_id, [])
    except Exception:
        pass

    db.delete(lab)
    db.commit()
    return {"message": "Xóa bài lab và thu dọn máy ảo, tệp đính kèm thành công"}

@router.post("/{lab_id}/clone", response_model=LabOut, status_code=status.HTTP_201_CREATED)
def clone_lab(
    lab_id: int,
    clone_data: LabClone,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Nhân bản bài lab sang lớp khác (Giảng viên/Admin)"""
    source_lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not source_lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab gốc")

    # Kiểm tra quyền với lớp nguồn (nếu là giảng viên)
    if current_user.role == "lecturer":
        source_class = db.query(Class).filter(Class.id == source_lab.class_id).first()
        if not source_class or current_user not in source_class.users:
            raise HTTPException(status_code=403, detail="Bạn không có quyền quản lý bài lab nguồn này")

    # Kiểm tra lớp đích
    target_class = db.query(Class).filter(Class.id == clone_data.target_class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học phần đích")

    if current_user.role == "lecturer" and current_user not in target_class.users:
        raise HTTPException(status_code=403, detail="Bạn không có quyền giao bài cho lớp học phần đích này")

    title = clone_data.new_title.strip() if clone_data.new_title and clone_data.new_title.strip() else f"{source_lab.title} (Bản sao)"
    deadline = clone_data.new_deadline if clone_data.new_deadline else source_lab.deadline

    # Tạo bản sao bài lab với dữ liệu cấu hình giống bài lab gốc
    cloned_lab = Lab(
        title=title,
        description=source_lab.description,
        grade_tag=clone_data.grade_tag if clone_data.grade_tag is not None else source_lab.grade_tag,
        form_fields=source_lab.form_fields,
        attachment_files=source_lab.attachment_files or [],
        deadline=deadline,
        late_policy=source_lab.late_policy,
        individual_extensions={}, # Làm mới danh sách gia hạn cá nhân
        class_id=clone_data.target_class_id,
        created_by_id=current_user.id,
        is_active=source_lab.is_active,
        enable_vm=source_lab.enable_vm,
        template_vmid=source_lab.template_vmid,
        is_linked_clone=source_lab.is_linked_clone,
        vm_protocol=source_lab.vm_protocol,
        vm_port=source_lab.vm_port,
        vm_username=source_lab.vm_username,
        vm_password=source_lab.vm_password,
        vm_drive_mode=source_lab.vm_drive_mode,
        vm_drive_files=source_lab.vm_drive_files or [],
        disable_vm_copy=getattr(source_lab, 'disable_vm_copy', False),
        disable_vm_paste=getattr(source_lab, 'disable_vm_paste', False),
        is_exam_mode=getattr(source_lab, 'is_exam_mode', False),
        cpu_cores=getattr(source_lab, 'cpu_cores', None),
        ram_mb=getattr(source_lab, 'ram_mb', None),
    )
    db.add(cloned_lab)
    db.commit()
    db.refresh(cloned_lab)

    log = AuditLog(
        user_id=current_user.id,
        action="CLONE_LAB",
        details=f"Nhân bản bài lab '{source_lab.title}' (ID {source_lab.id}) sang lớp '{target_class.name}' (ID {target_class.id}) thành '{cloned_lab.title}' (ID {cloned_lab.id})"
    )
    db.add(log)
    db.commit()
    return cloned_lab

@router.post("/{lab_id}/extensions", response_model=LabOut)
def update_individual_extensions(
    lab_id: int,
    extensions: Dict[str, str], # {"sv_username": "2026-05-30T23:59:59"}
    request: Request,
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
    
    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="grant_extension",
        target=f"Granted deadline extension on Lab ID {lab.id} to: {', '.join(extensions.keys())}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return lab

# --- PROXMOX & GUACAMOLE VM ENDPOINTS ---

@router.get("/templates/proxmox", response_model=List[Dict[str, Any]])
def get_proxmox_templates(
    current_user: User = Depends(require_lecturer)
):
    """API Lấy danh sách VM Templates từ Proxmox VE (Giảng viên/Admin)"""
    from app.services.vm_service import get_available_templates
    return get_available_templates()

@router.get("/vm-tools/available-files", response_model=List[Dict[str, Any]])
def get_available_vm_tool_files(
    current_user: User = Depends(require_lecturer)
):
    """API Liệt kê danh sách các file trong kho công cụ ổ D: (bao gồm kho chung và các không gian riêng)"""
    from app.services.iso_tool_service import IsoToolService
    try:
        return IsoToolService.list_all_available_files()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{lab_id}/vm-session")
def get_or_create_vm_session(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """API Sinh máy ảo cho sinh viên và trả về URL nhúng Apache Guacamole (HMAC)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if not lab.enable_vm:
        raise HTTPException(status_code=400, detail="Bài lab này không yêu cầu máy ảo thực hành")
    if lab.vm_protocol in {"rdp", "ssh"} and not lab.vm_username:
        raise HTTPException(status_code=400, detail="Lab chưa cấu hình tên đăng nhập VM")
    if not lab.vm_password:
        raise HTTPException(status_code=400, detail="Lab chưa cấu hình mật khẩu VM")
        
    from app.services.vm_service import (
        VMProvisionError,
        provision_student_vm,
        generate_guacamole_auth_json_url,
    )

    template_vmid = lab.template_vmid or settings.DEFAULT_TEMPLATE_VMID
    is_linked = getattr(lab, 'is_linked_clone', True)
    if is_linked is None:
        is_linked = True
    # Xác định file ISO gắn vào ổ D: của máy ảo (Custom Lab ISO vs Default tools-1001.iso)
    iso_filename = None
    if getattr(lab, 'vm_drive_mode', 'default') == 'custom' and getattr(lab, 'vm_drive_files', None):
        from app.services.iso_tool_service import IsoToolService
        iso_filename = IsoToolService.get_lab_iso_basename(lab.id)

    try:
        ip_address, vmid = provision_student_vm(
            student_username=current_user.username,
            lab_id=lab.id,
            template_vmid=template_vmid,
            protocol=lab.vm_protocol,
            port=lab.vm_port,
            is_linked_clone=is_linked,
            iso_filename=iso_filename,
            cpu_cores=getattr(lab, 'cpu_cores', None),
            ram_mb=getattr(lab, 'ram_mb', None),
            is_exam_mode=getattr(lab, 'is_exam_mode', False),
        )
    except VMProvisionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    print(f"[VM-SESSION] user={current_user.username} lab={lab_id} vmid={vmid} ip={ip_address} iso={iso_filename or 'default'}", flush=True)
    
    guacamole_url = generate_guacamole_auth_json_url(
        ip_address=ip_address,
        student_username=current_user.username,
        protocol=lab.vm_protocol,
        port=lab.vm_port,
        username=lab.vm_username,
        password=lab.vm_password,
        disable_vm_copy=getattr(lab, 'disable_vm_copy', False),
        disable_vm_paste=getattr(lab, 'disable_vm_paste', False),
        is_exam_mode=getattr(lab, 'is_exam_mode', False),
    )


    
    return {
        "status": "ready",
        "vmid": vmid,
        "ip_address": ip_address,
        "guacamole_url": guacamole_url,
        "template_vmid": template_vmid,
        "protocol": lab.vm_protocol,
        "port": lab.vm_port
    }

@router.post("/{lab_id}/vm-rollback")
def rollback_vm_session(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """API Khôi phục máy ảo về trạng thái sạch ban đầu cho sinh viên"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    from app.services.vm_service import VMProvisionError, rollback_student_vm
    try:
        success = rollback_student_vm(
            student_username=current_user.username,
            lab_id=lab.id,
        )
    except VMProvisionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"message": "Đã gửi yêu cầu khôi phục máy ảo về bản sạch thành công", "success": success}

@router.post("/{lab_id}/vm-screenshot")
def take_vm_screenshot(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """
    API Chụp ảnh màn hình máy ảo và lưu trực tiếp vào Desktop bên trong máy ảo.
    - Không tải file ra ngoài máy thật.
    - Nếu lab cấu hình disable_vm_copy (chặn copy), ảnh được bảo toàn lưu trữ an toàn trong VM.
    """
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
    if not lab.enable_vm:
        raise HTTPException(status_code=400, detail="Bài lab này không kích hoạt máy ảo")

    from app.services.vm_service import get_pve_client, _find_student_vm, save_vm_screenshot_to_desktop
    proxmox = get_pve_client()
    if not proxmox:
        raise HTTPException(status_code=503, detail="Không thể kết nối máy chủ Proxmox VE")

    try:
        resources = proxmox.cluster.resources.get(type="vm")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lỗi kiểm tra máy ảo Proxmox: {str(exc)}")

    existing_vm = _find_student_vm(resources, current_user.username, lab.id)
    if not existing_vm or existing_vm.get("status") != "running":
        raise HTTPException(status_code=400, detail="Máy ảo của bạn chưa được khởi động hoặc đang tắt")

    vmid = int(existing_vm["vmid"])
    is_windows = (lab.vm_protocol == "rdp")

    try:
        result = save_vm_screenshot_to_desktop(vmid=vmid, is_windows=is_windows)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/{lab_id}/vm-exam-submit")
def submit_exam_from_vm(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """
    API Nộp bài kiểm tra trực tiếp từ Workspace bên trong VM:
    1. Kiểm tra VM của sinh viên đang chạy trên Proxmox.
    2. Thu gom toàn bộ tài liệu/báo cáo từ C:\\Users\\<Student>\\Desktop\\Exam_Workspace.
    3. Đóng gói thành file zip lưu vào storage hệ thống MalSec.
    4. Tạo hoặc cập nhật bản ghi Submission (status = 'submitted', submitted_at = now).
    """
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
    if not lab.enable_vm:
        raise HTTPException(status_code=400, detail="This lab does not have a virtual machine enabled")

    from app.services.vm_service import get_pve_client, _find_student_vm, backup_vm_workspace
    from app.models import Submission, AuditLog
    import shutil

    proxmox = get_pve_client()
    if not proxmox:
        raise HTTPException(status_code=503, detail="Cannot connect to Proxmox VE hypervisor")

    try:
        resources = proxmox.cluster.resources.get(type="vm")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed checking Proxmox virtual machines: {str(exc)}")

    existing_vm = _find_student_vm(resources, current_user.username, lab.id)
    if not existing_vm or existing_vm.get("status") != "running":
        raise HTTPException(
            status_code=400,
            detail="Your virtual machine is not running or is powered off. Please launch your VM before submitting."
        )

    vmid = int(existing_vm["vmid"])
    backup_file = backup_vm_workspace(vmid, current_user.username, lab.id)
    if not backup_file or not os.path.exists(backup_file):
        raise HTTPException(
            status_code=400,
            detail=(
                "The 'Exam_Workspace' folder on your VM Desktop is empty! "
                "Please save your Word report (.docx) and practical analysis files into Exam_Workspace before submitting."
            )
        )

    # Đưa file vào thư mục uploads chính thức của Submissions
    sub_dir = os.path.join(settings.UPLOAD_DIR, "submissions", f"lab_{lab.id}")
    os.makedirs(sub_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    official_filename = f"Exam_Submission_{current_user.username}_{ts}.zip"
    official_filepath = os.path.join(sub_dir, official_filename)
    shutil.copy2(backup_file, official_filepath)

    new_attachments = []
    docx_found = None

    # Tự động trích xuất file Word .docx nếu sinh viên có để trong workspace
    try:
        import zipfile
        with zipfile.ZipFile(backup_file, 'r') as zf:
            docx_candidates = [f for f in zf.namelist() if f.lower().endswith('.docx') and not os.path.basename(f).startswith('~$')]
            if docx_candidates:
                target_docx = docx_candidates[0]
                docx_name = os.path.basename(target_docx)
                extracted_docx_name = f"Report_{current_user.username}_{ts}_{docx_name}"
                extracted_docx_path = os.path.join(sub_dir, extracted_docx_name)
                with zf.open(target_docx) as source, open(extracted_docx_path, "wb") as target:
                    shutil.copyfileobj(source, target)

                docx_found = {
                    "field_id": "exam_report_docx",
                    "original_filename": docx_name,
                    "saved_filename": extracted_docx_name,
                    "filepath": extracted_docx_path,
                    "uploaded_at": datetime.now().isoformat()
                }
                new_attachments.append(docx_found)
    except Exception as zerr:
        logger.warning(f"[EXAM_SUBMIT] Failed extracting docx from zip: {zerr}")

    # File zip toàn bộ workspace
    new_attachments.append({
        "field_id": "exam_workspace",
        "original_filename": official_filename,
        "saved_filename": official_filename,
        "filepath": official_filepath,
        "uploaded_at": datetime.now().isoformat()
    })

    now = datetime.now()
    submission = db.query(Submission).filter(
        Submission.lab_id == lab.id,
        Submission.student_id == current_user.id
    ).first()

    report_desc = f"Word Report: {docx_found['original_filename']}" if docx_found else "Submitted directly from VM Exam Workspace"

    if not submission:
        submission = Submission(
            lab_id=lab.id,
            student_id=current_user.id,
            answers={"exam_workspace": report_desc},
            file_attachments=new_attachments,
            status="submitted",
            submitted_at=now
        )
        db.add(submission)
    else:
        current_attachments = list(submission.file_attachments or [])
        merged_attachments = new_attachments + [a for a in current_attachments if a.get("field_id") not in ("exam_report_docx", "exam_workspace")]
        submission.file_attachments = merged_attachments
        current_answers = dict(submission.answers or {})
        current_answers["exam_workspace"] = report_desc
        submission.answers = current_answers
        submission.status = "submitted"
        submission.submitted_at = now
        submission.updated_at = now

    # Tính phạt muộn nếu quá hạn
    effective_deadline = lab.deadline
    individual_deadline_str = (lab.individual_extensions or {}).get(current_user.username)
    if individual_deadline_str:
        try:
            effective_deadline = datetime.fromisoformat(individual_deadline_str)
        except Exception:
            pass

    if now > effective_deadline:
        policy = lab.late_policy or {}
        allow_late = policy.get("allow_late", True)
        if not allow_late:
            raise HTTPException(status_code=400, detail="This lab deadline has passed and does not accept late submissions")
        penalty_per_hour = policy.get("penalty_per_hour_percent", 0.0)
        max_penalty = policy.get("max_penalty_percent", 0.0)
        hours_late = (now - effective_deadline).total_seconds() / 3600.0
        calculated_penalty = min(hours_late * penalty_per_hour, max_penalty)
        submission.late_penalty = calculated_penalty

    db.commit()
    db.refresh(submission)

    log = AuditLog(
        user_id=current_user.id,
        action="EXAM_SUBMIT",
        target=f"Submitted exam report from VM for lab '{lab.title}' (ID {lab.id})"
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "status": submission.status,
        "message": f"Exam report submitted successfully from VM! ({docx_found['original_filename'] if docx_found else official_filename})",
        "filename": docx_found["original_filename"] if docx_found else official_filename,
        "file_attachments": submission.file_attachments,
        "submission_id": submission.id,
        "submitted_at": now.isoformat()
    }

@router.get("/{lab_id}/vms")
def get_lab_student_vms(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Lấy danh sách máy ảo sinh viên thuộc bài lab (Giảng viên/Admin)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")

    if current_user.role == "lecturer" and current_user not in lab.class_.users:
        raise HTTPException(status_code=403, detail="Bạn không quản lý bài lab này")

    class_students = [u for u in lab.class_.users if u.role == "student"]
    from app.services.vm_service import list_lab_vms
    return list_lab_vms(lab_id, class_students)

@router.post("/{lab_id}/vms/{vmid}/control")
def control_lab_vm(
    lab_id: int,
    vmid: int,
    payload: Dict[str, str], # {"action": "start"|"stop"|"purge"}
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Điều khiển / Bật / Tắt / Xóa sạch máy ảo sinh viên (Giảng viên/Admin)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")

    if current_user.role == "lecturer" and current_user not in lab.class_.users:
        raise HTTPException(status_code=403, detail="Bạn không quản lý bài lab này")

    action = payload.get("action")
    if not action:
        raise HTTPException(status_code=400, detail="Thiếu thuộc tính action")

    if not (settings.STUDENT_VMID_MIN <= vmid <= settings.STUDENT_VMID_MAX):
        raise HTTPException(
            status_code=400, 
            detail=(
                f"BẢO VỆ AN TOÀN HỆ THỐNG: Hệ thống từ chối thao tác/xóa "
                f"VMID {vmid} do nằm ngoài dải máy ảo sinh viên quy hoạch "
                f"({settings.STUDENT_VMID_MIN} - {settings.STUDENT_VMID_MAX})!"
            )
        )

    from app.services.vm_service import control_student_vm

    result = control_student_vm(vmid, action)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])

    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action=f"vm_{action}",
        target=f"VM {action.upper()} executed on VMID {vmid} (Lab: {lab.title})",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return result

@router.post("/{lab_id}/vms/batch-control")
def batch_control_lab_vms(
    lab_id: int,
    payload: Dict[str, str], # {"action": "stop_all" | "purge_all"}
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """Batch VM management: stop all or purge all student VMs for a lab"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    if current_user.role == "lecturer" and current_user not in lab.class_.users:
        raise HTTPException(status_code=403, detail="You do not manage this lab")

    action = payload.get("action")
    if action not in ["stop_all", "purge_all"]:
        raise HTTPException(status_code=400, detail="Invalid batch action")

    class_students = [u for u in lab.class_.users if u.role == "student"]
    from app.services.vm_service import list_lab_vms, control_student_vm

    vms = list_lab_vms(lab_id, class_students)
    affected_count = 0

    for vm in vms:
        vmid = vm["vmid"]
        status = vm["status"]
        if action == "stop_all" and status == "running":
            control_student_vm(vmid, "stop")
            affected_count += 1
        elif action == "purge_all" and status != "not_created":
            control_student_vm(vmid, "purge")
            affected_count += 1

    action_text = "stop all" if action == "stop_all" else "purge all"
    msg = f"Sent {action_text} command ({affected_count} VMs) for Lab {lab.title}"

    log = AuditLog(
        user_id=current_user.id,
        action=f"vm_batch_{action}",
        target=msg,
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return {"success": True, "message": msg, "affected_count": affected_count}


@router.post("/upload-attachment")
def upload_lab_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(require_lecturer)
):
    """API tải tệp tài liệu đính kèm cho bài lab (Giảng viên/Admin)"""
    is_image = file.filename.split('.')[-1].lower() in {'png', 'jpg', 'jpeg'}
    saved_file_info = FileService.save_uploaded_file(file, is_image=is_image)
    
    return {
        "filename": saved_file_info["saved_filename"],
        "original_filename": saved_file_info["original_filename"],
        "filepath": saved_file_info["filepath"],
        "size_bytes": saved_file_info.get("size_bytes", 0),
        "sha256": saved_file_info.get("sha256", "N/A"),
        "uploaded_at": saved_file_info.get("uploaded_at")
    }


@router.get("/vm-tools/my-files", response_model=List[Dict[str, Any]])
def list_my_vm_tool_files(
    scope: str = Query("private", description="'private' for lecturer private drive, 'common' for global drive D:"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Liệt kê danh sách các file trong không gian riêng hoặc không gian chung của Giảng viên (kèm thông tin người sở hữu)"""
    from app.services.iso_tool_service import IsoToolService
    try:
        resolved_scope = "common" if scope == "common" else f"lecturer_{current_user.username}"
        files = IsoToolService.list_files(scope=resolved_scope)
        
        # Lấy thông tin owner từ CSDL
        records = db.query(VmToolFile).filter(VmToolFile.scope == resolved_scope).all()
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
                # Nếu file có sẵn từ trước hoặc do admin đặt trực tiếp trên host
                f["owner_id"] = None
                f["owner_username"] = "system"
                f["owner_name"] = "System / Admin"
            
            # Giảng viên chỉ có quyền xóa nếu là Admin hoặc là chính chủ nhân upload file
            can_delete = (current_user.role == "admin") or (resolved_scope != "common") or (f["owner_username"] == current_user.username)
            f["can_delete"] = can_delete
            enriched_files.append(f)

        return enriched_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vm-tools/my-files")
def upload_my_vm_tool_file(
    request: Request,
    file: UploadFile = File(...),
    scope: str = Form("private"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Upload file vào không gian riêng hoặc không gian chung của Giảng viên"""
    from app.services.iso_tool_service import IsoToolService
    try:
        resolved_scope = "common" if scope == "common" else f"lecturer_{current_user.username}"
        result = IsoToolService.upload_file(file, scope=resolved_scope)
        
        # Lưu hoặc cập nhật record người sở hữu trong CSDL
        existing_rec = db.query(VmToolFile).filter(
            VmToolFile.filename == result['filename'],
            VmToolFile.scope == resolved_scope
        ).first()

        if existing_rec:
            existing_rec.uploaded_by_id = current_user.id
            existing_rec.size_bytes = result['size_bytes']
        else:
            new_rec = VmToolFile(
                filename=result['filename'],
                scope=resolved_scope,
                uploaded_by_id=current_user.id,
                size_bytes=result['size_bytes']
            )
            db.add(new_rec)
        
        target_desc = f"Common Drive D: (Global)" if resolved_scope == "common" else f"Private Drive D: [{resolved_scope}]"
        log = AuditLog(
            user_id=current_user.id,
            action="lecturer_vm_tool_upload",
            target=f"Uploaded {result['filename']} ({result['size_bytes']} bytes) to {target_desc}",
            ip_address=get_client_ip(request)
        )
        db.add(log)
        db.commit()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/vm-tools/my-files/{filename}")
def delete_my_vm_tool_file(
    filename: str,
    request: Request,
    scope: str = Query("private"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Xóa file khỏi không gian riêng hoặc không gian chung (chỉ chủ sở hữu hoặc admin mới được xóa)"""
    from app.services.iso_tool_service import IsoToolService
    try:
        resolved_scope = "common" if scope == "common" else f"lecturer_{current_user.username}"
        
        # Kiểm tra quyền: nếu là không gian chung và user không phải admin
        if resolved_scope == "common" and current_user.role != "admin":
            rec = db.query(VmToolFile).filter(
                VmToolFile.filename == filename,
                VmToolFile.scope == "common"
            ).first()
            if not rec or rec.uploaded_by_id != current_user.id:
                raise HTTPException(
                    status_code=403, 
                    detail="Permission denied: You can only delete files that you uploaded in Common Drive D:. Other instructors' or system files can only be deleted by an Administrator."
                )

        IsoToolService.delete_file(filename, scope=resolved_scope)
        
        # Xóa record CSDL nếu có
        db.query(VmToolFile).filter(
            VmToolFile.filename == filename,
            VmToolFile.scope == resolved_scope
        ).delete(synchronize_session=False)

        target_desc = f"Common Drive D: (Global)" if resolved_scope == "common" else f"Private Drive D: [{resolved_scope}]"
        log = AuditLog(
            user_id=current_user.id,
            action="lecturer_vm_tool_delete",
            target=f"Deleted {filename} from {target_desc}",
            ip_address=get_client_ip(request)
        )
        db.add(log)
        db.commit()
        return {"success": True, "message": f"Successfully deleted {filename} from {target_desc}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



