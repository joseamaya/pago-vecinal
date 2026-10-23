import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useTableState } from '../useTableState';

const wrapperFor = (entry) => {
  const Wrapper = ({ children }) => (
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {children}
    </MemoryRouter>
  );
  return Wrapper;
};

const renderTableState = (entry = '/fees', options = {}) =>
  renderHook(
    () => {
      const table = useTableState(options);
      const [params] = useSearchParams();
      return { ...table, params };
    },
    { wrapper: wrapperFor(entry) }
  );

describe('useTableState', () => {
  test('reads defaults and preserves unrelated params', () => {
    const { result } = renderTableState('/fees?year=2026');

    expect(result.current.search).toBe('');
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(20);
    expect(result.current.params.get('year')).toBe('2026');
  });

  test('updates search and resets page', () => {
    const { result } = renderTableState('/fees?page=3&year=2026');

    act(() => result.current.setSearch('Villa'));

    expect(result.current.search).toBe('Villa');
    expect(result.current.page).toBe(1);
    expect(result.current.params.get('year')).toBe('2026');
  });

  test('updates sort and page size', () => {
    const { result } = renderTableState('/fees');

    act(() => result.current.setSort('amount', 'desc'));
    expect(result.current.sortBy).toBe('amount');
    expect(result.current.sortDir).toBe('desc');

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setLimit(50));
    expect(result.current.limit).toBe(50);
    expect(result.current.page).toBe(1);
  });

  test('reset clears table state', () => {
    const { result } = renderTableState('/fees?q=Villa&page=2&sort=amount&dir=desc');

    act(() => result.current.reset());

    expect(result.current.search).toBe('');
    expect(result.current.page).toBe(1);
    expect(result.current.sortBy).toBe('');
    expect(result.current.params.toString()).toBe('');
  });
});
