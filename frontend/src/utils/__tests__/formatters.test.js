import { formatCurrency, formatDate, formatMonth, formatPeriod, formatPropertyLabel, getInitials } from '../formatters';

describe('formatters', () => {
  test('formats currency in peruvian soles', () => {
    expect(formatCurrency(1234.5)).toMatch(/S\/\s?1,234\.50/);
    expect(formatCurrency(undefined)).toMatch(/0\.00/);
  });

  test('formats dates in es-PE', () => {
    expect(formatDate('2026-01-15T12:00:00Z')).toBe('15/01/2026');
    expect(formatDate(null)).toBe('—');
  });

  test('formats month and period labels', () => {
    expect(formatMonth(1)).toBe('enero');
    expect(formatPeriod(1, 2026)).toBe('Enero 2026');
  });

  test('formats property labels', () => {
    expect(formatPropertyLabel({ villa: 'Villa 1', row_letter: 'A', number: 3 })).toBe('Villa 1 A3');
    expect(formatPropertyLabel(null)).toBe('—');
  });

  test('builds initials', () => {
    expect(getInitials('Ana María Torres')).toBe('AM');
    expect(getInitials('')).toBe('PV');
  });
});
