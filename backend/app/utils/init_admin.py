import logging
from ..models.user import User, UserRole
from ..auth.utils import get_password_hash
from ..config.settings import settings

logger = logging.getLogger(__name__)


async def create_initial_admin():
    try:
        existing_admin = await User.find_one(User.role == UserRole.ADMIN)
        if existing_admin:
            logger.info("Admin user already exists, skipping initial admin creation")
            return

        admin_email = settings.INITIAL_ADMIN_EMAIL
        admin_password = settings.INITIAL_ADMIN_PASSWORD
        admin_name = settings.INITIAL_ADMIN_NAME

        if not all([admin_email, admin_password, admin_name]):
            logger.warning("Initial admin environment variables not configured, skipping")
            return

        hashed_password = get_password_hash(admin_password)

        admin = User(
            email=admin_email,
            password_hash=hashed_password,
            role=UserRole.ADMIN,
            full_name=admin_name,
            is_active=True
        )

        await admin.insert()

        logger.info("Initial admin user created successfully (email: %s)", admin_email)

    except Exception as e:
        logger.error("Error creating initial admin: %s", e)
        raise
