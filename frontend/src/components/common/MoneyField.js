import React from 'react';
import { InputAdornment, TextField } from '@mui/material';

const MoneyField = ({
  label = 'Monto',
  value,
  onChange,
  error = false,
  helperText,
  InputProps,
  inputProps,
  ...props
}) => (
  <TextField
    {...props}
    label={label}
    value={value}
    onChange={onChange}
    error={error}
    helperText={helperText}
    type="number"
    inputProps={{ inputMode: 'decimal', step: '0.01', min: 0, ...inputProps }}
    InputProps={{
      startAdornment: <InputAdornment position="start">S/</InputAdornment>,
      ...InputProps,
    }}
  />
);

export default MoneyField;
