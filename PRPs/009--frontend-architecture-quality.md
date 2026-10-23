# PRP: Frontend Architecture & Code Quality Improvements

> **Version:** 1.0
> **Created:** 2025-05-22
> **Status:** Implemented
> **Implementation:** Verified 2026-10-23: lazy routes, ErrorBoundary, hooks/utils, StatCard, skip link and a11y improvements are in place. Page containers use `maxWidth="xl"` consistently.

---

## Goal

Refactor the frontend to address critical architecture, performance, code quality, and accessibility issues identified in the audit. Enforce lazy loading, extract reusable hooks and utilities, add error boundaries, eliminate dead code, and reduce bundle size — all without changing user-facing behavior.

## Why

- **0% test coverage** — solo existe el boilerplate de CRA que ni siquiera aplica al proyecto
- **Sin lazy loading** — 14 páginas importadas estáticamente, bundle único gigante
- **Sin ErrorBoundary** — cualquier error de render crashea toda la app a pantalla blanca
- **Sin custom hooks ni utils** — toda la lógica inline duplicada en cada componente
- **Patrones duplicados 10+ veces**: `createObjectURL → <a> → revokeObjectURL`, meses del año, status colors/labels, `Container maxWidth sx={{mt:4, mb:4}}`
- **Sin memoización** — cero `React.memo`, `useMemo`, `useCallback` (salvo 2 excepciones)
- **`recharts` en `package.json` sin usar** (~150KB muertos)
- **`console.log` en producción** en `PaymentManagement.js`
- **Componentes inline** (`StatCard` en `Dashboard.js`, `ThemeWrapper`/`AppRouter` en `App.js`)
- **Sin a11y**: iconos sin `aria-label`, sin skip-to-content, sin `role` explícitos
- **`LoadingSpinner` propaga `...props`** al DOM — warnings de React
- **Container widths inconsistentes** (`maxWidth="lg"` vs `maxWidth="xl"`)

## Success Criteria

- [x] `React.lazy()` + `<Suspense>` para las rutas protegidas — bundle splitteado por ruta
- [x] `<ErrorBoundary>` a nivel raíz en `App.js`
- [x] Directorio `src/hooks/` con 4+ custom hooks (`useApi`, `usePagination`, `useDialog`, `useDownload`)
- [x] Directorio `src/utils/` con `constants.js`, `statusMappings.js`, `months.js`, `downloadBlob.js`
- [x] `StatCard` extraído a `src/components/common/StatCard.js`
- [x] `recharts` eliminado de `package.json`
- [x] `console.log` eliminados de `PaymentManagement.js` y otros componentes
- [x] `LoadingSpinner` no propaga props desconocidas al DOM
- [x] Loading states unificados: todos los componentes usan `<LoadingSkeleton>`, no texto plano
- [x] Iconos MUI con `aria-label` o `titleAccess` en botones de acción
- [x] Skip-to-content link en `Layout.js`
- [x] Ancho de página consistente con `PageContainer` (`xl`, salvo perfil)
- [x] `npm run build` succeeds sin warnings nuevos
- [x] `npm test` passes (tests existentes + nuevos para hooks/utils)

---

## All Needed Context

### Key Files

