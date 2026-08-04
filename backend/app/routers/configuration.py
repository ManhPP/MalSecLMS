from fastapi import APIRouter, Depends

from app.config import settings
from app.models import User
from app.security import require_any_user


router = APIRouter(prefix="/config", tags=["Runtime Configuration"])


@router.get("/client")
def get_client_configuration(
    current_user: User = Depends(require_any_user),
):
    """Expose only non-secret settings needed to render the authenticated UI."""
    return {
        "vm": {
            "default_template_vmid": settings.DEFAULT_TEMPLATE_VMID,
            "default_protocol": settings.DEFAULT_VM_PROTOCOL,
            "protocol_ports": settings.VM_PROTOCOL_PORTS,
            "template_vmid_min": settings.TEMPLATE_VMID_MIN,
            "template_vmid_max": settings.TEMPLATE_VMID_MAX,
            "student_vmid_min": settings.STUDENT_VMID_MIN,
            "student_vmid_max": settings.STUDENT_VMID_MAX,
        },
        "uploads": {
            "allowed_extensions": sorted(settings.ALLOWED_EXTENSIONS),
            "zip_password": settings.MALWARE_ZIP_PASSWORD,
            "max_file_size_mb": settings.MAX_FILE_SIZE_MB,
        },
    }
