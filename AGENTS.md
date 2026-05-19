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
  app/main.py          # FastAPI app, CORS, static files, router mounts
  app/config/database.py  # Beanie init with 11 document models
  app/auth/utils.py     # JWT create/verify, password hashing, auth helpers
  app/routes/           # 14 router modules (auth, users, properties, fees, fee-schedules,
                        #   payments, receipts, reports, dashboard, expenses,
                        #   miscellaneous-payments, treasurers, agreements)
  app/models/           # 11 Beanie document models
  run.py                # uvicorn launcher (reload=True)
  test_*.py             # ad-hoc scripts, no test framework — run with `python test_*.py`

frontend/
  src/index.js          # React entrypoint
  src/App.js            # Router + auth/theme providers, protected routes
  src/services/api.js   # Axios instance, interceptors, typed API modules
  src/contexts/         # AuthContext (form-data login), ThemeContext (dark/light)
```

## Key Quirks
- **Login sends `multipart/form-data`** (not JSON) — `OAuth2PasswordRequestForm` expects form fields `username` (the email) and `password`. The frontend `AuthContext.js` handles this; curl must use `-d "username=...&password=..."` with `Content-Type: application/x-www-form-urlencoded`.
- **Two fee routers**: `/fees/` (generated fees per property per period) and `/fee-schedules/` (rate definition templates). They are separate Beanie models.
- **Env loading**: `backend/app/config/database.py` calls `load_dotenv()` which reads `backend/.env` manually; Docker Compose uses root `.env`.
- **Default admin** auto-created on first startup via env vars (`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_NAME`). Default: `admin@pago-vecinal.com` / `AdminPass123!`.
- **CORS wide open**: `allow_origins=["*"]` in `main.py`.
- **Static files** mounted at `/static` (serves generated PDFs from `backend/static/receipts/`, etc).
- **Python ad-hoc tests** in `backend/` — no pytest infra, run with `python backend/test_*.py`.
- **Frontend proxy** in `package.json`: `"proxy": "http://localhost:8000"` — only active in CRA dev mode.
- **Deployment**: Railway via `railway.toml` at root, `backend/`, and `frontend/`. Root `railway.toml` health-check at `/docs`.
- **Installed skill**: `frontend-design` (locked in `skills-lock.json`).

## Database
- MongoDB via Beanie ODM with 11 document models (User, Property, FeeSchedule, Fee, Payment, Receipt, Agreement, AgreementInstallment, MiscellaneousPayment, Expense, Treasurer).
- Connection: `MONGODB_URL` env var (defaults to `mongodb://localhost:27017`), 5s timeout, pool size 10.
- Migration helper: `backend/migrate_fee_schedule_field.py` (rename `generation_day` → `due_day`).
