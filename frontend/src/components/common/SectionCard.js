import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

const SectionCard = ({ title, subtitle, action, icon, children, contentSx, sx, ...props }) => (
  <Paper
    component="section"
    sx={[{ overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : [sx])]}
    {...props}
  >
    {(title || action) && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2.5, sm: 3 },
          py: 2.25,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
          {icon && (
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 38,
                height: 38,
                borderRadius: 2.5,
                bgcolor: 'action.hover',
                color: 'primary.main',
                flexShrink: 0,
                '& svg': { fontSize: 20 },
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            {title && (
              <Typography variant="h6" component="h2">
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {action}
      </Box>
    )}
    <Box sx={[{ px: { xs: 2.5, sm: 3 }, py: 2.5 }, ...(Array.isArray(contentSx) ? contentSx : [contentSx])]}>
      {children}
    </Box>
  </Paper>
);

export default SectionCard;
