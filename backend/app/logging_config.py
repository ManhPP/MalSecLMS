import logging
import sys
import os
import time
from sqlalchemy import event
from app.models import AuditLog

# Enforce Hanoi / Vietnam Timezone (Asia/Ho_Chi_Minh, UTC+7)
os.environ["TZ"] = "Asia/Ho_Chi_Minh"
if hasattr(time, "tzset"):
    time.tzset()

# Configure logger
logger = logging.getLogger("malsec")

def setup_logging():
    """Configure structured logging for MalSec."""
    # Root logger formatting
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    
    # Configure malsec logger
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        logger.addHandler(handler)
        
    # Silence noisy dependencies
    logging.getLogger("passlib").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    
    logger.info("[SYSTEM] MalSec Logging System initialized successfully.")


# SQLAlchemy hook to automatically mirror database AuditLogs to stdout
@event.listens_for(AuditLog, "after_insert")
def on_audit_log_insert(mapper, connection, target):
    try:
        user_info = f"UserID:{target.user_id}"
        # Safely check if user relation is loaded in object dict
        user_obj = target.__dict__.get("user")
        if user_obj and hasattr(user_obj, "username"):
            role_str = f" ({user_obj.role})" if hasattr(user_obj, "role") else ""
            user_info = f"{user_obj.username}{role_str}"
            
        ip = target.ip_address or "unknown"
        action = (target.action or "UNKNOWN").upper()
        details = target.target or ""
        
        logger.info(f"[ACTION] User: {user_info} | Action: {action} | IP: {ip} | Details: {details}")
    except Exception as e:
        logger.info(f"[ACTION] UserID: {target.user_id} | Action: {target.action} | IP: {target.ip_address} | Details: {target.target}")
