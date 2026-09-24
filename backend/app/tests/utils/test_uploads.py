import io

import pytest
from fastapi import HTTPException

from app.utils.uploads import (
    validate_upload,
    safe_extension,
    generate_stored_filename,
    EXCEL_EXTENSIONS,
    EXCEL_CONTENT_TYPES,
    IMAGE_EXTENSIONS,
    IMAGE_CONTENT_TYPES,
    MAX_SIGNATURE_MB,
)


class FakeUpload:
    def __init__(self, filename, content, content_type, size=None):
        self.filename = filename
        self.content_type = content_type
        self._buffer = io.BytesIO(content)
        self.size = len(content) if size is None else size
        self._content = content

    async def read(self, n=-1):
        return self._buffer.read(n)

    async def seek(self, pos):
        return self._buffer.seek(pos)


class TestSafeExtension:
    def test_lowercases_extension(self):
        assert safe_extension("Report.XLSX") == ".xlsx"

    def test_handles_no_extension(self):
        assert safe_extension("file") == ""

    def test_handles_none(self):
        assert safe_extension(None) == ""


class TestGenerateStoredFilename:
    def test_uses_extension(self):
        assert generate_stored_filename(".png").endswith(".png")

    def test_unique(self):
        assert generate_stored_filename(".pdf") != generate_stored_filename(".pdf")


class TestValidateUpload:
    @pytest.mark.asyncio
    async def test_accepts_valid_excel(self):
        upload = FakeUpload("report.xlsx", b"PK\x03\x04rest", EXCEL_CONTENT_TYPES[0])
        await validate_upload(upload, EXCEL_EXTENSIONS, EXCEL_CONTENT_TYPES, 10)
        assert await upload.read() == b"PK\x03\x04rest"

    @pytest.mark.asyncio
    async def test_rejects_bad_extension(self):
        upload = FakeUpload("virus.exe", b"PK\x03\x04", EXCEL_CONTENT_TYPES[0])
        with pytest.raises(HTTPException) as exc:
            await validate_upload(upload, EXCEL_EXTENSIONS, EXCEL_CONTENT_TYPES, 10)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_bad_content_type(self):
        upload = FakeUpload("report.xlsx", b"PK\x03\x04", "text/plain")
        with pytest.raises(HTTPException) as exc:
            await validate_upload(upload, EXCEL_EXTENSIONS, EXCEL_CONTENT_TYPES, 10)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_oversized(self):
        upload = FakeUpload("firma.png", b"\x89PNG\r\n\x1a\n", "image/png", size=3 * 1024 * 1024)
        with pytest.raises(HTTPException) as exc:
            await validate_upload(upload, IMAGE_EXTENSIONS, IMAGE_CONTENT_TYPES, MAX_SIGNATURE_MB)
        assert exc.value.status_code == 413

    @pytest.mark.asyncio
    async def test_rejects_magic_mismatch(self):
        upload = FakeUpload("firma.png", b"not really a png", "image/png")
        with pytest.raises(HTTPException) as exc:
            await validate_upload(upload, IMAGE_EXTENSIONS, IMAGE_CONTENT_TYPES, MAX_SIGNATURE_MB)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_resets_stream_position(self):
        content = b"%PDF-1.4 data"
        upload = FakeUpload("recibo.pdf", content, "application/pdf")
        await validate_upload(upload, (".pdf",), ("application/pdf",), 10)
        assert await upload.read() == content

    @pytest.mark.asyncio
    async def test_none_is_ignored(self):
        await validate_upload(None, EXCEL_EXTENSIONS, EXCEL_CONTENT_TYPES, 10)
