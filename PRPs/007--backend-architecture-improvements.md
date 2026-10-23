# PRP: Backend Architecture Improvements

> **Version:** 1.0
> **Created:** 2025-05-22
> **Status:** Partially implemented
> **Implementation:** Verified 2026-10-23: services, dependencies, schemas, settings, logging and Cloudinary are centralized. Some owner/admin checks remain in agreements, miscellaneous payments and dashboard by design.

---

## Goal

Refactor the backend to introduce a proper **Service Layer**, extract reusable **dependencies**, centralize **Cloudinary uploads**, consolidate **shared Pydantic models**, replace `print()` with **structured logging**, and add a **Pydantic BaseSettings config module** for environment validation at startup.

## Why

- **45+ permission checks** `if current_user.role != UserRole.ADMIN` are copy-pasted across 12 route files — one change requires modifying every file
- **6 identical Cloudinary upload blocks** across `receipts.py` and `miscellaneous_payments.py` — any API change or config switch requires touching all 6 locations
- **Cross-route imports** (`payments.py` imports `create_receipt_for_payment` from `receipts.py`) create tight coupling and lazy-import workarounds for circular deps
- **60 bare `print()` calls** with no log levels, no timestamps, no structured output — impossible to filter or suppress in production
- **No Pydantic BaseSettings** — env vars read ad-hoc with `os.getenv()` at module level; missing variables cause obscure runtime errors instead of clear startup failures
- **Duplicate Pydantic models** (`BulkImportResponse`, `BulkApproveRequest`, `Paginated*Response`) defined in multiple route files
- **No `app/schemas/` or `app/dependencies/` directory** — no organizational structure beyond `models/` and `routes/`

## Success Criteria

- [x] `app/services/` directory created with 4+ service modules (payment, receipt, cloudinary, fee)
- [x] `app/dependencies/` module with `require_admin` dependency and `require_owner` authorization helper
- [x] `app/schemas/` module with shared Pydantic models (`PaginatedResponse`, `BulkImportResponse`, `BulkApproveRequest`)
- [x] `app/config/settings.py` using `pydantic.BaseSettings` for all env vars
- [x] `app/config/logging.py` configured with `logging` module — zero bare `print()` remaining in `app/` routes
- [x] Cloudinary logic centralized in `app/services/cloudinary_service.py` — used by all route files
- [x] Cross-route imports eliminated (receipt creation via service layer, not route-to-route imports)
- [ ] All 12 route files updated to use new service layer, dependencies, and schemas
- [x] Existing API contract preserved — all endpoints return identical responses
- [ ] Ad-hoc test scripts (`test_*.py`) still run successfully against the refactored code

---

## All Needed Context

### Key Files

```yaml
- file: backend/app/main.py
  why: Router mounting, CORS, startup event — will add config validation here

- file: backend/app/config/database.py
  why: Beanie init, module-level client/database — will refactor to use BaseSettings for URL

- file: backend/app/auth/utils.py
  why: JWT create/verify, get_current_user logic — will reference from dependencies module

- file: backend/app/routes/auth.py
  why: oauth2_scheme, get_current_user FastAPI dependency — routes currently import from here

- file: backend/app/routes/receipts.py
  why: Defines generate_correlative_number() and create_receipt_for_payment() — cross-route import targets

- file: backend/app/routes/payments.py
  why: 832 lines, imports create_receipt_for_payment 4 times with lazy imports — primary refactor target

- file: backend/app/routes/miscellaneous_payments.py
  why: 670 lines, duplicates Cloudinary block twice, imports generate_correlative_number

- file: backend/app/routes/fees.py
  why: 439 lines, typical route pattern with 4 repeated FeeResponse constructions

- file: backend/app/routes/properties.py
  why: 7 repeated PropertyResponse constructions, BulkImportResponse defined here

- file: backend/app/routes/expenses.py
  why: Duplicates BulkImportResponse, inconsistent 500 status code for bulk import

- file: backend/app/routes/agreements.py
  why: 871 lines, imports generate_correlative_number, has local file storage for agreements

- file: backend/app/models/fee.py
  why: Defines Fee document + FeeSchedule + FeeCreate/Update/Response schemas — Response model will move to schemas/

- file: backend/app/models/user.py
  why: UserRole enum — dependencies will reference this

- file: backend/app/utils/receipt_generator.py
  why: Thin wrapper that imports create_receipt_for_payment — will move to service layer
```

