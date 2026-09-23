import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert, Snackbar } from '@mui/material';
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

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((toast) => {
    setToasts((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        severity: 'info',
        autoHideDuration: 5000,
        ...toast,
      },
    ]);
  }, []);

  useEffect(() => subscribe(show), [show]);

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
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={toast.autoHideDuration}
          onClose={(event, reason) => {
            if (reason !== 'clickaway') {
              remove(toast.id);
            }
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ mb: index * 7 }}
        >
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => remove(toast.id)}
            sx={{ width: '100%', boxShadow: 3 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
