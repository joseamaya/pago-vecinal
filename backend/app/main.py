import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config.database import init_db
from .config.logging import setup_logging
from .config.settings import settings
from .services.audit_service import record_request_audit
from .utils.init_admin import create_initial_admin
from .routes import users, owners, properties, fees, payments, auth, receipts, fee_schedules, reports, miscellaneous_payments, expenses, dashboard, treasurers, agreements

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Pago Vecinal API...")
    await init_db()
    await create_initial_admin()
    logger.info("Pago Vecinal API startup complete")
    yield
    logger.info("Shutting down Pago Vecinal API")


app = FastAPI(
    title="Pago Vecinal API",
    description="API for managing condominium fee payments",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "%s %s -> %s (%.1fms) [%s]",
        request.method, request.url.path, response.status_code, duration_ms, request_id
    )
    await record_request_audit(request, response.status_code, request_id)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(owners.router, prefix="/owners", tags=["Owners"])
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


@app.get("/")
async def root():
    return {"message": "Pago Vecinal API", "status": "running"}


@app.get("/health")
async def health_check():
    try:
        from .config.database import client
        await client.admin.command('ping')
        return {
            "status": "healthy",
            "service": "Pago Vecinal API",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception:
        logger.exception("Health check failed: database unreachable")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": "Pago Vecinal API",
                "database": "disconnected",
                "error": "Database connection failed",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