### Directory Structure

**Current:**
```
backend/app/
  __init__.py
  main.py
  auth/
    __init__.py
    utils.py
  config/
    __init__.py
    database.py
  models/             # 11 Beanie documents + Pydantic schemas mixed
    user.py, property.py, fee.py, payment.py, receipt.py,
    agreement.py, expense.py, miscellaneous_payment.py, treasurer.py
  routes/             # 12 route files (all business logic inline)
    __init__.py, auth.py, users.py, properties.py, fees.py,
    fee_schedules.py, payments.py, receipts.py, reports.py,
    dashboard.py, expenses.py, miscellaneous_payments.py,
    treasurers.py, agreements.py
  utils/
    __init__.py
    excel_generator.py, pdf_generator.py,
    receipt_generator.py, init_admin.py
```

**Desired:**
```
backend/app/
  __init__.py
  main.py                        # Updated: config validation, logging setup, router mounts
  auth/
    __init__.py
    utils.py                     # Unchanged (JWT logic stays)
  config/
    __init__.py
    database.py                  # Updated: use settings for DB URL
    settings.py                  # NEW: Pydantic BaseSettings
    logging.py                   # NEW: structured logging config
  models/                        # Beanie documents only (no Pydantic schemas)
    user.py, property.py, fee.py, payment.py, receipt.py,
    agreement.py, expense.py, miscellaneous_payment.py, treasurer.py
  schemas/                       # NEW: shared Pydantic models
    __init__.py
    common.py                    # PaginatedResponse, BulkImportResponse, BulkApproveRequest
    fee.py                       # FeeCreate, FeeUpdate, FeeResponse (moved from models/)
    payment.py                   # PaymentCreate, PaymentUpdate, PaymentResponse
    ...                          # (one per model — Create/Update/Response schemas)
  dependencies/                  # NEW: reusable FastAPI dependencies
    __init__.py
    auth.py                      # get_current_user, require_admin, require_owner
  services/                      # NEW: business logic layer
    __init__.py
    cloudinary_service.py       # Centralized Cloudinary config + upload
    receipt_service.py           # generate_correlative_number, create_receipt_for_payment
    payment_service.py           # Payment CRUD + approval + bulk logic
    fee_service.py               # Fee CRUD + generation logic
  routes/                        # Thinned out — orchestration only
    __init__.py
    auth.py, users.py, properties.py, fees.py, fee_schedules.py,
    payments.py, receipts.py, reports.py, dashboard.py,
    expenses.py, miscellaneous_payments.py, treasurers.py, agreements.py
  utils/
    __init__.py
    excel_generator.py, pdf_generator.py, init_admin.py
```

### Conventions

- Backend is Python FastAPI + MongoDB (Beanie ODM). No pytest framework — ad-hoc scripts run with `python test_*.py`.
- All route files use `APIRouter()`. All endpoints are `async def`.
- Login uses `multipart/form-data` with `username` (email) and `password` fields.
- Beanie `Link[T]` fields require `await doc.fetch_link(Doc.field)` or `await doc.fetch_all_links()` before accessing linked data.
- Response models are flat (denormalized), e.g., `FeeResponse` includes `property_villa`, `property_owner_name` from linked `Property`.
- Environment files: `backend/.env` loaded by `load_dotenv()` in `database.py`.
- Python package manager: `pip` with `backend/requirements.txt`.
- No type checker configured — all type annotations are documentation-only.

### Known Gotchas & Library Quirks

