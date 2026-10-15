from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.database import get_db
from app.models import User, Class, ClassPost, ClassComment, AuditLog
from app.schemas import ClassPostCreate, ClassPostOut, ClassCommentCreate, ClassCommentOut
from app.security import require_any_user, get_current_user
from app.request_utils import get_client_ip
from app.logging_config import logger

router = APIRouter(prefix="/community", tags=["Class Community Posts & Comments"])


def _check_class_membership(class_id: int, user: User, db: Session) -> Class:
    """Xác thực người dùng có thuộc lớp học này hay không"""
    cl = db.query(Class).filter(Class.id == class_id).first()
    if not cl:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
    if user.role != "admin":
        if cl not in user.classes:
            raise HTTPException(status_code=403, detail="Bạn không thuộc lớp học này")
    return cl


@router.get("/class/{class_id}/posts", response_model=List[ClassPostOut])
def get_class_posts(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Lấy danh sách các bài đăng và bình luận của bảng tin lớp học"""
    _check_class_membership(class_id, current_user, db)
    posts = db.query(ClassPost).filter(
        ClassPost.class_id == class_id
    ).order_by(ClassPost.created_at.desc()).all()
    return posts


@router.post("/class/{class_id}/posts", response_model=ClassPostOut)
def create_class_post(
    class_id: int,
    payload: ClassPostCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Đăng bài viết mới lên bảng tin lớp học (Giảng viên, Sinh viên, Admin)"""
    cl = _check_class_membership(class_id, current_user, db)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Nội dung bài viết không được để trống")

    post = ClassPost(
        class_id=class_id,
        author_id=current_user.id,
        content=content
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    logger.info(f"[CLASS_STREAM] User {current_user.username} posted to Class {cl.name} (PostID: {post.id})")
    return post


@router.delete("/posts/{post_id}", response_model=Dict[str, Any])
def delete_class_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Xóa bài đăng (Chính tác giả, Giảng viên phụ trách lớp, hoặc Admin)"""
    post = db.query(ClassPost).filter(ClassPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    cl = db.query(Class).filter(Class.id == post.class_id).first()
    is_author = (post.author_id == current_user.id)
    is_instructor = (current_user.role in ["lecturer", "admin"] and (cl in current_user.classes or current_user.role == "admin"))

    if not (is_author or is_instructor):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài đăng này")

    db.delete(post)
    db.commit()
    return {"success": True, "message": "Đã xóa bài viết thành công"}


@router.post("/posts/{post_id}/comments", response_model=ClassCommentOut)
def create_class_comment(
    post_id: int,
    payload: ClassCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Bình luận trên bài đăng của bảng tin lớp học"""
    post = db.query(ClassPost).filter(ClassPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    _check_class_membership(post.class_id, current_user, db)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Nội dung bình luận không được để trống")

    comment = ClassComment(
        post_id=post_id,
        author_id=current_user.id,
        content=content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    logger.info(f"[CLASS_STREAM] Comment added by {current_user.username} on Post #{post.id}")
    return comment


@router.delete("/comments/{comment_id}", response_model=Dict[str, Any])
def delete_class_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Xóa bình luận (Chính tác giả, Giảng viên quản lý lớp hoặc Admin)"""
    comment = db.query(ClassComment).filter(ClassComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Không tìm thấy bình luận")

    post = db.query(ClassPost).filter(ClassPost.id == comment.post_id).first()
    cl = db.query(Class).filter(Class.id == post.class_id).first() if post else None

    is_author = (comment.author_id == current_user.id)
    is_instructor = (current_user.role in ["lecturer", "admin"] and (cl in current_user.classes or current_user.role == "admin"))

    if not (is_author or is_instructor):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bình luận này")

    db.delete(comment)
    db.commit()
    return {"success": True, "message": "Đã xóa bình luận thành công"}
