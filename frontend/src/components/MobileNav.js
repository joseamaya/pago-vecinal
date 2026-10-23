import React from 'react';
import { Box, ButtonBase, Typography, alpha } from '@mui/material';
import { MoreHoriz as MoreIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFlatNavigation } from '../layout/navigation';

const MOBILE_ORDER = {
  admin: ['/dashboard', '/fees', '/payments', '/properties'],
  owner: ['/dashboard', '/fees', '/payments', '/receipts'],
};

const MobileNav = ({ onOpenMore }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const paths = MOBILE_ORDER[isAdmin ? 'admin' : 'owner'];
  const items = getFlatNavigation(user?.role).filter((item) => paths.includes(item.path));
  const ordered = paths.map((path) => items.find((item) => item.path === path)).filter(Boolean);

  return (
    <Box
      component="nav"
      aria-label="Navegación rápida"
      sx={(theme) => ({
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.94),
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        pb: 'env(safe-area-inset-bottom)',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch', height: 62 }}>
        {ordered.map((item) => {
          const Icon = item.icon;
          const selected = location.pathname === item.path;
          return (
            <ButtonBase
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={selected ? 'page' : undefined}
              sx={{
                flex: 1,
                flexDirection: 'column',
                gap: 0.25,
                py: 0.75,
                color: selected ? 'primary.main' : 'text.secondary',
                position: 'relative',
                '&::before': selected
                  ? {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '30%',
                      right: '30%',
                      height: 2,
                      borderRadius: 2,
                      bgcolor: 'primary.main',
                    }
                  : undefined,
              }}
            >
              <Icon sx={{ fontSize: 22 }} />
              <Typography component="span" sx={{ fontSize: '0.64rem', fontWeight: selected ? 600 : 500 }}>
                {item.text}
              </Typography>
            </ButtonBase>
          );
        })}
        <ButtonBase
          onClick={onOpenMore}
          aria-label="Más secciones"
          sx={{
            flex: 1,
            flexDirection: 'column',
            gap: 0.25,
            py: 0.75,
            color: 'text.secondary',
          }}
        >
          <MoreIcon sx={{ fontSize: 22 }} />
          <Typography component="span" sx={{ fontSize: '0.64rem', fontWeight: 500 }}>
            Más
          </Typography>
        </ButtonBase>
      </Box>
    </Box>
  );
};

export default MobileNav;
