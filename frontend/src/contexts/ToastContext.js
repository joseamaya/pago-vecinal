import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Box } from '@mui/material';
import { subscribe } from '../services/notifications';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random()}`;
      const autoHideDuration = toast.autoHideDuration ?? 4000;
      setToasts((current) => [
        ...current,
        { severity: 'info', ...toast, id, autoHideDuration },
      ]);
      if (autoHideDuration) {
        timers.current.set(id, setTimeout(() => remove(id), autoHideDuration));
      }
    },
    [remove]
  );

  useEffect(() => subscribe(show), [show]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      show,
      success: (message) => show({ message, severity: 'success' }),
      error: (message) => show({ message, severity: 'error' }),
      warning: (message) => show({ message, severity: 'warning' }),
      info: (message) => show({ message, severity: 'info' }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 1,
          zIndex: (theme) => theme.zIndex.snackbar,
          pointerEvents: 'none',
          width: { xs: 'calc(100% - 32px)', sm: 'auto' },
          maxWidth: '100%',
        }}
      >
        {toasts.map((toast) => (
          <Alert
            key={toast.id}
            severity={toast.severity}
            variant="filled"
            onClose={() => remove(toast.id)}
            sx={{ width: '100%', boxShadow: 3, pointerEvents: 'auto' }}
          >
            {toast.message}
          </Alert>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
