import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildTheme } from '../theme';

const ThemeContext = createContext();

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

const getInitialMode = () => {
  if (typeof window === 'undefined') return 'light';
  const savedTheme = window.localStorage.getItem('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
    window.localStorage.setItem('theme', mode);
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      isDarkMode: mode === 'dark',
      setMode,
      toggleTheme,
    }),
    [theme, mode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
