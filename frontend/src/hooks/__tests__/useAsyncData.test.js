import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncData } from '../useAsyncData';

describe('useAsyncData', () => {
  test('loads data and exposes loading state', async () => {
    const loader = jest.fn().mockResolvedValue({ value: 42 });

    const { result } = renderHook(() => useAsyncData(loader, [loader]));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBe('');
  });

  test('exposes an error and can retry', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ value: 7 });

    const { result } = renderHook(() =>
      useAsyncData(loader, [loader], { fallbackError: 'Fallo' })
    );

    await waitFor(() => expect(result.current.error).toBe('boom'));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBe('');
    expect(result.current.data).toEqual({ value: 7 });
    consoleError.mockRestore();
  });

  test('uses fallback error when the loader has no detail', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const loader = jest.fn().mockRejectedValue({});

    const { result } = renderHook(() =>
      useAsyncData(loader, [loader], { fallbackError: 'Fallo' })
    );

    await waitFor(() => expect(result.current.error).toBe('Fallo'));
    consoleError.mockRestore();
  });
});
