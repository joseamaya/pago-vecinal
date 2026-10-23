# PRP: Backend Test Coverage

> **Version:** 1.0
> **Created:** 2025-05-22
> **Status:** Implemented
> **Implementation:** Verified 2026-10-23: 323 backend tests passing with pytest + mongomock.

---

## Goal

Implement a pytest-based test suite covering the newly created service layer, configuration, dependencies, and schema modules. Achieve high coverage on business logic (services), config validation, auth dependencies, and route integration tests — all without a real MongoDB connection.

## Why

- There is **no test framework** in the project — only 3 ad-hoc scripts (`test_admin_creation.py`, `test_fees_endpoint.py`, `test_payment_precision.py`) that require a live MongoDB connection.
- The new `services/`, `dependencies/`, `config/`, and `schemas/` modules from PRP 007 have **zero test coverage**.
- No tests for auth logic (token creation, password hashing, `get_current_user`, `require_admin`).
- No tests for the Cloudinary service, receipt generation logic, or payment approval flow.
- All current "tests" are manual scripts with print/output that require human inspection.

## Success Criteria

- [x] `pytest` + `pytest-asyncio` + `httpx` + `mongomock` installed in requirements
- [x] `backend/app/tests/` directory created with proper `__init__.py`
- [x] `backend/pytest.ini` configured with asyncio mode and test paths
- [x] Unit tests for `app/config/settings.py` (valid config, missing env var, defaults)
- [x] Unit tests for `app/config/logging.py` (setup_logging, log levels)
- [x] Unit tests for `app/auth/utils.py` (password hashing, JWT create/verify, authenticate_user with mocked DB)
- [x] Unit tests for `app/dependencies/auth.py` (`get_current_user` valid/invalid tokens, `require_admin` access control)
- [x] Unit tests for `app/services/cloudinary_service.py` (upload, delete, error handling — mocked cloudinary)
- [x] Unit tests for `app/services/receipt_service.py` (correlative number generation, receipt creation with mocked DB/Cloudinary)
- [x] Unit tests for `app/services/payment_service.py` (fee status recalculation, approval flow, receipt trigger)
- [x] Unit tests for `app/schemas/common.py` (PaginatedResponse serialization, BulkApproveRequest validation)
- [x] Unit tests for `app/schemas/` model schemas (Create/Update/Response validation, required fields, edge cases)
- [x] Integration tests for 3 key route modules using `TestClient` with mocked Beanie
- [x] Existing ad-hoc test scripts still run without modification
- [x] `pytest` runs in CI-like mode without requiring MongoDB

---

## All Needed Context

### Key Files

```yaml
- file: backend/app/config/settings.py
  why: BaseSettings — test env var loading, missing vars, defaults

- file: backend/app/config/logging.py
  why: setup_logging() — test handler configuration, log levels

- file: backend/app/config/database.py
  why: Mock this entirely for tests — no real MongoDB required

- file: backend/app/auth/utils.py
  why: verify_password, get_password_hash, create_access_token, verify_token, authenticate_user, get_current_user

- file: backend/app/dependencies/auth.py
  why: get_current_user (FastAPI Depends wrapper), require_admin

- file: backend/app/services/cloudinary_service.py
  why: upload_receipt_pdf, delete_cloudinary_file — mock cloudinary.uploader

- file: backend/app/services/receipt_service.py
  why: generate_correlative_number, create_receipt_for_payment — mock Beanie + Cloudinary

- file: backend/app/services/payment_service.py
  why: update_fee_status_based_on_payments, create_receipt_on_approval, approve_payment, bulk_approve_payments

- file: backend/app/schemas/common.py
  why: PaginatedResponse[T], BulkApproveRequest — test serialization

- file: backend/app/schemas/fee.py
  why: FeeCreate, FeeResponse — test field validation, required fields

- file: backend/app/schemas/user.py
  why: UserCreate — test EmailStr validation, role enum

- file: backend/app/routes/auth.py
  why: Login/register endpoints — integration test with TestClient

- file: backend/app/routes/users.py
  why: User CRUD — integration test with TestClient

- file: backend/app/routes/fees.py
  why: Fee list + generation — integration test with mock aggregation

- file: AGENTS.md
  why: Stack quirks, dev commands
```

### Conventions

- **Python 3.12** + FastAPI + Beanie ODM + MongoDB (Motor).
- **Login** uses `multipart/form-data` with `username` (email) and `password` fields.
- **All endpoints are `async def`** — tests must use `pytest-asyncio` or be wrapped in `AsyncClient`.
- **No pydantic-settings mock needed** — settings can be set via environment variables or `.env` file.
- **The existing `.env` has real secrets** — tests must NOT read from it. Use `pytest-env` or set env vars in `pytest.ini` / test fixtures.
- **Beanie documents use `init_beanie()`** before queries — mock this or use `mongomock` which is compatible with PyMongo/Motor.
- **No existing CI pipeline** — `pytest` command will be the primary validation.

