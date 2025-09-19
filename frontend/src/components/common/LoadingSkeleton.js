import React from 'react';
import {
  Skeleton,
  TableRow,
  TableCell,
  Box,
  Paper,
} from '@mui/material';

const LoadingSkeleton = ({
  type = 'table',
  rows = 5,
  columns = 6,
  height = 60,
  variant = 'rectangular',
  ...props
}) => {
  if (type === 'table') {
    return (
      <>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton
                  variant={variant}
                  height={height}
                  sx={{ width: '100%' }}
                  {...props}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </>
    );
  }

  if (type === 'card') {
    return (
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" height={32} width="60%" />
          <Skeleton variant="text" height={24} width="40%" />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Skeleton variant="rectangular" height={100} width="25%" />
          <Skeleton variant="rectangular" height={100} width="25%" />
          <Skeleton variant="rectangular" height={100} width="25%" />
          <Skeleton variant="rectangular" height={100} width="25%" />
        </Box>
        <Skeleton variant="rectangular" height={200} width="100%" />
      </Paper>
    );
  }

  if (type === 'form') {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: rows }).map((_, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            <Skeleton variant="text" height={24} width="30%" sx={{ mb: 1 }} />
            <Skeleton variant={variant} height={height} width="100%" />
          </Box>
        ))}
      </Box>
    );
  }

  // Default skeleton
  return (
    <Skeleton
      variant={variant}
      height={height}
      sx={{ width: '100%' }}
      {...props}
    />
  );
};

export default LoadingSkeleton;