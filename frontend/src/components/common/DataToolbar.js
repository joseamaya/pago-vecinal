import React, { useEffect, useState } from 'react';
import { Box, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

const DataToolbar = ({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  resultCount,
  totalCount,
  children,
  actions,
  debounceMs = 300,
  sx,
}) => {
  const [value, setValue] = useState(search);

  useEffect(() => {
    setValue(search);
  }, [search]);

  useEffect(() => {
    if (value === search) return undefined;
    const timer = setTimeout(() => onSearchChange?.(value), debounceMs);
    return () => clearTimeout(timer);
  }, [value, search, onSearchChange, debounceMs]);

  return (
    <Paper
      sx={[
        {
          mb: 2.5,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <TextField
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={searchPlaceholder}
        size="small"
        inputProps={{ 'aria-label': searchPlaceholder }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ flex: { xs: '1 1 100%', sm: '1 1 280px' }, maxWidth: { sm: 420 } }}
      />

      {children && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          {children}
        </Box>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {typeof totalCount === 'number' && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {resultCount ?? totalCount} de {totalCount}
        </Typography>
      )}

      {actions}
    </Paper>
  );
};

export default DataToolbar;
