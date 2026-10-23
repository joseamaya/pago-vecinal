import React from 'react';
import { Typography } from '@mui/material';
import { formatCurrency } from '../../utils/formatters';

const MoneyText = ({ value, variant = 'body1', color, sx, ...props }) => (
  <Typography
    variant={variant}
    color={color}
    className="tabular-nums"
    sx={[{ whiteSpace: 'nowrap', fontWeight: 600 }, ...(Array.isArray(sx) ? sx : [sx])]}
    {...props}
  >
    {formatCurrency(value)}
  </Typography>
);

export default MoneyText;
