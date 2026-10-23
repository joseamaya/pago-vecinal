import React from 'react';
import { InputAdornment, TextField } from '@mui/material';

const MoneyField = ({
  label = 'Monto',
  value,
  onChange,
  error = false,
  helperText,
  ...props
}) => (
  <TextField
    label={label}
    value={value}
    onChange={onChange}
    error={error}
    helperText={helperText}
    inputProps={{ inputMode: 'decimal', step: '0.01', min: 0 }}
    InputProps={{
      startAdornment: <InputAdornment position="start">S/</InputAdornment>,
    }}
    {...props}
  />
);

export default MoneyField;
