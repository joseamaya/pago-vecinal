# PRP: Notification System (Snackbar/Toast)

> **Version:** 1.0
> **Created:** 2025-05-18
> **Status:** Ready

---

## Goal
Replace the current ad-hoc error/success feedback (inline `<Alert>` components and native `alert()` calls) with a global MUI Snackbar notification system. This provides consistent, non-intrusive toast notifications across all pages.

## Why
- `PaymentManagement.js` uses native `alert()` for bulk approval success — breaks MUI UX consistency
- Errors are shown via inline `<Alert>` at the top of containers — pushes content down, lacks auto-dismiss
- No success toasts anywhere — users get no confirmation after mutations (create/edit/delete)
- Each component duplicates its own error state management

## Success Criteria
- [ ] Global `NotificationProvider` context wraps the app (in `App.js`)
- [ ] `useNotification()` hook provides `{ success(msg), error(msg), info(msg), warning(msg) }`
- [ ] Native `alert()` in `PaymentManagement.js` replaced with snackbar toast
- [ ] Inline `<Alert>` error patterns replaced with snackbar where appropriate (errors on mutations)
- [ ] Snackbar auto-dismisses after 4 seconds (configurable)
- [ ] Multiple toasts can stack
- [ ] Snackbar respects theme (light/dark)
- [ ] `npm run build` succeeds, `npm test` passes

---

## All Needed Context

### Key Files
```yaml
- file: frontend/src/App.js
  why: Provider nesting — NotificationProvider must wrap the app
- file: frontend/src/components/PaymentManagement.js
  why: Contains native alert() calls to replace
- file: frontend/src/components/Dashboard.js
  why: Uses inline error states — candidate for snackbar
- file: frontend/src/components/Login.js
  why: Uses inline Alert for login errors — keep inline for login (it's a form-level error)
- file: frontend/src/components/PropertyManagement.js
  why: Likely follows same inline Alert pattern — check and update
- file: frontend/src/components/FeeManagement.js
  why: Same
```

### Current Pattern (to replace)
```javascript
// PaymentManagement.js line ~702 — native alert
alert(`Se aprobaron ${response.data.approved_count} pagos exitosamente`);

// Most components — inline Alert at top of container
const [error, setError] = useState('');
// ...
{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
```

### Target Pattern
```javascript
// In any component:
const { success, error } = useNotification();

const handleDelete = async (id) => {
  try {
    await api.delete(`/items/${id}`);
    success('Elemento eliminado correctamente');
    fetchItems();
  } catch (err) {
    error('Error al eliminar el elemento');
  }
};
```

### MUI Snackbar + Alert Combo
```jsx
import { Snackbar, Alert } from '@mui/material';

<Snackbar
  open={open}
  autoHideDuration={4000}
  onClose={handleClose}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
>
  <Alert onClose={handleClose} severity="success" variant="filled">
    Mensaje aquí
  </Alert>
</Snackbar>
```

### Implementation Approach

**Option A — Simple Context (Recommended):**
- Create `NotificationContext.js` in `frontend/src/contexts/`
- Wraps a queue of notifications displayed as stacked MUI Snackbars
- Provides `{ success, error, info, warning }` functions
- Uses `Slide` transition from MUI (or default)

**Option B — Custom Hook Only:**
- Simpler: a hook that manages a single Snackbar state
- Components call `showNotification(msg, severity)` which auto-dismisses
- Lacks stacking support

Go with Option A for proper UX.

### File Structure
```
frontend/src/contexts/
├── AuthContext.js       # Already exists
├── ThemeContext.js      # Already exists
└── NotificationContext.js  # NEW
```

### Expected NotificationContext Pattern
```javascript
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, Stack } from '@mui/material';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, severity) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, severity }]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback((msg) => addNotification(msg, 'success'), [addNotification]);
  const error = useCallback((msg) => addNotification(msg, 'error'), [addNotification]);
  const info = useCallback((msg) => addNotification(msg, 'info'), [addNotification]);
  const warning = useCallback((msg) => addNotification(msg, 'warning'), [addNotification]);

  return (
    <NotificationContext.Provider value={{ success, error, info, warning }}>
      {children}
      <Stack spacing={1} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
        {notifications.map(({ id, message, severity }) => (
          <Snackbar
            key={id}
            open
            autoHideDuration={4000}
            onClose={() => removeNotification(id)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert severity={severity} variant="filled" onClose={() => removeNotification(id)}>
              {message}
            </Alert>
          </Snackbar>
        ))}
      </Stack>
    </NotificationContext.Provider>
  );
};
```

### Gotchas
- NotificationProvider must be inside ThemeProvider (so Alert uses theme colors) but can be inside or outside AuthProvider — inside is better so it can potentially show auth errors
- Don't wrap the Snackbar in a `<Box>` with layout-affecting styles — use `sx` with `position: fixed` and `zIndex`
- Don't remove inline Alert from Login.js — form-level validation errors are different from toast notifications
- Keep `autoHideDuration` consistent across all notifications (4000ms is standard)

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Create NotificationContext
  - CREATE: frontend/src/contexts/NotificationContext.js
  - IMPLEMENT: NotificationProvider with stacked Snackbars
  - EXPORT: useNotification hook + NotificationProvider

Task 2: Wire into App.js
  - MODIFY: frontend/src/App.js
  - INSERT: NotificationProvider wrapping children
  - ORDER: ThemeProvider > ThemeWrapper > NotificationProvider > AuthProvider > AppRouter
  - WHY: Notification needs theme; Auth needs notification

Task 3: Replace native alert in PaymentManagement.js
  - MODIFY: frontend/src/components/PaymentManagement.js
  - IMPORT: useNotification
  - REPLACE: alert('Se aprobaron...') → success('Se aprobaron...')
  - REPLACE: error setError + inline Alert patterns → notification.error() for mutation errors
  - KEEP: inline Alert for form validation errors (amountError, etc.) — those are field-level

Task 4: Audit and update remaining components
  - CHECK: PropertyManagement.js, FeeManagement.js, FeeScheduleManagement.js, ReceiptManagement.js
  - MODIFY: replace mutation feedback with snackbar calls
  - KEEP: form-level validation errors as inline Alert
```

---

## Validation

```bash
cd frontend && npm run build   # Must succeed
cd frontend && npm test        # Must pass
```

Manual checks:
- Perform a create/edit/delete action → success toast appears bottom-right, auto-dismisses
- Trigger an API error → error toast appears
- Rapidly trigger multiple toasts → they stack vertically
- Close a toast manually → it dismisses
- Native `alert()` no longer appears anywhere
- Toggle dark mode → toasts use correct theme colors

---

## Final Checklist

- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] NotificationContext created with stacked snackbar support
- [ ] `useNotification()` hook provides success/error/info/warning
- [ ] PaymentManagement native `alert()` replaced
- [ ] Mutation success/failure feedback uses snackbar across all management pages
- [ ] Form-level validation errors still show as inline Alert (unchanged)
- [ ] Toasts auto-dismiss after 4 seconds
- [ ] Multiple toasts stack correctly
- [ ] Dark/light mode works for toasts

---

## Anti-Patterns to Avoid

- ❌ Don't replace inline Alert for form validation errors — those are context-specific, not global notifications
- ❌ Don't use `notistack` or any third-party toast library — MUI Snackbar + Alert is sufficient
- ❌ Don't modify Login.js error display — login errors are form-level
- ❌ Don't put NotificationProvider outside ThemeProvider — it needs theme access
- ❌ Don't forget to handle the "remove on close" for individual stacked toasts
