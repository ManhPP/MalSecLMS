from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, Float, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from app.config import settings
from app.database import Base

# Bảng trung gian n-n giữa Người dùng và Lớp học
user_class_association = Table(
    'user_class',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('class_id', Integer, ForeignKey('classes.id', ondelete='CASCADE'), primary_key=True)
)

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin, lecturer, student
    email = Column(String, unique=True, index=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classes = relationship('Class', secondary=user_class_association, back_populates='users')
    submissions = relationship('Submission', back_populates='student')
    audit_logs = relationship('AuditLog', back_populates='user')

class Class(Base):
    __tablename__ = 'classes'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship('User', secondary=user_class_association, back_populates='classes')
    labs = relationship('Lab', back_populates='class_', cascade='all, delete-orphan')


class Lab(Base):
    __tablename__ = 'labs'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # form_fields lưu mảng cấu hình câu hỏi động dạng JSONB
    # [{id: "q1", type: "text"|"textarea"|"select"|"file", label: "...", options: ["...", "..."], required: true}]
    form_fields = Column(JSONB, nullable=False, server_default='[]')
    
    deadline = Column(DateTime, nullable=False)
    
    # late_policy lưu cấu hình phạt nộp muộn
    # {allow_late: true, penalty_per_hour_percent: 1.0, max_penalty_percent: 50.0}
    late_policy = Column(JSONB, nullable=False, server_default='{"allow_late": true, "penalty_per_hour_percent": 0.0, "max_penalty_percent": 0.0}')
    
    # individual_extensions lưu danh sách gia hạn cá nhân dạng JSONB: {student_username: new_deadline}
    individual_extensions = Column(JSONB, nullable=True, server_default='{}')
    
    is_active = Column(Boolean, default=True)
    enable_vm = Column(Boolean, default=True, server_default='true', nullable=False)
    template_vmid = Column(
        Integer, default=lambda: settings.DEFAULT_TEMPLATE_VMID, nullable=False
    )
    vm_protocol = Column(
        String, default=lambda: settings.DEFAULT_VM_PROTOCOL, nullable=False
    )
    vm_port = Column(Integer, default=lambda: settings.DEFAULT_VM_PORT, nullable=False)
    vm_username = Column(String, nullable=True)
    vm_password = Column(String, nullable=True)
    class_id = Column(Integer, ForeignKey('classes.id', ondelete='CASCADE'), nullable=False)

    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    class_ = relationship('Class', back_populates='labs')
    created_by = relationship('User')
    submissions = relationship('Submission', back_populates='lab', cascade='all, delete-orphan')

class Submission(Base):
    __tablename__ = 'submissions'

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey('labs.id', ondelete='CASCADE'), nullable=False)
    student_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # answers lưu câu trả lời động dạng JSONB: {q1: "Mã MD5...", q2: "Assembly...", q3: "Tải ảnh..."}
    answers = Column(JSONB, nullable=False, server_default='{}')
    
    # file_attachments lưu danh sách file đính kèm thực tế: [{field_id: "q3", filename: "image.png", filepath: "/app/uploads/..."}]
    file_attachments = Column(JSONB, nullable=False, server_default='[]')
    
    status = Column(String, default='draft')  # draft, submitted, graded, re_submit_requested
    
    score = Column(Float, nullable=True)
    late_penalty = Column(Float, default=0.0)
    comment = Column(String, nullable=True)
    
    submitted_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Chống đạo văn
    is_plagiarized = Column(Boolean, default=False)
    plagiarism_score = Column(Float, default=0.0)  # % trùng lặp
    plagiarism_details = Column(JSONB, nullable=True, server_default='[]')  # chi tiết trùng lặp: {student: "SV A", matched_field: "q2", score: 85.0}

    # Relationships
    lab = relationship('Lab', back_populates='submissions')
    student = relationship('User', back_populates='submissions')

class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = Column(String, nullable=False)  # login, create_user, update_score, submit_lab, etc.
    target = Column(String, nullable=True)  # Chi tiết đối tượng bị tác động
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship('User', back_populates='audit_logs')