```yaml
- file: frontend/src/App.js
  why: Router setup, ProtectedRoute, lazy loading target, ErrorBoundary insertion point

- file: frontend/src/components/Layout.js
  why: Skip-to-content link, Container wrapper consistency

- file: frontend/src/components/PaymentManagement.js
  why: 1340 líneas, console.log, patrones a extraer (download, filters, status colors)

- file: frontend/src/components/Dashboard.js
  why: StatCard inline component, patrones de loading states

- file: frontend/src/components/FeeManagement.js
  why: 771 líneas, meses duplicados, status mappings duplicados

- file: frontend/src/components/MiscellaneousPaymentManagement.js
  why: 605 líneas, fetch sin paginación, patrones duplicados

- file: frontend/src/components/ReportsManagement.js
  why: 551 líneas, download con MIME type hardcodeado incorrecto

- file: frontend/src/components/ReceiptManagement.js
  why: Usa texto plano en lugar de LoadingSkeleton para loading

- file: frontend/src/components/FeeScheduleManagement.js
  why: Bug generation_day vs due_day en handleOpenDialog/handleCloseDialog

- file: frontend/src/components/common/LoadingSkeleton.js
  why: Modelo de loading state a seguir

- file: frontend/src/components/common/LoadingSpinner.js
  why: Bug de propagación de props

- file: frontend/src/contexts/AuthContext.js
  why: Token en localStorage, bug en register (setUser con datos del form)

- file: frontend/src/services/api.js
  why: Sin AbortController, hard redirect en 401, interceptor bien estructurado

- file: frontend/package.json
  why: Dependencias, scripts, recharts a eliminar

- file: frontend/public/index.html
  why: lang="en" debe ser "es", title genérico de CRA, meta description

- file: AGENTS.md
  why: Stack quirks (form-data login, proxy, etc.)
```

### Conventions

- Frontend es React 19 + MUI 7 + CRA. JavaScript puro (JSX) — sin TypeScript.
- Login usa `multipart/form-data` con campo `username` (el email).
- API calls van por `src/services/api.js` (Axios con interceptor de auth).
- Theme: `ThemeContext.js` provee `{ theme, isDarkMode, toggleTheme }`.
- Tests: Jest + React Testing Library, se ejecutan con `npm test` desde `frontend/`.
- Build: `npm run build` genera `frontend/build/`.
- Proxy en desarrollo: `"proxy": "http://localhost:8000"` en `package.json`.

### Current Component Structure
```
src/
  index.js              # Entry point (web-vitals sin callback)
  App.js                # Router + providers + ProtectedRoute inline
  contexts/
    AuthContext.js       # Token/user en localStorage, bug en register
    ThemeContext.js      # MUI theme light/dark
  services/
    api.js              # Axios instance, interceptors, API modules
  components/
    Login.js
    Layout.js            # Sidebar + contenido responsivo
    Dashboard.js         # StatCard inline
    PaymentManagement.js # 1340 líneas
    FeeManagement.js     # 771 líneas
    FeeScheduleManagement.js # bug generation_day/due_day
    MiscellaneousPaymentManagement.js # 605 líneas
    ReportsManagement.js # 551 líneas
    ReceiptManagement.js # texto plano en loading
    ExpenseManagement.js
    PropertyManagement.js
    UserManagement.js
    AgreementManagement.js
    TreasurerConfiguration.js
    Profile.js
    common/
      LoadingSkeleton.js
      LoadingSpinner.js  # ...props bug
      ConfirmDialog.js
      PaymentsModal.js
```

### Desired Structure
```
src/
  index.js
  App.js                         # Lazy routes + Suspense + ErrorBoundary
  App.css                        # Vacío (se mantiene o se elimina)
  contexts/
    AuthContext.js               # Sin cambios en este PRP
    ThemeContext.js
  services/
    api.js
  hooks/                         # NUEVO
    useApi.js                    # AbortController + loading + error
    usePagination.js
    useDialog.js
    useDownload.js
  utils/                         # NUEVO
    constants.js                 # Roles, payment types, status values
    statusMappings.js            # getStatusColor, getStatusLabel unificados
    months.js                    # Array de 12 meses
    downloadBlob.js              # createObjectURL → click → revokeObjectURL
  pages/                         # RENOMBRADO desde components/
    Login.js
    Layout.js
    Dashboard.js
    PaymentManagement.js         # Reducido, coordina sub-componentes
    FeeManagement.js
    FeeScheduleManagement.js     # Arreglado bug due_day
    MiscellaneousPaymentManagement.js
    ReportsManagement.js         # MIME type corregido
    ReceiptManagement.js         # Usa LoadingSkeleton
    ExpenseManagement.js
    PropertyManagement.js
    UserManagement.js
    AgreementManagement.js
    TreasurerConfiguration.js
    Profile.js
    common/                      # Componentes compartidos
      LoadingSkeleton.js
      LoadingSpinner.js          # Sin spread de props
      ConfirmDialog.js
      PaymentsModal.js
      StatCard.js                # NUEVO - extraído de Dashboard
      ErrorBoundary.js           # NUEVO
      PageContainer.js           # NUEVO - wrapper Container maxWidth="lg"
```

