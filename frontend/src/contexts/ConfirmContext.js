import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  useMediaQuery,
  useTheme,
} from '@mui/material';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const resolver = useRef(null);
  const openRef = useRef(false);
  const [state, setState] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    destructive: true,
  });

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        if (openRef.current) {
          resolve(false);
          return;
        }
        openRef.current = true;
        resolver.current = resolve;
        setState({
          open: true,
          title: options.title || 'Confirmar acción',
          message: options.message || '',
          confirmLabel: options.confirmLabel || 'Confirmar',
          cancelLabel: options.cancelLabel || 'Cancelar',
          destructive: options.destructive !== false,
        });
      }),
    []
  );

  const close = useCallback((result) => {
    openRef.current = false;
    setState((current) => ({ ...current, open: false }));
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={state.open}
        onClose={() => close(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreen}
        aria-labelledby="confirm-dialog-title"
      >
        <DialogTitle id="confirm-dialog-title">{state.title}</DialogTitle>
        {state.message && (
          <DialogContent>
            <DialogContentText>{state.message}</DialogContentText>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => close(false)}>{state.cancelLabel}</Button>
          <Button
            onClick={() => close(true)}
            variant="contained"
            color={state.destructive ? 'error' : 'primary'}
          >
            {state.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

export default ConfirmProvider;
