import { useCallback, useState } from 'react';
import { validateValues } from '../utils/validators';

const focusField = (name) => {
  if (typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const input = document.querySelector(`[name="${name}"]`);
    input?.focus?.();
  });
};

export function useFormValidation(values, schema) {
  const [errors, setErrors] = useState({});

  const validateField = useCallback(
    (name) => {
      const nextErrors = validateValues(values, schema);
      setErrors((previous) => ({ ...previous, [name]: nextErrors[name] || '' }));
      return !nextErrors[name];
    },
    [values, schema]
  );

  const validateAll = useCallback(() => {
    const nextErrors = validateValues(values, schema);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      focusField(firstError);
      return false;
    }
    return true;
  }, [values, schema]);

  const clearError = useCallback((name) => {
    setErrors((previous) => ({ ...previous, [name]: '' }));
  }, []);

  return { errors, validateField, validateAll, clearError, setErrors };
}