```python
# CRITICAL: Beanie init must happen BEFORE any DB query.
# database.py creates client/database at module level — do NOT move to a lazy init.

# CRITICAL: FastAPI Depends() resolution order matters.
# get_current_user must execute before require_admin — both must be in the Depends() list in order.

# CRITICAL: Beanie Link fetch requires string arg: fetch_link(Fee.property) vs fetch_link('property').
# Both work but the typed version is preferred. Existing code uses strings in most places.

# CRITICAL: payment.fee_id is a redundant string field duplicating payment.fee (Link[Fee]).
# Do NOT remove it — payment queries use it for filtering. Preserve it exactly.

# CRITICAL: Receipt generation for approved payments has a fragile flow:
# create_payment() → approve → create_receipt_for_payment() → Cloudinary upload.
# This flow MUST NOT be broken. Receipt creation must remain synchronous (awaited) inside payment approval.

# GOTCHA: payments.py uses lazy imports for create_receipt_for_payment (imported inside if blocks)
# to avoid circular imports. Moving to a service layer eliminates this hack.
```

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Create app/config/settings.py — Pydantic BaseSettings
  - CREATE: backend/app/config/settings.py
  - PATTERN: Use pydantic.BaseSettings (pydantic-settings package may need pip install)
  - FIELDS: MONGODB_URL, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
            INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_NAME,
            CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
            DATABASE_NAME
  - VALIDATION: required=True for MONGODB_URL, SECRET_KEY, CLOUDINARY_*
  - EXPORT: settings = Settings() singleton

Task 2: Create app/config/logging.py — structured logging
  - CREATE: backend/app/config/logging.py
  - PATTERN: Configure root logger with format "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
  - CONFIGURE: Two handlers (console + optional file), level from LOG_LEVEL env var (default INFO)
  - EXPORT: setup_logging() function called at startup

Task 3: Update app/config/database.py to use settings
  - MODIFY: backend/app/config/database.py
  - IMPORT: from .settings import settings
  - REPLACE: os.getenv("MONGODB_URL") → settings.MONGODB_URL
  - REPLACE: os.getenv("DATABASE_NAME", ...) → settings.DATABASE_NAME
  - REPLACE: all print() calls → logger.info() / logger.error()
  - KEEP: module-level client, database variables
  - KEEP: init_db() function signature and behavior

Task 4: Update app/auth/utils.py to use settings and logger
  - MODIFY: backend/app/auth/utils.py
  - IMPORT: from ..config.settings import settings
  - REPLACE: os.getenv("SECRET_KEY", "your-secret-key...") → settings.SECRET_KEY
  - REPLACE: os.getenv("ALGORITHM", "HS256") → settings.ALGORITHM
  - REPLACE: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) → settings.ACCESS_TOKEN_EXPIRE_MINUTES
  - REPLACE: print() calls → logger.error() / logger.warning()
  - KEEP: Module-level variables can stay (they'll read from settings) but add a lazy init pattern
         SECRET_KEY = settings.SECRET_KEY (read at import time, which is fine after task 3 loads dotenv)

Task 5: Create app/dependencies/auth.py — reusable permission dependencies
  - CREATE: backend/app/dependencies/__init__.py (empty)
  - CREATE: backend/app/dependencies/auth.py
  - MOVE: oauth2_scheme from app/routes/auth.py
  - MOVE: get_current_user from app/routes/auth.py (lines 65-67) — the FastAPI Depends wrapper
  - ADD: require_admin dependency:
      async def require_admin(current_user: User = Depends(get_current_user)) -> User:
          if current_user.role != UserRole.ADMIN:
              raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                  detail="Admin privileges required")
          return current_user
  - ADD: require_owner_or_admin helper (factory pattern):
      def require_owner_or_admin(resource_owner_field: str):
          async def _dependency(current_user: User = Depends(get_current_user)):
              ...
          return _dependency
  - PATTERN: Mirror existing import style — from app.models.user import User, UserRole
  - NOTE: The original get_current_user in auth.py's routes will now import from here to avoid breakage

Task 6: Update app/routes/auth.py to use new dependencies module
  - MODIFY: backend/app/routes/auth.py
  - REPLACE: oauth2_scheme and get_current_user definitions → import from ..dependencies.auth
  - RE-EXPORT: Keep the names available for backward compatibility while all routes transition
  - IMPORTANT: All other route files currently import get_current_user from ..routes.auth.
               After this task, we'll update them in Task 15, but for now backward compat is preserved.

