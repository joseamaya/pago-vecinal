import React from 'react';
import { Alert, Button } from '@mui/material';

const ErrorState = ({ message, onRetry, retryLabel = 'Reintentar', sx }) => {
  if (!message) return null;

  return (
    <Alert
      severity="error"
      sx={[{ mb: 2.5 }, ...(Array.isArray(sx) ? sx : [sx])]}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
};

export default ErrorState;
