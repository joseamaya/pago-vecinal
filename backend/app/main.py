from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config.database import init_db
from .utils.init_admin import create_initial_admin
from .routes import users, properties, fees, payments, auth, receipts, fee_schedules, reports, agreements, miscellaneous_payments, expenses, dashboard

app = FastAPI(
    title="Pago Vecinal API",
    description="API for managing condominium fee payments",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(properties.router, prefix="/properties", tags=["Properties"])
app.include_router(fees.router, prefix="/fees", tags=["Fees"])
app.include_router(fee_schedules.router, prefix="/fee-schedules", tags=["Fee Schedules"])
app.include_router(payments.router, prefix="/payments", tags=["Payments"])
app.include_router(receipts.router, prefix="/receipts", tags=["Receipts"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])
app.include_router(agreements.router, prefix="/agreements", tags=["Agreements"])
app.include_router(miscellaneous_payments.router, prefix="/miscellaneous-payments", tags=["Miscellaneous Payments"])
app.include_router(expenses.router, prefix="/expenses", tags=["Expenses"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

@app.on_event("startup")
async def startup_event():
    await init_db()
    await create_initial_admin()

@app.get("/")
async def root():
    return {"message": "Pago Vecinal API", "status": "running"}

@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    try:
        # Test database connection
        from .config.database import client
        await client.admin.command('ping')
        return {
            "status": "healthy",
            "service": "Pago Vecinal API",
            "database": "connected",
            "timestamp": "2025-01-19T02:46:25.944Z"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "Pago Vecinal API",
            "database": "disconnected",
            "error": str(e),
            "timestamp": "2025-01-19T02:46:25.944Z"
        }

@app.get("/docs")
async def api_docs():
    """Redirect to API documentation"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")