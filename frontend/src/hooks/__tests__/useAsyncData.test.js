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

  test('ignores an older response that resolves after a newer one', async () => {
    let resolveFirst;
    let resolveSecond;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    const loader = jest
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const { result } = renderHook(() =>
      useAsyncData(loader, [], { immediate: false })
    );

    let firstRequest;
    let secondRequest;
    act(() => {
      firstRequest = result.current.reload();
      secondRequest = result.current.reload();
    });

    await act(async () => {
      resolveSecond({ value: 'new' });
      await secondRequest;
    });
    expect(result.current.data).toEqual({ value: 'new' });

    await act(async () => {
      resolveFirst({ value: 'old' });
      await firstRequest;
    });
    expect(result.current.data).toEqual({ value: 'new' });
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
