import { useCallback, useEffect, useRef, useState } from 'react';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.detail || error?.message || fallback;

export function useAsyncData(loader, deps = [], { immediate = true, fallbackError = 'No pudimos cargar la información.' } = {}) {
  const loaderRef = useRef(loader);
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  loaderRef.current = loader;

  const execute = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (hasDataRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const result = await loaderRef.current();
      if (requestId !== requestIdRef.current) return result;

      setData(result);
      hasDataRef.current = true;
      return result;
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(getErrorMessage(err, fallbackError));
      }
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fallbackError]);

  useEffect(() => {
    if (immediate) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    []
  );

  return { data, loading, refreshing, error, reload: execute, setData };
}
