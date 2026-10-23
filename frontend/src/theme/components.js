import { alpha } from '@mui/material/styles';

export const components = {
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      '*, *::before, *::after': {
        '@media (prefers-reduced-motion: reduce)': {
          animationDuration: '0.01ms !important',
          animationDelay: '0ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
          scrollBehavior: 'auto !important',
        },
      },
      body: {
        backgroundColor: theme.palette.background.default,
        backgroundImage:
          theme.palette.mode === 'light'
            ? 'radial-gradient(1100px 520px at 12% -8%, rgba(201, 120, 91, 0.14), transparent 60%), radial-gradient(900px 480px at 100% 0%, rgba(110, 90, 67, 0.08), transparent 55%)'
            : 'radial-gradient(1100px 520px at 12% -8%, rgba(217, 138, 112, 0.12), transparent 60%), radial-gradient(900px 480px at 100% 0%, rgba(196, 181, 160, 0.06), transparent 55%)',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
      },
      '::selection': {
        backgroundColor: alpha(theme.palette.primary.main, 0.24),
      },
      '*::-webkit-scrollbar': { width: 10, height: 10 },
      '*::-webkit-scrollbar-track': { background: 'transparent' },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: alpha(theme.palette.text.secondary, 0.24),
        borderRadius: 999,
        border: '2px solid transparent',
        backgroundClip: 'content-box',
      },
      '*::-webkit-scrollbar-thumb:hover': {
        backgroundColor: alpha(theme.palette.text.secondary, 0.4),
      },
      ':focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
      },
      '@keyframes fade-up': {
        from: { opacity: 0, transform: 'translateY(10px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
      '@keyframes soft-pulse': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.55 },
      },
    }),
  },
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 16,
        backgroundImage: 'none',
        border: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiCard: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 16,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow:
          theme.palette.mode === 'light'
            ? '0 1px 2px rgba(36, 29, 25, 0.04), 0 12px 32px -18px rgba(36, 29, 25, 0.28)'
            : '0 1px 2px rgba(0, 0, 0, 0.4), 0 16px 36px -20px rgba(0, 0, 0, 0.7)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        backgroundImage: 'none',
      }),
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: 10,
        padding: '9px 18px',
        minHeight: 40,
        fontWeight: 600,
      },
      containedPrimary: ({ theme }) => ({
        boxShadow: `0 8px 20px -12px ${alpha(theme.palette.primary.main, 0.9)}`,
        '&:hover': { boxShadow: `0 10px 24px -12px ${alpha(theme.palette.primary.main, 0.9)}` },
      }),
      sizeSmall: { minHeight: 34, padding: '6px 12px', borderRadius: 9 },
      sizeLarge: { minHeight: 46, padding: '12px 24px' },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: { borderRadius: 10 },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 8, fontWeight: 600, fontSize: '0.75rem' },
      sizeSmall: { height: 24 },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({ borderColor: theme.palette.divider }),
      head: ({ theme }) => ({
        backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.035 : 0.06),
        color: theme.palette.text.secondary,
        fontFamily: '"Outfit", sans-serif',
        fontWeight: 700,
        fontSize: '0.6875rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }),
      body: { fontSize: '0.875rem' },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        transition: 'background-color 150ms ease',
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
        '&:last-of-type td': { borderBottom: 0 },
      }),
    },
  },
  MuiTableContainer: {
    styleOverrides: {
      root: { borderRadius: 0 },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10,
        backgroundColor: theme.palette.mode === 'light' ? '#FFFFFF' : alpha('#FFFFFF', 0.02),
        transition: 'box-shadow 150ms ease',
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: alpha(theme.palette.primary.main, 0.5),
        },
        '&.Mui-focused': {
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}`,
        },
      }),
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: { fontWeight: 500 },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: { borderRadius: 20, backgroundImage: 'none' },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontFamily: '"Fraunces", serif',
        fontWeight: 600,
        fontSize: '1.35rem',
        paddingBottom: theme.spacing(1),
      }),
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(2, 3, 2.5),
        gap: theme.spacing(1),
      }),
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: { backgroundImage: 'none', boxShadow: 'none' },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundImage:
          theme.palette.mode === 'light'
            ? 'linear-gradient(180deg, #FFFCF7 0%, #FBF5EC 100%)'
            : 'linear-gradient(180deg, #241C17 0%, #1B1511 100%)',
        borderRight: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 12, alignItems: 'center' },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: { borderRadius: 8, fontSize: '0.75rem', padding: '6px 10px' },
    },
  },
  MuiPaginationItem: {
    styleOverrides: {
      root: { borderRadius: 9, fontWeight: 600 },
    },
  },
  MuiAvatar: {
    styleOverrides: {
      root: { fontWeight: 700 },
    },
  },
  MuiSkeleton: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.06 : 0.1),
        borderRadius: 8,
      }),
    },
  },
  MuiTabs: {
    styleOverrides: {
      indicator: { height: 3, borderRadius: 3 },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: { textTransform: 'none', fontWeight: 600, fontSize: '0.9rem' },
    },
  },
};
