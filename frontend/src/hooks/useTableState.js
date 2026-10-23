import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function useTableState({
  defaultLimit = 20,
  defaultSortBy = '',
  defaultSortDir = '',
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('q') || '';
  const page = parsePositiveInt(searchParams.get('page'), 1);
  const limit = parsePositiveInt(searchParams.get('limit'), defaultLimit);
  const sortBy = searchParams.get('sort') || defaultSortBy;
  const sortDir = searchParams.get('dir') || defaultSortDir;

  const update = useCallback(
    (changes) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(changes).forEach(([key, value]) => {
            if (
              value === '' ||
              value === null ||
              value === undefined ||
              (key === 'page' && value === 1) ||
              (key === 'limit' && value === defaultLimit)
            ) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });
          return next;
        },
        { replace: true }
      );
    },
    [defaultLimit, setSearchParams]
  );

  const setSearch = useCallback(
    (value) => update({ q: value, page: 1 }),
    [update]
  );

  const setPage = useCallback((value) => update({ page: value }), [update]);

  const setLimit = useCallback(
    (value) => update({ limit: value, page: 1 }),
    [update]
  );

  const setSort = useCallback(
    (nextSortBy, nextSortDir = '') =>
      update({ sort: nextSortBy, dir: nextSortDir, page: 1 }),
    [update]
  );

  const reset = useCallback(
    () => update({ q: '', page: 1, limit: defaultLimit, sort: '', dir: '' }),
    [defaultLimit, update]
  );

  return useMemo(
    () => ({
      search,
      page,
      limit,
      sortBy,
      sortDir,
      setSearch,
      setPage,
      setLimit,
      setSort,
      reset,
    }),
    [search, page, limit, sortBy, sortDir, setSearch, setPage, setLimit, setSort, reset]
  );
}
