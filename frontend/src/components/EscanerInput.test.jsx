// src/components/EscanerInput.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EscanerInput } from './EscanerInput';

describe('EscanerInput', () => {
  it('debe renderizar el input', () => {
    render(<EscanerInput onProductoEncontrado={() => {}} />);
    expect(screen.getByPlaceholderText(/acerca el producto/i)).toBeDefined();
  });

  it('debe llamar a onProductoEncontrado cuando se presiona Enter', () => {
    const mockFn = vi.fn();
    render(<EscanerInput onProductoEncontrado={mockFn} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(mockFn).toHaveBeenCalledWith('123456');
  });
});