import { describe, it, expect } from 'vitest';
import { obtenerPrecioAplicable, calcularVuelto } from './cartUtils';

describe('Cálculos de Precios y Vuelto en Ventas', () => {
  const itemMock = {
    id: 1,
    nombre: 'Cuaderno A4',
    cantidad: 2,
    precio_efectivo: 1000,
    precio_tarjeta: 1200,
    descuento: 0
  };

  it('debe usar precio_efectivo cuando el método es efectivo', () => {
    const precio = obtenerPrecioAplicable(itemMock, 'efectivo');
    expect(precio).toBe(1000);
  });

  it('debe usar precio_tarjeta cuando el método es mercadopago, qr, tarjeta o posnet', () => {
    expect(obtenerPrecioAplicable(itemMock, 'mercadopago')).toBe(1200);
    expect(obtenerPrecioAplicable(itemMock, 'qr')).toBe(1200);
    expect(obtenerPrecioAplicable(itemMock, 'tarjeta')).toBe(1200);
    expect(obtenerPrecioAplicable(itemMock, 'posnet')).toBe(1200);
  });

  it('debe calcular el vuelto correctamente cuando el cliente abona con más dinero', () => {
    const { vuelto, montoInsuficiente } = calcularVuelto(2000, '2500');
    expect(montoInsuficiente).toBe(false);
    expect(vuelto).toBe(500);
  });

  it('debe detectar monto insuficiente si se ingresa un valor menor al total', () => {
    const { montoInsuficiente, faltante } = calcularVuelto(2000, '1500');
    expect(montoInsuficiente).toBe(true);
    expect(faltante).toBe(500);
  });

  it('debe asumir pago exacto y vuelto $0 si el campo de monto recibido queda vacío', () => {
    const { esPagoExacto, montoInsuficiente, vuelto } = calcularVuelto(2000, '');
    expect(esPagoExacto).toBe(true);
    expect(montoInsuficiente).toBe(false);
    expect(vuelto).toBe(0);
  });
});
