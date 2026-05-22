import logging
from datetime import datetime
import cloudinary
import cloudinary.uploader
import cloudinary.api
from ..config.settings import settings

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)


def upload_receipt_pdf(pdf_buffer, correlative_number, folder="receipts"):
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    pdf_filename = f"recibo_{correlative_number}_{timestamp}.pdf"

    upload_result = cloudinary.uploader.upload(
        pdf_buffer.getvalue(),
        public_id=pdf_filename,
        resource_type="raw",
        folder=folder
    )
    logger.info("PDF uploaded to Cloudinary: %s", upload_result['secure_url'])
    return upload_result['secure_url']


def delete_cloudinary_file(public_id, folder="receipts"):
    try:
        cloudinary.uploader.destroy(f"{folder}/{public_id}", resource_type="raw")
        logger.info("Cloudinary file deleted: %s/%s", folder, public_id)
    except Exception as e:
        logger.error("Error deleting Cloudinary file: %s", e)
