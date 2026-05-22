import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from io import BytesIO
import cloudinary
from app.services.cloudinary_service import upload_receipt_pdf, delete_cloudinary_file


class TestUploadReceiptPdf:
    def test_returns_secure_url(self):
        mock_upload_result = {"secure_url": "https://res.cloudinary.com/test/raw/upload/recibo_test.pdf"}
        mock_pdf_buffer = BytesIO(b"%PDF-test-content")

        with patch("cloudinary.uploader.upload", return_value=mock_upload_result):
            url = upload_receipt_pdf(mock_pdf_buffer, "CUOT-2025-00001")
            assert url == "https://res.cloudinary.com/test/raw/upload/recibo_test.pdf"

    def test_filename_contains_correlative(self):
        mock_upload_result = {"secure_url": "https://res.cloudinary.com/test/raw/upload/recibo_CUOT-2025-00001_20250101_120000.pdf"}
        mock_pdf_buffer = BytesIO(b"%PDF-test")

        with patch("cloudinary.uploader.upload", return_value=mock_upload_result) as mock_upload:
            upload_receipt_pdf(mock_pdf_buffer, "CUOT-2025-00001")
            call_args = mock_upload.call_args[1]
            assert "recibo_CUOT-2025-00001" in call_args["public_id"]
            assert call_args["resource_type"] == "raw"
            assert call_args["folder"] == "receipts"

    def test_custom_folder(self):
        mock_upload_result = {"secure_url": "https://res.cloudinary.com/test/raw/upload/recibo_test.pdf"}
        mock_pdf_buffer = BytesIO(b"%PDF-test")

        with patch("cloudinary.uploader.upload", return_value=mock_upload_result) as mock_upload:
            upload_receipt_pdf(mock_pdf_buffer, "REC-2025-00005", folder="agreements")
            assert mock_upload.call_args[1]["folder"] == "agreements"


class TestDeleteCloudinaryFile:
    def test_calls_destroy_with_correct_params(self):
        with patch("cloudinary.uploader.destroy") as mock_destroy:
            delete_cloudinary_file("recibo_CUOT-2025-00001.pdf")
            mock_destroy.assert_called_once()
            args = mock_destroy.call_args[0]
            assert "receipts" in args[0]

    def test_handles_exception_gracefully(self):
        with patch("cloudinary.uploader.destroy", side_effect=Exception("API error")):
            delete_cloudinary_file("test.pdf")
