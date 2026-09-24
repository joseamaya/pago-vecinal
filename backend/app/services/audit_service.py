import logging

from ..auth.utils import verify_token
from ..models.audit_log import AuditLog

logger = logging.getLogger(__name__)

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def record_request_audit(request, status_code, request_id):
    if request.method not in MUTATING_METHODS:
        return

    try:
        user_email = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1]
            user_email = verify_token(token)

        await AuditLog(
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            user_email=user_email,
            client_ip=request.client.host if request.client else None,
            request_id=request_id,
        ).insert()
    except Exception:
        logger.exception("Failed to write audit log for %s %s", request.method, request.url.path)
