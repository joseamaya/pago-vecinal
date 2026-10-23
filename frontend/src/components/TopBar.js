import React from 'react';
import { Box, Button, IconButton, Tooltip, Typography, alpha } from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useThemeContext } from '../contexts/ThemeContext';
import { navigationGroups } from '../layout/navigation';
import UserMenu from './UserMenu';

const findLocation = (pathname) => {
  for (const group of navigationGroups) {
    const item = group.items.find((entry) => entry.path === pathname);
    if (item) return { group, item };
  }
  return null;
};

const TopBar = ({ onOpenSearch }) => {
  const { isDarkMode, toggleTheme } = useThemeContext();
  const location = useLocation();
  const current = findLocation(location.pathname);

  return (
    <Box
      component="header"
      sx={(theme) => ({
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.appBar,
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        gap: 2,
        height: 68,
        px: 3,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.default, 0.78),
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {current?.group.label || 'Pago Vecinal'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          /
        </Typography>
        <Typography variant="subtitle2" noWrap>
          {current?.item.text || 'Inicio'}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Button
        onClick={onOpenSearch}
        startIcon={<SearchIcon fontSize="small" />}
        sx={(theme) => ({
          color: 'text.secondary',
          bgcolor: theme.palette.mode === 'light' ? '#FFFFFF' : alpha('#FFFFFF', 0.04),
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2.5,
          px: 1.75,
          py: 0.75,
          minWidth: 240,
          justifyContent: 'flex-start',
          fontWeight: 400,
          '&:hover': { bgcolor: 'action.hover' },
        })}
      >
        Buscar secciones…
        <Box
          component="span"
          sx={{
            ml: 'auto',
            px: 0.75,
            py: 0.125,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            fontSize: '0.68rem',
            color: 'text.disabled',
          }}
        >
          Ctrl K
        </Box>
      </Button>

      <Tooltip title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
        <IconButton onClick={toggleTheme} aria-label="Cambiar tema" size="small">
          {isDarkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <UserMenu compact />
    </Box>
  );
};

export default TopBar;