### Current Test Pattern (to be preserved)
```python
# test_admin_creation.py pattern: ad-hoc, asyncio.run(), hardcoded env reads
# These must remain runnable with `python test_*.py` as before
```

### Known Gotchas

```python
# CRITICAL: mongomock does NOT support Motor's async client directly.
# Use unittest.mock to patch AsyncIOMotorClient or use mongomock's MongoClient + wrap in motor.
# Alternative: patch Beanie's find()/find_one()/insert()/save() methods directly.

# CRITICAL: FastAPI TestClient is synchronous but async endpoints need special handling.
# Use httpx.AsyncClient or pytest-asyncio with ASGITransport for async tests.

# CRITICAL: Beanie's init_beanie() must be called before any Document queries.
# For unit tests, either mock the Document class methods or init a mongomock instance.

# CRITICAL: The Cloudinary SDK expects real credentials. Tests must mock
# cloudinary.config(), cloudinary.uploader.upload(), and cloudinary.uploader.destroy().

# GOTCHA: Some route handlers use Form(...) params (payments.py, miscellaneous_payments.py).
# TestClient.post() with data={} sends form-urlencoded, which matches OAuth2PasswordRequestForm.

# GOTCHA: test_admin_creation.py uses print() assertions — must still run correctly to pass.
```

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Install test dependencies and configure pytest
  - MODIFY: backend/requirements.txt — add `pytest`, `pytest-asyncio`, `httpx`, `mongomock`, `pytest-env`
  - CREATE: backend/pytest.ini with:
      [pytest]
      asyncio_mode = auto
      testpaths = app/tests
      env =
          MONGODB_URL=mongomock://localhost
          DATABASE_NAME=pago_vecinal_test
          SECRET_KEY=test-secret-key-for-tests-only
          ALGORITHM=HS256
          ACCESS_TOKEN_EXPIRE_MINUTES=1
          CLOUDINARY_CLOUD_NAME=test-cloud
          CLOUDINARY_API_KEY=test-api-key
          CLOUDINARY_API_SECRET=test-api-secret
          INITIAL_ADMIN_EMAIL=admin@test.com
          INITIAL_ADMIN_PASSWORD=TestPass123
          INITIAL_ADMIN_NAME=Test Admin
  - RUN: pip install -r requirements.txt

Task 2: Create test directory and conftest.py with shared fixtures
  - CREATE: backend/app/tests/__init__.py (empty)
  - CREATE: backend/app/tests/conftest.py with fixtures:
      - mock_beanie: patches Beanie init and Document methods (find, find_one, insert, save, delete)
      - test_settings: imports and returns Settings (with test env vars)
      - test_client: creates FastAPI TestClient from app.main
      - auth_headers: helper to generate Bearer token with test JWT
      - MOCK_USER: constant dict for a test admin user
      - MOCK_PROPERTY: constant dict for a test property
      - MOCK_FEE: constant dict for a test fee
      - MOCK_PAYMENT: constant dict for a test payment

Task 3: Write tests for app/config/settings.py
  - CREATE: backend/app/tests/config/test_settings.py
  - TEST: Settings loads with all env vars set → validates correctly
  - TEST: Settings with missing MONGODB_URL → raises ValidationError
  - TEST: Settings defaults (DATABASE_NAME="pago_vecinal", ALGORITHM="HS256", etc.)
  - TEST: ACCESS_TOKEN_EXPIRE_MINUTES type coercion (string to int)
  - MOCK: Use pytest.MonkeyPatch or pytest-env to override env

Task 4: Write tests for app/config/logging.py
  - CREATE: backend/app/tests/config/test_logging.py
  - TEST: setup_logging() adds a StreamHandler
  - TEST: setup_logging() respects LOG_LEVEL env var (DEBUG, WARNING)
  - TEST: setup_logging() sets motor/pymongo loggers to WARNING
  - FIXTURE: Clean up handlers after test to avoid side effects

Task 5: Write tests for app/auth/utils.py
  - CREATE: backend/app/tests/auth/test_utils.py
  - TEST: get_password_hash() produces bcrypt hash different from input
  - TEST: verify_password() returns True for correct password
  - TEST: verify_password() returns False for wrong password
  - TEST: create_access_token() returns a valid JWT string
  - TEST: verify_token() decodes valid token and returns email
  - TEST: verify_token() returns None for expired token
  - TEST: verify_token() returns None for tampered token
  - TEST: authenticate_user() returns user for valid credentials (mock Beanie find_one)
  - TEST: authenticate_user() returns None for wrong password
  - TEST: authenticate_user() returns None for non-existent email
  - TEST: get_current_user() returns User object for valid token
  - TEST: get_current_user() raises 401 for invalid token
  - MOCK: Patch User.find_one to return mock user doc

