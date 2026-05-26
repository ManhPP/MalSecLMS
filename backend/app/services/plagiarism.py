import re
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models import Submission, User

class PlagiarismService:
    @staticmethod
    def tokenize(text: str) -> set:
        """Làm sạch văn bản, tách thành tập hợp các từ (tokens)"""
        if not text:
            return set()
        # Chuyển chữ thường, loại bỏ ký tự đặc biệt, giữ lại ký tự alphanumeric Tiếng Việt
        cleaned_text = re.sub(r'[^\w\s]', '', text.lower())
        # Tách từ bằng khoảng trắng
        tokens = set(cleaned_text.split())
        # Loại bỏ các stopword siêu phổ biến nếu cần, ở đây giữ nguyên để tính Jaccard
        return {t for t in tokens if len(t) > 1}

    @staticmethod
    def calculate_jaccard_similarity(text1: str, text2: str) -> float:
        """Tính chỉ số tương đồng Jaccard giữa hai chuỗi văn bản (từ 0.0 đến 100.0)"""
        tokens1 = PlagiarismService.tokenize(text1)
        tokens2 = PlagiarismService.tokenize(text2)
        
        if not tokens1 or not tokens2:
            return 0.0
            
        intersection = tokens1.intersection(tokens2)
        union = tokens1.union(tokens2)
        
        similarity = (len(intersection) / len(union)) * 100.0
        return round(similarity, 2)

    @staticmethod
    def check_submission(
        db: Session, 
        current_sub: Submission, 
        form_fields: List[Dict[str, Any]], 
        threshold: float = 70.0
    ) -> Tuple[bool, float, List[Dict[str, Any]]]:
        """
        Quét đạo văn bài nộp mới:
        Chỉ kiểm tra các trường dạng tự luận tự gõ (textarea)
        Bỏ qua các mã băm MD5/SHA256, trường chọn, file tải lên để tránh cảnh báo sai
        """
        # 1. Tìm danh sách các field_id là tự luận (textarea)
        textarea_fields = {}
        for field in form_fields:
            if field.get("type") == "textarea":
                textarea_fields[field.get("id")] = field.get("label", "Câu hỏi tự luận")

        if not textarea_fields:
            # Không có câu hỏi tự luận nào, không cần quét đạo văn
            return False, 0.0, []

        is_plagiarized = False
        max_score = 0.0
        details = []

        # 2. Lấy tất cả các bài nộp khác đã nộp của bài lab này (trừ bài hiện tại)
        other_subs = db.query(Submission).filter(
            Submission.lab_id == current_sub.lab_id,
            Submission.id != current_sub.id,
            Submission.status.in_(["submitted", "graded"]) # Chỉ so sánh với các bài đã nộp thực tế
        ).all()

        # 3. So khớp từng trường tự luận với từng bài nộp khác
        for other_sub in other_subs:
            other_student = db.query(User).filter(User.id == other_sub.student_id).first()
            student_name = other_student.full_name if other_student else f"Sinh viên ID {other_sub.student_id}"

            for field_id, field_label in textarea_fields.items():
                text_curr = current_sub.answers.get(field_id, "")
                text_other = other_sub.answers.get(field_id, "")

                # Chỉ so sánh nếu cả 2 đều có nội dung dài (> 20 ký tự)
                if len(text_curr) > 20 and len(text_other) > 20:
                    sim = PlagiarismService.calculate_jaccard_similarity(text_curr, text_other)
                    
                    if sim >= threshold:
                        is_plagiarized = True
                        if sim > max_score:
                            max_score = sim
                        
                        details.append({
                            "matched_student": student_name,
                            "matched_field_id": field_id,
                            "matched_field_label": field_label,
                            "similarity_score": sim,
                            "snippet_current": text_curr[:100] + "...",
                            "snippet_matched": text_other[:100] + "..."
                        })

        return is_plagiarized, max_score, details
