from beanie import Document
from datetime import datetime
from typing import Optional


class AuditLog(Document):
    timestamp: datetime = datetime.utcnow()
    method: str
    path: str
    status_code: int
    user_email: Optional[str] = None
    client_ip: Optional[str] = None
    request_id: Optional[str] = None

    class Settings:
        name = "audit_logs"
