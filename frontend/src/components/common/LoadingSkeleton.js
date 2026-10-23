import React from 'react';
import { Box, Paper, Skeleton, TableCell, TableRow } from '@mui/material';

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
                <Skeleton variant={variant} height={height / 2} sx={{ width: '100%', maxWidth: 160 }} {...props} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </>
    );
  }

  if (type === 'cards' || type === 'list') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {Array.from({ length: rows }).map((_, index) => (
          <Paper key={index} sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1 }}>
              <Skeleton variant="text" height={22} width="45%" />
              <Skeleton variant="rounded" height={24} width={80} />
            </Box>
            <Skeleton variant="text" height={18} width="68%" />
            <Skeleton variant="text" height={18} width="38%" sx={{ mt: 1 }} />
          </Paper>
        ))}
      </Box>
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
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} variant="rounded" height={100} sx={{ flex: 1 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={200} width="100%" />
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

  return <Skeleton variant={variant} height={height} sx={{ width: '100%' }} {...props} />;
};

export default LoadingSkeleton;
