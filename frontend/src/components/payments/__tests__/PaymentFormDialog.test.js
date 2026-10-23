import React from 'react';
import { render, screen } from '@testing-library/react';
import PaymentFormDialog from '../PaymentFormDialog';

const buildDialog = (overrides = {}) => ({
  open: true,
  editingPayment: null,
  formData: {
    fee_id: 'fee-1',
    amount: '',
    notes: '',
    payment_date: '',
  },
  setFormData: jest.fn(),
  approveDirectly: false,
  setApproveDirectly: jest.fn(),
  saving: false,
  selectedVilla: 'Villa 1',
  selectedRow: 'A',
  selectedHouse: 'prop-1',
  availableRows: ['A'],
  availableHouses: [{ id: 'prop-1', number: 1 }],
  availableFees: [
    {
      id: 'fee-1',
      month: 1,
      year: 2026,
      amount: 100,
      status: 'pending',
      paid_amount: 0,
      remaining_amount: 100,
    },
  ],
  selectedFeeId: '',
  selectedFeeAmount: 100,
  selectedFeeInfo: {
    ownerName: 'Ana Owner',
    month: 1,
    year: 2026,
    dueDate: '2026-01-15',
    paidAmount: 0,
    totalAmount: 100,
    status: 'pending',
  },
  availableVillas: ['Villa 1'],
  handleCloseDialog: jest.fn(),
  handleVillaChange: jest.fn(),
  handleRowChange: jest.fn(),
  handleHouseChange: jest.fn(),
  handleFeeChange: jest.fn(),
  handleSubmit: jest.fn(),
  ...overrides,
});

describe('PaymentFormDialog', () => {
  test('keeps submit disabled until a fee is selected', () => {
    render(<PaymentFormDialog dialog={buildDialog()} />);

    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
  });

  test('enables submit with a valid amount and date', () => {
    render(
      <PaymentFormDialog
        dialog={buildDialog({
          selectedFeeId: 'fee-1',
          formData: {
            fee_id: 'fee-1',
            amount: '100',
            notes: '',
            payment_date: '2026-10-23',
          },
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeEnabled();
  });

  test('disables submit when the amount exceeds the remaining fee', () => {
    render(
      <PaymentFormDialog
        dialog={buildDialog({
          selectedFeeId: 'fee-1',
          formData: {
            fee_id: 'fee-1',
            amount: '150',
            notes: '',
            payment_date: '2026-10-23',
          },
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
    expect(screen.getByText('El monto no puede superar S/ 100.00.')).toBeInTheDocument();
  });

  test('disables submit when the payment date is missing', () => {
    render(
      <PaymentFormDialog
        dialog={buildDialog({
          selectedFeeId: 'fee-1',
          formData: {
            fee_id: 'fee-1',
            amount: '100',
            notes: '',
            payment_date: '',
          },
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
  });

  test('allows editing an amount above the original fee value', () => {
    render(
      <PaymentFormDialog
        dialog={buildDialog({
          editingPayment: { id: 'payment-1' },
          selectedFeeId: 'fee-1',
          formData: {
            fee_id: 'fee-1',
            amount: '150',
            notes: '',
            payment_date: '2026-10-23',
          },
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });
});