Task 6: Write tests for app/dependencies/auth.py
  - CREATE: backend/app/tests/dependencies/test_auth.py
  - TEST: oauth2_scheme token URL is correctly set
  - TEST: get_current_user() integrates with Depends (mock token extraction)
  - TEST: require_admin() allows admin user → returns user
  - TEST: require_admin() blocks owner user → raises 403
  - TEST: require_admin() dependency chaining (Depends(get_current_user) → Depends(require_admin))
  - MOCK: Patch _get_current_user to return mock user with specified role

Task 7: Write tests for app/services/cloudinary_service.py
  - CREATE: backend/app/tests/services/test_cloudinary_service.py
  - TEST: upload_receipt_pdf() calls cloudinary.uploader.upload with correct params
  - TEST: upload_receipt_pdf() returns the secure_url from upload result
  - TEST: upload_receipt_pdf() filename format is correct (pattern "recibo_CUOT-2025-00001_timestamp.pdf")
  - TEST: delete_cloudinary_file() calls cloudinary.uploader.destroy with correct public_id
  - TEST: delete_cloudinary_file() logs error but does not raise on exception
  - MOCK: unittest.mock.patch("cloudinary.uploader.upload")
  - MOCK: unittest.mock.patch("cloudinary.uploader.destroy")
  - MOCK: unittest.mock.patch("cloudinary.config")

Task 8: Write tests for app/services/receipt_service.py
  - CREATE: backend/app/tests/services/test_receipt_service.py
  - TEST: generate_correlative_number() returns "REC-2025-00001" for first receipt
  - TEST: generate_correlative_number() increments last number for existing receipts
  - TEST: generate_correlative_number() with custom prefix "CUOT" returns "CUOT-2025-00001"
  - TEST: create_receipt_for_payment() creates receipt with correct data
  - TEST: create_receipt_for_payment() sets property details from fee
  - TEST: create_receipt_for_payment() uses defaults when fee has no property
  - TEST: create_receipt_for_payment() generates PDF and uploads to Cloudinary
  - TEST: create_receipt_for_payment() uses treasurer data when villa matches
  - MOCK: Receipt.find, Receipt.insert, Payment methods, Treasurer.find_one
  - MOCK: generate_receipt_pdf, upload_receipt_pdf

Task 9: Write tests for app/services/payment_service.py
  - CREATE: backend/app/tests/services/test_payment_service.py
  - TEST: update_fee_status_based_on_payments() sets COMPLETED when total_paid >= amount
  - TEST: update_fee_status_based_on_payments() sets PARTIALLY_PAID when 0 < total_paid < amount
  - TEST: update_fee_status_based_on_payments() sets PENDING when total_paid == 0
  - TEST: update_fee_status_based_on_payments() updates paid_amount on fee
  - TEST: create_receipt_on_approval() calls create_receipt_for_payment
  - TEST: create_receipt_on_approval() logs error but does not raise on failure
  - TEST: approve_payment() sets status to APPROVED, triggers receipt, updates fee
  - TEST: bulk_approve_payments() processes multiple payments, counts successes/errors
  - TEST: bulk_approve_payments() skips already-approved payments
  - MOCK: Payment.find, Fee.find_one, create_receipt_for_payment, payment.save

Task 10: Write tests for app/schemas/
  - CREATE: backend/app/tests/schemas/test_common.py
  - TEST: PaginatedResponse serializes with data and pagination dict
  - TEST: PaginatedResponse works with generic type parameter
  - TEST: BulkApproveRequest validates payment_ids is non-empty list
  - TEST: PropertyBulkImportResponse validates imported/updated are ints
  - CREATE: backend/app/tests/schemas/test_user.py
  - TEST: UserCreate with valid data → passes validation
  - TEST: UserCreate with missing email → raises ValidationError
  - TEST: UserCreate with invalid email format → raises ValidationError
  - TEST: UserCreate with invalid role value → raises ValidationError
  - TEST: UserResponse serializes correctly
  - CREATE: backend/app/tests/schemas/test_fee.py
  - TEST: FeeCreate validates required fields (property_id, fee_schedule_id, due_date)
  - TEST: FeeResponse computed field remaining_amount is not required in input
  - CREATE: backend/app/tests/schemas/test_payment.py
  - TEST: PaymentCreate validates fee_id is required
  - TEST: PaymentResponse all optional fields accept None
  - (Similar tests for property, receipt, expense schemas — minimal)

Task 11: Write integration tests for app/routes/auth.py
  - CREATE: backend/app/tests/routes/test_auth.py
  - TEST: POST /auth/login with valid credentials → returns 200 + token
  - TEST: POST /auth/login with wrong password → returns 401
  - TEST: POST /auth/login with non-existent email → returns 401
  - TEST: POST /auth/login with form-data username/password → works
  - TEST: POST /auth/register with new email → returns 200 + token
  - TEST: POST /auth/register with existing email → returns 400
  - MOCK: authenticate_user, User.find_one, User.insert

