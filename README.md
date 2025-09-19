# Pago Vecinal - Condominium Fee Management System

A full-stack system for managing condominium fee payments with FastAPI backend, React frontend, MongoDB and Beanie ODM.

## Features

- **User Management**: Admin and property owner roles with JWT authentication
- **Property Management**: Track properties with row letter, number, villa, and owner details
- **Dynamic Fee Schedules**: Support for varying fees over time
- **Payment Processing**: Record and track payments with status management
- **Receipt Generation**: Generate PDF receipts with correlative numbers
- **Role-based Access Control**: Different permissions for admins and owners
- **Modern UI**: React frontend with Material-UI components

## Architecture

This project uses a **monorepo** structure with separate backend and frontend applications:

```
pago-vecinal/
├── backend/              # FastAPI Backend
│   ├── app/
│   │   ├── models/       # Beanie ODM models
│   │   ├── routes/       # API endpoints
│   │   ├── auth/         # Authentication utilities
│   │   ├── config/       # Database configuration
│   │   └── utils/        # PDF generation, admin creation
│   ├── requirements.txt
│   ├── run.py
│   └── .env
├── frontend/             # React Frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # React context providers
│   │   ├── services/     # API service layer
│   │   └── ...
│   ├── package.json
│   ├── .env
│   └── public/
└── README.md
```

## Tech Stack

**Backend:**
- **FastAPI**: Modern Python web framework
- **MongoDB**: NoSQL database
- **Beanie**: MongoDB ODM for Python
- **JWT**: Token-based authentication
- **ReportLab**: PDF generation
- **Pydantic**: Data validation

**Frontend:**
- **React**: User interface library
- **Material-UI**: Component library
- **Axios**: HTTP client
- **React Router**: Client-side routing

## Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB
- Git

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

   **Note:** If you encounter issues with pydantic installation, try:
   ```bash
   pip install --upgrade pip
   pip install pydantic[email]==2.11.9
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   - **For manual setup:** Edit `backend/.env`
   - **For Docker:** Edit the root `.env` file (already configured for Docker Compose)

   Environment variables:
   ```bash
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=pago_vecinal
   SECRET_KEY=your-secret-key-here-change-in-production
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30

   # Initial Admin Configuration
   INITIAL_ADMIN_EMAIL=admin@pago-vecinal.com
   INITIAL_ADMIN_PASSWORD=AdminPass123!
   INITIAL_ADMIN_NAME=Administrador
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd ../frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment (optional):**
   Edit `frontend/.env`:
   ```bash
   REACT_APP_API_URL=http://localhost:8000
   ```

### Running the Application

#### Option 1: Manual Setup

1. **Start MongoDB service**

2. **Start the backend:**
   ```bash
   cd backend
   source .venv/bin/activate
   python run.py
   ```
   Backend will be available at: `http://localhost:8000`

3. **Start the frontend (in a new terminal):**
   ```bash
   cd frontend
   npm start
   ```
   Frontend will be available at: `http://localhost:3000`

#### Option 2: Docker Compose (Recommended)

1. **Configure environment variables:**
   Copy `.env.example` to `.env` and edit the values:
   ```bash
   cp .env.example .env
   ```

   Then edit the `.env` file in the project root with your desired configuration:
   ```bash
   # Database Configuration
   MONGODB_URL=mongodb://mongodb:27017
   DATABASE_NAME=pago_vecinal

   # JWT Configuration
   SECRET_KEY=your-secret-key-here-change-in-production
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30

   # Initial Admin Configuration
   INITIAL_ADMIN_EMAIL=admin@pago-vecinal.com
   INITIAL_ADMIN_PASSWORD=AdminPass123!
   INITIAL_ADMIN_NAME=Administrador

   # Frontend Configuration
   REACT_APP_API_URL=http://localhost:8000
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the applications:**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`

The backend will automatically create an initial admin user on first startup using the environment variables from the `.env` file.

