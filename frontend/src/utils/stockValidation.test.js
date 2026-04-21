// src/utils/stockValidation.test.js
import { describe, it, expect } from 'vitest';

const validarStock = (producto, cantidadSolicitada) => {
  if (!producto) return { valido: false, mensaje: 'Producto no encontrado' };
  if (producto.cantidad <= 0) return { valido: false, mensaje: 'Producto sin stock' };
  if (cantidadSolicitada > producto.cantidad) {
    return { valido: false, mensaje: `Solo hay ${producto.cantidad} unidades disponibles` };
  }
  return { valido: true, mensaje: 'Stock disponible' };
};

describe('validarStock', () => {
  it('debe aceptar stock suficiente', () => {
    const producto = { cantidad: 10 };
    expect(validarStock(producto, 5).valido).toBe(true);
  });

  it('debe rechazar si no hay stock', () => {
    const producto = { cantidad: 0 };
    expect(validarStock(producto, 1).valido).toBe(false);
    expect(validarStock(producto, 1).mensaje).toContain('sin stock');
  });

  it('debe rechazar si la cantidad excede el stock', () => {
    const producto = { cantidad: 3 };
    expect(validarStock(producto, 5).valido).toBe(false);
    expect(validarStock(producto, 5).mensaje).toContain('Solo hay 3 unidades');
  });

  it('debe rechazar si producto no existe', () => {
    expect(validarStock(null, 1).valido).toBe(false);
    expect(validarStock(undefined, 1).mensaje).toContain('no encontrado');
  });
});