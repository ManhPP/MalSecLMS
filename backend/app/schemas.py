from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- TOKEN & LOGIN SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
    username: str
    email: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class LoginSchema(BaseModel):
    username: str
    password: str

# --- USER SCHEMAS ---
class UserBase(BaseModel):
    username: str
    full_name: str
    role: str
    email: Optional[str] = None
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- CLASS SCHEMAS ---
class ClassBase(BaseModel):
    name: str
    description: Optional[str] = None

class ClassCreate(ClassBase):
    pass

class ClassOut(ClassBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ClassWithStudents(ClassOut):
    users: List[UserOut] = []

    class Config:
        from_attributes = True

# --- LAB SCHEMAS ---
class LabBase(BaseModel):
    title: str
    description: Optional[str] = None
    form_fields: List[Dict[str, Any]] = []
    deadline: datetime
    late_policy: Dict[str, Any] = {
        "allow_late": True,
        "penalty_per_hour_percent": 0.0,
        "max_penalty_percent": 0.0
    }
    individual_extensions: Optional[Dict[str, str]] = {}
    is_active: Optional[bool] = True
    enable_vm: Optional[bool] = True
    template_vmid: Optional[int] = 101
    class_id: int

class LabCreate(LabBase):
    pass

class LabUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    form_fields: Optional[List[Dict[str, Any]]] = None
    deadline: Optional[datetime] = None
    late_policy: Optional[Dict[str, Any]] = None
    individual_extensions: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None
    enable_vm: Optional[bool] = None
    template_vmid: Optional[int] = None
    class_id: Optional[int] = None


class LabOut(LabBase):
    id: int
    created_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- SUBMISSION SCHEMAS ---
class SubmissionBase(BaseModel):
    lab_id: int
    answers: Dict[str, Any] = {}

class SubmissionCreate(SubmissionBase):
    pass

class SubmissionDraft(BaseModel):
    answers: Dict[str, Any] = {}

class SubmissionOut(BaseModel):
    id: int
    lab_id: int
    student_id: int
    student: Optional[UserOut] = None
    answers: Dict[str, Any]
    file_attachments: List[Dict[str, Any]] = []
    status: str
    score: Optional[float] = None
    late_penalty: float
    comment: Optional[str] = None
    submitted_at: Optional[datetime] = None
    updated_at: datetime
    is_plagiarized: bool
    plagiarism_score: float
    plagiarism_details: Optional[List[Dict[str, Any]]] = []

    class Config:
        from_attributes = True

class GradeSubmissionSchema(BaseModel):
    score: float
    comment: Optional[str] = None
    request_resubmit: Optional[bool] = False

# --- AUDIT LOG SCHEMAS ---
class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user: Optional[UserOut] = None
    action: str
    target: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
