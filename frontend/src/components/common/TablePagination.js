import React from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Pagination,
  Select,
  Typography,
} from '@mui/material';

const rangeLabel = (page, limit, totalCount) => {
  if (!totalCount) return 'Sin resultados';
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalCount);
  return `Mostrando ${start}–${end} de ${totalCount}`;
};

const TablePagination = ({
  page = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  disabled = false,
  sx,
}) => (
  <Box
    sx={[
      {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        px: 2.5,
        py: 1.75,
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {rangeLabel(page, pageSize, totalCount)}
    </Typography>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 92 }}>
        <Select
          value={pageSize}
          onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          disabled={disabled}
          inputProps={{ 'aria-label': 'Filas por página' }}
        >
          {pageSizeOptions.map((size) => (
            <MenuItem key={size} value={size}>
              {size} / pág.
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Pagination
        count={Math.max(totalPages, 1)}
        page={page}
        onChange={(event, value) => onPageChange?.(value)}
        color="primary"
        size="small"
        disabled={disabled || totalPages <= 1}
      />
    </Box>
  </Box>
);

export default TablePagination;
