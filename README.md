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
   INITIAL_ADMIN_PASSWORD=replace-with-a-strong-password
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
   INITIAL_ADMIN_PASSWORD=replace-with-a-strong-password
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
INITIAL_ADMIN_PASSWORD=replace-with-a-strong-password
INITIAL_ADMIN_NAME=Administrador
```

### Initial Admin Credentials:
- **Email**: value of `INITIAL_ADMIN_EMAIL`
- **Password**: value of `INITIAL_ADMIN_PASSWORD`
- **Name**: value of `INITIAL_ADMIN_NAME`

### Important Notes:
- The admin is created only if no admin users exist in the database
- Use a strong password and change it after first login
- You can disable auto-creation by removing/commenting the environment variables
- The system will show confirmation messages during startup

### Testing Admin Creation:
After starting the application, you can verify the admin was created by running:
```bash
python test_admin_creation.py
```

This script will check your database and confirm if the initial admin user was created successfully.

## Testing

```bash
# Backend
cd backend && pytest app/tests

# Frontend unit tests
cd frontend && CI=true npm test -- --watchAll=false

# End-to-end (requires MongoDB; starts the API on :8100 and the app on :3100)
cd frontend
npx playwright install chromium
npm run test:e2e
```

Set `E2E_MONGODB_URL` if MongoDB is not available at `mongodb://127.0.0.1:27017`.

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
- `POST /payments/bulk-import` - Bulk import payments from Excel (Admin only) - **Automatically approves and generates receipts**
- `POST /payments/bulk-approve` - Bulk approve multiple payments (Admin only)

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

### Bulk Import Payments (Excel)
```bash
curl -X POST "http://localhost:8000/payments/bulk-import" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@payments.xlsx"
```

**Excel Format Requirements:**
- Column headers: Villa, Fila, Número, Año, Mes, Monto, Fecha de Pago, Notas
- **Important**: Payments are automatically approved and receipts are generated upon successful import
- Returns JSON with successful_imports, failed_imports, and error details

**Example Response:**
```json
{
  "successful_imports": 5,
  "failed_imports": 1,
  "errors": [
    {
      "row": 3,
      "error": "Property not found: Villa Central, B5"
    }
  ]
}
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

## 🚀 Deployment to Render with MongoDB Atlas

### Prerequisites
- Render account (free tier available)
- MongoDB Atlas account (free tier available)

### Step 1: Set up MongoDB Atlas
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster (M0 Sandbox)
3. Create database user with read/write permissions
4. Under Network Access, whitelist `0.0.0.0/0` (Render uses dynamic outbound IPs unless you pay for a static IP)
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

### Step 3: Deploy the Backend (Web Service)
1. In the [Render Dashboard](https://dashboard.render.com), click **New → Web Service**
2. Connect this Git repository
3. Set **Root Directory** to `backend`
4. Render detects `backend/Dockerfile` automatically (Runtime: Docker)
5. Set **Health Check Path** to `/health`
6. Add the environment variables from your `.env` (MongoDB, JWT, Cloudinary, initial admin, `CORS_ORIGINS`)
7. Create the service — Render injects `PORT`, which the Dockerfile already respects

### Step 4: Deploy the Frontend (Static Site)
1. Click **New → Static Site**
2. Connect this Git repository
3. Set **Root Directory** to `frontend`
4. Set **Build Command** to `npm ci && npm run build`
5. Set **Publish Directory** to `build`
6. Add environment variable `REACT_APP_API_URL=https://<your-backend-service>.onrender.com` (CRA bakes this in at build time, so set it before the first build)
7. Under **Redirects/Rewrites**, add a rewrite from `/*` to `/index.html` so React Router handles client-side routes

### Step 5: Access Your Application
- Frontend: Your Render static site URL
- Backend API: Your Render web service URL
- API Docs: `https://<your-backend-service>.onrender.com/docs`

### Troubleshooting Deployment
- Check the Render build and deploy logs for errors
- Verify the MongoDB Atlas connection string format
- Confirm environment variables are set in the Render dashboard
- Ensure `REACT_APP_API_URL` was set before building the static site

## License

MIT License