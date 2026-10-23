import React from 'react';
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  Logout as LogoutIcon,
  MenuOpen as MenuOpenIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInitials } from '../utils/formatters';
import { getNavigationForRole } from '../layout/navigation';

export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_COLLAPSED_WIDTH = 88;

const BrandMark = () => (
  <Box
    sx={(theme) => ({
      display: 'grid',
      placeItems: 'center',
      width: 40,
      height: 40,
      borderRadius: 2.5,
      flexShrink: 0,
      background: `linear-gradient(145deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
      color: '#FFF',
      fontFamily: '"Fraunces", serif',
      fontWeight: 600,
      fontSize: '1.05rem',
      boxShadow: `0 6px 16px -8px ${alpha(theme.palette.primary.dark, 0.9)}`,
    })}
  >
    PV
  </Box>
);

const SidebarContent = ({ collapsed = false, onNavigate, showClose, onClose, onToggleCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const groups = getNavigationForRole(user?.role);

  const go = (path) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: collapsed ? 2 : 2.5,
          py: 2.5,
          minHeight: 80,
        }}
      >
        <BrandMark />
        {!collapsed && (
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
              Pago Vecinal
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              Gestión condominal
            </Typography>
          </Box>
        )}
        {showClose && (
          <IconButton onClick={onClose} aria-label="Cerrar menú" size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Divider />

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 2,
          px: collapsed ? 1.25 : 1.5,
        }}
      >
        {groups.map((group, groupIndex) => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            {!collapsed ? (
              <Typography
                variant="overline"
                sx={{ px: 1.25, color: 'text.disabled', display: 'block', mb: 0.5, fontSize: '0.62rem' }}
              >
                {group.label}
              </Typography>
            ) : (
              groupIndex > 0 && <Divider sx={{ mx: 1, my: 1.25 }} />
            )}
            <List disablePadding>
              {group.items.map((item) => {
                const Icon = item.icon;
                const selected = location.pathname === item.path;
                const button = (
                  <ListItemButton
                    key={item.path}
                    selected={selected}
                    onClick={() => go(item.path)}
                    sx={(theme) => ({
                      position: 'relative',
                      borderRadius: 2.5,
                      px: collapsed ? 1.5 : 1.5,
                      py: 1.05,
                      mb: 0.25,
                      minHeight: 44,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
                      '&.Mui-selected': {
                        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.11 : 0.18),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
                      },
                      '&.Mui-selected::before': {
                        content: '""',
                        position: 'absolute',
                        left: -1.5,
                        top: 10,
                        bottom: 10,
                        width: 3,
                        borderRadius: 4,
                        bgcolor: theme.palette.primary.main,
                      },
                    })}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 38,
                        color: 'inherit',
                        justifyContent: 'center',
                        '& svg': { fontSize: 21 },
                      }}
                    >
                      <Icon />
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: selected ? 600 : 500,
                          noWrap: true,
                        }}
                      />
                    )}
                  </ListItemButton>
                );

                return collapsed ? (
                  <Tooltip key={item.path} title={item.text} placement="right" arrow>
                    {button}
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Divider />

      <Box sx={{ p: collapsed ? 1.5 : 2 }}>
        <Box
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: collapsed ? 0 : 1.25,
            borderRadius: 3,
            bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.text.primary, 0.03) : alpha('#FFFFFF', 0.04),
            justifyContent: collapsed ? 'center' : 'flex-start',
          })}
        >
          <Tooltip title={collapsed ? user?.full_name || '' : ''} placement="right">
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: '0.8rem' }}>
              {getInitials(user?.full_name || user?.email || '')}
            </Avatar>
          </Tooltip>
          {!collapsed && (
            <>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }} noWrap>
                  {user?.full_name || 'Usuario'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }} noWrap>
                  {isAdmin ? 'Administrador' : 'Propietario'}
                </Typography>
              </Box>
              <Tooltip title="Cerrar sesión">
                <IconButton size="small" onClick={logout} aria-label="Cerrar sesión" sx={{ color: 'text.secondary' }}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
        {collapsed && (
          <Tooltip title="Cerrar sesión" placement="right">
            <IconButton size="small" onClick={logout} aria-label="Cerrar sesión" sx={{ mt: 1, color: 'text.secondary' }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', mt: 1 }}>
          <Tooltip title={collapsed ? 'Expandir menú' : 'Colapsar menú'} placement="right">
            <IconButton size="small" onClick={onToggleCollapsed} aria-label="Alternar menú lateral" sx={{ color: 'text.secondary' }}>
              <MenuOpenIcon
                fontSize="small"
                sx={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}
              />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};

const Sidebar = ({ mobileOpen, onClose, collapsed, onToggleCollapsed }) => (
  <Box component="nav" aria-label="Navegación principal">
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: SIDEBAR_WIDTH },
      }}
    >
      <SidebarContent
        onNavigate={onClose}
        showClose
        onClose={onClose}
      />
    </Drawer>

    <Drawer
      variant="permanent"
      open
      sx={{
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          position: 'fixed',
          height: '100vh',
          top: 0,
          left: 0,
          overflowX: 'hidden',
          transition: 'width 200ms ease',
        },
      }}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
    </Drawer>
  </Box>
);

export default Sidebar;
