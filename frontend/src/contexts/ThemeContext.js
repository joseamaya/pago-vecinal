import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme } from '@mui/material/styles';

const ThemeContext = createContext();

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

const sharedTypography = {
  fontFamily: '"Outfit", sans-serif',
  h1: { fontFamily: '"Fraunces", serif', fontWeight: 600 },
  h2: { fontFamily: '"Fraunces", serif', fontWeight: 600 },
  h3: { fontFamily: '"Fraunces", serif', fontWeight: 600 },
  h4: { fontFamily: '"Fraunces", serif', fontWeight: 600 },
  h5: { fontFamily: '"Fraunces", serif', fontWeight: 500 },
  h6: { fontFamily: '"Fraunces", serif', fontWeight: 500 },
  button: { textTransform: 'none', fontWeight: 500 },
};

const sharedComponents = {
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      '*, *::before, *::after': {
        '@media (prefers-reduced-motion: reduce)': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
          scrollBehavior: 'auto !important',
        },
      },
      ':focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
      },
    }),
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: { borderRadius: 8, padding: '8px 20px' },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { borderRadius: 12 },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: { borderRadius: 16 },
    },
  },
};

// Light theme — "Cálido Mediterráneo"
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#C8684A',
      light: '#E8997F',
      dark: '#A34A30',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#E8D5B7',
      dark: '#D4BFA0',
      contrastText: '#3A2F2A',
    },
    error: {
      main: '#C44545',
    },
    warning: {
      main: '#D4A843',
    },
    info: {
      main: '#5A8F9E',
    },
    success: {
      main: '#7A8B5F',
    },
    background: {
      default: '#F9F6F0',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2C2420',
      secondary: '#6B5E56',
    },
    divider: '#E8E0D8',
  },
  typography: sharedTypography,
  shape: { borderRadius: 12 },
  components: sharedComponents,
});

// Dark theme — warm charcoal
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#D98A70',
      light: '#E8A890',
      dark: '#C8684A',
      contrastText: '#1A1410',
    },
    secondary: {
      main: '#C4B5A0',
      dark: '#A89880',
      contrastText: '#1A1410',
    },
    error: {
      main: '#E06060',
    },
    warning: {
      main: '#D4A843',
    },
    info: {
      main: '#6DADBE',
    },
    success: {
      main: '#8FA67A',
    },
    background: {
      default: '#1A1410',
      paper: '#2C2420',
    },
    text: {
      primary: '#EDE6DE',
      secondary: '#A89E94',
    },
    divider: '#3D342E',
  },
  typography: sharedTypography,
  shape: { borderRadius: 12 },
  components: sharedComponents,
});

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  const value = {
    theme,
    isDarkMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};