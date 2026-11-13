// frontend/src/utils/cartUtils.js

export const esMetodoEfectivo = (metodo) => metodo === 'efectivo';

/**
 * Obtiene el precio unitario correspondiente según el método de pago:
 * - 'efectivo' -> precio_efectivo
 * - otros ('tarjeta', 'mercadopago', 'qr', 'posnet') -> precio_tarjeta (con fallback a precio_efectivo)
 */
export const obtenerPrecioAplicable = (producto, metodoPago = 'efectivo') => {
  if (!producto) return 0;
  if (esMetodoEfectivo(metodoPago)) {
    return Number(producto.precio_efectivo ?? producto.precioEfectivo ?? 0);
  }
  return Number(producto.precio_tarjeta ?? producto.precioTarjeta ?? producto.precio_efectivo ?? producto.precioEfectivo ?? 0);
};

export const calcularSubtotalItem = (item, metodoPago = 'efectivo') => {
  const precioUnitario = obtenerPrecioAplicable(item, metodoPago);
  const cantidad = Number(item.cantidad) || 0;
  const descuento = Number(item.descuento) || 0;
  return precioUnitario * cantidad * (1 - descuento / 100);
};

export const calcularTotalCarrito = (carrito, metodoPago = 'efectivo') => {
  if (!Array.isArray(carrito)) return 0;
  return carrito.reduce((sum, item) => sum + calcularSubtotalItem(item, metodoPago), 0);
};

/**
 * Genera el detalle de ítems normalizado para el payload de /ventas/registrar
 */
export const formatearItemsVenta = (carrito, metodoPago = 'efectivo') => {
  if (!Array.isArray(carrito)) return [];
  return carrito.map(item => {
    const precio = obtenerPrecioAplicable(item, metodoPago);
    return {
      tipoProducto: item.tipo,
      categoria: item.categoria || item.tipo,
      productoId: item.id || null,
      producto_unificado_id: item.producto_unificado_id || item.id || null,
      nombre: item.nombre || 'Varios',
      descripcion: item.nombre || 'Varios',
      cantidad: item.cantidad,
      precioUnitario: precio,
      precio_unitario: precio,
      descuento: item.descuento || 0,
      es_temporal: Boolean(item.es_temporal)
    };
  });
};

/**
 * Calcula el vuelto y valida si el monto ingresado cubre el total de la venta
 */
export const calcularVuelto = (totalVenta, montoRecibido) => {
  const recibidoNum = typeof montoRecibido === 'string' && montoRecibido.trim() === ''
    ? null
    : (montoRecibido !== null && montoRecibido !== undefined && !isNaN(montoRecibido) ? parseFloat(montoRecibido) : null);

  const esPagoExacto = recibidoNum === null || isNaN(recibidoNum);
  const vuelto = esPagoExacto ? 0 : Math.max(0, recibidoNum - totalVenta);
  const montoInsuficiente = !esPagoExacto && recibidoNum < totalVenta;
  const faltante = montoInsuficiente ? totalVenta - recibidoNum : 0;

  return { recibidoNum, esPagoExacto, vuelto, montoInsuficiente, faltante };
};
