import React from 'react';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';
import { Home as HomeIcon } from '@mui/icons-material';

describe('StatCard', () => {
  test('renders title and value', () => {
    render(
      <StatCard title="Propiedades" value={42} icon={<HomeIcon />} color="primary.main" />
    );
    expect(screen.getByText('Propiedades')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  test('renders without loading spinner when not loading', () => {
    render(
      <StatCard title="Test" value={10} icon={<HomeIcon />} color="primary.main" loading={false} />
    );
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  test('renders with custom color', () => {
    render(
      <StatCard title="Test" value={5} icon={<HomeIcon />} color="success.main" />
    );
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
