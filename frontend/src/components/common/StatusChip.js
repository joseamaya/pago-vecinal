import React from 'react';
import { Chip, alpha } from '@mui/material';
import { getStatusLabel, getStatusTone } from '../../utils/statusMappings';

const StatusChip = ({ status, label, tone, size = 'small', sx, ...props }) => {
  const resolvedTone = tone || getStatusTone(status);

  return (
    <Chip
      label={label ?? getStatusLabel(status)}
      size={size}
      sx={[
        (theme) => {
          if (resolvedTone === 'default') {
            return {
              bgcolor: alpha(theme.palette.text.secondary, 0.12),
              color: theme.palette.text.secondary,
            };
          }
          const palette = theme.palette[resolvedTone] || theme.palette.primary;
          return {
            bgcolor: alpha(palette.main, theme.palette.mode === 'light' ? 0.13 : 0.2),
            color: palette.main,
            border: `1px solid ${alpha(palette.main, 0.18)}`,
          };
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  );
};

export default StatusChip;
