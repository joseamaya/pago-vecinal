import React, { useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
  alpha,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Menu as MenuIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Sidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './Sidebar';
import TopBar from './TopBar';
import MobileNav from './MobileNav';
import CommandPalette from './CommandPalette';
import UserMenu from './UserMenu';
import { useThemeContext } from '../contexts/ThemeContext';

const Layout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useThemeContext();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'transparent' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 10000,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          p: 1,
          borderRadius: 1,
          '&:focus': { left: 8, top: 8 },
        }}
      >
        Saltar al contenido principal
      </Box>

      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
      />

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          ml: { md: `${sidebarWidth}px` },
          transition: 'margin-left 200ms ease',
        }}
      >
        <TopBar onOpenSearch={() => setPaletteOpen(true)} />

        {/* Mobile header */}
        <Box
          sx={(theme) => ({
            display: { xs: 'flex', md: 'none' },
            position: 'sticky',
            top: 0,
            zIndex: theme.zIndex.appBar,
            alignItems: 'center',
            gap: 1,
            height: 60,
            px: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.background.default, 0.88),
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          })}
        >
          <IconButton onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }} noWrap>
            Pago Vecinal
          </Typography>
          <IconButton onClick={() => setPaletteOpen(true)} aria-label="Buscar">
            <SearchIcon />
          </IconButton>
          <IconButton onClick={toggleTheme} aria-label="Cambiar tema">
            {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <UserMenu compact />
        </Box>

        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            minHeight: { xs: 'calc(100vh - 60px)', md: 'calc(100vh - 68px)' },
            pb: { xs: 10, md: 3 },
            outline: 'none',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>

      <MobileNav onOpenMore={() => setMobileOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </Box>
  );
};

export default Layout;
