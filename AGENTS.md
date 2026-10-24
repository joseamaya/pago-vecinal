# Pago Vecinal — Agent Guide

## Stack
- **Backend**: FastAPI + MongoDB (Beanie 1.x) + JWT auth.
- **Frontend**: React 19 + Material-UI 7 + Create React App (JavaScript/JSX, no TypeScript).

## Commands

### Backend (from `backend/`)
```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python run.py                 # dev server on :8000 with auto-reload
pytest app/tests              # full test suite
```

### Frontend (from `frontend/`)
```bash
npm install
npm start                     # dev server on :3000, proxies API to :8000
CI=true npm test -- --watchAll=false
npm run build
npm run test:e2e              # Playwright; needs MongoDB (default localhost:27017)
```

### Docker (from repo root)
```bash
docker compose up --build
```

Use **npm** only (`packageManager` is pinned in `frontend/package.json`); do not add `yarn.lock`.

## Definition of Done
- Backend changes: `cd backend && pytest app/tests`.
- Frontend changes: `cd frontend && CI=true npm test -- --watchAll=false && npm run build`.
- Run both when a change crosses the API boundary.
- Keep tests and the production build green; do not leave new console warnings.

## Architecture
- **Backend**
  - `app/routes/`: HTTP layer only. Validate input, call a service, return a schema.
  - `app/services/`: business logic and persistence orchestration.
  - `app/schemas/`: Pydantic API models (Create/Update/Response and shared models).
  - `app/models/`: Beanie documents only; no API schemas.
  - `app/dependencies/auth.py`: `get_current_user`, `require_admin`, `require_owner`.
  - `app/config/`: settings (`pydantic-settings`), logging and Beanie initialization.
- **Frontend**
  - `src/components/`: feature pages; `components/common/` shared UI; `components/payments/` payment-specific UI.
  - `src/hooks/`: reusable state/API hooks (`usePaymentFilters`, `usePaymentDialog`, ...).
  - `src/contexts/`: auth, theme, toast and confirm providers.
  - `src/services/api.js`: the only place for HTTP calls.
  - `src/theme/`, `src/utils/`: design tokens and pure helpers.
- **Data flow**: component → hook → `services/api.js` → FastAPI route → service → Beanie model.
- Do not import route modules from other routes; move shared behavior to `app/services/`.
- Keep `PaymentManagement.js` as a thin coordinator; payment dialogs/tables belong in `components/payments/`.

## Conventions
- Follow existing MUI patterns and keep components small.
- Use `ToastContext` for user feedback and `ConfirmContext` for destructive actions; never use `alert()`.
- Use `require_admin` / `require_owner` for authorization; do not duplicate role checks in route bodies.
- Keep API schemas in `app/schemas/`; do not define response models inside routes.
- Normalize person names with `app/utils/names.py` (`normalize_person_name`) on writes; do not duplicate the title-case logic.
- Add tests for new services, hooks and components. Backend tests use pytest + mongomock; frontend uses Jest + React Testing Library.
- Never commit `.env`, `.env.local`, secrets, build artifacts or local tooling files.
- Do not hardcode credentials in docs or code; the initial admin is created from environment variables.

## Configuration and Security
- Required backend env vars: `MONGODB_URL`, `SECRET_KEY`, `INITIAL_ADMIN_PASSWORD`, `CLOUDINARY_*`; see `.env.example`.
- Local backend reads `backend/.env`; Docker Compose uses the root `.env`.
- CORS is controlled by `CORS_ORIGINS` (JSON array); use `["*"]` only for local development.
- `/auth/login` is rate-limited per IP. User accounts are created by an admin via `/users/`; there is no public registration.
- Every mutating request is recorded in the `audit_logs` collection by middleware.
- Uploads are validated by extension, content type, magic bytes and size: Excel ≤10 MB, signatures ≤2 MB, receipts ≤10 MB.
- Receipts, agreements and signatures are not publicly mounted; access them through authenticated endpoints.
- Beanie is pinned to 1.x; upgrading to 2.x breaks the current ODM usage.

## Key Quirks
- **Login uses form data, not JSON**: `username` is the email and `password` is the password. The frontend sends `multipart/form-data`; curl should use `-d "username=...&password=..."` with `Content-Type: application/x-www-form-urlencoded`.
- **Two fee routers**: `/fees/` stores generated fees per property/period; `/fee-schedules/` stores rate templates. They are separate models.
- **Owners are not users**: `Owner` holds the person's data and may link one `User` account via `Owner.user`. `Property.owners` stores owner ids (many-to-many); `Property.primary_owner` is used for receipts/reports and `owner_name`/`owner_phone` are a derived cache. Inactive owners lose property access.
- **Frontend proxy** in `package.json` (`http://localhost:8000`) only applies in CRA development mode.
- **Deployment**: Render is configured through the dashboard (no IaC file). Backend is a Web Service from `backend/Dockerfile`; frontend is a Static Site with `npm ci && npm run build` and a `/*` → `/index.html` rewrite. Both respect `PORT`.

## Database
- 12 Beanie documents: `User`, `Owner`, `Property`, `FeeSchedule`, `Fee`, `Payment`, `Receipt`, `Agreement`, `AgreementInstallment`, `MiscellaneousPayment`, `Expense`, `Treasurer`.
- Connection: `MONGODB_URL` (default `mongodb://localhost:27017`), 5s timeout, pool size 10.
- Migration helper: `backend/migrate_fee_schedule_field.py` (`generation_day` → `due_day`).

## References
- Setup, features and API usage: `README.md`.
- Feature specifications and implementation blueprints: `PRPs/`.
- Shared agent skills: `.agents/skills/` (locked in `skills-lock.json`).
