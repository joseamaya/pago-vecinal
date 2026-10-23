import {
  email,
  maxNumber,
  minLength,
  phone,
  positiveInteger,
  positiveNumber,
  required,
  validateValues,
} from '../validators';

describe('validators', () => {
  test('required rejects empty values', () => {
    expect(required()('')).toBe('Este campo es obligatorio.');
    expect(required()('   ')).toBe('Este campo es obligatorio.');
    expect(required()('ok')).toBe('');
  });

  test('email validates format', () => {
    expect(email()('vecino@example.com')).toBe('');
    expect(email()('vecino@')).not.toBe('');
    expect(email()('')).toBe('');
  });

  test('minLength and phone handle empty optional values', () => {
    expect(minLength(6)('abc')).not.toBe('');
    expect(minLength(6)('abcdef')).toBe('');
    expect(minLength(6)('')).toBe('');

    expect(phone()('999 888 777')).toBe('');
    expect(phone()('123')).not.toBe('');
    expect(phone()('')).toBe('');
  });

  test('numeric validators reject invalid values', () => {
    expect(positiveNumber()('10.5')).toBe('');
    expect(positiveNumber()('0')).not.toBe('');
    expect(positiveInteger()('2')).toBe('');
    expect(positiveInteger()('2.5')).not.toBe('');
    expect(maxNumber(100)('101')).not.toBe('');
    expect(maxNumber(100)('99')).toBe('');
  });

  test('validateValues collects the first error per field', () => {
    const errors = validateValues(
      { name: '', amount: '0', email: 'bad' },
      {
        name: required('Nombre requerido'),
        amount: [required(), positiveNumber()],
        email: [required(), email()],
      }
    );

    expect(errors).toEqual({
      name: 'Nombre requerido',
      amount: 'Ingresa un número mayor a 0.',
      email: 'Ingresa un correo electrónico válido.',
    });
    expect(validateValues({ name: 'Ana' }, { name: required() })).toEqual({});
  });
});
