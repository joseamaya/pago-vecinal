import React from 'react';
import { Box, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

const EmptyState = ({ icon, title, description, action, sx }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      py: 6,
      px: 2,
      ...sx,
    }}
  >
    <Box sx={{ color: 'text.secondary', mb: 1.5, display: 'flex' }}>
      {icon || <InboxOutlinedIcon sx={{ fontSize: 48, opacity: 0.5 }} />}
    </Box>
    {title && (
      <Typography variant="subtitle1" color="textPrimary" gutterBottom>
        {title}
      </Typography>
    )}
    {description && (
      <Typography variant="body2" color="textSecondary">
        {description}
      </Typography>
    )}
    {action && <Box sx={{ mt: 2 }}>{action}</Box>}
  </Box>
);

export default EmptyState;
