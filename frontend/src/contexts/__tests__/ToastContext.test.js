import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';
import { notify } from '../../services/notifications';

const Trigger = () => {
  const toast = useToast();
  return <button onClick={() => toast.success('Guardado')}>Mostrar</button>;
};

describe('ToastProvider', () => {
  test('renders a toast when triggered through the hook', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Mostrar'));
    expect(await screen.findByText('Guardado')).toBeInTheDocument();
  });

  test('renders a toast emitted through the global notifier', async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>
    );

    await act(async () => {
      notify.error('Falló la operación');
    });
    expect(await screen.findByText('Falló la operación')).toBeInTheDocument();
  });

  test('throws when useToast is used outside a provider', () => {
    const Bad = () => {
      useToast();
      return null;
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    console.error.mockRestore();
  });
});
