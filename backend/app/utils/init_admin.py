from ..models.user import User, UserRole
from ..auth.utils import get_password_hash
import os

async def create_initial_admin():
    """
    Create the initial administrator user if none exists.
    Uses environment variables for configuration.
    """
    try:
        # Check if an admin already exists
        existing_admin = await User.find_one(User.role == UserRole.ADMIN)
        if existing_admin:
            print("ℹ️  Admin user already exists, skipping initial admin creation")
            return

        # Get admin configuration from environment variables
        admin_email = os.getenv("INITIAL_ADMIN_EMAIL")
        admin_password = os.getenv("INITIAL_ADMIN_PASSWORD")
        admin_name = os.getenv("INITIAL_ADMIN_NAME")

        # Validate that all required variables are set
        if not all([admin_email, admin_password, admin_name]):
            print("⚠️  Initial admin environment variables not configured:")
            print("   - INITIAL_ADMIN_EMAIL")
            print("   - INITIAL_ADMIN_PASSWORD")
            print("   - INITIAL_ADMIN_NAME")
            print("   Skipping initial admin creation")
            return

        # Hash the password
        hashed_password = get_password_hash(admin_password)

        # Create the admin user
        admin = User(
            email=admin_email,
            password_hash=hashed_password,
            role=UserRole.ADMIN,
            full_name=admin_name,
            is_active=True
        )

        # Insert into database
        await admin.insert()

        print("✅ Initial admin user created successfully!")
        print(f"   Email: {admin_email}")
        print(f"   Name: {admin_name}")
        print("   Role: Administrator")
        print("   Status: Active")
        print("\n🔐 Please change the default password after first login!")

    except Exception as e:
        print(f"❌ Error creating initial admin: {str(e)}")
        raise