import os
import csv
import zipfile
import shutil
from io import BytesIO, StringIO
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.models import Lab, User, Submission, AuditLog, Class
from app.schemas import SubmissionOut, GradeSubmissionSchema
from app.security import (
    require_student, require_lecturer, get_current_user, require_any_user,
    require_any_user_flexible, require_lecturer_flexible
)
from app.services.file_service import FileService
from app.services.plagiarism import PlagiarismService
from app.config import settings
from app.request_utils import get_client_ip
from app.logging_config import logger


router = APIRouter(prefix="/submissions", tags=["Submissions"])

@router.get("/lab/{lab_id}/my", response_model=Optional[SubmissionOut])
def get_my_submission(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """API Sinh viên lấy bài làm hiện tại của mình (bao gồm cả Bản nháp)"""
    return db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.student_id == current_user.id
    ).first()

def _get_student_lab_deadline(lab: Lab, username: str) -> datetime:
    """Lấy thời hạn cuối cùng của sinh viên cho bài lab (tính cả gia hạn cá nhân nếu có)"""
    deadline = lab.deadline
    individual_deadline_str = (lab.individual_extensions or {}).get(username)
    if individual_deadline_str:
        try:
            deadline = datetime.fromisoformat(individual_deadline_str)
        except Exception:
            pass
    return deadline

@router.post("/lab/{lab_id}/draft", response_model=SubmissionOut)
def save_draft(
    lab_id: int,
    payload: Dict[str, Any], # {"answers": {...}}
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """API Tự động lưu bản nháp phía Server (Server-Side Auto-save)"""
    lab = db.query(Lab).filter(Lab.id == lab_id, Lab.is_active == True).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab hoặc bài lab đã đóng")

    # Tìm xem đã có bản ghi nào chưa, nếu chưa thì tạo mới, nếu có rồi thì cập nhật
    submission = db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.student_id == current_user.id
    ).first()

    answers = payload.get("answers", {})

    if not submission:
        submission = Submission(
            lab_id=lab_id,
            student_id=current_user.id,
            answers=answers,
            status="draft"
        )
        db.add(submission)
    else:
        # Nếu đã nộp trước đó nhưng chưa chấm, kiểm tra hạn chót
        if submission.status == "graded":
            raise HTTPException(status_code=400, detail="Bài làm đã được giảng viên chấm điểm, không thể chỉnh sửa")
        
        now = datetime.now()
        effective_deadline = _get_student_lab_deadline(lab, current_user.username)
        
        if submission.status == "submitted":
            if now > effective_deadline:
                raise HTTPException(status_code=400, detail="Bài lab đã hết hạn, không thể chỉnh sửa bài đã nộp")
            # Đang trước hạn: cho phép sinh viên chỉnh sửa nội dung bài làm
            submission.status = "draft"

        submission.answers = answers
        submission.updated_at = now

    db.commit()
    db.refresh(submission)
    return submission

