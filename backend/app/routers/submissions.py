import os
import csv
import zipfile
import shutil
from io import BytesIO, StringIO
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.models import Lab, User, Submission, AuditLog, Class
from app.schemas import SubmissionOut, GradeSubmissionSchema
from app.security import require_student, require_lecturer, get_current_user, require_any_user
from app.services.file_service import FileService
from app.services.plagiarism import PlagiarismService

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
        # Nếu đang ở trạng thái nháp hoặc cần nộp lại thì cho phép lưu
        if submission.status not in ["draft", "re_submit_requested"]:
            raise HTTPException(status_code=400, detail="Bài làm đã nộp trước đó, không thể sửa nháp")
        submission.answers = answers
        submission.updated_at = datetime.utcnow()

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

    # Gọi FileService để kiểm tra định dạng và làm sạch
    is_image = field_config.get("type") == "file" and file.filename.split('.')[-1].lower() in {'png', 'jpg', 'jpeg'}
    
    saved_file_info = FileService.save_uploaded_file(file, is_image=is_image)

    # Tìm hoặc tạo bản nộp bài nháp để liên kết file đính kèm
    submission = db.query(Submission).filter(
        Submission.lab_id == lab_id,
        Submission.student_id == current_user.id
    ).first()

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

    # Cập nhật thông tin file đính kèm vào submission
    current_attachments = list(submission.file_attachments or [])
    # Xóa file cũ liên kết với trường này nếu có
    current_attachments = [a for a in current_attachments if a.get("field_id") != field_id]
    
    attachment_record = {
        "field_id": field_id,
        "original_filename": saved_file_info["original_filename"],
        "saved_filename": saved_file_info["saved_filename"],
        "filepath": saved_file_info["filepath"],
        "uploaded_at": datetime.utcnow().isoformat()
    }
    
    current_attachments.append(attachment_record)
    submission.file_attachments = current_attachments
    
    # Đồng thời lưu tên file vào trường text của câu hỏi để hiển thị
    current_answers = dict(submission.answers or {})
    current_answers[field_id] = saved_file_info["original_filename"]
    submission.answers = current_answers
    
    db.commit()

    return {
        "field_id": field_id,
        "filename": saved_file_info["original_filename"],
        "message": "Tải file lên thành công và đã được quét bảo mật an toàn!"
    }

@router.post("/lab/{lab_id}/submit", response_model=SubmissionOut)
def submit_lab(
    lab_id: int,
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

    if submission.status not in ["draft", "re_submit_requested"]:
        raise HTTPException(status_code=400, detail="Bài làm đã được nộp trước đó")

    # 1. Tính toán thời hạn phạt nộp muộn (bao gồm cả Gia hạn cá nhân)
    now = datetime.utcnow()
    deadline = lab.deadline
    
    # Kiểm tra gia hạn riêng cá nhân
    individual_deadline_str = (lab.individual_extensions or {}).get(current_user.username)
    if individual_deadline_str:
        try:
            deadline = datetime.fromisoformat(individual_deadline_str)
        except Exception:
            pass

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

    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="submit_lab",
        target=f"Sinh viên {current_user.username} nộp bài Lab {lab.title} (Phạt muộn: {submission.late_penalty}%)",
        ip_address="127.0.0.1"
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
    return db.query(Submission).filter(Submission.lab_id == lab_id).order_by(Submission.submitted_at.desc()).all()

@router.post("/{submission_id}/grade", response_model=SubmissionOut)
def grade_submission(
    submission_id: int,
    grading: GradeSubmissionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Chấm điểm bài làm sinh viên (Speed Grader) - Hỗ trợ yêu cầu làm lại"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài làm")

    if grading.request_resubmit:
        submission.status = "re_submit_requested"
        submission.score = None
    else:
        submission.status = "graded"
        # Điểm số thực tế sau khi đã áp dụng hình phạt nộp muộn
        # Ví dụ: Điểm chấm 9.0, phạt muộn 20% -> Điểm thực tế = 9.0 * (1 - 0.20) = 7.2
        raw_score = grading.score
        penalty_ratio = (submission.late_penalty or 0.0) / 100.0
        final_score = raw_score * (1.0 - penalty_ratio)
        
        submission.score = round(final_score, 2)

    submission.comment = grading.comment
    submission.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(submission)

    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="grade_submission",
        target=f"Giảng viên {current_user.username} chấm điểm bài làm ID {submission.id} (Điểm: {submission.score})",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()

    return submission

@router.get("/lab/{lab_id}/export")
def export_grades_csv(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Xuất bảng điểm lớp học ra file CSV theo chuẩn định dạng Phòng đào tạo"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")

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
    response = StreamingResponse(
        iter([f.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=Bang_diem_lab_{lab_id}.csv"
    return response

@router.get("/lab/{lab_id}/bulk-download")
def bulk_download_submissions(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer)
):
    """API Tải về toàn bộ bài nộp của cả lớp được đóng gói trong một file .zip duy nhất (Minh chứng đào tạo)"""
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài lab")

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
    
    # Ghi log hoạt động
    log = AuditLog(
        user_id=current_user.id,
        action="bulk_download",
        target=f"Tải hàng loạt minh chứng bài Lab ID {lab.id}",
        ip_address="127.0.0.1"
    )
    db.add(log)
    db.commit()
    
    return response
