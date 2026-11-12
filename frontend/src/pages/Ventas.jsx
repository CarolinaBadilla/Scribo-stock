import { useState, useEffect } from 'react';
import { EscanerInput } from '../components/EscanerInput';
import { SelectorPago } from '../components/SelectorPago';
import { formatMoney } from '../utils/formatters';
import {
  esMetodoEfectivo,
  obtenerPrecioAplicable,
  calcularSubtotalItem,
  calcularTotalCarrito,
  formatearItemsVenta,
  calcularVuelto
} from '../utils/cartUtils';
import api from '../services/api';
import { toast } from 'sonner';

const IS_PAYMENTS_ENABLED = import.meta.env.VITE_ENABLE_PAYMENTS_MODULE === 'true';

export function Ventas() {
  const [carrito, setCarrito] = useState([]);
  const [tipoPago, setTipoPago] = useState('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarSelectorPago, setMostrarSelectorPago] = useState(false);

  useEffect(() => {
    cargarSucursales();
  }, []);

  const cargarSucursales = async () => {
    try {
      const response = await api.get('/sucursales');
      setSucursales(response.data);

      const user = JSON.parse(localStorage.getItem('usuario') || localStorage.getItem('user') || '{}');
      if (user.sucursalId) {
        setSucursalId(Number(user.sucursalId));
      } else if (response.data.length > 0) {
        setSucursalId(response.data[0].id);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const handleProductoEncontrado = async (codigo) => {
    try {
      const response = await api.get(`/productos/buscar?codigo=${encodeURIComponent(codigo)}&sucursal=${sucursalId}`);
      const producto = response.data;

      if (!producto?.producto_id) {
        toast.error('❌ Producto no encontrado');
        return;
      }

      if (Number(producto.cantidad) <= 0) {
        toast.warning(`⚠️ "${producto.nombre_producto}" existe pero tiene 0 unidades en esta sucursal`);
        return;
      }

      agregarAlCarrito(producto);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('❌ Producto no encontrado en el catálogo');
      } else {
        toast.error('Error al consultar el producto');
      }
    }
  };

  const agregarAlCarrito = (producto) => {
    const precioEfectivo = Number(producto.precio_efectivo) || 0;
    const precioTarjeta = Number(producto.precio_tarjeta || producto.precio_efectivo) || precioEfectivo;
    
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.producto_id && item.tipo === producto.tipo_producto);
      if (existe) {
        return prev.map(item =>
          item.id === producto.producto_id && item.tipo === producto.tipo_producto
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, {
        id: producto.producto_id,
        tipo: producto.tipo_producto,
        nombre: producto.nombre_producto,
        cantidad: 1,
        precioEfectivo,
        precioTarjeta,
        precio_efectivo: precioEfectivo,
        precio_tarjeta: precioTarjeta,
        descuento: 0,
        stockDisponible: producto.cantidad
      }];
    });
  };

  const actualizarCantidad = (index, nuevaCantidad) => {
    if (nuevaCantidad < 1) return;
    if (nuevaCantidad > carrito[index].stockDisponible) {
      alert(`Solo hay ${carrito[index].stockDisponible} unidades disponibles`);
      return;
    }
    const nuevoCarrito = [...carrito];
    nuevoCarrito[index].cantidad = nuevaCantidad;
    setCarrito(nuevoCarrito);
  };

  const actualizarDescuento = (index, descuento) => {
    const nuevoCarrito = [...carrito];
    nuevoCarrito[index].descuento = Math.min(100, Math.max(0, descuento));
    setCarrito(nuevoCarrito);
  };

  const eliminarItem = (index) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  // Valores derivados del render
  const esEfectivo = esMetodoEfectivo(tipoPago);
  const totalVenta = calcularTotalCarrito(carrito, tipoPago);
  const { recibidoNum, esPagoExacto, vuelto, montoInsuficiente, faltante } = calcularVuelto(totalVenta, montoRecibido);

  const handleFinalizarVenta = async () => {
    if (carrito.length === 0) {
      alert('Agregá productos al carrito primero');
      return;
    }

    if (esEfectivo && montoInsuficiente) {
      toast.error(`⚠️ Monto insuficiente. Faltan ${formatMoney(faltante)}`);
      return;
    }

    if (IS_PAYMENTS_ENABLED) {
      setMostrarSelectorPago(true);
      return;
    }

    const detalleVuelto = esEfectivo && !esPagoExacto 
      ? `\nAbona con: ${formatMoney(recibidoNum)}\nVuelto: ${formatMoney(vuelto)}` 
      : '';
    const confirmar = confirm(`Total: ${formatMoney(totalVenta)}${detalleVuelto}\n¿Confirmar venta?`);
    if (!confirmar) return;

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await api.post('/ventas/registrar', {
        sucursalId,
        tipoPago,
        items: formatearItemsVenta(carrito, tipoPago),
        usuarioId: user.id
      });
      
      const mensajeExito = esEfectivo && !esPagoExacto && vuelto > 0
        ? `✅ Venta registrada correctamente. Vuelto a entregar: ${formatMoney(vuelto)}`
        : '✅ Venta registrada correctamente';

      toast.success(mensajeExito);
      setCarrito([]);
      setMontoRecibido('');
    } catch {
      alert('Error al registrar la venta');
    }
  };

  if (loading) {
    return <div className="text-center py-10 font-bold text-base text-[#8a7a6a]">Cargando Punto de Venta...</div>;
  }

  return (
    <div className="w-full space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between bg-[#fefcf8] px-6 py-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight">🛒 Punto de Venta</h1>
          <span className="text-sm font-bold text-[#8a7a6a] hidden md:inline">
            — Emisión de tickets e ingreso rápido de mercadería
          </span>
        </div>
        
        <div className="flex items-center gap-3 bg-[#f5f0e8] px-4 py-2 rounded-xl border border-[#e2d8cc]">
          <span className="font-bold text-xs uppercase tracking-wider text-[#5a4a3a]">📍 Sucursal:</span>
          {(() => {
            const user = JSON.parse(localStorage.getItem('usuario') || localStorage.getItem('user') || '{}');
            const esJefe = user.rol === 'jefe' || user.rol === 'DUENO';

            return (
              <select
                value={sucursalId || ''}
                onChange={(e) => setSucursalId(parseInt(e.target.value))}
                disabled={!esJefe}
                className={`bg-transparent font-bold text-base text-[#5a4a3a] focus:outline-none ${
                  esJefe ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                }`}
              >
                {sucursales.map(suc => (
                  <option key={suc.id} value={suc.id}>{suc.nombre}</option>
                ))}
              </select>
            );
          })()}
        </div>
      </div>
      
      {/* Grilla Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a] mb-2.5">Ingreso de Productos</h2>
            <EscanerInput onProductoEncontrado={handleProductoEncontrado} />
          </div>
          
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">Método de Pago</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#f5f0e8] border border-[#e2d8cc] text-[#5a4a3a]">
                {esEfectivo ? '🏷️ Tarifa Efectivo' : '💳 Tarifa Tarjeta'}
              </span>
            </div>

            <div className={`grid ${IS_PAYMENTS_ENABLED ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
              <button 
                type="button"
                onClick={() => setTipoPago('efectivo')}
                style={{ 
                  backgroundColor: tipoPago === 'efectivo' ? '#5a4a3a' : '#ffffff',
                  color: tipoPago === 'efectivo' ? '#ffffff' : '#5a4a3a',
                  borderColor: tipoPago === 'efectivo' ? '#43372b' : '#e2d8cc'
                }}
                className="flex items-center justify-center gap-1 py-3 px-2 border rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <span>💵 Efectivo</span>
              </button>

              {IS_PAYMENTS_ENABLED && (
                <button 
                  type="button"
                  onClick={() => setTipoPago('mercadopago')}
                  style={{ 
                    backgroundColor: tipoPago === 'mercadopago' ? '#5a4a3a' : '#ffffff',
                    color: tipoPago === 'mercadopago' ? '#ffffff' : '#5a4a3a',
                    borderColor: tipoPago === 'mercadopago' ? '#43372b' : '#e2d8cc'
                  }}
                  className="flex items-center justify-center gap-1 py-3 px-2 border rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  <span>📱 MP QR</span>
                </button>
              )}

              <button 
                type="button"
                onClick={() => setTipoPago('tarjeta')}
                style={{ 
                  backgroundColor: tipoPago === 'tarjeta' ? '#5a4a3a' : '#ffffff',
                  color: tipoPago === 'tarjeta' ? '#ffffff' : '#5a4a3a',
                  borderColor: tipoPago === 'tarjeta' ? '#43372b' : '#e2d8cc'
                }}
                className="flex items-center justify-center gap-1 py-3 px-2 border rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <span>💳 {IS_PAYMENTS_ENABLED ? 'Posnet' : 'Tarjeta'}</span>
              </button>
            </div>

            {esEfectivo && (
              <div className="mt-3.5 pt-3 border-t border-[#e2d8cc]/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5a4a3a]">
                    💵 Con cuánto abona:
                  </label>
                  <span className="text-[10px] font-semibold text-[#8a7a6a]">
                    {esPagoExacto ? 'Pago exacto' : `Abona: ${formatMoney(recibidoNum)}`}
                  </span>
                </div>
                
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-[#5a4a3a]">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    placeholder={`Pago exacto (${formatMoney(totalVenta)})`}
                    className={`w-full pl-6 pr-3 py-2 bg-white border rounded-xl text-xs font-bold text-[#5a4a3a] focus:outline-none ${
                      montoInsuficiente ? 'border-rose-400 ring-1 ring-rose-200' : 'border-[#e2d8cc] focus:border-[#5a4a3a]'
                    }`}
                  />
                </div>

                {montoInsuficiente ? (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-bold flex items-center justify-between">
                    <span>⚠️ Monto insuficiente</span>
                    <span>Faltan {formatMoney(faltante)}</span>
                  </div>
                ) : (
                  !esPagoExacto && vuelto > 0 && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] font-bold flex items-center justify-between">
                      <span>🪙 Vuelto a entregar:</span>
                      <span className="text-xs font-black">{formatMoney(vuelto)}</span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Carrito */}
        <div className="lg:col-span-7 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e2d8cc]/60 mb-4">
              <h2 className="text-sm font-bold text-[#5a4a3a] uppercase tracking-wider">🛍️ Carrito de Compra</h2>
              <span className="text-xs font-bold text-[#8a7a6a] bg-[#f5f0e8] px-3 py-1 rounded-lg border border-[#e2d8cc]">
                {carrito.length} {carrito.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>
            
            {carrito.length === 0 ? (
              <div className="text-center py-12 text-[#8a7a6a]">
                <p className="text-4xl mb-2">🛒</p>
                <p className="text-base font-bold text-[#5a4a3a]">El carrito está vacío</p>
                <p className="text-xs mt-1">Escanea un código de barras para comenzar la venta</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {carrito.map((item, index) => {
                  const precioUnit = obtenerPrecioAplicable(item, tipoPago);
                  const subtotalItem = calcularSubtotalItem(item, tipoPago);

                  return (
                    <div key={index} className="bg-[#f5f0e8]/50 border border-[#e2d8cc] rounded-xl p-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base text-[#5a4a3a] truncate">{item.nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-semibold text-[#8a7a6a]">
                            {formatMoney(precioUnit)} c/u
                          </span>
                          <span className="text-xs font-bold text-[#5a4a3a]">
                            = {formatMoney(subtotalItem)}
                          </span>
                          {!esEfectivo && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-bold">
                              Tarifa Tarjeta
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-[#8a7a6a]">Cant:</label>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => actualizarCantidad(index, parseInt(e.target.value) || 1)}
                            className="w-14 p-1 border border-[#e2d8cc] rounded-lg text-center text-sm font-bold bg-white text-[#5a4a3a]"
                            min="1"
                            max={item.stockDisponible}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-[#8a7a6a]">Desc:</label>
                          <input
                            type="number"
                            value={item.descuento}
                            onChange={(e) => actualizarDescuento(index, parseInt(e.target.value) || 0)}
                            className="w-14 p-1 border border-[#e2d8cc] rounded-lg text-center text-sm font-bold bg-white text-[#5a4a3a]"
                            min="0"
                            max="100"
                          />
                          <span className="text-xs font-bold text-[#8a7a6a]">%</span>
                        </div>

                        <button
                          onClick={() => eliminarItem(index)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold bg-white border border-rose-200 px-2 py-1 rounded-lg cursor-pointer ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {carrito.length > 0 && (
            <div className="border-t border-[#e2d8cc] pt-4 mt-4 flex items-center justify-between gap-6">
              <div className="text-xl font-black text-[#5a4a3a]">
                Total: <span>{formatMoney(totalVenta)}</span>
                <span className="text-xs font-semibold text-[#8a7a6a] ml-2 block sm:inline">
                  ({esEfectivo ? 'Tarifa Efectivo' : 'Tarifa Tarjeta / MP'})
                </span>
              </div>
              <button
                onClick={handleFinalizarVenta}
                disabled={montoInsuficiente}
                style={{ 
                  backgroundColor: montoInsuficiente ? '#a89d91' : '#5a4a3a', 
                  color: '#ffffff' 
                }}
                className="font-bold py-3 px-8 rounded-xl text-sm shadow-md hover:bg-[#43372b] transition-all cursor-pointer border border-[#43372b] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {montoInsuficiente 
                  ? `⚠️ Monto insuficiente (${formatMoney(totalVenta)})` 
                  : `✅ Finalizar Venta (${formatMoney(totalVenta)})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {IS_PAYMENTS_ENABLED && (
        <SelectorPago
          isOpen={mostrarSelectorPago}
          onClose={() => setMostrarSelectorPago(false)}
          carrito={carrito}
          sucursalId={sucursalId}
          sucursales={sucursales}
          metodoInicial={tipoPago === 'mercadopago' ? 'qr' : (tipoPago === 'tarjeta' ? 'posnet' : 'efectivo')}
          montoRecibidoInicial={montoRecibido}
          onVentaCompletada={() => {
            setCarrito([]);
            setMontoRecibido('');
            setMostrarSelectorPago(false);
          }}
        />
      )}
    </div>
  );
}