## 🔐 Initial Admin Setup

The application automatically creates an initial administrator user on first startup using environment variables. Configure these variables in your `.env` file:

```bash
INITIAL_ADMIN_EMAIL=admin@pago-vecinal.com
INITIAL_ADMIN_PASSWORD=AdminPass123!
INITIAL_ADMIN_NAME=Administrador
```

### Default Admin Credentials:
- **Email**: admin@pago-vecinal.com
- **Password**: AdminPass123!
- **Name**: Administrador

### Important Notes:
- The admin is created only if no admin users exist in the database
- Change the default password after first login for security
- You can disable auto-creation by removing/commenting the environment variables
- The system will show confirmation messages during startup

### Testing Admin Creation:
After starting the application, you can verify the admin was created by running:
```bash
python test_admin_creation.py
```

This script will check your database and confirm if the initial admin user was created successfully.

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, visit `http://localhost:8000/docs` for interactive Swagger documentation.

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get access token

### Users
- `GET /users/me` - Get current user information
- `GET /users/` - List all users (Admin only)
- `GET /users/{user_id}` - Get user details (Admin only)
- `PUT /users/{user_id}` - Update user (Admin only)
- `DELETE /users/{user_id}` - Delete user (Admin only)

### Properties
- `GET /properties/` - List all properties
- `GET /properties/{property_id}` - Get property details
- `POST /properties/` - Create property (Admin only)
- `PUT /properties/{property_id}` - Update property (Admin only)
- `DELETE /properties/{property_id}` - Delete property (Admin only)

### Fee Schedules (Admin only)
- `GET /fees/` - List all fee schedules
- `GET /fees/current` - Get current active fee
- `POST /fees/` - Create fee schedule
- `PUT /fees/{fee_id}` - Update fee schedule
- `DELETE /fees/{fee_id}` - Delete fee schedule

### Payments
- `GET /payments/` - List payments (filtered by user role)
- `GET /payments/{payment_id}` - Get payment details
- `POST /payments/` - Create payment
- `PUT /payments/{payment_id}` - Update payment
- `DELETE /payments/{payment_id}` - Delete payment (Admin only)

### Receipts
- `GET /receipts/` - List receipts (filtered by user role)
- `GET /receipts/{receipt_id}` - Get receipt details
- `POST /receipts/` - Generate receipt for completed payment
- `GET /receipts/{receipt_id}/download` - Download receipt as PDF
- `DELETE /receipts/{receipt_id}` - Delete receipt (Admin only)

## Usage Examples

### Register an Admin User
```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "adminpass",
    "role": "admin",
    "full_name": "Admin User"
  }'
```

### Login
```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=adminpass"
```

### Create a Property
```bash
curl -X POST "http://localhost:8000/properties/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "row_letter": "A",
    "number": 1,
    "villa": "Villa 1",
    "owner_name": "John Doe",
    "owner_phone": "+1234567890"
  }'
```

### Generate a Receipt
```bash
curl -X POST "http://localhost:8000/receipts/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "PAYMENT_ID_HERE",
    "fee_period": "Enero 2024",
    "notes": "Pago completo de cuota mensual"
  }'
```

### Download Receipt PDF
```bash
curl -X GET "http://localhost:8000/receipts/RECEIPT_ID_HERE/download" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output receipt.pdf
```

## Database Models

### User
- email: EmailStr
- password_hash: str
- role: UserRole (admin/owner)
- full_name: str
- phone: Optional[str]
- is_active: bool

### Property
- row_letter: str
- number: int
- villa: str
- owner_name: str
- owner_phone: Optional[str]
- owner: Optional[Link[User]]

### FeeSchedule
- amount: float
- description: str
- effective_date: datetime
- end_date: Optional[datetime]
- is_active: bool

### Payment
- property: Link[Property]
- user: Optional[Link[User]]
- amount: float
- payment_date: datetime
- due_date: datetime
- status: PaymentStatus
- reference: Optional[str]
- notes: Optional[str]