Task 7: Create app/schemas/common.py — shared Pydantic models
  - CREATE: backend/app/schemas/__init__.py (empty)
  - CREATE: backend/app/schemas/common.py
  - MOVE: BulkImportResponse from properties.py and expenses.py → one definition here
  - MOVE: BulkApproveRequest from payments.py and miscellaneous_payments.py → one definition here
  - ADD: PaginatedResponse[T] — generic paginated wrapper:
      class PaginatedResponse(BaseModel, Generic[T]):
          items: List[T]
          total: int
          page: int
          total_pages: int
  - KEEP: Existing specific paginated models (PaginatedPaymentResponse, etc.) as type aliases
          e.g., PaginatedPaymentResponse = PaginatedResponse[PaymentResponse]
  - NOTE: Each model-specific schema file (fee.py, payment.py, etc.) will import PaginatedResponse

Task 8: Create app/schemas/fee.py — move Fee Pydantic schemas out of models/
  - CREATE: backend/app/schemas/fee.py
  - MOVE from models/fee.py: FeeCreate, FeeUpdate, FeeResponse, FeeStatus
  - ADD: type alias PaginatedFeeResponse = PaginatedResponse[FeeResponse]
  - KEEP: FeeScheme and Fee document classes in models/fee.py (Beanie models must stay)

Task 9: Create app/schemas/payment.py — move Payment Pydantic schemas
  - CREATE: backend/app/schemas/payment.py
  - MOVE from models/payment.py: PaymentCreate, PaymentUpdate, PaymentResponse
  - ADD: type alias PaginatedPaymentResponse = PaginatedResponse[PaymentResponse]
  - ADD: PaymentBulkApproveRequest (move the model definition here)

Task 10: Create remaining app/schemas/ files for other models
  - CREATE: backend/app/schemas/property.py (move PropertyCreate, PropertyUpdate, PropertyResponse from models/)
  - CREATE: backend/app/schemas/user.py (move UserCreate, UserResponse from models/)
  - CREATE: backend/app/schemas/receipt.py (move schemas from models/receipt.py)
  - CREATE: backend/app/schemas/agreement.py (move AgreementCreate, etc. from models/agreement.py)
  - CREATE: backend/app/schemas/expense.py (move ExpenseCreate, etc. from models/expense.py)
  - CREATE: backend/app/schemas/miscellaneous_payment.py (move schemas from models/miscellaneous_payment.py)
  - CREATE: backend/app/schemas/treasurer.py (move schemas from models/treasurer.py)
  - PATTERN: Each file: Create, Update, Response schemas + PaginatedResponse type alias
  - NOTE: For each model file, keep ONLY the Beanie Document class. Remove Pydantic BaseModel classes.
         Add re-import at bottom for backward compat:
         `from ..schemas.fee import FeeCreate, FeeUpdate, FeeResponse, FeeStatus`
         This allows routes importing from models to work during transition.

Task 11: Create app/services/cloudinary_service.py — centralize Cloudinary
  - CREATE: backend/app/services/__init__.py (empty)
  - CREATE: backend/app/services/cloudinary_service.py
  - FUNCTIONS:
      def configure_cloudinary():
          cloudinary.config(
              cloud_name=settings.CLOUDINARY_CLOUD_NAME,
              api_key=settings.CLOUDINARY_API_KEY,
              api_secret=settings.CLOUDINARY_API_SECRET
          )
      async def upload_receipt_pdf(pdf_buffer, correlative_number, folder="receipts") -> str:
          timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
          pdf_filename = f"recibo_{correlative_number}_{timestamp}.pdf"
          upload_result = cloudinary.uploader.upload(
              pdf_buffer.getvalue(),
              public_id=pdf_filename,
              resource_type="raw",
              folder=folder
          )
          return upload_result['secure_url']
      async def delete_cloudinary_file(public_id: str, folder: str = "receipts"):
          cloudinary.uploader.destroy(f"{folder}/{public_id}", resource_type="raw")
  - CALL configure_cloudinary() once at module level (uses settings, which is already loaded)
  - NOTE: This replaces the 6 identical blocks in receipts.py and miscellaneous_payments.py

