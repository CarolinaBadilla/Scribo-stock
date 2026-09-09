import { useState, useEffect } from 'react';
import { EscanerInput } from '../components/EscanerInput';
import { formatMoney } from '../utils/formatters';
import api from '../services/api';
import { toast } from 'sonner';

export function Ventas() {
  const [carrito, setCarrito] = useState([]);
  const [tipoPago, setTipoPago] = useState('efectivo');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarSucursales();
  }, []);

  const cargarSucursales = async () => {
    try {
      const response = await api.get('/sucursales');
      setSucursales(response.data);
      if (response.data.length > 0) {
        setSucursalId(response.data[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error cargando sucursales:', error);
      setLoading(false);
    }
  };

  const handleProductoEncontrado = async (codigo) => {
    try {
      const response = await api.get(`/productos/buscar?codigo=${codigo}&sucursal=${sucursalId}`);
      const producto = response.data;
      
      if (producto.cantidad <= 0) {
        toast.error(`❌ No hay stock de ${producto.nombre_producto}`);
        return;
      }
      
      agregarAlCarrito(producto);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('❌ Producto no encontrado');
      } else {
        console.error('Error:', error);
      }
    }
  };

  const agregarAlCarrito = (producto) => {
    const precioEfectivo = producto.precio_efectivo || 0;
    const precioTarjeta = producto.precio_tarjeta || precioEfectivo;
    
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
        precioEfectivo: precioEfectivo,
        precioTarjeta: precioTarjeta,
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

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => {
      const precioBase = tipoPago === 'efectivo' ? (item.precioEfectivo || 0) : (item.precioTarjeta || 0);
      const precioConDescuento = precioBase * (1 - (item.descuento || 0) / 100);
      return sum + (precioConDescuento * (item.cantidad || 0));
    }, 0);
  };

  const handleFinalizarVenta = async () => {
    if (carrito.length === 0) {
      alert('Agregá productos al carrito primero');
      return;
    }

    const confirmar = confirm(`Total: ${formatMoney(calcularTotal())}\n¿Confirmar venta?`);
    if (!confirmar) return;

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      await api.post('/ventas/registrar', {
        sucursalId,
        tipoPago,
        items: carrito.map(item => ({
          tipoProducto: item.tipo,
          productoId: item.id,
          cantidad: item.cantidad,
          precioUnitario: tipoPago === 'efectivo' ? item.precioEfectivo : item.precioTarjeta,
          descuento: item.descuento
        })),
        usuarioId: user.id
      });
      
      toast.success('✅ Venta registrada correctamente');
      setCarrito([]);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al registrar la venta');
    }
  };

  if (loading) {
    return <div className="text-center py-10 font-bold text-base text-[#8a7a6a]">Cargando Punto de Venta...</div>;
  }

  return (
    <div className="w-full space-y-4">
      
      {/* Encabezado Panorámico */}
      <div className="flex items-center justify-between bg-[#fefcf8] px-6 py-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight">
            🛒 Punto de Venta
          </h1>
          <span className="text-sm font-bold text-[#8a7a6a] hidden md:inline">
            — Emisión de tickets e ingreso rápido de mercadería
          </span>
        </div>
        
        <div className="flex items-center gap-3 bg-[#f5f0e8] px-4 py-2 rounded-xl border border-[#e2d8cc]">
          <span className="font-bold text-xs uppercase tracking-wider text-[#5a4a3a]">📍 Sucursal:</span>
          <select
            value={sucursalId || ''}
            onChange={(e) => setSucursalId(parseInt(e.target.value))}
            className="bg-transparent font-bold text-base text-[#5a4a3a] focus:outline-none cursor-pointer"
          >
            {sucursales.map(suc => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Grilla Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
        
        {/* Columna Izquierda */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Lectura de Código (Sin flex-1 para que se ajuste exactamente al contenido) */}
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a] mb-2.5">
              Ingreso de Productos
            </h2>
            <EscanerInput 
              onProductoEncontrado={handleProductoEncontrado} 
              placeholder="Escanea el código de barras o escríbelo..."
            />
          </div>
          
          {/* Forma de Pago */}
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a] mb-2.5">
              Método de Pago
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setTipoPago('efectivo')}
                style={{ 
                  backgroundColor: tipoPago === 'efectivo' ? '#5a4a3a' : '#ffffff',
                  color: tipoPago === 'efectivo' ? '#ffffff' : '#5a4a3a',
                  borderColor: tipoPago === 'efectivo' ? '#43372b' : '#e2d8cc'
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 border rounded-xl transition-all text-sm font-bold shadow-xs cursor-pointer"
              >
                <span>💰 Efectivo</span>
              </button>

              <button 
                type="button"
                onClick={() => setTipoPago('tarjeta')}
                style={{ 
                  backgroundColor: tipoPago === 'tarjeta' ? '#5a4a3a' : '#ffffff',
                  color: tipoPago === 'tarjeta' ? '#ffffff' : '#5a4a3a',
                  borderColor: tipoPago === 'tarjeta' ? '#43372b' : '#e2d8cc'
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 border rounded-xl transition-all text-sm font-bold shadow-xs cursor-pointer"
              >
                <span>💳 Tarjeta</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Columna Derecha: Carrito */}
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
                {carrito.map((item, index) => (
                  <div key={index} className="bg-[#f5f0e8]/50 border border-[#e2d8cc] rounded-xl p-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-[#5a4a3a] truncate">{item.nombre}</p>
                      <p className="text-xs font-semibold text-[#8a7a6a]">
                        {formatMoney(tipoPago === 'efectivo' ? item.precioEfectivo : item.precioTarjeta)} c/u
                      </p>
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
                ))}
              </div>
            )}
          </div>
          
          {/* Pie del Carrito */}
          {carrito.length > 0 && (
            <div className="border-t border-[#e2d8cc] pt-4 mt-4 flex items-center justify-between gap-6">
              <div className="text-xl font-black text-[#5a4a3a]">
                Total: <span className="text-[#5a4a3a]">{formatMoney(calcularTotal())}</span>
              </div>
              <button
                onClick={handleFinalizarVenta}
                style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
                className="font-bold py-3 px-8 rounded-xl text-sm shadow-md hover:bg-[#43372b] transition-all cursor-pointer border border-[#43372b]"
              >
                ✅ Finalizar Venta ({formatMoney(calcularTotal())})
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}