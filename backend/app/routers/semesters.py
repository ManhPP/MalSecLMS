from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Semester, Class, User, AuditLog
from app.schemas import SemesterOut, SemesterCreate, SemesterUpdate
from app.security import require_admin, require_any_user
from app.request_utils import get_client_ip

router = APIRouter(prefix="/semesters", tags=["Semesters"])

@router.get("/", response_model=List[SemesterOut])
def get_semesters(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_user)
):
    """Retrieve all academic semesters (ordered by active first, then newest first)"""
    return db.query(Semester).order_by(Semester.is_active.desc(), Semester.id.desc()).all()

@router.post("/", response_model=SemesterOut, status_code=status.HTTP_201_CREATED)
def create_semester(
    sem_data: SemesterCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new semester (Admin only)"""
    clean_name = sem_data.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Semester name cannot be empty")
        
    existing = db.query(Semester).filter(Semester.name.ilike(clean_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Semester '{clean_name}' already exists")

    # If new semester is marked active, deactivate others
    if sem_data.is_active:
        db.query(Semester).update({"is_active": False})

    new_sem = Semester(
        name=clean_name,
        description=(sem_data.description or "").strip() or None,
        is_active=bool(sem_data.is_active)
    )
    db.add(new_sem)
    db.commit()
    db.refresh(new_sem)

    log = AuditLog(
        user_id=current_user.id,
        action="CREATE_SEMESTER",
        target=f"Semester: {new_sem.name} (Active: {new_sem.is_active})",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return new_sem

@router.put("/{semester_id}/activate", response_model=SemesterOut)
def set_active_semester(
    semester_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Set a semester as the current active semester across the system (Admin only)"""
    sem = db.query(Semester).filter(Semester.id == semester_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Deactivate all other semesters
    db.query(Semester).update({"is_active": False})
    sem.is_active = True
    db.commit()
    db.refresh(sem)

    log = AuditLog(
        user_id=current_user.id,
        action="SET_ACTIVE_SEMESTER",
        target=f"Activated Semester: {sem.name}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return sem

@router.put("/{semester_id}", response_model=SemesterOut)
def update_semester(
    semester_id: int,
    sem_data: SemesterUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update semester information (Admin only)"""
    sem = db.query(Semester).filter(Semester.id == semester_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")

    if sem_data.name is not None:
        clean_name = sem_data.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Semester name cannot be empty")
        existing = db.query(Semester).filter(Semester.name.ilike(clean_name), Semester.id != semester_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Semester '{clean_name}' already exists")
        old_name = sem.name
        sem.name = clean_name
        # Update associated classes if semester name changed
        db.query(Class).filter(Class.semester == old_name).update({"semester": clean_name})

    if sem_data.description is not None:
        sem.description = sem_data.description.strip() or None

    if sem_data.is_active is not None:
        if sem_data.is_active:
            db.query(Semester).update({"is_active": False})
            sem.is_active = True
        else:
            sem.is_active = False

    db.commit()
    db.refresh(sem)

    log = AuditLog(
        user_id=current_user.id,
        action="UPDATE_SEMESTER",
        target=f"Semester: {sem.name}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return sem

@router.delete("/{semester_id}", status_code=status.HTTP_200_OK)
def delete_semester(
    semester_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a semester (Admin only). Classes belonging to this semester will have semester set to 'unknown'."""
    sem = db.query(Semester).filter(Semester.id == semester_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")

    # Fallback any classes using this semester to 'unknown'
    db.query(Class).filter(Class.semester == sem.name).update({"semester": "unknown"})

    sem_name = sem.name
    db.delete(sem)
    db.commit()

    log = AuditLog(
        user_id=current_user.id,
        action="DELETE_SEMESTER",
        target=f"Semester: {sem_name}",
        ip_address=get_client_ip(request)
    )
    db.add(log)
    db.commit()

    return {"message": f"Semester '{sem_name}' deleted successfully. Associated classes defaulted to 'unknown'."}
