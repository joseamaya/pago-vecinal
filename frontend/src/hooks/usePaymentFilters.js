import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { paymentsAPI } from '../services/api';
import { MONTHS } from '../utils/months';
import { formatPropertyLabel } from '../utils/formatters';

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  year: '',
  month: '',
  status: '',
  property: '',
};

const buildFilterParams = (filters) => {
  const params = {};
  if (filters.year) params.year = parseInt(filters.year, 10);
  if (filters.month) params.month = parseInt(filters.month, 10);
  if (filters.status) params.status = filters.status;
  if (filters.property) params.property_id = filters.property;
  return params;
};

export function usePaymentFilters(properties = []) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(PAGE_SIZE);
  const [availableYears] = useState(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= 2020; year -= 1) {
      years.push(year);
    }
    return years;
  });
  const mountedRef = useRef(false);

  const fetchPayments = useCallback(
    async (targetPage = 1, targetFilters = {}) => {
      try {
        setLoading(true);
        const response = await paymentsAPI.getPayments(targetPage, pageSize, targetFilters);
        const sortedData = [...response.data.data].sort(
          (a, b) => new Date(b.payment_date) - new Date(a.payment_date)
        );
        setPayments(sortedData);
        setTotalPages(response.data.pagination.total_pages);
        setTotalCount(response.data.pagination.total_count);
        setPage(targetPage);
        setError('');
      } catch (err) {
        setError('Error al cargar pagos');
        console.error('Error fetching payments:', err);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  const currentFilters = useMemo(() => buildFilterParams(filters), [filters]);

  useEffect(() => {
    fetchPayments(1, {});
  }, [fetchPayments]);

  useEffect(() => {
    if (!mountedRef.current) return;
    fetchPayments(1, currentFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.year, filters.month, filters.status, filters.property]);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  const setFilter = useCallback((name, value) => {
    setFilters((previous) => ({ ...previous, [name]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const applyFilters = useCallback(() => {
    return fetchPayments(1, currentFilters);
  }, [fetchPayments, currentFilters]);

  const refresh = useCallback(() => {
    return fetchPayments(page, currentFilters);
  }, [fetchPayments, page, currentFilters]);

  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage >= 1 && newPage <= totalPages) {
        fetchPayments(newPage, currentFilters);
      }
    },
    [fetchPayments, currentFilters, totalPages]
  );

  const activeFilterChips = useMemo(
    () =>
      [
        filters.year && {
          key: 'year',
          label: `Año ${filters.year}`,
          onRemove: () => setFilter('year', ''),
        },
        filters.month && {
          key: 'month',
          label: MONTHS.find((month) => month.value.toString() === filters.month.toString())?.label,
          onRemove: () => setFilter('month', ''),
        },
        filters.status && {
          key: 'status',
          label: filters.status,
          onRemove: () => setFilter('status', ''),
        },
        filters.property && {
          key: 'property',
          label: (() => {
            const property = properties.find((item) => item.id === filters.property);
            return property ? formatPropertyLabel(property) : 'Propiedad';
          })(),
          onRemove: () => setFilter('property', ''),
        },
      ].filter(Boolean),
    [filters, properties, setFilter]
  );

  return {
    filters,
    setFilter,
    payments,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    totalCount,
    availableYears,
    currentFilters,
    activeFilterChips,
    fetchPayments,
    applyFilters,
    clearFilters,
    refresh,
    handlePageChange,
  };
}