@router.post("/lab/{lab_id}/upload/{field_id}", response_model=Dict[str, Any])
def upload_submission_file(
    lab_id: int,
    field_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """API Tải lên file minh chứng/ảnh chụp màn hình (Tự động lọc mã độc và làm sạch Exif ảnh)"""
    lab = db.query(Lab).filter(Lab.id == lab_id, Lab.is_active == True).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")

    # Xác thực field_id có trong thiết kế Form hay không
    field_config = next((f for f in lab.form_fields if f.get("id") == field_id), None)
    if not field_config:
        raise HTTPException(status_code=400, detail="Trường tải lên không nằm trong cấu hình bài lab")

    # Tìm bản nộp bài nếu có
    submission = db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.student_id == current_user.id
    ).first()

    now = datetime.now()
    effective_deadline = _get_student_lab_deadline(lab, current_user.username)

    if submission:
        if submission.status == "graded":
            raise HTTPException(status_code=400, detail="Bài làm đã được chấm điểm, không thể tải tệp mới")
        if submission.status == "submitted" and now > effective_deadline:
            raise HTTPException(status_code=400, detail="Bài lab đã hết hạn, không thể thay đổi tệp đã nộp")

    # Gọi FileService để kiểm tra định dạng và làm sạch
    is_image = field_config.get("type") == "file" and file.filename.split('.')[-1].lower() in {'png', 'jpg', 'jpeg'}
    
    saved_file_info = FileService.save_uploaded_file(file, is_image=is_image)
    size_kb = saved_file_info.get("size_bytes", 0) / 1024.0
    sha256 = saved_file_info.get("sha256", "N/A")
    logger.info(
        f"[FILE_UPLOAD] User: {current_user.username} | LabID: {lab_id} | "
        f"File: {saved_file_info['original_filename']} ({size_kb:.1f} KB) | SHA256: {sha256}"
    )

    if not submission:
        submission = Submission(
            lab_id=lab_id,
            student_id=current_user.id,
            answers={},
            status="draft"
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
    elif submission.status == "submitted" and now <= effective_deadline:
        submission.status = "draft"

    # Cập nhật danh sách file đính kèm (cho phép đính kèm nhiều file trên cùng 1 trường)
    current_attachments = list(submission.file_attachments or [])
    
    attachment_record = {
        "field_id": field_id,
        "original_filename": saved_file_info["original_filename"],
        "saved_filename": saved_file_info["saved_filename"],
        "filepath": saved_file_info["filepath"],
        "uploaded_at": datetime.now().isoformat()
    }
    
    current_attachments.append(attachment_record)
    submission.file_attachments = current_attachments
    
    # Cập nhật answers[field_id] thành danh sách tên các file đính kèm của field này
    field_file_names = [
        a["original_filename"] for a in current_attachments if a.get("field_id") == field_id
    ]
    current_answers = dict(submission.answers or {})
    current_answers[field_id] = ", ".join(field_file_names)
    submission.answers = current_answers
    
    db.commit()

    return {
        "field_id": field_id,
        "filename": saved_file_info["original_filename"],
        "total_files": len(field_file_names),
        "message": "Tải file lên thành công và đã được quét bảo mật an toàn!"
    }

@router.delete("/lab/{lab_id}/attachment/{field_id}")
def delete_submission_attachment(
    lab_id: int,
    field_id: str,
    filepath: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """API Cho phép sinh viên xóa 1 tệp đính kèm trong bài làm (nếu chưa nộp hoặc trước hạn)"""
    submission = db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.student_id == current_user.id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài làm")

    lab = db.query(Lab).filter(Lab.id == lab_id, Lab.is_active == True).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")

    now = datetime.now()
    effective_deadline = _get_student_lab_deadline(lab, current_user.username)

    if submission.status == "graded":
        raise HTTPException(status_code=400, detail="Bài làm đã được chấm điểm, không thể xóa tệp")
    if submission.status == "submitted" and now > effective_deadline:
        raise HTTPException(status_code=400, detail="Bài lab đã hết hạn, không thể thay đổi tệp đã nộp")

    current_attachments = list(submission.file_attachments or [])
    updated_attachments = [a for a in current_attachments if not (a.get("field_id") == field_id and a.get("filepath") == filepath)]
    
    if len(updated_attachments) == len(current_attachments):
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp đính kèm cần xóa")

    # Xóa tệp vật lý trên đĩa nếu tồn tại trong UPLOAD_DIR
    try:
        normalized_path = os.path.abspath(filepath)
        normalized_upload_dir = os.path.abspath(settings.UPLOAD_DIR)
        if normalized_path.startswith(normalized_upload_dir) and os.path.exists(normalized_path):
            os.remove(normalized_path)
    except Exception as err:
        logger.warning(f"Error removing physical attachment file: {err}")

    submission.file_attachments = updated_attachments
    
    # Cập nhật lại answers[field_id]
    remaining_names = [
        a["original_filename"] for a in updated_attachments if a.get("field_id") == field_id
    ]
    current_answers = dict(submission.answers or {})
    if remaining_names:
        current_answers[field_id] = ", ".join(remaining_names)
    else:
        current_answers.pop(field_id, None)
    submission.answers = current_answers

    if submission.status == "submitted" and now <= effective_deadline:
        submission.status = "draft"

    db.commit()
    db.refresh(submission)

    return {
        "message": "Đã xóa tệp đính kèm thành công",
        "remaining_files": len(remaining_names)
    }

@router.post("/lab/{lab_id}/submit", response_model=SubmissionOut)
def submit_lab(
    lab_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    """API Nộp bài chính thức (Tự động tính phạt muộn & đối khớp chống đạo văn)"""
    lab = db.query(Lab).filter(Lab.id == lab_id, Lab.is_active == True).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")

    submission = db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.student_id == current_user.id
    ).first()

    if not submission:
        raise HTTPException(status_code=400, detail="Bạn chưa điền báo cáo hoặc chưa lưu nháp")

    if submission.status == "graded":
        raise HTTPException(status_code=400, detail="Bài làm đã được giảng viên chấm điểm, không thể nộp lại")

    # 1. Tính toán thời hạn phạt nộp muộn (bao gồm cả Gia hạn cá nhân)
    now = datetime.now()
    deadline = _get_student_lab_deadline(lab, current_user.username)

    # Nếu đã nộp và quá hạn thì không cho nộp lại
    if submission.status == "submitted" and now > deadline:
        raise HTTPException(status_code=400, detail="Bài lab đã hết hạn nộp!")

    late_penalty = 0.0
    if now > deadline:
        late_policy = lab.late_policy or {}
        if not late_policy.get("allow_late", True):
            raise HTTPException(status_code=400, detail="Bài lab đã hết hạn nộp và không cho phép nộp muộn!")
            
        penalty_per_hour = late_policy.get("penalty_per_hour_percent", 0.0)
        max_penalty = late_policy.get("max_penalty_percent", 0.0)
        
        hours_late = (now - deadline).total_seconds() / 3600.0
        calculated_penalty = hours_late * penalty_per_hour
        late_penalty = min(calculated_penalty, max_penalty)

    # 2. Thực hiện quét đạo văn (chỉ so khớp trên các trường tự luận)
    is_plagiarized, plagiarism_score, plagiarism_details = PlagiarismService.check_submission(
        db=db,
        current_sub=submission,
        form_fields=lab.form_fields,
        threshold=75.0
    )

    # Cập nhật trạng thái nộp bài
    submission.status = "submitted"
    submission.submitted_at = now
    submission.late_penalty = round(late_penalty, 2)
    submission.is_plagiarized = is_plagiarized
    submission.plagiarism_score = plagiarism_score
    submission.plagiarism_details = plagiarism_details

    db.commit()
    db.refresh(submission)

    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="submit_lab",
        target=f"Student {current_user.username} submitted Lab {lab.title} (Late penalty: {submission.late_penalty}%)",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return submission

# --- INSTRUCTOR ENDPOINTS ---

@router.get("/lab/{lab_id}/all", response_model=List[SubmissionOut])
def get_all_submissions_for_lab(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Lấy toàn bộ danh sách bài nộp của một bài lab (Giảng viên/Admin)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if current_user.role == "lecturer":
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần chứa bài lab này")
            
    # Lấy toàn bộ sinh viên được phân công vào lớp học phần này
    enrolled_students = []
    if lab.class_:
        enrolled_students = [u for u in lab.class_.users if u.role == "student"]
    else:
        class_obj = db.query(Class).filter(Class.id == lab.class_id).first()
        if class_obj:
            enrolled_students = [u for u in class_obj.users if u.role == "student"]

    existing_subs = db.query(Submission).filter(Submission.lab_id == lab_id).all()
    sub_by_student_id = {s.student_id: s for s in existing_subs}

    # Đảm bảo mọi sinh viên trong lớp đều có bản ghi Submission (kể cả chưa vào hoặc chưa nộp)
    new_stubs = False
    for student in enrolled_students:
        if student.id not in sub_by_student_id:
            stub_sub = Submission(
                lab_id=lab_id,
                student_id=student.id,
                answers={},
                file_attachments=[],
                status="draft",
                score=None,
                late_penalty=0.0
            )
            db.add(stub_sub)
            new_stubs = True

    if new_stubs:
        db.commit()

    # Trả về toàn bộ danh sách sinh viên: ưu tiên các bài đã nộp/đã chấm lên trước, sắp xếp theo tên sinh viên
    all_subs = db.query(Submission).filter(Submission.lab_id == lab_id).all()
    # Sắp xếp có thứ tự ổn định: submitted/graded lên đầu, hoặc theo tên
    all_subs.sort(key=lambda s: (
        0 if s.status in ['submitted', 'graded'] else 1,
        s.student.full_name if s.student else ""
    ))
    return all_subs

@router.get("/class/{class_id}/student/{student_id}")
def get_student_submissions_for_class(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Lấy toàn bộ các bài lab và bài làm tương ứng của một sinh viên cụ thể trong lớp để chấm điểm"""
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học phần")

    if current_user.role == "lecturer" and current_user not in class_.users:
        raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần này")

    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên")

    if student not in class_.users:
        raise HTTPException(status_code=400, detail="Sinh viên không thuộc lớp học phần này")

    # Lấy toàn bộ bài lab thuộc lớp, sắp xếp theo deadline tăng dần / id
    labs = sorted(class_.labs, key=lambda l: (l.deadline or datetime.max, l.id))
    
    # Tìm các bài nộp hiện có của sinh viên cho các lab trong lớp
    lab_ids = [l.id for l in labs]
    existing_subs = db.query(Submission).filter(
        Submission.student_id == student_id,
        Submission.lab_id.in_(lab_ids)
    ).all() if lab_ids else []
    sub_map = {s.lab_id: s for s in existing_subs}

    new_stubs = False
    for lab in labs:
        if lab.id not in sub_map:
            stub = Submission(
                lab_id=lab.id,
                student_id=student_id,
                answers={},
                file_attachments=[],
                status="draft",
                score=None,
                late_penalty=0.0
            )
            db.add(stub)
            sub_map[lab.id] = stub
            new_stubs = True

    if new_stubs:
        db.commit()
        for lab in labs:
            db.refresh(sub_map[lab.id])

    # Convert to response structure
    from app.schemas import UserOut, LabOut, SubmissionOut
    labs_result = []
    for lab in labs:
        sub = sub_map.get(lab.id)
        labs_result.append({
            "lab": LabOut.model_validate(lab),
            "submission": SubmissionOut.model_validate(sub) if sub else None
        })

    return {
        "student": UserOut.model_validate(student),
        "class_id": class_.id,
        "class_name": class_.name,
        "semester": class_.semester,
        "labs": labs_result
    }

@router.post("/{submission_id}/grade", response_model=SubmissionOut)
def grade_submission(
    submission_id: int,
    grading: GradeSubmissionSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Chấm điểm bài làm sinh viên (Speed Grader) - Hỗ trợ yêu cầu làm lại"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài làm")

    if current_user.role == "lecturer":
        lab = db.query(Lab).filter(Lab.id == submission.lab_id).first()
        if not lab:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài lab của bài nộp này")
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần chứa bài nộp này")

    if grading.request_resubmit:
        submission.status = "re_submit_requested"
        submission.score = None
        logger.info(
            f"[GRADE] Instructor: {current_user.username} | SubmissionID: {submission.id} | "
            f"StudentID: {submission.student_id} | Action: Requested Resubmission"
        )
    else:
        submission.status = "graded"
        # Điểm số thực tế sau khi đã áp dụng hình phạt nộp muộn
        # Ví dụ: Điểm chấm 9.0, phạt muộn 20% -> Điểm thực tế = 9.0 * (1 - 0.20) = 7.2
        raw_score = grading.score
        penalty_ratio = (submission.late_penalty or 0.0) / 100.0
        final_score = raw_score * (1.0 - penalty_ratio)
        
        submission.score = round(final_score, 2)
        logger.info(
            f"[GRADE] Instructor: {current_user.username} | SubmissionID: {submission.id} | "
            f"StudentID: {submission.student_id} | RawScore: {raw_score} | "
            f"Penalty: {submission.late_penalty or 0.0}% | FinalScore: {submission.score}"
        )

    submission.comment = grading.comment
    submission.updated_at = datetime.now()
    db.commit()
    db.refresh(submission)

    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="grade_submission",
        target=f"Instructor {current_user.username} graded submission ID {submission.id} (Score: {submission.score})",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return submission

@router.get("/lab/{lab_id}/export")
def export_grades_csv(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer_flexible)
):
    """API Xuất bảng điểm lớp học ra file CSV theo chuẩn định dạng Phòng đào tạo"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if current_user.role == "lecturer":
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần chứa bài lab này")

    submissions = db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.status.in_(["submitted", "graded"])
    ).all()

    # Dựng file CSV trong RAM
    f = StringIO()
    writer = csv.writer(f)
    
    # Viết tiêu đề
    writer.writerow([f"BẢNG ĐIỂM BÀI TẬP LAB: {lab.title.upper()}"])
    writer.writerow(["MSSV", "Họ và Tên", "Trạng thái", "Điểm phạt muộn (%)", "Điểm số cuối cùng", "Giảng viên nhận xét", "Thời gian nộp"])
    
    for sub in submissions:
        student = db.query(User).filter(User.id == sub.student_id).first()
        if student:
            writer.writerow([
                student.username,
                student.full_name,
                sub.status,
                f"{sub.late_penalty}%",
                sub.score if sub.score is not None else "Chưa chấm",
                sub.comment or "",
                sub.submitted_at.isoformat() if sub.submitted_at else ""
            ])

    f.seek(0)
    csv_content = f.getvalue()
    csv_bytes = csv_content.encode("utf-8-sig")
    
    response = StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=Bang_diem_lab_{lab_id}.csv"
    return response

@router.get("/lab/{lab_id}/bulk-download")
def bulk_download_submissions(
    lab_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer_flexible)
):
    """API Tải về toàn bộ bài nộp của cả lớp được đóng gói trong một file .zip duy nhất (Minh chứng đào tạo)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")
        
    if current_user.role == "lecturer":
        class_exists = db.query(Class).filter(Class.id == lab.class_id).first()
        if not class_exists or current_user not in class_exists.users:
            raise HTTPException(status_code=403, detail="Bạn không quản lý lớp học phần chứa bài lab này")

    submissions = db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.status.in_(["submitted", "graded"])
    ).all()

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for sub in submissions:
            student = db.query(User).filter(User.id == sub.student_id).first()
            if not student:
                continue

            student_folder = f"{student.username}_{student.full_name.replace(' ', '_')}"

            # 1. Tạo file báo cáo text/tự luận của sinh viên
            report_content = f"BÁO CÁO KẾT QUẢ THỰC HÀNH LAB: {lab.title}\n"
            report_content += f"Sinh viên: {student.full_name} (MSSV: {student.username})\n"
            report_content += f"Thời gian nộp: {sub.submitted_at.isoformat() if sub.submitted_at else 'N/A'}\n"
            report_content += f"Phạt nộp muộn: {sub.late_penalty}%\n"
            report_content += "--------------------------------------------------\n\n"

            for field in lab.form_fields:
                field_id = field.get("id")
                label = field.get("label", "")
                answer = sub.answers.get(field_id, "")
                report_content += f"** {label} **\n{answer}\n\n"

            zf.writestr(f"{student_folder}/Bao_cao_tong_hop.txt", report_content)

            # 2. Đóng gói các file đính kèm của sinh viên đó vào thư mục tương ứng
            for attachment in sub.file_attachments:
                filepath = attachment.get("filepath")
                original_filename = attachment.get("original_filename")
                if filepath and os.path.exists(filepath):
                    zf.write(filepath, f"{student_folder}/files/{original_filename}")

    zip_buffer.seek(0)
    response = StreamingResponse(
        zip_buffer,
        media_type="application/zip"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=Bulk_Submissions_Lab_{lab_id}.zip"
    
    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="bulk_download",
        target=f"Bulk downloaded submissions for Lab ID {lab.id}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()
    
    return response

@router.get("/file")
def get_submission_file(
    path: str,
    download: bool = False,
    current_user: User = Depends(require_any_user_flexible),
    db: Session = Depends(get_db)
):
    """API để xem hoặc tải tệp đính kèm (Yêu cầu đăng nhập, chống Path Traversal)"""
    # 1. Ngăn chặn Path Traversal
    normalized_path = os.path.abspath(path)
    normalized_upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    
    if not normalized_path.startswith(normalized_upload_dir):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Truy cập bị từ chối: Đường dẫn không hợp lệ"
        )
        
    # 2. Kiểm tra sự tồn tại của tệp
    if not os.path.exists(normalized_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tệp tin không tồn tại trên hệ thống"
        )
        
    # 3. Phân quyền truy cập tệp
    if current_user.role == "student":
        student_class_ids = [c.id for c in current_user.classes]
        allowed = False
        
        # Kiểm tra xem file có thuộc tài liệu bài lab của các lớp sinh viên tham gia không
        student_labs = db.query(Lab).filter(Lab.class_id.in_(student_class_ids), Lab.is_active == True).all()
        for l in student_labs:
            lab_files = l.attachment_files or []
            if any(att.get("filepath") == path for att in lab_files):
                allowed = True
                break

        if not allowed:
            # Kiểm tra xem file có thuộc bài nộp của chính sinh viên này không
            student_subs = db.query(Submission).filter(Submission.student_id == current_user.id).all()
            for sub in student_subs:
                attachments = sub.file_attachments or []
                if any(att.get("filepath") == path for att in attachments):
                    allowed = True
                    break
                    
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập tệp tin này"
            )
    elif current_user.role == "lecturer":
        lecturer_class_ids = [c.id for c in current_user.classes]
        allowed = False

        # Kiểm tra xem file có thuộc tài liệu bài lab của các lớp giảng viên quản lý không
        lecturer_labs = db.query(Lab).filter(Lab.class_id.in_(lecturer_class_ids)).all()
        for l in lecturer_labs:
            lab_files = l.attachment_files or []
            if any(att.get("filepath") == path for att in lab_files):
                allowed = True
                break

        if not allowed:
            # Kiểm tra xem file có thuộc bài nộp của lớp giảng viên quản lý không
            all_subs = db.query(Submission).all()
            for sub in all_subs:
                attachments = sub.file_attachments or []
                if any(att.get("filepath") == path for att in attachments):
                    lab = db.query(Lab).filter(Lab.id == sub.lab_id).first()
                    if lab and lab.class_id in lecturer_class_ids:
                        allowed = True
                        break
                        
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không quản lý lớp học chứa bài lab hoặc bài nộp có tệp tin này"
            )

    # 4. Phục vụ tệp
    filename = os.path.basename(normalized_path)
    # Nếu là download, gửi kèm header Content-Disposition
    if download:
        return FileResponse(
            path=normalized_path,
            filename=filename,
            media_type="application/octet-stream"
        )
        
    # Xác định media type cơ bản cho hiển thị ảnh, văn bản và source code
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    media_type = "application/octet-stream"
    if ext in ['png', 'jpg', 'jpeg']:
        media_type = f"image/{'jpeg' if ext == 'jpg' else ext}"
    elif ext == 'pdf':
        media_type = "application/pdf"
    elif ext == 'docx':
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif ext in ['txt', 'log', 'c', 'cpp', 'h', 'hpp', 'py', 'java', 'asm', 's', 'js', 'ts', 'html', 'css', 'sql', 'sh', 'ps1', 'rs', 'go']:
        media_type = "text/plain; charset=utf-8"
    elif ext == 'json':
        media_type = "application/json"
        
    return FileResponse(path=normalized_path, media_type=media_type)