Task 12: Write integration tests for app/routes/users.py
  - CREATE: backend/app/tests/routes/test_users.py
  - TEST: GET /users/ → returns list with pagination (admin)
  - TEST: GET /users/ → owner can only see self
  - TEST: POST /users/ → creates new user (admin)
  - TEST: PUT /users/{id} → updates user fields
  - TEST: DELETE /users/{id} → deletes user
  - TEST: GET /users/me → returns current user
  - MOCK: User.find_all, User.get, User.insert, User.save, User.delete

Task 13: Write integration tests for app/routes/fees.py
  - CREATE: backend/app/tests/routes/test_fees.py
  - TEST: GET /fees/ → returns paginated fee list
  - TEST: GET /fees/?year=2025&month=1 → filters correctly
  - TEST: GET /fees/?status=pending → filters by status
  - TEST: GET /fees/?property_id=xxx → filters by property
  - TEST: POST /fees/generate → admin only, creates fees
  - TEST: POST /fees/generate → owner gets 403
  - MOCK: database.fees aggregation pipeline

Task 14: Write integration tests for app/routes/payments.py
  - CREATE: backend/app/tests/routes/test_payments.py
  - TEST: GET /payments/ → returns paginated list
  - TEST: POST /payments/ (form-data) → creates payment
  - TEST: PUT /payments/{id} approve → triggers receipt creation
  - TEST: POST /payments/bulk-approve → approves multiple
  - TEST: DELETE /payments/{id} → admin only
  - MOCK: Payment CRUD + receipt_service + cloudinary

Task 15: Write integration tests for app/routes/receipts.py
  - CREATE: backend/app/tests/routes/test_receipts.py
  - TEST: GET /receipts/ → returns paginated list
  - TEST: GET /receipts/{id} → returns single receipt
  - TEST: GET /receipts/{id}/download → returns PDF stream
  - MOCK: Receipt CRUD + generate_receipt_pdf

Task 16: Verify ad-hoc scripts still work
  - RUN: python backend/test_admin_creation.py
  - RUN: python backend/test_fees_endpoint.py
  - RUN: python backend/test_payment_precision.py
  - FIX: Any import errors introduced by refactoring

Task 17: Run full test suite and verify coverage
  - RUN: cd backend && pytest app/tests/ -v
  - RUN: cd backend && pytest app/tests/ --cov=app --cov-report=term-missing (if pytest-cov available)
  - TARGET: >70% coverage on app/services/, app/config/, app/dependencies/, app/schemas/
```

---

## Validation

```bash
# Install test dependencies
cd backend && pip install -r requirements.txt

# Run all tests
cd backend && pytest app/tests/ -v

# Run specific test file
cd backend && pytest app/tests/services/test_cloudinary_service.py -v

# Run with coverage
cd backend && pytest app/tests/ -v --tb=short

# Verify ad-hoc scripts still work
cd backend && python test_admin_creation.py
cd backend && python test_fees_endpoint.py
cd backend && python test_payment_precision.py
```

---

## Final Checklist

- [x] `pytest`, `pytest-asyncio`, `httpx`, `mongomock` and `pytest-env` in `requirements.txt`
- [x] `pytest.ini` configured with `asyncio_mode=auto` and test env vars
- [x] `app/tests/conftest.py` with shared fixtures
- [x] Config/logging tests covered in `app/tests/config/test_settings.py`
- [x] Auth and dependency tests cover password hashing, JWT and access control
- [x] Service tests cover Cloudinary, receipts and payments with mocked DB/Cloudinary
- [x] Schema tests cover common, fee, payment and user models
- [x] Route integration tests use `TestClient` with mocked Beanie
- [x] `pytest app/tests -q` passes (324 tests)
- [x] Legacy diagnostic scripts run without crashing against a disposable database
- [x] No real MongoDB required for the pytest suite

---

## Anti-Patterns to Avoid

- **Do NOT connect to real MongoDB** during tests — use mocks only
- **Do NOT read from `.env`** during tests — use `pytest.ini` env vars
- **Do NOT modify ad-hoc test scripts** — they must remain runnable as-is
- **Do NOT test FastAPI internals** — test behavior via TestClient or mocked services
- **Do NOT test third-party libraries** (e.g., don't test bcrypt itself — test it's called correctly)
- **Do NOT create new patterns** — follow pytest conventions: arrange/act/assert, fixtures, parametrize
- **Do NOT use `unittest.TestCase`** — use pytest-style functions only
- **Do NOT hardcode secrets** in tests — use `test-secret-for-testing` and document it's test-only