### Known Gotchas

```javascript
// CRITICAL: Login usa multipart/form-data con username, NO JSON.
// AuthContext.login() usa URLSearchParams + FormData. No romper este patrón.

// CRITICAL: El proxy de CRA solo funciona en dev (npm start).
// En prod, la API debe estar en el mismo origen o con reverse proxy.

// CRITICAL: El bug de register en AuthContext — setUser guarda datos del form,
// no la respuesta del servidor. user.id y user.role quedan undefined.
// FIX: después de register, llamar a /users/me como hace login.

// GOTCHA: FeeScheduleManagement tiene bug: handleOpenDialog setea generation_day:'1'
// pero handleCloseDialog resetea due_day:'1'. El campo real es due_day.
// handleOpenDialog debe usar due_day.

// GOTCHA: ReportsManagement línea ~110 hardcodea MIME type de spreadsheet
// para TODOS los reportes, rompiendo descargas PDF.

// GOTCHA: LoadingSpinner hace <CircularProgress {...props} /> propagando
// todas las props desconocidas al DOM. Usar solo props relevantes.

// GOTCHA: web-vitals en index.js se llama sin callback, no hace nada.
// Se puede eliminar o pasar console.log como callback.
```

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Create directories and utility files
  - CREATE: frontend/src/hooks/ directory (vacío, archivos en tasks siguientes)
  - CREATE: frontend/src/utils/constants.js
    CONTENT: export ROLE_ADMIN, ROLE_OWNER, PAYMENT_STATUS, FEE_STATUS, MISC_PAYMENT_TYPES
  - CREATE: frontend/src/utils/months.js
    CONTENT: export const MONTHS = [{value:1,label:'Enero'},...{value:12,label:'Diciembre'}]
  - CREATE: frontend/src/utils/statusMappings.js
    CONTENT: export getStatusColor(status), getStatusLabel(status) — unificado de PaymentManagement, FeeManagement, MiscPaymentManagement, PaymentsModal
  - CREATE: frontend/src/utils/downloadBlob.js
    CONTENT: export downloadBlob(blob, filename) — createObjectURL → <a> click → revokeObjectURL
  - VERIFY: npm run build no rompe (solo se agregaron archivos, sin modificar existentes)

Task 2: Fix bugs in existing components (sin refactorizar estructura)
  - MODIFY: FeeScheduleManagement.js
    BUG: handleOpenDialog asigna generation_day:'1' - cambiar a due_day:'1'
  - MODIFY: ReportsManagement.js
    BUG: downloadReport línea ~110 hardcodea MIME type spreadsheet. Usar dinámico según Content-Type del response.
  - MODIFY: LoadingSpinner.js
    BUG: quitar ...props spread. Solo pasar size, color, sx al CircularProgress.
  - MODIFY: ReceiptManagement.js
    BUG: reemplazar texto "Cargando..." por <LoadingSkeleton type="table" rows={5} columns={...} />
  - DELETE: console.log de PaymentManagement.js líneas 100 y 370
  - VERIFY: npm run build succeeds

