# Pago Vecinal — Agent Guide

## Stack
- **Backend**: FastAPI + MongoDB (Beanie ODM) + JWT auth
- **Frontend**: React 19 + Material-UI 7 + Create React App

## Dev Commands

```bash
# Backend (from backend/)
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python run.py                              # dev server at :8000 with auto-reload
uvicorn app.main:app --reload              # equivalent

# Frontend (from frontend/)
npm install && npm start                   # dev server at :3000, proxies API to :8000
npm test                                   # Jest + React Testing Library
npm run build                              # outputs to build/

# Docker (from repo root)
docker-compose up --build                  # starts backend + frontend + mongodb
```

## Project Structure
```
backend/
  app/main.py          # FastAPI app, lifespan, CORS, request-id/logging + audit middleware, routers
  app/config/          # settings (pydantic BaseSettings), logging, Beanie DB init
  app/auth/utils.py     # JWT create/verify, password hashing, auth helpers
  app/dependencies/     # reusable FastAPI deps (get_current_user, require_admin, rate_limit)
  app/schemas/          # Pydantic API models — single source for Create/Update/Response
  app/services/         # business logic layer (payments, receipts, reports, agreements, ...)
  app/models/           # 11 Beanie document models only (no API schemas)
  app/routes/           # 14 router modules (auth, users, properties, fees, fee-schedules,
                        #   payments, receipts, reports, dashboard, expenses,
                        #   miscellaneous-payments, treasurers, agreements)
  app/tests/            # pytest suite — run with `pytest app/tests`
  run.py                # uvicorn launcher (reload=True)
  test_*.py             # legacy ad-hoc scripts — run with `python test_*.py`

frontend/
  src/index.js          # React entrypoint
  src/App.js            # Router + auth/theme providers, protected routes
  src/services/api.js   # Axios instance, interceptors, typed API modules
  src/contexts/         # AuthContext (form-data login), ThemeContext (dark/light)
```

## Key Quirks
- **Login sends `multipart/form-data`** (not JSON) — `OAuth2PasswordRequestForm` expects form fields `username` (the email) and `password`. The frontend `AuthContext.js` handles this; curl must use `-d "username=...&password=..."` with `Content-Type: application/x-www-form-urlencoded`.
- **Two fee routers**: `/fees/` (generated fees per property per period) and `/fee-schedules/` (rate definition templates). They are separate Beanie models.
- **Env loading**: `app/config/settings.py` uses pydantic-settings and reads `backend/.env` (Docker Compose uses root `.env`). Required vars: `MONGODB_URL`, `SECRET_KEY`, `INITIAL_ADMIN_PASSWORD`, `CLOUDINARY_*`.
- **Default admin** auto-created on first startup via env vars (`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_NAME`). Default: `admin@pago-vecinal.com` / `AdminPass123!`.
- **CORS** is configurable via `CORS_ORIGINS` (JSON array, default `["*"]`) in `settings.py`.
- **No public static mount**: receipts/agreements/signatures are only reachable through authenticated endpoints; the expenses import template is served at `GET /expenses/template` (admin).
- **Security**: `/auth/login` and `/auth/register` are rate-limited (in-memory per IP); every mutating request is written to the `audit_logs` collection by middleware.
- **Dependencies**: Beanie is pinned to 1.x (2.x breaks the ODM usage); Dependabot ignores breaking majors for beanie/reportlab/bcrypt/@mui.
- **Tests**: pytest suite in `backend/app/tests` (`pytest app/tests`), plus legacy ad-hoc scripts.
- **Frontend proxy** in `package.json`: `"proxy": "http://localhost:8000"` — only active in CRA dev mode.
- **Deployment**: Render, configured via dashboard (no IaC file in repo). Backend = Web Service from `backend/Dockerfile` (root dir `backend`, health check `/health`); frontend = Static Site (root dir `frontend`, build `npm ci && npm run build`, publish `build`, rewrite `/*` → `/index.html`). `PORT` is injected by Render and respected by both Dockerfiles.
- **Installed skill**: `frontend-design` (locked in `skills-lock.json`).

## Database
- MongoDB via Beanie ODM with 11 document models (User, Property, FeeSchedule, Fee, Payment, Receipt, Agreement, AgreementInstallment, MiscellaneousPayment, Expense, Treasurer).
- Connection: `MONGODB_URL` env var (defaults to `mongodb://localhost:27017`), 5s timeout, pool size 10.
- Migration helper: `backend/migrate_fee_schedule_field.py` (rename `generation_day` → `due_day`).
