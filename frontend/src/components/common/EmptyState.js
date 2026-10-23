import React from 'react';
import { Box, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

const EmptyState = ({ icon, title, description, action, sx }) => (
  <Box
    sx={[
      {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 6,
        px: 2,
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    <Box
      sx={{
        display: 'grid',
        placeItems: 'center',
        width: 64,
        height: 64,
        borderRadius: '50%',
        bgcolor: 'action.hover',
        color: 'text.secondary',
        mb: 2,
        '& svg': { fontSize: 30, opacity: 0.7 },
      }}
    >
      {icon || <InboxOutlinedIcon />}
    </Box>
    {title && (
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        {title}
      </Typography>
    )}
    {description && (
      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 380 }}>
        {description}
      </Typography>
    )}
    {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
  </Box>
);

export default EmptyState;
