import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BulkUploadDialog from '../BulkUploadDialog';
import { paymentsAPI } from '../../../services/api';
import { ToastProvider } from '../../../contexts/ToastContext';

jest.mock('../../../services/api', () => ({
  paymentsAPI: {
    bulkImportPayments: jest.fn(),
  },
}));

const renderDialog = (props = {}) =>
  render(
    <ToastProvider>
      <BulkUploadDialog open onClose={jest.fn()} onUploaded={jest.fn()} {...props} />
    </ToastProvider>
  );

describe('BulkUploadDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsAPI.bulkImportPayments.mockResolvedValue({
      data: { successful_imports: 3, failed_imports: 1, errors: [{ row: 4, error: 'Cuota no encontrada' }] },
    });
  });

  test('uploads a file and renders the results', async () => {
    const onUploaded = jest.fn().mockResolvedValue(undefined);
    renderDialog({ onUploaded });

    const file = new File(['contenido'], 'pagos.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

    expect(await screen.findByText('Exitosos')).toBeInTheDocument();
    expect(screen.getByText('Fila 4: Cuota no encontrada')).toBeInTheDocument();
    expect(paymentsAPI.bulkImportPayments).toHaveBeenCalledWith(file);
    expect(onUploaded).toHaveBeenCalled();
  });

  test('does not submit without a file', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Subir archivo' })).toBeDisabled();
    expect(paymentsAPI.bulkImportPayments).not.toHaveBeenCalled();
  });
});
