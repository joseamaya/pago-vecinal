import { useState } from 'react';

export function usePagination(defaultLimit = 20) {
  const [page, setPage] = useState(1);
  const [limit] = useState(defaultLimit);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const updateFromResponse = (pagination) => {
    if (pagination) {
      setTotalCount(pagination.total_count || 0);
      setTotalPages(pagination.total_pages || 0);
    }
  };

  return {
    page,
    limit,
    totalCount,
    totalPages,
    setPage: handlePageChange,
    setTotalCount,
    setTotalPages,
    updateFromResponse,
  };
}
