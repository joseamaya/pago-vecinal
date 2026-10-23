import React from 'react';
import { render, screen } from '@testing-library/react';
import ResponsiveTable from '../ResponsiveTable';

const columns = [
  { key: 'name', label: 'Nombre', mobile: false },
  { key: 'amount', label: 'Monto', render: (row) => `S/ ${row.amount}` },
];

const rows = [
  { id: '1', name: 'Ana', amount: 10 },
  { id: '2', name: 'Luis', amount: 20 },
];

describe('ResponsiveTable', () => {
  test('renders rows on desktop', () => {
    render(<ResponsiveTable columns={columns} rows={rows} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(screen.getByText('S/ 20')).toBeInTheDocument();
  });

  test('renders empty state', () => {
    render(
      <ResponsiveTable
        columns={columns}
        rows={[]}
        emptyState={<div>Sin datos</div>}
      />
    );
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  test('renders mobile cards when viewport is small', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    render(
      <ResponsiveTable
        columns={columns}
        rows={rows}
        mobileTitle={(row) => row.name}
        mobileSubtitle={(row) => `Monto ${row.amount}`}
      />
    );

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Monto 20')).toBeInTheDocument();
    window.matchMedia = originalMatchMedia;
  });
});
