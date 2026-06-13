import { MONTHS } from '../months';

describe('months', () => {
  test('has 12 elements', () => {
    expect(MONTHS).toHaveLength(12);
  });

  test('first month is Enero', () => {
    expect(MONTHS[0]).toEqual({ value: 1, label: 'Enero' });
  });

  test('last month is Diciembre', () => {
    expect(MONTHS[11]).toEqual({ value: 12, label: 'Diciembre' });
  });

  test('values are sequential 1-12', () => {
    MONTHS.forEach((month, index) => {
      expect(month.value).toBe(index + 1);
    });
  });

  test('all labels are non-empty strings', () => {
    MONTHS.forEach((month) => {
      expect(typeof month.label).toBe('string');
      expect(month.label.length).toBeGreaterThan(0);
    });
  });
});
