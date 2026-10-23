import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  SettingsOutlined as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInitials } from '../utils/formatters';

const UserMenu = ({ compact = false }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const displayName = user?.full_name || user?.email || 'Usuario';
  const roleLabel = isAdmin ? 'Administrador' : 'Propietario';

  return (
    <>
      <Tooltip title={compact ? displayName : ''}>
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          size="small"
          aria-label="Abrir menú de usuario"
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{ p: compact ? 0.5 : 1 }}
        >
          <Avatar
            sx={{
              width: compact ? 34 : 36,
              height: compact ? 34 : 36,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontSize: '0.8rem',
            }}
          >
            {getInitials(displayName)}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 250, borderRadius: 3, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 42, height: 42 }}>
            {getInitials(displayName)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {displayName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
              {user?.email}
            </Typography>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
              {roleLabel}
            </Typography>
          </Box>
        </Box>
        <Divider />
        {isAdmin && (
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              navigate('/configuration');
            }}
          >
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Configuración" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            logout();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Cerrar sesión" primaryTypographyProps={{ variant: 'body2' }} />
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserMenu;
