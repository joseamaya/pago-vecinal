export const isRequired = (value) =>
  value !== undefined && value !== null && String(value).trim() !== '';

export const required = (message = 'Este campo es obligatorio.') =>
  (value) => (isRequired(value) ? '' : message);

export const email = (message = 'Ingresa un correo electrónico válido.') =>
  (value) => (!isRequired(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()) ? '' : message);

export const minLength = (length, message = `Ingresa al menos ${length} caracteres.`) =>
  (value) => (!isRequired(value) || String(value).trim().length >= length ? '' : message);

export const positiveNumber = (message = 'Ingresa un número mayor a 0.') =>
  (value) => {
    if (!isRequired(value)) return '';
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? '' : message;
  };

export const positiveInteger = (message = 'Ingresa un número entero mayor a 0.') =>
  (value) => {
    if (!isRequired(value)) return '';
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? '' : message;
  };

export const maxNumber = (max, message = `El valor no puede superar ${max}.`) =>
  (value) => {
    if (!isRequired(value)) return '';
    const number = Number(value);
    return Number.isFinite(number) && number <= max ? '' : message;
  };

export const phone = (message = 'Ingresa un teléfono válido.') =>
  (value) => {
    if (!isRequired(value)) return '';
    const digits = String(value).replace(/\D/g, '');
    return digits.length >= 6 && digits.length <= 15 ? '' : message;
  };

const runValidator = (validator, value) => {
  if (Array.isArray(validator)) {
    for (const rule of validator) {
      const message = runValidator(rule, value);
      if (message) return message;
    }
    return '';
  }
  return typeof validator === 'function' ? validator(value) || '' : '';
};

export const validateValues = (values, schema = {}) => {
  const errors = {};
  Object.entries(schema).forEach(([field, validators]) => {
    const message = runValidator(validators, values[field]);
    if (message) errors[field] = message;
  });
  return errors;
};