Task 12: Create app/services/receipt_service.py — receipt generation logic
  - CREATE: backend/app/services/receipt_service.py
  - MOVE: generate_correlative_number() from routes/receipts.py (lines 26-47)
  - MOVE: create_receipt_for_payment() from routes/receipts.py (lines 49-200)
  - REPLACE: inline Cloudinary block → call cloudinary_service.upload_receipt_pdf()
  - REPLACE: print() calls → logger.info() / logger.error()
  - REPLACE: traceback.print_exc() → logger.exception(...)
  - KEEP: Function signatures identical (params: payment, fee_period=None, notes=None)
  - RETURN: Receipt object (same return type as before)
  - EXPORT: Both functions for use by routes and other services

Task 13: Create app/services/payment_service.py — payment business logic
  - CREATE: backend/app/services/payment_service.py
  - MOVE: Payment CRUD orchestration from routes/payments.py:
      - create_payment_with_validation() — validate fee, create payment, return payment
      - approve_payment() — approve + trigger receipt generation
      - reject_payment()
      - bulk_approve_payments()
      - bulk_import_payments()
  - NOTE: These functions accept the Beanie Payment document as input, not HTTP request objects
  - NOTE: Do NOT include route decorators or FastAPI Depends() — services take resolved objects
  - REPLACE: print() calls → logger.info() / logger.error()
  - REPLACE: traceback.print_exc() → logger.exception(...)
  - IMPORT: cloudinary_service and receipt_service as needed

Task 14: Create app/services/fee_service.py — fee business logic
  - CREATE: backend/app/services/fee_service.py
  - MOVE from routes/fees.py:
      - generate_fees_logic() — the generate_fees endpoint body (lines ~330-420)
      - recalculate_fee_status() — called after payment changes
  - REPLACE: print() calls → logger.info() / logger.error()
  - NOTE: Fee generation is complex — be extremely careful to preserve all logic exactly

