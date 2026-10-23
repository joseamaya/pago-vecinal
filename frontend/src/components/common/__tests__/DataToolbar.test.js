import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DataToolbar from '../DataToolbar';

describe('DataToolbar', () => {
  test('renders the result count and debounces search changes', async () => {
    const onSearchChange = jest.fn();

    render(
      <DataToolbar
        search=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Buscar propiedades"
        resultCount={3}
        totalCount={10}
      />
    );

    expect(screen.getByText('3 de 10')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar propiedades'), {
      target: { value: 'Villa' },
    });

    await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith('Villa'), {
      timeout: 1000,
    });
  });

  test('syncs when the external search value changes', () => {
    const { rerender } = render(
      <DataToolbar search="uno" onSearchChange={jest.fn()} searchPlaceholder="Buscar" />
    );

    expect(screen.getByLabelText('Buscar')).toHaveValue('uno');

    rerender(
      <DataToolbar search="dos" onSearchChange={jest.fn()} searchPlaceholder="Buscar" />
    );

    expect(screen.getByLabelText('Buscar')).toHaveValue('dos');
  });
});
