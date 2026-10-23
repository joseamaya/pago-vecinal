import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaymentFilters } from '../usePaymentFilters';
import { paymentsAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  paymentsAPI: {
    getPayments: jest.fn(),
  },
}));

const payment = (id, date) => ({
  id,
  payment_date: date,
  amount: 100,
  status: 'pending',
  property_row_letter: 'A',
  property_number: 1,
  fee_month: 1,
  fee_year: 2026,
});

describe('usePaymentFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsAPI.getPayments.mockResolvedValue({
      data: {
        data: [payment('1', '2026-01-10'), payment('2', '2026-02-10')],
        pagination: { total_pages: 1, total_count: 2 },
      },
    });
  });

  test('loads and sorts payments', async () => {
    const { result } = renderHook(() => usePaymentFilters([]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(paymentsAPI.getPayments).toHaveBeenCalledWith(1, 20, {});
    expect(result.current.payments.map((item) => item.id)).toEqual(['2', '1']);
    expect(result.current.totalCount).toBe(2);
  });

  test('applies filters and builds the active chips', async () => {
    const properties = [{ id: 'prop-1', villa: 'Villa 1', row_letter: 'A', number: 2 }];
    const { result } = renderHook(() => usePaymentFilters(properties));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilter('status', 'pending'));
    await waitFor(() =>
      expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(1, 20, { status: 'pending' })
    );

    act(() => result.current.setFilter('property', 'prop-1'));
    await waitFor(() =>
      expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(1, 20, {
        status: 'pending',
        property_id: 'prop-1',
      })
    );

    expect(result.current.activeFilterChips.map((chip) => chip.label)).toEqual([
      'pending',
      'Villa 1 A2',
    ]);
  });

  test('clears filters and paginates', async () => {
    paymentsAPI.getPayments.mockResolvedValue({
      data: {
        data: [payment('1', '2026-01-10')],
        pagination: { total_pages: 3, total_count: 40 },
      },
    });

    const { result } = renderHook(() => usePaymentFilters([]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilter('year', '2026'));
    await waitFor(() =>
      expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(1, 20, { year: 2026 })
    );

    act(() => result.current.handlePageChange(2));
    await waitFor(() =>
      expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(2, 20, { year: 2026 })
    );

    act(() => result.current.clearFilters());
    await waitFor(() => expect(result.current.filters.year).toBe(''));
    await waitFor(() => expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(1, 20, {}));
  });

  test('applies search, sorting and page size without duplicate fetches', async () => {
    const { result } = renderHook(() => usePaymentFilters([]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(paymentsAPI.getPayments).toHaveBeenCalledTimes(1);

    act(() => result.current.setSearch('Villa'));
    await waitFor(() =>
      expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(1, 20, {
        search: 'Villa',
      })
    );

    act(() => result.current.setSort('amount', 'desc'));
    await waitFor(() =>
      expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(1, 20, {
        search: 'Villa',
        sort_by: 'amount',
        sort_dir: 'desc',
      })
    );
    expect(paymentsAPI.getPayments).toHaveBeenCalledTimes(3);

    act(() => result.current.setPageSize(50));
    await waitFor(() =>
      expect(paymentsAPI.getPayments).toHaveBeenLastCalledWith(1, 50, {
        search: 'Villa',
        sort_by: 'amount',
        sort_dir: 'desc',
      })
    );
    expect(paymentsAPI.getPayments).toHaveBeenCalledTimes(4);
  });

  test('exposes an error when loading fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    paymentsAPI.getPayments.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => usePaymentFilters([]));

    await waitFor(() => expect(result.current.error).toBe('Error al cargar pagos'));
    expect(result.current.loading).toBe(false);
    consoleError.mockRestore();
  });
});
