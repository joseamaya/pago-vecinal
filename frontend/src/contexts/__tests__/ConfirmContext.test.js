import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from '../ConfirmContext';

const Trigger = ({ onResult }) => {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () =>
        onResult(await confirm({ title: 'Eliminar', message: '¿Seguro?', confirmLabel: 'Sí' }))
      }
    >
      Abrir
    </button>
  );
};

describe('ConfirmProvider', () => {
  test('resolves true when the user confirms', async () => {
    const onResult = jest.fn();
    render(
      <ConfirmProvider>
        <Trigger onResult={onResult} />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Abrir'));
    expect(await screen.findByText('¿Seguro?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  test('resolves false when the user cancels', async () => {
    const onResult = jest.fn();
    render(
      <ConfirmProvider>
        <Trigger onResult={onResult} />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Abrir'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  test('throws when useConfirm is used outside a provider', () => {
    const Bad = () => {
      useConfirm();
      return null;
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ConfirmProvider/);
    console.error.mockRestore();
  });
});
