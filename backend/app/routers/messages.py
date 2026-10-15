from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.database import get_db
from app.models import User, DirectMessage, Class
from app.schemas import DirectMessageCreate, DirectMessageOut, UserOut
from app.security import require_any_user, get_current_user
from app.request_utils import get_client_ip
from app.logging_config import logger

router = APIRouter(prefix="/messages", tags=["Direct Messages"])


@router.get("/contacts", response_model=List[Dict[str, Any]])
def get_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """
    Lấy danh sách các cuộc hội thoại đã có tin nhắn:
    Chỉ hiển thị những người ĐÃ CÓ tin nhắn qua lại (last_msg is not None) hoặc có tin nhắn chưa đọc.
    """
    contacts_map = {}

    if current_user.role == "student":
        # Tìm giảng viên phụ trách các lớp của sinh viên
        for cl in current_user.classes:
            for u in cl.users:
                if u.role in ["lecturer", "admin"] and u.id != current_user.id:
                    contacts_map[u.id] = u
    elif current_user.role == "lecturer":
        # Tìm sinh viên trong các lớp giảng viên phụ trách
        for cl in current_user.classes:
            for u in cl.users:
                if u.role == "student" and u.id != current_user.id:
                    contacts_map[u.id] = u
    else: # admin
        all_users = db.query(User).filter(User.id != current_user.id, User.is_active == True).all()
        for u in all_users:
            contacts_map[u.id] = u

    # Đếm số tin nhắn chưa đọc từ từng contact
    unread_counts = {}
    unread_msgs = db.query(DirectMessage.sender_id).filter(
        DirectMessage.recipient_id == current_user.id,
        DirectMessage.is_read == False
    ).all()
    for row in unread_msgs:
        s_id = row[0]
        unread_counts[s_id] = unread_counts.get(s_id, 0) + 1

    # Lấy tin nhắn cuối cùng với từng contact - CHỈ LẤY AI ĐÃ TỪNG NHẮN TIN
    results = []
    for uid, u in contacts_map.items():
        last_msg = db.query(DirectMessage).filter(
            or_(
                and_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == uid),
                and_(DirectMessage.sender_id == uid, DirectMessage.recipient_id == current_user.id)
            )
        ).order_by(DirectMessage.created_at.desc()).first()

        # Nếu chưa từng nhắn tin và không có unread -> Không hiện trong danh sách hội thoại
        if not last_msg and unread_counts.get(uid, 0) == 0:
            continue

        results.append({
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "email": u.email,
            "unread_count": unread_counts.get(uid, 0),
            "last_message": last_msg.content if last_msg else None,
            "last_message_time": last_msg.created_at.isoformat() if last_msg else None
        })

    # Sắp xếp liên hệ có tin nhắn mới nhất lên đầu
    results.sort(key=lambda c: c["last_message_time"] or "", reverse=True)
    return results


@router.get("/unread-count", response_model=Dict[str, int])
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Lấy tổng số tin nhắn chưa đọc của người dùng hiện tại"""
    count = db.query(DirectMessage).filter(
        DirectMessage.recipient_id == current_user.id,
        DirectMessage.is_read == False
    ).count()
    return {"unread_count": count}


@router.get("/available-recipients", response_model=List[Dict[str, Any]])
def get_available_recipients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """
    Lấy danh sách người có thể bắt đầu nhắn tin mới:
    - Sinh viên CHỈ có thể nhắn cho Giảng viên / Admin (KHÔNG được nhắn cho sinh viên khác).
    - Giảng viên có thể nhắn cho Sinh viên các lớp mình phụ trách.
    - Admin có thể nhắn cho bất kỳ ai.
    """
    recipients_map = {}

    if current_user.role == "student":
        for cl in current_user.classes:
            for u in cl.users:
                if u.role in ["lecturer", "admin"] and u.id != current_user.id and u.is_active:
                    recipients_map[u.id] = {
                        "id": u.id,
                        "username": u.username,
                        "full_name": u.full_name,
                        "role": u.role,
                        "class_name": cl.name
                    }
    elif current_user.role == "lecturer":
        for cl in current_user.classes:
            for u in cl.users:
                if u.role == "student" and u.id != current_user.id and u.is_active:
                    recipients_map[u.id] = {
                        "id": u.id,
                        "username": u.username,
                        "full_name": u.full_name,
                        "role": u.role,
                        "class_name": cl.name
                    }
    else: # admin
        all_users = db.query(User).filter(User.id != current_user.id, User.is_active == True).all()
        for u in all_users:
            recipients_map[u.id] = {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "role": u.role,
                "class_name": "Toàn hệ thống"
            }

    results = list(recipients_map.values())
    results.sort(key=lambda x: (x.get("class_name", ""), x.get("full_name", "")))
    return results


@router.get("/conversation/{other_user_id}", response_model=List[DirectMessageOut])
def get_conversation(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Lấy toàn bộ lịch sử tin nhắn 1-1 giữa người dùng hiện tại và đối phương, đồng thời đánh dấu đã đọc"""
    messages = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == other_user_id),
            and_(DirectMessage.sender_id == other_user_id, DirectMessage.recipient_id == current_user.id)
        )
    ).order_by(DirectMessage.created_at.asc()).all()

    # Đánh dấu các tin nhắn gửi tới mình là đã đọc
    updated = False
    for m in messages:
        if m.recipient_id == current_user.id and not m.is_read:
            m.is_read = True
            updated = True
    if updated:
        db.commit()

    return messages


@router.post("/", response_model=DirectMessageOut)
def send_direct_message(
    payload: DirectMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Gửi tin nhắn riêng: Nghiêm cấm sinh viên nhắn tin riêng cho sinh viên khác"""
    if payload.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể tự gửi tin nhắn cho chính mình")

    recipient = db.query(User).filter(User.id == payload.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Không tìm thấy người nhận tin nhắn")

    # QUY TẮC BẢO MẬT: Sinh viên KHÔNG được phép nhắn tin riêng cho sinh viên khác
    if current_user.role == "student" and recipient.role == "student":
        raise HTTPException(status_code=403, detail="Sinh viên chỉ có thể nhắn tin cho Giảng viên, không được phép nhắn tin riêng cho sinh viên khác")

    clean_content = payload.content.strip()
    if not clean_content:
        raise HTTPException(status_code=400, detail="Nội dung tin nhắn không được để trống")

    new_msg = DirectMessage(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        content=clean_content,
        is_read=False
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    logger.info(f"[CHAT] Message sent from {current_user.username} ({current_user.role}) to {recipient.username} ({recipient.role})")
    return new_msg
