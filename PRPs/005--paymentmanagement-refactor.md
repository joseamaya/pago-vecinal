# PRP: PaymentManagement Refactor

> **Version:** 1.0
> **Created:** 2025-05-18
> **Status:** Implemented
> **Implementation:** Verified 2026-10-23: `PaymentManagement.js` is 326 lines; hooks/components extracted and covered by tests.

---

## Goal
Refactor `PaymentManagement.js` (currently 1341 lines) into smaller, focused components and custom hooks. The component contains dialog logic, cascade selectors, filtering, bulk operations, and table rendering — all in one file. Extract reusable pieces to improve maintainability without changing functionality.

## Why
- 1341 lines in a single component is unsustainable — hard to read, test, and modify
- The cascade selector pattern (Villa → Fila → Casa → Cuota) is duplicated logic that other modules could reuse
- Dialog state management is interleaved with table logic
- Filter state and API calls are mixed with rendering

## Success Criteria
- [x] `PaymentManagement.js` reduced to <400 lines (coordinating sub-components)
- [x] Custom hook `usePaymentFilters` extracted for filter state + API calls
- [x] Custom hook `usePaymentDialog` extracted for dialog/form state
- [x] `PaymentTable` component extracted (table + rows + pagination)
- [x] `PaymentFormDialog` component extracted (the add/edit dialog with cascade selectors)
- [x] `BulkUploadDialog` component extracted (the bulk upload dialog)
- [x] All existing functionality preserved (CRUD, filters, bulk approve, bulk upload, export)
- [x] `npm run build` succeeds, `npm test` passes

---

## All Needed Context

### Key Files
```yaml
- file: frontend/src/components/PaymentManagement.js
  why: THE file to refactor — 1341 lines
- file: frontend/src/components/common/LoadingSkeleton.js
  why: Already used by PaymentManagement — keep pattern
- file: frontend/src/services/api.js
  why: API endpoints used (paymentsAPI, feesAPI, propertiesAPI, reportsAPI)
- file: frontend/src/contexts/AuthContext.js
  why: isAdmin used for permission gating
```

### Current Component Breakdown (lines)
```
1-46    Imports and component setup
47-95   State declarations (~50 state vars)
96-115  fetchPayments + useEffect
116-146 fetchProperties + empty states
147-282 handleOpenDialog + handleCloseDialog (cascade selection + fee fetching)
283-345 handleSubmit (create/update with FormData)
346-362 handleDelete
363-386 handleApprove (with 2s setTimeout for receipt generation)
387-403 handleReject
404-444 handleBulkUpload
445-475 handleSelectPayment / handleSelectAll / applyFilters / clearFilters
476-520 handleExportExcel
521-675 Villa → Row → House → Fee cascade handlers
676-707 handleBulkApprove
708-758 Pagination + handleDownload + status helpers
759+   JSX: header, filters, table, dialogs (~580 lines JSX)
```

### Extraction Plan

**`usePaymentFilters.js`** — custom hook:
```javascript
// Manages: filterYear, filterMonth, filterStatus, filterProperty
//          filteredPayments, currentPage, totalPages, totalCount
//          fetchPayments(), applyFilters(), clearFilters()
// Returns: { filters, setFilters, payments, pagination, fetchPayments, ... }
```

**`usePaymentDialog.js`** — custom hook:
```javascript
// Manages: open, editingPayment, formData, cascade selection state
//          availableFees, selectedFeeInfo, approveDirectly
//          handleOpenDialog(), handleCloseDialog(), handleSubmit()
//          handleVillaChange(), handleRowChange(), handleHouseChange(), handleFeeChange()
// Returns: { dialogState, openDialog, closeDialog, handlers }
```

**`PaymentTable.js`** — component:
```javascript
// Props: payments, loading, isAdmin, selectedPayments, selectAll
//        onSelectPayment, onSelectAll, onEdit, onApprove, onReject, onDelete, onDownload
//        pagination ({ page, totalPages, totalCount, onPageChange })
```

**`PaymentFormDialog.js`** — component:
```javascript
// Props: open, onClose, editingPayment, properties, isAdmin
// Uses: usePaymentDialog internally or receives its state
// Renders: the cascade selector (Villa → Fila → Casa), fee selector, amount, date, notes, approve checkbox
```

**`BulkUploadDialog.js`** — component:
```javascript
// Props: open, onClose, onUploadComplete
// Renders: file input, upload button, results display
```

