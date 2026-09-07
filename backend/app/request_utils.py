from fastapi import Request
from jose import jwt
from app.config import settings


def get_client_ip(request: Request) -> str:
    """Return the real client IP, prioritizing Cloudflare Tunnel, then reverse proxy headers."""
    # 1. Cloudflare Connecting IP (direct visitor IP behind Cloudflare Tunnel)
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    # 2. X-Real-IP
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    # 3. X-Forwarded-For (first entry is original client)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()

    # 4. Direct ASGI client host
    return request.client.host if request.client else "unknown"


def extract_user_from_request(request: Request) -> str:
    """Safely extract username and role from Authorization Bearer token for logging purposes."""
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return "Anonymous"

    token = auth_header[7:].strip()
    if not token:
        return "Anonymous"

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False, "verify_signature": False},
        )
        username = payload.get("sub")
        role = payload.get("role")
        if username and role:
            return f"{username} ({role})"
        if username:
            return username
        return "UnknownUser"
    except Exception:
        return "InvalidToken"
