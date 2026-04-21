// src/components/StockBadge.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockBadge } from './StockBadge';

describe('StockBadge', () => {
  it('debe mostrar color azul para stock >= 15', () => {
    render(<StockBadge stock={20} />);
    const badge = screen.getByText(/20 und/);
    expect(badge.className).toContain('bg-blue-500');
    expect(badge).toHaveTextContent('Alto stock');
  });

  it('debe mostrar color verde para stock entre 6 y 14', () => {
    render(<StockBadge stock={10} />);
    const badge = screen.getByText(/10 und/);
    expect(badge.className).toContain('bg-green-500');
    expect(badge).toHaveTextContent('Stock normal');
  });

  it('debe mostrar color amarillo para stock entre 1 y 5', () => {
    render(<StockBadge stock={3} />);
    const badge = screen.getByText(/3 und/);
    expect(badge.className).toContain('bg-yellow-500');
    expect(badge).toHaveTextContent('Stock bajo');
  });

  it('debe mostrar color rojo para stock 0', () => {
    render(<StockBadge stock={0} />);
    const badge = screen.getByText(/0 und/);
    expect(badge.className).toContain('bg-red-500');
    expect(badge).toHaveTextContent('Sin stock');
  });
});