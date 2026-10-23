import React from 'react';
import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';

const PageHeader = ({ eyebrow, title, subtitle, actions, breadcrumbs, backTo, sx }) => (
  <Box
    sx={[
      {
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'flex-end' },
        justifyContent: 'space-between',
        gap: { xs: 2, sm: 3 },
        mb: { xs: 3, md: 4 },
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    <Box sx={{ minWidth: 0 }}>
      {breadcrumbs?.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
              {crumb.to ? (
                <Typography
                  component={RouterLink}
                  to={crumb.to}
                  variant="caption"
                  sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
                >
                  {crumb.label}
                </Typography>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {crumb.label}
                </Typography>
              )}
            </React.Fragment>
          ))}
        </Box>
      )}
      {eyebrow && (
        <Typography variant="overline" sx={{ color: 'primary.main', display: 'block', mb: 0.5 }}>
          {eyebrow}
        </Typography>
      )}
      <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 720 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    {actions && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          width: { xs: '100%', sm: 'auto' },
          '& > *': { flex: { xs: '1 1 auto', sm: '0 0 auto' } },
        }}
      >
        {actions}
      </Box>
    )}
    {backTo && (
      <RouterLink to={backTo} style={{ textDecoration: 'none' }}>
        <Typography variant="caption" color="primary">
          Volver
        </Typography>
      </RouterLink>
    )}
  </Box>
);

export default PageHeader;
