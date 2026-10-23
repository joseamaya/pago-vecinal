# PRP: Dashboard Data Visualizations

> **Version:** 1.0
> **Created:** 2025-05-18
> **Status:** Implemented
> **Implementation:** Verified 2026-10-23: admin Bar/Pie charts and the owner debt-evolution LineChart are implemented with `@mui/x-charts`, including loading and empty states.

---

## Goal
Add meaningful charts and data visualizations to the Dashboard using the existing `recharts` library. Replace the current static card numbers with interactive charts that show payment trends, fee status distribution, and property-level insights.

## Why
- `recharts` is already in `package.json` but completely unused
- The Dashboard currently shows flat numbers (total properties, payments, etc.) with zero visual context
- Charts would give admins quick insight into trends (e.g., "are payments improving month over month?")
- Property owners would benefit from visualizing their debt/expenses over time

## Success Criteria
- [x] Dashboard shows at least 2 charts for admin view, 1 for owner view
- [x] Admin chart 1: Monthly payment collection trend (bar/line chart — payments collected per month over last 12 months)
- [x] Admin chart 2: Fee status breakdown (pie/donut chart — paid vs pending vs overdue)
- [x] Owner chart 1: Personal debt evolution over time
- [x] Charts use the theme's color palette (light/dark compatible)
- [x] Charts are responsive and work on mobile
- [x] Loading state shown while chart data loads
- [x] Empty state shown when no data
- [x] `npm run build` succeeds, `npm test` passes

---

## All Needed Context

### Key Files
```yaml
- file: frontend/src/components/Dashboard.js
  why: Main file to modify — add chart sections below existing stats cards
- file: frontend/src/services/api.js
  why: API calls — check dashboardAPI endpoints available
- file: frontend/src/contexts/ThemeContext.js
  why: Charts must use theme palette colors
- file: frontend/package.json
  why: recharts is already a dependency — verify version
```

### Available API Endpoints (from api.js)
```javascript
dashboardAPI.getStats()
  // Returns: { properties, fees, payments, receipts, total_debt, pending_fees, agreements }

dashboardAPI.getOwnerDebtSummary()
  // Returns: per-property debt breakdown with fees history

reportsAPI.getPaymentsOverTime()
  // Returns: payment amounts grouped by period (for trend charts)

reportsAPI.getFeesByStatus()
  // Returns: counts by fee status (for pie/donut charts)
```

### Current Dashboard Structure
```jsx
// Dashboard.js currently has:
//   1. Header (title + welcome)
//   2. Stats grid (Card components with numbers)
//   3. Quick Actions (button grid)
//   4. Owner sections (debt summary, property report, expenses report)
//   5. Admin "Recent Activity" placeholder

// Charts should go between stats grid and quick actions (admin)
// Charts should integrate into owner sections (owner)
```

### recharts Usage Pattern (MUI-compatible)
```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '@mui/material/styles';

const MyChart = () => {
  const theme = useTheme();
  const data = [
    { month: 'Ene', collected: 4200, pending: 1800 },
    { month: 'Feb', collected: 4800, pending: 1200 },
    // ...
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>Recaudación Mensual</Typography>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis dataKey="month" stroke={theme.palette.text.secondary} />
          <YAxis stroke={theme.palette.text.secondary} />
          <Tooltip />
          <Bar dataKey="collected" fill={theme.palette.primary.main} name="Recaudado" />
          <Bar dataKey="pending" fill={theme.palette.warning.main} name="Pendiente" />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
};
```

### Gotchas
- `ResponsiveContainer` must have a parent with explicit width (or `width="100%"`) — otherwise charts render at 0 width
- recharts Tooltip will appear white-on-white in light mode by default — use `theme.palette` to style it
- All chart colors must use theme tokens (`theme.palette.primary.main`, etc.) not hardcoded hex
- Don't import the entire recharts library — just the specific components needed
- recharts v2.x is installed — check `package.json` for exact version

---

## Implementation Blueprint

### Tasks (in execution order)

```yaml
Task 1: Add chart data fetching to Dashboard.js
  - MODIFY: frontend/src/components/Dashboard.js
  - ADD: new useEffect calls to fetch chart data from reportsAPI
  - ADD: new state variables for chart data, loading, error
  - PRESERVE: existing stats and owner data fetching

Task 2: Add payment trends chart (admin)
  - MODIFY: frontend/src/components/Dashboard.js
  - CREATE: chart section showing monthly collection trend (BarChart or LineChart)
  - INSERT: between stats grid and Quick Actions (admin view only)

Task 3: Add fee status breakdown chart (admin)
  - MODIFY: frontend/src/components/Dashboard.js
  - CREATE: donut/pie chart showing fee status distribution
  - INSERT: alongside or below the trends chart

Task 4: Add owner debt chart (owner)
  - MODIFY: frontend/src/components/Dashboard.js
  - CREATE: simple bar or line chart showing owner's debt history
  - INSERT: within the owner sections area

Task 5: Add loading/error/empty states for charts
  - MODIFY: frontend/src/components/Dashboard.js
  - ADD: LoadingSkeleton for chart loading state
  - ADD: empty state message when chart has no data
  - ADD: error fallback (e.g., "No hay datos disponibles")
```

---

## Validation

```bash
cd frontend && npm run build   # Must succeed
cd frontend && npm test        # Must pass
```

Manual checks:
- Log in as admin → Dashboard shows 2 charts (monthly trend + fee status pie)
- Log in as owner → Dashboard shows personal debt chart (if data exists)
- Toggle dark mode → chart colors update correctly via theme tokens
- Resize browser → charts are responsive, no overflow
- Empty database → charts show empty state, not errors

---

## Final Checklist

- [x] `npm run build` succeeds
- [x] `npm test` passes
- [x] Admin sees payment trend chart (last 12 months) with responsive sizing
- [x] Admin sees fee status breakdown (pie/donut)
- [x] Owner sees personal debt-evolution and expense charts
- [x] All chart colors use theme palette (work in light + dark)
- [x] Loading state shown while fetching chart data
- [x] Empty state shown when no chart data exists
- [x] Charts use the existing `@mui/x-charts` dependency
- [x] Existing dashboard cards and quick actions remain intact

---

## Anti-Patterns to Avoid

- ❌ Don't hardcode chart colors — always use `theme.palette`
- ❌ Don't import `recharts` globally — import only components needed
- ❌ Don't remove or restructure existing Dashboard content — add charts alongside it
- ❌ Don't add charts outside the Dashboard — that's for future PRPs
- ❌ Don't add TypeScript or new libraries
