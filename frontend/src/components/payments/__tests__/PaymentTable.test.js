import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PaymentTable from '../PaymentTable';

const payments = [
  {
    id: 'p1',
    amount: 100,
    payment_date: '2026-01-10',
    status: 'pending',
    property_row_letter: 'A',
    property_number: 1,
    fee_month: 1,
    fee_year: 2026,
  },
  {
    id: 'p2',
    amount: 250,
    payment_date: '2026-02-10',
    status: 'approved',
    property_row_letter: 'A',
    property_number: 2,
    fee_month: 2,
    fee_year: 2026,
    receipt_correlative_number: 'REC-2026-00002',
  },
];

const baseProps = {
  payments,
  isAdmin: true,
  selectedPayments: [],
  onToggleSelect: jest.fn(),
  onSelectAll: jest.fn(),
  onClearSelection: jest.fn(),
  onBulkApprove: jest.fn(),
  onCreate: jest.fn(),
  onEdit: jest.fn(),
  onApprove: jest.fn(),
  onReject: jest.fn(),
  onDelete: jest.fn(),
  onDownload: jest.fn(),
  pagination: {
    page: 1,
    totalPages: 1,
    totalCount: 2,
    pageSize: 20,
    onPageChange: jest.fn(),
  },
};

describe('PaymentTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders payments and their status', () => {
    render(<PaymentTable {...baseProps} />);

    expect(screen.getByText('A1 · Enero 2026')).toBeInTheDocument();
    expect(screen.getByText('A2 · Febrero 2026')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
  });

  test('shows the empty state', () => {
    render(<PaymentTable {...baseProps} payments={[]} />);

    expect(screen.getByText('No hay pagos registrados')).toBeInTheDocument();
  });

  test('selects a payment and allows bulk approval', () => {
    render(<PaymentTable {...baseProps} selectedPayments={['p1']} />);

    fireEvent.click(screen.getByLabelText('Seleccionar p1'));
    expect(baseProps.onToggleSelect).toHaveBeenCalledWith('p1');

    fireEvent.click(screen.getByText('Aprobar seleccionados'));
    expect(baseProps.onBulkApprove).toHaveBeenCalled();
  });

  test('opens the action menu and triggers edit', () => {
    render(<PaymentTable {...baseProps} />);

    fireEvent.click(screen.getAllByLabelText(/Acciones para el pago/)[0]);
    fireEvent.click(screen.getByText('Editar'));

    expect(baseProps.onEdit).toHaveBeenCalledWith(payments[0]);
  });
});
