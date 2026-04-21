import { useState, useEffect } from 'react';
import { EscanerInput } from '../components/EscanerInput';
import { formatMoney } from '../utils/formatters';
import api from '../services/api';


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
    return <div className="text-center py-10">Cargando...</div>;
  }

  return (
    <div className="w-full">
      <div className="w-full">
        {/* Título con más espacio inferior */}
        <h1 className="text-3xl md:text-4xl font-bold mb-10">🛒 Punto de Venta</h1>
        
        {/* Selector de sucursal - más padding y margen */}
        <div className="mb-10 p-6 bg-blue-50 rounded-2xl border border-blue-100">
          <label className="font-bold text-lg mr-4">📍 Sucursal:</label>
          <select
            value={sucursalId || ''}
            onChange={(e) => setSucursalId(parseInt(e.target.value))}
            className="p-3 border rounded-xl text-base"
          >
            {sucursales.map(suc => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>
        
        {/* Grid con más espacio entre columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
          
          {/* Columna izquierda */}
          <div className="space-y-8">
            {/* Escáner */}
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
              <EscanerInput 
                onProductoEncontrado={handleProductoEncontrado} 
                placeholder="Escanea el código de barras..."
              />
            </div>
            
            {/* Método de pago */}
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
              <h2 className="text-xl font-bold mb-6">💳 Método de pago</h2>
              <div className="flex gap-6">
                <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 flex-1">
                  <input
                    type="radio"
                    value="efectivo"
                    checked={tipoPago === 'efectivo'}
                    onChange={() => setTipoPago('efectivo')}
                    className="w-5 h-5"
                  />
                  <span className="font-medium text-lg">💰 Efectivo</span>
                </label>
                <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 flex-1">
                  <input
                    type="radio"
                    value="tarjeta"
                    checked={tipoPago === 'tarjeta'}
                    onChange={() => setTipoPago('tarjeta')}
                    className="w-5 h-5"
                  />
                  <span className="font-medium text-lg">💳 Tarjeta</span>
                </label>
              </div>
            </div>
          </div>
          
          {/* Columna derecha - Carrito */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">🛍️ Carrito</h2>
            
            {carrito.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-6xl mb-4">🛒</p>
                <p className="text-xl">No hay productos en el carrito</p>
                <p className="text-base mt-3">Escanea un código para comenzar</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 max-h-96 overflow-y-auto mb-6 pr-2">
                  {carrito.map((item, index) => (
                    <div key={index} className="border rounded-xl p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg">{item.nombre}</p>
                          <p className="text-base text-gray-600 mt-1">
                            {formatMoney(tipoPago === 'efectivo' ? item.precioEfectivo : item.precioTarjeta)} c/u
                          </p>
                        </div>
                        <button
                          onClick={() => eliminarItem(index)}
                          className="text-red-500 hover:text-red-700 text-xl"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-6 mt-3">
                        <div className="flex items-center gap-3">
                          <label className="text-base font-medium">Cantidad:</label>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => actualizarCantidad(index, parseInt(e.target.value))}
                            className="w-20 p-2 border rounded-lg text-center text-base"
                            min="1"
                            max={item.stockDisponible}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-base font-medium">Descuento:</label>
                          <input
                            type="number"
                            value={item.descuento}
                            onChange={(e) => actualizarDescuento(index, parseInt(e.target.value))}
                            className="w-20 p-2 border rounded-lg text-center text-base"
                            min="0"
                            max="100"
                          />
                          <span className="text-base">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-6 space-y-5">
                  <div className="flex justify-between text-2xl font-bold">
                    <span>Total:</span>
                    <span className="text-blue-600">{formatMoney(calcularTotal())}</span>
                  </div>
                  <button
                    onClick={handleFinalizarVenta}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all"
                  >
                    ✅ Finalizar venta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}