Task 3: Extract StatCard and create PageContainer + ErrorBoundary
  - CREATE: frontend/src/components/common/StatCard.js
    MOVE: componente StatCard desde Dashboard.js (línea 95)
    PROPS: { title, value, icon, color, loading }
  - CREATE: frontend/src/components/common/ErrorBoundary.js
    CONTENT: class ErrorBoundary extends React.Component con componentDidCatch + fallback UI
  - CREATE: frontend/src/components/common/PageContainer.js
    CONTENT: <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>{children}</Container>
  - MODIFY: Dashboard.js — importar StatCard desde common/StatCard, eliminar definición inline
  - VERIFY: npm run build, Dashboard renderiza igual

Task 4: Implement lazy loading in App.js
  - MODIFY: frontend/src/App.js
    REPLACE: imports estáticos de 14 páginas → React.lazy(() => import(...))
    ADD: <Suspense fallback={<LoadingSpinner />}> wrappeando las rutas
    ADD: <ErrorBoundary> wrappeando <Suspense>
    KEEP: ProtectedRoute, AuthProvider, ThemeProvider — mismos wrappers
  - VERIFY: npm run build genera chunks separados por página
  - VERIFY: Cambiar de página en la app carga sin error

Task 5: Create custom hooks
  - CREATE: frontend/src/hooks/useApi.js
    FUNCTION: useApi(apiCall) → { data, loading, error, execute }
    FEATURES: AbortController para cancelar requests stale, estado loading/error
  - CREATE: frontend/src/hooks/usePagination.js
    FUNCTION: usePagination(fetchFn, defaultLimit=20) → { page, totalPages, totalCount, setPage, data, loading }
  - CREATE: frontend/src/hooks/useDialog.js
    FUNCTION: useDialog(initialFormData={}) → { open, editingItem, formData, handleOpen, handleClose, setFormData }
  - CREATE: frontend/src/hooks/useDownload.js
    FUNCTION: useDownload() → { downloadBlob, downloadExcel, downloadPDF }
    USES: utils/downloadBlob.js
  - VERIFY: npm run build (hooks no se usan aún, pero compilan)

Task 6: Unify duplicated patterns across pages
  - MODIFY: FeeManagement.js — reemplazar array meses inline por MONTHS de utils
  - MODIFY: PaymentManagement.js — reemplazar array meses inline
  - MODIFY: MiscellaneousPaymentManagement.js — reemplazar array meses inline
  - MODIFY: ReportsManagement.js — reemplazar array meses inline
  - MODIFY: FeeManagement.js — reemplazar getStatusColor/getStatusLabel locales por imports de utils
  - MODIFY: PaymentManagement.js — reemplazar getStatusColor/getStatusLabel locales
  - MODIFY: MiscellaneousPaymentManagement.js — reemplazar getStatusColor/getStatusLabel locales
  - MODIFY: PaymentsModal.js — reemplazar getStatusColor/getStatusLabel locales
  - MODIFY: Todas las páginas — reemplazar Container inline por <PageContainer>
  - VERIFY: npm run build

Task 7: Clean up dead code and warnings
  - MODIFY: frontend/src/index.js — eliminar o arreglar web-vitals (pasar console.log como callback)
  - MODIFY: frontend/package.json — eliminar "recharts" de dependencies
  - MODIFY: frontend/public/index.html
    CHANGE: lang="en" → lang="es"
    CHANGE: <title>React App</title> → <title>Pago Vecinal</title>
    CHANGE: meta description de CRA → descripción real
  - RUN: npm uninstall recharts
  - VERIFY: npm run build succeeds, bundle size reducido

Task 8: Add accessibility improvements
  - MODIFY: frontend/src/components/Layout.js
    ADD: <SkipToContentLink /> con href="#main-content"
    ADD: id="main-content" al contenido principal
  - MODIFY: Fila de acciones en tablas (PaymentManagement, FeeManagement, etc.)
    ADD: aria-label a IconButton de editar, eliminar, aprobar, rechazar, descargar
    PATTERN: <IconButton aria-label="Editar pago" onClick={...}><EditIcon /></IconButton>
  - MODIFY: Sidebar.js
    ADD: role="navigation", aria-label="Menú principal" al drawer/sidebar
  - VERIFY: npm run build, inspeccionar con lector de pantalla

