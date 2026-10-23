import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TablePagination from '../TablePagination';

describe('TablePagination', () => {
  test('shows the current range and changes page', () => {
    const onPageChange = jest.fn();

    render(
      <TablePagination
        page={1}
        totalPages={3}
        totalCount={45}
        pageSize={20}
        onPageChange={onPageChange}
        onPageSizeChange={jest.fn()}
      />
    );

    expect(screen.getByText('Mostrando 1–20 de 45')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /page 2/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test('shows an empty range', () => {
    render(
      <TablePagination page={1} totalPages={1} totalCount={0} pageSize={20} />
    );

    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });
});
