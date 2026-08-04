from fastapi import Request


def get_client_ip(request: Request) -> str | None:
    """Return the address supplied by the trusted reverse proxy or ASGI client."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()

    return request.client.host if request.client else None
