import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config.database import init_db
from .config.logging import setup_logging
from .utils.init_admin import create_initial_admin
from .routes import users, properties, fees, payments, auth, receipts, fee_schedules, reports, miscellaneous_payments, expenses, dashboard, treasurers, agreements

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Pago Vecinal API",
    description="API for managing condominium fee payments",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(properties.router, prefix="/properties", tags=["Properties"])
app.include_router(fees.router, prefix="/fees", tags=["Fees"])
app.include_router(fee_schedules.router, prefix="/fee-schedules", tags=["Fee Schedules"])
app.include_router(payments.router, prefix="/payments", tags=["Payments"])
app.include_router(receipts.router, prefix="/receipts", tags=["Receipts"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])

app.include_router(miscellaneous_payments.router, prefix="/miscellaneous-payments", tags=["Miscellaneous Payments"])
app.include_router(expenses.router, prefix="/expenses", tags=["Expenses"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(treasurers.router, prefix="/treasurers", tags=["Treasurers"])
app.include_router(agreements.router, prefix="/agreements", tags=["Agreements"])

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Pago Vecinal API...")
    await init_db()
    await create_initial_admin()
    logger.info("Pago Vecinal API startup complete")

@app.get("/")
async def root():
    return {"message": "Pago Vecinal API", "status": "running"}

@app.get("/health")
async def health_check():
    from datetime import datetime
    try:
        from .config.database import client
        await client.admin.command('ping')
        return {
            "status": "healthy",
            "service": "Pago Vecinal API",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "Pago Vecinal API",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@app.get("/docs")
async def api_docs():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")