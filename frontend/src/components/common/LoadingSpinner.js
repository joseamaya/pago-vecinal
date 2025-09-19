import React from 'react';
import {
  CircularProgress,
  Box,
  Typography,
  Button,
} from '@mui/material';

const LoadingSpinner = ({
  size = 40,
  message = 'Cargando...',
  showMessage = true,
  fullScreen = false,
  buttonVariant = false,
  disabled = false,
  ...props
}) => {
  const spinner = (
    <CircularProgress
      size={size}
      sx={{
        color: 'primary.main',
        ...props.sx
      }}
      {...props}
    />
  );

  if (buttonVariant) {
    return (
      <Button
        variant="contained"
        disabled={disabled || true}
        startIcon={spinner}
        sx={{
          minWidth: 120,
          ...props.buttonSx
        }}
      >
        {message}
      </Button>
    );
  }

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          zIndex: 9999,
        }}
      >
        {spinner}
        {showMessage && (
          <Typography
            variant="h6"
            sx={{ mt: 2, color: 'text.secondary' }}
          >
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        ...props.sx
      }}
    >
      {spinner}
      {showMessage && (
        <Typography
          variant="body1"
          sx={{ mt: 2, color: 'text.secondary' }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingSpinner;