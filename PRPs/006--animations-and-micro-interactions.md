# PRP: Animations & Micro-interactions

> **Version:** 1.0
> **Created:** 2025-05-18
> **Status:** Ready

---

## Goal
Add subtle, purposeful animations and micro-interactions throughout the UI to create a more polished, responsive-feeling application. Focus on high-impact moments: staggered page content reveals, hover state enhancements on cards and buttons, smooth sidebar transitions, and subtle feedback on user actions.

## Why
- The current UI is static — cards appear instantly, no page transition feel, no hover feedback beyond MUI defaults
- Animations communicate responsiveness and quality; the app feels "alive" vs "flat"
- Strategic micro-interactions guide attention (e.g., a slight card lift on hover signals clickability)

## Success Criteria
- [ ] Dashboard stat cards have hover elevation effect (subtle lift)
- [ ] Dashboard content sections fade/stagger in on page load
- [ ] Buttons have refined hover/press states (beyond MUI defaults)
- [ ] Sidebar navigation items have smooth active indicator transition
- [ ] Dialog open/close transitions feel smooth (MUI default is acceptable but verify)
- [ ] Table rows have subtle hover highlight
- [ ] Page transitions (route changes) have a brief fade-in
- [ ] All animations respect `prefers-reduced-motion`
- [ ] `npm run build` succeeds, `npm test` passes

---

## All Needed Context

### Key Files
```yaml
- file: frontend/src/components/Dashboard.js
  why: Stat cards + quick actions — main animation targets
- file: frontend/src/components/Sidebar.js
  why: Navigation items with active state
- file: frontend/src/components/Layout.js
  why: Page content wrapper — fade-in on route change
- file: frontend/src/components/common/LoadingSpinner.js
  why: Already has basic spinner — verify consistency
- file: frontend/src/contexts/ThemeContext.js
  why: transition tokens could be added to theme
- file: frontend/src/App.js
  why: Router wrapper — page transition insertion point
```

### MUI Animation Tools Available
```javascript
// MUI provides these animation primitives (no extra libraries needed):
import { Fade, Grow, Slide, Zoom, Collapse } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Fade — opacity transition, good for page content
<Fade in={true} timeout={600}>
  <div>Content</div>
</Fade>

// Grow — scale + fade, good for cards
<Grow in={true} timeout={400} style={{ transformOrigin: '0 0 0' }}>
  <Card>...</Card>
</Grow>

// Slide — slides in from a direction, good for panels
<Slide direction="up" in={true}>
  <div>...</div>
</Slide>
```

### CSS Transition Approach (Preferred for Simple Cases)
```javascript
// For hover effects and subtle transitions, use sx prop transitions:
<Card sx={{
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}}>
```

### Staggered Entry Pattern (for Dashboard)
```javascript
// Use MUI Fade + style animation-delay for staggered reveals
{cards.map((card, index) => (
  <Grid item xs={12} sm={6} md={3} key={index}>
    <Fade in={true} timeout={500} style={{ transitionDelay: `${index * 100}ms` }}>
      <div>
        <StatCard ... />
      </div>
    </Fade>
  </Grid>
))}
```

### Page Transition Pattern
```javascript
// In Layout.js, wrap children with Fade that triggers on route change:
import { useLocation } from 'react-router-dom';
import { Fade } from '@mui/material';

const Layout = ({ children }) => {
  const location = useLocation();
  // Fade re-triggers when key changes (route change)
  return (
    <Fade in={true} key={location.pathname} timeout={300}>
      <Box component="main"> {children} </Box>
    </Fade>
  );
};
```

### `prefers-reduced-motion` Pattern
```css
/* In index.css or App.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Gotchas
- MUI `Fade` wrapper adds a `<div>` — ensure it doesn't break Grid layouts (use `<Grid item>` inside or apply `as` prop)
- `transitionDelay` in inline `style` prop overrides MUI's internal delay — use carefully
- `useLocation()` in Layout.js will cause re-renders on every route change — that's intentional for page transitions but verify no unwanted side effects
- Dashboard stat cards are clickable (navigate on click) — the hover elevation effect should reinforce clickability
- Sidebar already has `selected` styles with `primary.main` background — the animation should work with the existing `Mui-selected` class
- Animations must not interfere with data loading states — ensure content is fully rendered before animating in

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Add prefers-reduced-motion CSS
  - MODIFY: frontend/src/index.css (or App.css)
  - ADD: @media (prefers-reduced-motion: reduce) rule to disable all animations
  - WHY: Accessibility requirement

Task 2: Add page transition to Layout.js
  - MODIFY: frontend/src/components/Layout.js
  - WRAP: main content Box with Fade component, keyed by location.pathname
  - TIMEOUT: 300ms fade

Task 3: Add hover effects to Dashboard stat cards
  - MODIFY: frontend/src/components/Dashboard.js
  - ADD: transition + hover transform/boxShadow to StatCard
  - ADD: pointer cursor (already exists for clickable cards)

Task 4: Add staggered entry to Dashboard stats grid
  - MODIFY: frontend/src/components/Dashboard.js
  - WRAP: each Grid item in Fade with calculated transitionDelay (100ms stagger)
  - VERIFY: Grid layout is not broken by Fade wrapper divs

Task 5: Add hover effects to Dashboard quick action buttons
  - MODIFY: frontend/src/components/Dashboard.js
  - ADD: subtle scale on hover for quick action buttons
  - KEEP: existing button styles

Task 6: Add sidebar active item animation
  - MODIFY: frontend/src/components/Sidebar.js
  - ADD: transition on background-color + border-left indicator animation
  - VERIFY: existing selected state styles remain intact

Task 7: Add table row hover highlight management pages
  - MODIFY: frontend/src/components/PaymentManagement.js (or payments/PaymentTable.js after PRP 005)
  - NOTE: MUI TableRow already has hover state — verify it's enabled
  - ADD: subtle background color transition if not already present
```

---

## Validation

```bash
cd frontend && npm run build   # Must succeed
cd frontend && npm test        # Must pass
```

Manual checks:
- Navigate between pages → content fades in smoothly
- Dashboard cards hover → subtle lift + shadow increase
- Dashboard cards stagger in on page load (each card appears with slight delay)
- Sidebar item click → active indicator transitions smoothly
- Quick action buttons hover → subtle feedback
- Table rows hover → highlight
- Enable `prefers-reduced-motion` in OS/browser → all animations disabled
- Toggle dark mode → animations still work correctly
- All existing functionality works

---

## Final Checklist

- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] `prefers-reduced-motion` CSS rule added
- [ ] Page transitions fade in content on route change
- [ ] Dashboard stat cards lift on hover (translateY + shadow)
- [ ] Dashboard cards stagger in on load (100ms delay between each)
- [ ] Quick action buttons have hover feedback
- [ ] Sidebar active item has smooth transition
- [ ] Table rows highlight on hover
- [ ] All animations are subtle and purposeful (not distracting)
- [ ] Animations work in both light and dark mode

---

## Anti-Patterns to Avoid

- ❌ Don't use external animation libraries (framer-motion, GSAP, etc.) — MUI primitives suffice
- ❌ Don't animate things that should be instant (form submissions, button clicks)
- ❌ Don't use excessive duration (>500ms for most things, >800ms only for page entry)
- ❌ Don't animate elements that aren't visible (waste of performance)
- ❌ Don't break grid layouts with Fade/Grow wrapper divs — test responsive layout
- ❌ Don't forget `prefers-reduced-motion` — this is an accessibility requirement
- ❌ Don't animate loading states or error states — only stable content
