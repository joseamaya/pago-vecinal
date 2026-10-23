import React from 'react';
import { render, screen } from '@testing-library/react';
import MoneyField from '../MoneyField';

describe('MoneyField', () => {
  test('renders the currency prefix and helper text', () => {
    render(
      <MoneyField
        label="Monto"
        value="150"
        onChange={jest.fn()}
        helperText="Máximo S/ 200.00"
      />
    );

    expect(screen.getByText('S/')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto')).toHaveValue(150);
    expect(screen.getByText('Máximo S/ 200.00')).toBeInTheDocument();
  });

  test('shows the error helper text', () => {
    render(
      <MoneyField
        label="Monto"
        value="0"
        onChange={jest.fn()}
        error
        helperText="Ingresa un monto mayor a 0."
      />
    );

    expect(screen.getByText('Ingresa un monto mayor a 0.')).toBeInTheDocument();
  });
});
