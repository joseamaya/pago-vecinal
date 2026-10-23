import React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

const FormDialog = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  submitLabel = 'Guardar',
  savingLabel = 'Guardando…',
  cancelLabel = 'Cancelar',
  saving = false,
  error,
  maxWidth = 'sm',
  fullScreen,
  submitDisabled = false,
  extraActions,
  contentSx,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isFullScreen = fullScreen ?? isMobile;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={isFullScreen}
    >
      <DialogTitle component="div">
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, fontWeight: 400 }}>
            {subtitle}
          </Typography>
        )}
      </DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent dividers={isFullScreen} sx={contentSx}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {children}
        </DialogContent>
        <DialogActions sx={isFullScreen ? { position: 'sticky', bottom: 0, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' } : undefined}>
          {extraActions}
          <Button onClick={onClose} disabled={saving} color="inherit">
            {cancelLabel}
          </Button>
          <Button type="submit" variant="contained" disabled={saving || submitDisabled}>
            {saving ? savingLabel : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default FormDialog;
