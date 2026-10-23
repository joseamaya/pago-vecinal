import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';
import { required } from '../../utils/validators';

const schema = {
  name: required('Nombre requerido'),
};

describe('useFormValidation', () => {
  test('validates a single field and clears its error', () => {
    const { result } = renderHook(() =>
      useFormValidation({ name: '' }, schema)
    );

    act(() => {
      expect(result.current.validateField('name')).toBe(false);
    });
    expect(result.current.errors.name).toBe('Nombre requerido');

    act(() => result.current.clearError('name'));
    expect(result.current.errors.name).toBe('');
  });

  test('validates all fields and reports validity', () => {
    const { result, rerender } = renderHook(
      ({ values }) => useFormValidation(values, schema),
      { initialProps: { values: { name: '' } } }
    );

    act(() => {
      expect(result.current.validateAll()).toBe(false);
    });
    expect(result.current.errors.name).toBe('Nombre requerido');

    rerender({ values: { name: 'Ana' } });

    act(() => {
      expect(result.current.validateAll()).toBe(true);
    });
    expect(result.current.errors).toEqual({});
  });
});