Task 15: Update all 12 route files to use new modules
  - MODIFY: Each file in backend/app/routes/*.py
  - REPLACE imports:
      from ..routes.auth import get_current_user → from ..dependencies.auth import get_current_user, require_admin
      from ..models.fee import FeeCreate, FeeUpdate, FeeResponse → from ..schemas.fee import ...
      (or keep model imports if models re-export schemas — see Task 10 NOTE)
  - REPLACE permission checks (45+ occurrences):
      if current_user.role != UserRole.ADMIN: ... → injected via Depends(require_admin)
      Pairs like (get_current_user, require_admin) in Depends() list
  - REPLACE Cloudinary blocks → import and call cloudinary_service
  - REPLACE print() + traceback.print_exc() → logger.error() / logger.exception()
  - REPLACE import traceback (lazy imports in except blocks) → remove entirely
  - PRESERVE: All HTTP-level logic (Query params, Path params, status codes, response_model)
  - PRESERVE: All response construction — do not change what the API returns
  - ORDER: Start with auth.py (already half-done in Task 6), then properties.py, fees.py,
           fee_schedules.py, payments.py, receipts.py, reports.py, dashboard.py,
           expenses.py, miscellaneous_payments.py, treasurers.py, agreements.py

Task 16: Update app/main.py — integrate new config and logging
  - MODIFY: backend/app/main.py
  - ADD: At top of file (before app creation):
      from .config.settings import settings
      from .config.logging import setup_logging
      setup_logging()
  - ADD: Config validation in startup event (verify settings are loaded correctly)
  - REPLACE: print() calls → logger.info()
  - ADD: Exception handler for unhandled exceptions (optional, low priority):
      @app.exception_handler(Exception)
      async def global_exception_handler(request, exc):
          logger.exception(f"Unhandled exception: {exc}")
          return JSONResponse(status_code=500, content={"detail": "Internal server error"})
  - KEEP: All router mounts, CORS, static files
  - VERIFY: All 12 router prefixes preserved

Task 17: Update backend/run.py if needed
  - CHECK: backend/run.py
  - MODIFY: Import settings or add logging call if not already triggered by main.py import chain
  - KEEP: uvicorn.run() call unchanged

Task 18: Install dependencies if needed
  - CHECK: Does requirements.txt have pydantic-settings?
  - ADD: pydantic-settings to requirements.txt if not present
  - RUN: pip install pydantic-settings

Task 19: Run ad-hoc test scripts to verify
  - RUN: python backend/test_admin_creation.py
  - RUN: python backend/test_fees_endpoint.py
  - RUN: python backend/test_payment_precision.py
  - FIX: Any import errors or broken references
```

---

## Validation

```bash
# Backend validation — no formal test framework, so manual checks

# 1. Import check — verify all modules import cleanly
cd backend && python -c "from app.main import app; print('All imports OK')"

# 2. Uvicorn startup check — verify FastAPI starts without errors
cd backend && timeout 5 python run.py 2>&1 || true

# 3. Ad-hoc test scripts
cd backend && python test_admin_creation.py
cd backend && python test_fees_endpoint.py
cd backend && python test_payment_precision.py

# 4. Grep for remaining anti-patterns
cd backend && rg "print\(" app/ --include '*.py' | grep -v "__pycache__" || echo "No print() remaining"
cd backend && rg "from \.\.routes\.\w+ import" app/ --include '*.py' | grep -v "auth\|get_current_user\|__init__" || echo "No cross-route imports remaining"
cd backend && rg "from \.receipts import" app/ --include '*.py' || echo "No sibling route imports remaining"
cd backend && rg "import traceback" app/ --include '*.py' || echo "No lazy traceback imports remaining"
```

**Manual API checks** (start server, then test):
- `POST /auth/login` — login still works
- `GET /properties/` — property list returns correctly
- `POST /properties/bulk-import` — bulk import works
- `POST /fees/generate` — fee generation works
- `POST /payments/` — create payment works
- `PUT /payments/{id}/approve` — approve works, receipt auto-generated
- `GET /receipts/` — receipt list returns correctly
- `POST /expenses/bulk-import` — expense import works

---

## Final Checklist

- [ ] `app/config/settings.py` created with all env vars
- [ ] `app/config/logging.py` created with structured logging
- [ ] `app/dependencies/auth.py` created with `require_admin` and `require_owner`
- [ ] `app/schemas/` directory with 8+ schema files
- [ ] `app/services/` directory with 4+ service modules
- [ ] All 12 route files updated (imports, permissions, Cloudinary, logging)
- [ ] Zero bare `print()` in `app/routes/` directory
- [ ] Zero `import traceback` in except blocks
- [ ] Zero cross-route imports (besides `get_current_user` from dependencies)
- [ ] `python -c "from app.main import app"` succeeds
- [ ] `python run.py` starts without errors
- [ ] `python test_admin_creation.py` passes
- [ ] `python test_fees_endpoint.py` passes
- [ ] `python test_payment_precision.py` passes
- [ ] All API endpoints return identical responses to before refactor
- [ ] `pydantic-settings` added to `requirements.txt`
- [ ] No `UserRole.ADMIN` manual checks remain in route handler bodies (replaced by Depends)

---

## Anti-Patterns to Avoid

- **Do NOT change API response models** — this is a structural refactor, not a feature change. Every endpoint must return the same JSON it returned before.
- **Do NOT remove redundant `fee_id` string field** on Payment — it is used for queries even though it duplicates the Link.
- **Do NOT change the receipt generation flow** — the synchronous await chain (approve → generate receipt → Cloudinary upload) must stay intact.
- **Do NOT introduce async/await mismatches** — Beanie requires `await` for all DB operations; service functions must be `async def`.
- **Do NOT add new dependencies** (libraries) beyond `pydantic-settings`.
- **Do NOT create circular imports** — the services layer must NOT import from routes. Routes import from services.
- **Do NOT refactor `utils/excel_generator.py` or `utils/pdf_generator.py`** — those are separate concerns (PRP 008+).
- **Do NOT add comments** unless code is truly non-obvious.
- **Do NOT use TypeScript/JS patterns** — this is Python backend only.
- **Do NOT move Beanie `Document` classes out of `app/models/`** — they must stay for Beanie's `init_beanie()` to work.
