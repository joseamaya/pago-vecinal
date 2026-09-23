const listeners = new Set();

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (message, severity) => {
  if (!message) return;
  listeners.forEach((listener) => listener({ message, severity }));
};

export const notify = {
  success: (message) => emit(message, 'success'),
  error: (message) => emit(message, 'error'),
  warning: (message) => emit(message, 'warning'),
  info: (message) => emit(message, 'info'),
};

export const isNetworkError = (error) => Boolean(error?.isNetworkError);
