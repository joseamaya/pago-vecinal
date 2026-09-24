import os
import uuid

from fastapi import HTTPException, status

EXCEL_EXTENSIONS = (".xlsx", ".xls")
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")
RECEIPT_EXTENSIONS = (".pdf", ".png", ".jpg", ".jpeg")

EXCEL_CONTENT_TYPES = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
)
IMAGE_CONTENT_TYPES = ("image/png", "image/jpeg", "application/octet-stream")
RECEIPT_CONTENT_TYPES = (
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/octet-stream",
)

MAX_EXCEL_MB = 10
MAX_SIGNATURE_MB = 2
MAX_RECEIPT_MB = 10

_SIGNATURES = {
    ".xlsx": (b"PK\x03\x04",),
    ".xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".pdf": (b"%PDF-",),
}


def safe_extension(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def generate_stored_filename(extension: str) -> str:
    return f"{uuid.uuid4()}{extension}"


async def validate_upload(file, allowed_extensions, allowed_content_types, max_size_mb):
    if file is None:
        return

    extension = safe_extension(file.filename)
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: {', '.join(allowed_extensions)}",
        )

    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file content type",
        )

    if file.size is not None and file.size > max_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File too large (maximum {max_size_mb} MB)",
        )

    signatures = _SIGNATURES.get(extension)
    if signatures:
        head = await file.read(8)
        await file.seek(0)
        if not any(head.startswith(sig) for sig in signatures):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match its extension",
            )
