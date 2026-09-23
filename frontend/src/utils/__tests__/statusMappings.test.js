import { getStatusColor, getStatusLabel } from '../statusMappings';

describe('statusMappings', () => {
  describe('getStatusColor', () => {
    test('pending returns warning', () => {
      expect(getStatusColor('pending')).toBe('warning');
    });

    test('approved returns success', () => {
      expect(getStatusColor('approved')).toBe('success');
    });

    test('rejected returns error', () => {
      expect(getStatusColor('rejected')).toBe('error');
    });

    test('completed returns success', () => {
      expect(getStatusColor('completed')).toBe('success');
    });

    test('cancelled returns default', () => {
      expect(getStatusColor('cancelled')).toBe('default');
    });

    test('unknown status returns default', () => {
      expect(getStatusColor('nonexistent')).toBe('default');
    });

    test('partially_paid returns info', () => {
      expect(getStatusColor('partially_paid')).toBe('info');
    });

    test('agreement returns secondary', () => {
      expect(getStatusColor('agreement')).toBe('secondary');
    });
  });

  describe('getStatusLabel', () => {
    test('pending returns Pendiente', () => {
      expect(getStatusLabel('pending')).toBe('Pendiente');
    });

    test('approved returns Aprobado', () => {
      expect(getStatusLabel('approved')).toBe('Aprobado');
    });

    test('rejected returns Rechazado', () => {
      expect(getStatusLabel('rejected')).toBe('Rechazado');
    });

    test('completed returns Completado', () => {
      expect(getStatusLabel('completed')).toBe('Completado');
    });

    test('cancelled returns Cancelado', () => {
      expect(getStatusLabel('cancelled')).toBe('Cancelado');
    });

    test('unknown returns the status itself', () => {
      expect(getStatusLabel('unknown_status')).toBe('unknown_status');
    });

    test('partially_paid label is correct', () => {
      expect(getStatusLabel('partially_paid')).toBe('Parcialmente pagado');
    });

    test('agreement label is correct', () => {
      expect(getStatusLabel('agreement')).toBe('En convenio');
    });
  });
});
