# PRP: Visual Identity & Theming

> **Version:** 1.0
> **Created:** 2025-05-18
> **Status:** Ready

---

## Goal
Replace the generic MUI default look with a cohesive, branded visual identity. This includes a custom color palette, distinctive typography, proper meta tags/favicon, and cleanup of dead CRA boilerplate CSS.

## Why
- Current UI is indistinguishable from a default MUI template — no brand personality
- `<html lang="en">` should be `es`, title is "React App", favicon is CRA default
- Dark/light themes use stock MUI colors with zero customization
- `App.css` and `index.css` contain dead CRA boilerplate code
- Body uses the default system font stack (ugly, no character)

## Success Criteria
- [ ] Custom color palette defined (primary, secondary, accent, background variants, semantic colors) — no MUI defaults
- [ ] One distinctive font pair loaded (e.g., display + body from Google Fonts) — not the system stack
- [ ] `index.html` updated: `<html lang="es">`, `<title>Pago Vecinal</title>`, proper meta description, custom favicon
- [ ] Dark theme is not just `#121212` — uses a curated dark palette that complements the light palette
- [ ] `App.css` stripped of dead CRA boilerplate (`.App-logo-spin`, `.App-header`, `.App-logo`)
- [ ] `index.css` updated with the new font stack and any design tokens
- [ ] All existing pages look correct in both light and dark modes
- [ ] `npm run build` succeeds, `npm test` passes

---

## All Needed Context

### Key Files
```yaml
- file: frontend/src/contexts/ThemeContext.js
  why: Where MUI theme is defined — this is the primary file to modify
- file: frontend/public/index.html
  why: HTML entrypoint, meta, title, font loading
- file: frontend/src/index.css
  why: Body/root styles, font-face declarations
- file: frontend/src/App.css
  why: Global styles — needs dead code removal
- file: frontend/src/index.js
  why: Entrypoint — verify no stray CRA references
- file: frontend/src/components/Sidebar.js
  why: Has theme toggle — verify it works with new theme
- file: frontend/src/components/Login.js
  why: First impression page — should reflect brand
```

### Design Direction (Choose one)

**Option A — "Residencial Profesional":**
- Deep teal/navy primary (`#0D4F4F` or `#1B3A5C`), warm gold accent (`#D4A843`)
- Clean, confident, institutional feel
- Dark mode: charcoal backgrounds (`#1A1D23`), muted teal accents

**Option B — "Cálido Mediterráneo":**
- Terracotta primary (`#C8684A`), sandy secondary (`#E8D5B7`), olive accent (`#7A8B5F`)
- Earthy, welcoming, residential feel
- Dark mode: warm dark browns (`#2C2420`), muted terracotta

**Option C — "Moderno Corporativo":**
- Indigo primary (`#3F51B5`), emerald accent (`#2E7D32`), slate neutrals
- Professional, clean, financial-tool feel
- Dark mode: true dark slate (`#1E2029`), indigo glow accents

**Typography suggestion (pair):**
- Display/headings: **DM Serif Display** or **Fraunces** (serif with character)
- Body/UI: **Inter Tight**, **Outfit**, or **Sora** (clean humanist sans)
- Avoid: Inter, Roboto, Space Grotesk (overused AI defaults)

### Current ThemeContext code pattern
```javascript
// Current light theme — pure MUI defaults
const lightTheme = createTheme({
  palette: { mode: 'light', primary: { main: '#1976d2' }, ... }
});
// Needs to become:
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#C8684A', light: '#E8997F', dark: '#A34A30', contrastText: '#FFFFFF' },
    secondary: { main: '#E8D5B7', ... },
    background: { default: '#F9F6F0', paper: '#FFFFFF' },
    // ... semantic colors
  },
  typography: {
    fontFamily: '"Outfit", sans-serif',
    h1: { fontFamily: '"Fraunces", serif' },
    // ...
  },
  shape: { borderRadius: 12 },
  // Custom component overrides
  components: {
    MuiCard: { styleOverrides: { root: { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 8, textTransform: 'none' } } },
  }
});
```

### Gotchas
- `ThemeContext.js` is used by `ThemeWrapper` in `App.js` — the interface (`{ theme, isDarkMode, toggleTheme }`) must remain unchanged
- `CssBaseline` already applies MUI reset — don't duplicate base styles
- Google Fonts should be loaded via `<link>` in `index.html`, not via JS import
- Favicon files go in `frontend/public/` and should be a simple SVG or PNG — no build config changes needed

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Replace palette and typography in ThemeContext.js
  - MODIFY: frontend/src/contexts/ThemeContext.js
  - REPLACE: entire createTheme() calls for both light and dark
  - KEEP: the context API surface ({ theme, isDarkMode, toggleTheme })

Task 2: Update public/index.html
  - MODIFY: frontend/public/index.html
  - CHANGE: lang="es", <title>Pago Vecinal</title>, meta description
  - ADD: Google Fonts <link> for chosen typeface(s)
  - REPLACE: favicon.ico with custom SVG favicon

Task 3: Clean up index.css
  - MODIFY: frontend/src/index.css
  - REPLACE: font-family with chosen body font
  - REMOVE: unused rules
  - ADD: only essential global overrides (if any)

Task 4: Clean up App.css
  - MODIFY: frontend/src/App.css
  - REMOVE: all dead CRA boilerplate (.App-logo-spin, .App-header, .App-logo)
  - KEEP: only styles actively used (likely none — move to MUI sx if needed)

Task 5: Verify theme toggle works across all components
  - CHECK: Sidebar.js theme switch, Login.js, Dashboard.js cards
  - FIX: any hardcoded colors that break in dark mode
```

---

## Validation

```bash
cd frontend && npm run build   # Must succeed
cd frontend && npm test        # Must pass
```

Manual checks:
- Open light mode — verify palette, typography, spacing feel cohesive
- Toggle to dark mode — verify all sections are readable, no contrast issues
- Check Login page (first impression), Dashboard (cards), Sidebar (navigation)
- Verify favicon shows in browser tab
- Verify `<title>` shows "Pago Vecinal"

---

## Final Checklist

- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] Custom palette applied (no MUI defaults remain)
- [ ] Custom font pair loaded and applied
- [ ] `index.html` has proper lang, title, meta, favicon
- [ ] Dead CRA CSS removed from `App.css` and `index.css`
- [ ] Dark mode looks good — not a default MUI dark
- [ ] All existing functionality works (login, navigation, CRUD)
- [ ] Responsive layout unaffected

---

## Anti-Patterns to Avoid

- ❌ Don't change the `ThemeContext` export interface — `App.js` depends on `{ theme, isDarkMode, toggleTheme }`
- ❌ Don't use fonts already present in the project (there are none loaded — this is from scratch)
- ❌ Don't over-engineer — the goal is a cohesive palette + fonts, not a design system
- ❌ Don't touch component files beyond fixing hardcoded colors that break with new theme
- ❌ Don't remove `CssBaseline` or `<React.StrictMode>`
