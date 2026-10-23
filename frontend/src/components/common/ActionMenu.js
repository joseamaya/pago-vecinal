import React, { useState } from 'react';
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { MoreVert as MoreVertIcon } from '@mui/icons-material';

const ActionMenu = ({ items = [], ariaLabel = 'Más acciones', size = 'small', icon, buttonSx }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (event) => {
    event?.stopPropagation?.();
    setAnchorEl(null);
  };

  const visibleItems = items.filter(Boolean);

  if (visibleItems.length === 0) return null;

  return (
    <>
      <IconButton
        size={size}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleOpen}
        sx={buttonSx}
      >
        {icon || <MoreVertIcon fontSize="small" />}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 190, borderRadius: 3, mt: 0.5 } } }}
      >
        {visibleItems.map((item, index) =>
          item.divider ? (
            <Divider key={`divider-${index}`} sx={{ my: 0.5 }} />
          ) : (
            <MenuItem
              key={item.label}
              onClick={(event) => {
                handleClose(event);
                item.onClick?.();
              }}
              disabled={item.disabled}
              sx={{ color: item.color ? `${item.color}.main` : 'text.primary', gap: 1 }}
            >
              {item.icon && (
                <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>{item.icon}</ListItemIcon>
              )}
              <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
            </MenuItem>
          )
        )}
      </Menu>
    </>
  );
};

export default ActionMenu;
