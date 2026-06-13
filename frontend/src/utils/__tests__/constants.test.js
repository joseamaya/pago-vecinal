import { ROLE_ADMIN, ROLE_OWNER, PAYMENT_STATUS, FEE_STATUS, MISC_PAYMENT_STATUS } from '../constants';

describe('constants', () => {
  test('ROLE_ADMIN is admin', () => {
    expect(ROLE_ADMIN).toBe('admin');
  });

  test('ROLE_OWNER is owner', () => {
    expect(ROLE_OWNER).toBe('owner');
  });

  test('PAYMENT_STATUS has all expected values', () => {
    expect(PAYMENT_STATUS.PENDING).toBe('pending');
    expect(PAYMENT_STATUS.APPROVED).toBe('approved');
    expect(PAYMENT_STATUS.REJECTED).toBe('rejected');
    expect(PAYMENT_STATUS.CANCELLED).toBe('cancelled');
  });

  test('FEE_STATUS has Partially Paid', () => {
    expect(FEE_STATUS.PARTIALLY_PAID).toBe('partially_paid');
    expect(FEE_STATUS.COMPLETED).toBe('completed');
  });

  test('MISC_PAYMENT_STATUS matches payment status values', () => {
    expect(MISC_PAYMENT_STATUS.PENDING).toBe(PAYMENT_STATUS.PENDING);
    expect(MISC_PAYMENT_STATUS.APPROVED).toBe(PAYMENT_STATUS.APPROVED);
  });
});
