import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { usePaymentDialog } from '../usePaymentDialog';
import { paymentsAPI, feesAPI } from '../../services/api';
import { ToastProvider } from '../../contexts/ToastContext';
import { toInputDate } from '../../utils/formatters';

jest.mock('../../services/api', () => ({
  paymentsAPI: {
    createPayment: jest.fn(),
    updatePayment: jest.fn(),
  },
  feesAPI: {
    getFee: jest.fn(),
    getFees: jest.fn(),
  },
}));

const properties = [
  { id: 'p1', villa: 'Villa 1', row_letter: 'A', number: 1 },
  { id: 'p2', villa: 'Villa 1', row_letter: 'A', number: 2 },
  { id: 'p3', villa: 'Villa 2', row_letter: 'B', number: 1 },
];

const fee = (overrides = {}) => ({
  id: 'f1',
  property_id: 'p1',
  property_owner_name: 'Ana',
  month: 1,
  year: 2026,
  due_date: '2026-01-31',
  paid_amount: 20,
  remaining_amount: 80,
  amount: 100,
  status: 'partially_paid',
  ...overrides,
});

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

describe('usePaymentDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsAPI.createPayment.mockResolvedValue({ data: {} });
    paymentsAPI.updatePayment.mockResolvedValue({ data: {} });
    feesAPI.getFee.mockResolvedValue({ data: fee() });
    feesAPI.getFees.mockResolvedValue({ data: { data: [fee()] } });
  });

  test('opens a new payment with today as the default date', async () => {
    const { result } = renderHook(() => usePaymentDialog({ properties }), { wrapper });

    await act(async () => {
      await result.current.handleOpenDialog();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.editingPayment).toBeNull();
    expect(result.current.formData.payment_date).toBe(toInputDate(new Date()));
    expect(result.current.availableVillas).toEqual(['Villa 1', 'Villa 2']);
  });

  test('walks the villa, row, house and fee cascade', async () => {
    const { result } = renderHook(() => usePaymentDialog({ properties }), { wrapper });

    await act(async () => {
      await result.current.handleOpenDialog();
    });

    act(() => result.current.handleVillaChange('Villa 1'));
    expect(result.current.availableRows).toEqual(['A']);

    act(() => result.current.handleRowChange('A'));
    expect(result.current.availableHouses).toEqual([
      { id: 'p1', number: 1 },
      { id: 'p2', number: 2 },
    ]);

    await act(async () => {
      await result.current.handleHouseChange('p1');
    });

    expect(feesAPI.getFees).toHaveBeenCalledWith(
      { property_id: 'p1', status: 'pending,partially_paid' },
      1,
      100
    );
    expect(result.current.availableFees).toHaveLength(1);

    act(() => result.current.handleFeeChange('f1'));

    expect(result.current.formData.fee_id).toBe('f1');
    expect(result.current.formData.amount).toBe('80');
    expect(result.current.selectedFeeAmount).toBe(80);
    expect(result.current.selectedFeeInfo.ownerName).toBe('Ana');
  });

  test('prefills the form when editing a payment', async () => {
    const { result } = renderHook(() => usePaymentDialog({ properties }), { wrapper });

    await act(async () => {
      await result.current.handleOpenDialog({
        id: 'pay-1',
        fee_id: 'f1',
        amount: 75,
        notes: 'Nota',
        payment_date: '2026-01-15',
      });
    });

    expect(result.current.open).toBe(true);
    expect(result.current.editingPayment.id).toBe('pay-1');
    expect(result.current.formData.fee_id).toBe('f1');
    expect(result.current.formData.amount).toBe('75');
    expect(result.current.formData.notes).toBe('Nota');
    expect(result.current.selectedVilla).toBe('Villa 1');
    expect(result.current.selectedHouse).toBe('p1');
    expect(result.current.selectedFeeAmount).toBe(75);
  });

  test('submits a new payment as FormData and refreshes the list', async () => {
    const onSaved = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => usePaymentDialog({ properties, isAdmin: true, onSaved }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleOpenDialog();
    });

    act(() => result.current.handleVillaChange('Villa 1'));
    act(() => result.current.handleRowChange('A'));
    await act(async () => {
      await result.current.handleHouseChange('p1');
    });
    act(() => result.current.handleFeeChange('f1'));

    act(() =>
      result.current.setFormData((previous) => ({
        ...previous,
        notes: 'Pago parcial',
        payment_date: '2026-01-20',
      }))
    );

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() });
    });

    const sent = paymentsAPI.createPayment.mock.calls[0][0];
    expect(sent).toBeInstanceOf(FormData);
    expect(sent.get('fee_id')).toBe('f1');
    expect(sent.get('amount')).toBe('80');
    expect(sent.get('notes')).toBe('Pago parcial');
    expect(sent.get('payment_date')).toBe('2026-01-20');
    expect(onSaved).toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  test('rejects a non-positive amount before calling the API', async () => {
    const { result } = renderHook(() => usePaymentDialog({ properties }), { wrapper });

    await act(async () => {
      await result.current.handleOpenDialog();
    });

    act(() =>
      result.current.setFormData((previous) => ({
        ...previous,
        fee_id: 'f1',
        amount: '0',
        payment_date: '2026-01-20',
      }))
    );

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(paymentsAPI.createPayment).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });
});