### Receipt
- correlative_number: str (Format: REC-YYYY-XXXXX)
- payment: Link[Payment]
- issue_date: datetime
- total_amount: float
- property_details: dict
- owner_details: dict
- fee_period: Optional[str]
- notes: Optional[str]

## Development

The project structure:
```
pago-vecinal/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config/
│   │   ├── __init__.py
│   │   └── database.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── property.py
│   │   ├── fee.py
│   │   └── payment.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── properties.py
│   │   ├── fees.py
│   │   └── payments.py
│   └── auth/
│       ├── __init__.py
│       └── utils.py
├── .env
├── requirements.txt
├── run.py
└── README.md
```

## Troubleshooting

### Common Issues

#### 1. Pydantic Installation Error
If you get an error like `pip install pydantic[email]`, try:
```bash
# Upgrade pip first
pip install --upgrade pip

# Install pydantic with email support explicitly
pip install pydantic[email]==2.11.9

# Then install other requirements
pip install -r requirements.txt
```

#### 2. MongoDB Connection Issues
- Ensure MongoDB is running on port 27017
- For Docker: Use `MONGODB_URL=mongodb://mongodb:27017`
- For local development: Use `MONGODB_URL=mongodb://localhost:27017`

#### 3. Port Already in Use
If ports 3000 or 8000 are busy:
```bash
# Kill processes using the ports
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

#### 4. CORS Issues
If you get CORS errors in development:
- Ensure the frontend proxy is configured correctly
- Check that `REACT_APP_API_URL` points to the correct backend URL

#### 5. Environment Variables Not Loading
- Ensure `.env` file exists in the correct location
- Check that variable names match exactly
- Restart the development servers after changing `.env`

#### 6. Login 422 Error
If you get a 422 error during login with "Field required" for username:
- This is fixed in the current version
- The frontend now sends form-data with "username" field (containing email)
- OAuth2PasswordRequestForm expects form-data, not JSON
- Make sure you're using the updated AuthContext

### Getting Help

If you encounter issues not covered here:
1. Check the console logs for detailed error messages
2. Verify all prerequisites are installed
3. Ensure you're using compatible Python/Node.js versions
4. Check the GitHub repository for updates

## 🚀 Deployment to Railway with MongoDB Atlas

### Prerequisites
- Railway account (free tier available)
- MongoDB Atlas account (free tier available)
- Railway CLI installed: `npm install -g @railway/cli`

### Step 1: Set up MongoDB Atlas
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster (M0 Sandbox)
3. Create database user with read/write permissions
4. Whitelist IP addresses (0.0.0.0/0 for Railway)
5. Get connection string from "Connect" → "Connect your application"

### Step 2: Configure Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your MongoDB Atlas connection string:
   ```bash
   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/pago_vecinal?retryWrites=true&w=majority
   ```

3. Generate a secure SECRET_KEY for production

### Step 3: Deploy to Railway
1. **Login to Railway:**
   ```bash
   railway login
   ```

2. **Deploy backend:**
   ```bash
   cd backend
   railway init
   railway up
   ```

3. **Deploy frontend:**
   ```bash
   cd ../frontend
   railway init
   railway up
   ```

4. **Or use the automated script:**
   ```bash
   ./deploy.sh
   ```

### Step 4: Configure Railway Environment Variables
In Railway dashboard:
1. Go to your project
2. Add environment variables from your `.env` file
3. Update `REACT_APP_API_URL` with your backend Railway URL

### Step 5: Access Your Application
- Frontend: Your Railway frontend URL
- Backend API: Your Railway backend URL
- API Docs: `https://your-backend-url.railway.app/docs`

### Troubleshooting Deployment
- Ensure Dockerfiles are in correct directories
- Check Railway build logs for errors
- Verify MongoDB Atlas connection string format
- Confirm environment variables are set in Railway dashboard

## License

MIT License