Task 9: Write tests for new modules
  - CREATE: frontend/src/utils/__tests__/constants.test.js
    TEST: constantes exportadas correctamente, valores esperados
  - CREATE: frontend/src/utils/__tests__/months.test.js
    TEST: array tiene 12 elementos, labels y values correctos
  - CREATE: frontend/src/utils/__tests__/statusMappings.test.js
    TEST: getStatusColor devuelve colores correctos para cada status
    TEST: getStatusLabel devuelve labels correctos
    TEST: maneja status desconocido con default
  - CREATE: frontend/src/utils/__tests__/downloadBlob.test.js
    TEST: crea objectURL, crea <a>, hace click, revoca URL
    MOCK: URL.createObjectURL, URL.revokeObjectURL, document.createElement
  - CREATE: frontend/src/components/common/__tests__/ErrorBoundary.test.js
    TEST: renderiza children sin error, renderiza fallback cuando hay error
  - CREATE: frontend/src/components/common/__tests__/StatCard.test.js
    TEST: renderiza title, value, icon, color correctamente
  - VERIFY: npm test pasa todos los tests

Task 10: Final verification
  - RUN: cd frontend && npm run build — verificar sin errores ni warnings nuevos
  - RUN: cd frontend && npm test — todos los tests pasan
  - RUN: npx source-map-explorer build/static/js/*.js — verificar reducción de bundle
  - RUN: Verificar manualmente: login, navegación entre páginas, CRUD básico, filtros
```

---

## Validation

```bash
# Build check
cd frontend && npm run build

# Test suite
cd frontend && npm test -- --watchAll=false

# Bundle size check
cd frontend && npx source-map-explorer build/static/js/main.*.js --no-border-checks
```

---

## Final Checklist

- [x] `src/hooks/` con `useApi.js`, `usePagination.js`, `useDialog.js`, `useDownload.js`
- [x] `src/utils/` con `constants.js`, `months.js`, `statusMappings.js`, `downloadBlob.js`
- [x] `src/components/common/StatCard.js`, `ErrorBoundary.js`, `PageContainer.js`
- [x] `App.js` con `React.lazy()` + `<Suspense>` + `<ErrorBoundary>`
- [x] Bug `generation_day` → `due_day` corregido en FeeScheduleManagement
- [x] MIME type dinámico en ReportsManagement
- [x] LoadingSpinner sin spread de props
- [x] ReceiptManagement usa LoadingSkeleton
- [x] `console.log` eliminados de producción
- [x] Array meses unificado en `utils/months.js`, usado en 4 componentes
- [x] Status mappings unificados en `utils/statusMappings.js`, usado en 4 componentes
- [x] `Container` reemplazado por `<PageContainer>` en todas las páginas
- [x] `recharts` eliminado de `package.json`
- [x] `index.html` con lang="es", title="Pago Vecinal", meta description real
- [x] Skip-to-content link en Layout
- [x] aria-label en IconButtons de acciones
- [x] role="navigation" en Sidebar
- [x] `npm run build` succeeds
- [x] `npm test` passes (nuevos tests para utils + ErrorBoundary + StatCard)
- [x] Bundle size reducido (sin recharts, con code splitting)

---

## Anti-Patterns to Avoid

- **No cambiar TypeScript** — el proyecto es JS puro
- **No cambiar el flujo de login** — mantiene `multipart/form-data` con `username`
- **No introducir nuevas dependencias** de estado (Redux, Zustand, etc.)
- **No romper el proxy de CRA** — `"proxy": "http://localhost:8000"` debe seguir funcionando en dev
- **No usar CSS modules ni styled-components** — el proyecto usa MUI `sx`, mantener ese patrón
- **No modificar API responses** — el backend no se toca en este PRP
- **No tocar AuthContext.register** en este PRP — es un bug de lógica de negocio que requiere coordinación con backend
