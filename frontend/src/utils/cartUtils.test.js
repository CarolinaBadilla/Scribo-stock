// src/utils/cartUtils.test.js
import { describe, it, expect } from 'vitest';

// Esta función debería estar en un archivo utils
const calcularTotalCarrito = (carrito, tipoPago) => {
  return carrito.reduce((sum, item) => {
    const precio = tipoPago === 'efectivo' ? item.precioEfectivo : item.precioTarjeta;
    const precioConDescuento = precio * (1 - (item.descuento || 0) / 100);
    return sum + (precioConDescuento * item.cantidad);
  }, 0);
};

describe('calcularTotalCarrito', () => {
  it('debe calcular total sin descuentos', () => {
    const carrito = [
      { precioEfectivo: 1000, precioTarjeta: 1100, cantidad: 2, descuento: 0 }
    ];
    expect(calcularTotalCarrito(carrito, 'efectivo')).toBe(2000);
    expect(calcularTotalCarrito(carrito, 'tarjeta')).toBe(2200);
  });

  it('debe aplicar descuentos correctamente', () => {
    const carrito = [
      { precioEfectivo: 1000, precioTarjeta: 1100, cantidad: 2, descuento: 10 }
    ];
    expect(calcularTotalCarrito(carrito, 'efectivo')).toBe(1800); // 1000 * 0.9 * 2
  });

  it('debe sumar múltiples items', () => {
    const carrito = [
      { precioEfectivo: 1000, precioTarjeta: 1100, cantidad: 1, descuento: 0 },
      { precioEfectivo: 2000, precioTarjeta: 2200, cantidad: 1, descuento: 0 }
    ];
    expect(calcularTotalCarrito(carrito, 'efectivo')).toBe(3000);
  });

  it('debe manejar carrito vacío', () => {
    expect(calcularTotalCarrito([], 'efectivo')).toBe(0);
  });
});