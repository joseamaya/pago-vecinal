import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  IconButton,
  useMediaQuery,
  useTheme,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  Payment as PaymentIcon,
  Receipt as ReceiptIcon,
  MonetizationOn as FeeIcon,
  Schedule as ScheduleIcon,
  Assessment as ReportsIcon,
  Assignment as AgreementIcon,
  AccountBalance as InstallmentIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';

const drawerWidth = 280;

const Sidebar = ({ mobileOpen, handleDrawerToggle, handleDrawerClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { isDarkMode, toggleTheme } = useThemeContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      roles: ['admin', 'owner'],
    },
    {
      text: 'Usuarios',
      icon: <PeopleIcon />,
      path: '/users',
      roles: ['admin'],
    },
    {
      text: 'Propiedades',
      icon: <HomeIcon />,
      path: '/properties',
      roles: ['admin'],
    },
    {
      text: 'Cuotas',
      icon: <FeeIcon />,
      path: '/fees',
      roles: ['admin', 'owner'],
    },
    {
      text: 'Convenios',
      icon: <AgreementIcon />,
      path: '/agreements',
      roles: ['admin', 'owner'],
    },
    {
      text: 'Planes de Cuotas',
      icon: <ScheduleIcon />,
      path: '/fee-schedules',
      roles: ['admin'],
    },
    {
      text: 'Pagos',
      icon: <PaymentIcon />,
      path: '/payments',
      roles: ['admin', 'owner'],
    },
    {
      text: 'Pagos Convenios',
      icon: <InstallmentIcon />,
      path: '/agreement-payments',
      roles: ['admin', 'owner'],
    },
    {
      text: 'Recibos',
      icon: <ReceiptIcon />,
      path: '/receipts',
      roles: ['admin', 'owner'],
    },
    {
      text: 'Reportes',
      icon: <ReportsIcon />,
      path: '/reports',
      roles: ['admin', 'owner'],
    },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      handleDrawerToggle();
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" noWrap component="div">
          Pago Vecinal
        </Typography>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      {/* User Info */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" color="textSecondary">
          {user?.full_name}
        </Typography>
        <Typography variant="body2" color="primary">
          {isAdmin ? 'Administrador' : 'Propietario'}
        </Typography>
      </Box>

      {/* Theme Toggle */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <FormControlLabel
          control={
            <Switch
              checked={isDarkMode}
              onChange={toggleTheme}
              icon={<LightIcon />}
              checkedIcon={<DarkIcon />}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isDarkMode ? <DarkIcon /> : <LightIcon />}
              <Typography variant="body2">
                {isDarkMode ? 'Modo Oscuro' : 'Modo Claro'}
              </Typography>
            </Box>
          }
          sx={{ width: '100%', m: 0 }}
        />
      </Box>

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {menuItems
          .filter(item => item.roles.includes(user?.role))
          .map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 1,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path ? 'inherit' : 'action.active',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
      </List>

      <Divider />

      {/* Logout */}
      <List>
        <ListItem disablePadding>
          <ListItemButton
            onClick={logout}
            sx={{
              mx: 1,
              mb: 1,
              borderRadius: 1,
              '&:hover': {
                backgroundColor: 'error.main',
                color: 'error.contrastText',
                '& .MuiListItemIcon-root': {
                  color: 'error.contrastText',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Cerrar Sesión" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box component="nav">
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            position: 'fixed',
            height: '100vh',
            top: 0,
            left: 0,
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;