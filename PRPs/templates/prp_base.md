# PRP: [Feature Name]

> **Version:** 1.0
> **Created:** [Date]
> **Status:** Ready

---

## Goal
[What needs to be built — specific end state]

## Why
- [Business value and user impact]
- [Problems this solves]

## Success Criteria
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]

---

## All Needed Context

### Key Files
```yaml
- file: frontend/src/contexts/ThemeContext.js
  why: Current MUI theme configuration (light/dark)
- file: frontend/src/App.js
  why: Root component, provider nesting
- file: frontend/src/services/api.js
  why: Axios instance, interceptors, all API modules
- file: frontend/src/App.css
  why: Global styles (has dead CRA boilerplate)
- file: frontend/src/index.css
  why: Body/root styles, font stack
- file: frontend/public/index.html
  why: HTML entrypoint, meta tags, title, fonts
- file: AGENTS.md
  why: Stack quirks (form-data login, proxy, etc.)
```

### Conventions
- Frontend is React 19 + MUI 7 + CRA. No TypeScript — plain JS.
- Login uses `multipart/form-data` with `username` field (not JSON).
- API calls go through `src/services/api.js` (Axios instance with auth interceptor).
- Theme: `ThemeContext.js` provides `{ theme, isDarkMode, toggleTheme }`.
- Routing: React Router v6. Protected routes in `App.js`.
- No test framework for Python (ad-hoc scripts). Frontend tests use Jest/RTL via `npm test`.

### Current File: ThemeContext.js
```javascript
// Light theme uses pure MUI defaults (#1976d2 primary, #dc004e secondary, #f5f5f5 bg)
// Dark theme uses pure MUI defaults (#90caf9 primary, #f48fb1 secondary, #121212 bg)
// No custom palette, no semantic colors beyond mode switch
```

### Current File: App.css
```css
/* Contains dead CRA boilerplate: .App-logo-spin keyframes, .App-header, .App-logo */
```

### Current File: index.css
```css
/* Body uses default system font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', ... */
```

### Current File: public/index.html
```html
<!-- lang="en", title="React App", generic CRA meta description, default favicon -->
```

---

## Implementation Blueprint

### Tasks (in execution order)
```yaml
Task 1: [Description]
  - MODIFY: [file]
  - FIND pattern: "[existing code to locate]"

Task 2: [Description]
  - CREATE: [new file path]
  - MIRROR pattern from: [existing file]

Task N: [Description]
  - DELETE: [dead code file/path]
```

---

## Validation

```bash
# Frontend validation
cd frontend && npm run build    # Check for build errors
cd frontend && npm test          # Run existing tests
```

---

## Final Checklist

- [ ] `npm run build` succeeds without errors
- [ ] `npm test` passes all existing tests
- [ ] Manual visual check in browser confirms expected behavior
- [ ] No dead code left behind (CRA boilerplate, unused imports)
- [ ] Responsive layout verified (mobile + desktop)
- [ ] Light and dark mode both work

---

## Anti-Patterns to Avoid

- ❌ Don't import libraries not already in `package.json`
- ❌ Don't use TypeScript — project is plain JS
- ❌ Don't break the form-data login pattern in `AuthContext.js`
- ❌ Don't add comments unless the code is non-obvious (project convention)
- ❌ Don't create new files when editing existing ones suffices
- ❌ Don't introduce dependencies outside the existing stack (MUI 7, React 19, Axios, recharts)