### Gotchas
- The cascade Villa → Fila → Casa → Cuota uses `propertiesAPI.getProperties(1, 10000)` to fetch ALL properties — this is a code smell but must be preserved for now
- `handleApprove` uses `setTimeout(..., 2000)` to wait for receipt generation — this is fragile but must be preserved exactly
- `handleBulkApprove` uses `alert()` — this will be replaced by the Notification PRP (PRP 003), so leave it as-is in the refactor
- FormData is used for payment create/update (not JSON) because it may include file uploads — preserve this pattern
- The `console.log` statements throughout should be preserved during refactor (cleanup is a separate concern)
- The `validateAmount` function must be preserved exactly — it has specific business logic

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Extract usePaymentFilters hook
  - CREATE: frontend/src/hooks/usePaymentFilters.js
  - MOVE: filterYear, filterMonth, filterStatus, filterProperty
          filteredPayments, currentPage, totalPages, totalCount, initialLoad
          payments, loading, error
          fetchPayments(), applyFilters(), clearFilters()
          handlePageChange()
  - EXPOSE: { filters, payments, loading, error, pagination, fetchPayments, clearFilters }

Task 2: Extract usePaymentDialog hook
  - CREATE: frontend/src/hooks/usePaymentDialog.js
  - MOVE: open, editingPayment, formData, cascade state (selectedVilla, etc.)
          availableFees, selectedFeeInfo, selectedFeeId, selectedFeeAmount, approveDirectly
          handleOpenDialog(), handleCloseDialog(), handleSubmit()
          handleVillaChange(), handleRowChange(), handleHouseChange(), handleFeeChange()
          validateAmount()
  - EXPOSE: { dialogState, openDialog, closeDialog, cascadeHandlers, submitHandler, validation }

Task 3: Extract PaymentTable component
  - CREATE: frontend/src/components/payments/PaymentTable.js
  - MOVE: table JSX + header row + body rows + pagination
          status helpers (getStatusColor, getStatusLabel)
          handleDownload, handleSelectPayment, handleSelectAll, handleBulkApprove
  - IMPORT: hooks from Task 1/2
  - RENDER: Table + Pagination

Task 4: Extract PaymentFormDialog component
  - CREATE: frontend/src/components/payments/PaymentFormDialog.js
  - MOVE: dialog JSX (cascade selectors, fee info, form fields)
          cascade handler logic
  - IMPORT: usePaymentDialog

Task 5: Extract BulkUploadDialog component
  - CREATE: frontend/src/components/payments/BulkUploadDialog.js
  - MOVE: bulk upload dialog JSX + handlers

Task 6: Rewrite PaymentManagement.js as coordinator
  - MODIFY: frontend/src/components/PaymentManagement.js
  - KEEP: only the container logic (layout, error banner, orchestration)
  - COMPOSE: PaymentTable + PaymentFormDialog + BulkUploadDialog
  - VERIFY: all functionality works identically

Task 7: Create directory structure
  - CREATE: frontend/src/components/payments/ directory
  - CREATE: frontend/src/hooks/ directory
```

### New File Structure
```
frontend/src/
  components/
    payments/
      PaymentTable.js
      PaymentFormDialog.js
      BulkUploadDialog.js
    PaymentManagement.js   # Reduced to ~300 lines
  hooks/
    usePaymentFilters.js
    usePaymentDialog.js
```

---

## Validation

```bash
cd frontend && npm run build   # Must succeed
cd frontend && npm test        # Must pass
```

Manual checks:
- Payment list loads, filters work, pagination works
- Create payment dialog: select Villa → Fila → Casa → Cuota, submit
- Edit payment: click edit, change amount, submit
- Approve/reject individual payments
- Bulk approve (select multiple, click approve)
- Bulk upload (open dialog, select file, upload)
- Export Excel
- Download receipt PDF
- Delete payment

---

## Final Checklist

- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] `PaymentManagement.js` reduced from 1341 to <400 lines
- [ ] All 5 extracted modules created
- [ ] All existing CRUD operations work identically
- [ ] Cascade selectors work (Villa → Fila → Casa → Cuota)
- [ ] Bulk operations work (approve, upload, export)
- [ ] Filters + pagination work
- [ ] Receipt download works
- [ ] No regressions in any payment workflow

---

## Anti-Patterns to Avoid

- ❌ Don't change any business logic — this is a pure structural refactor
- ❌ Don't remove `console.log` statements (cleanup is separate)
- ❌ Don't change the 2-second setTimeout in handleApprove
- ❌ Don't replace `alert()` in bulk approve (that's PRP 003)
- ❌ Don't introduce new state management (no Redux, no Zustand)
- ❌ Don't change FormData pattern for payment submissions
- ❌ Don't use TypeScript
