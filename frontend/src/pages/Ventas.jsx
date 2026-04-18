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
        alert(`❌ No hay stock de ${producto.nombre_producto}`);
        return;
      }
      
      agregarAlCarrito(producto);
    } catch (error) {
      if (error.response?.status === 404) {
        alert('❌ Producto no encontrado');
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
      
      alert('✅ Venta registrada correctamente');
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">🛒 Punto de Venta</h1>
        
        <div className="mb-6 p-4 bg-blue-50 rounded-xl">
          <label className="font-bold mr-3">📍 Sucursal:</label>
          <select
            value={sucursalId || ''}
            onChange={(e) => setSucursalId(parseInt(e.target.value))}
            className="p-2 border rounded-lg"
          >
            {sucursales.map(suc => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <EscanerInput 
                onProductoEncontrado={handleProductoEncontrado} 
                placeholder="Escanea el código de barras..."
              />
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">💳 Método de pago</h2>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 flex-1">
                  <input
                    type="radio"
                    value="efectivo"
                    checked={tipoPago === 'efectivo'}
                    onChange={() => setTipoPago('efectivo')}
                  />
                  <span className="font-medium">💰 Efectivo</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 flex-1">
                  <input
                    type="radio"
                    value="tarjeta"
                    checked={tipoPago === 'tarjeta'}
                    onChange={() => setTipoPago('tarjeta')}
                  />
                  <span className="font-medium">💳 Tarjeta</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold mb-4">🛍️ Carrito</h2>
            
            {carrito.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-2">🛒</p>
                <p>No hay productos en el carrito</p>
                <p className="text-sm mt-1">Escanea un código para comenzar</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                  {carrito.map((item, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{item.nombre}</p>
                          <p className="text-sm text-gray-600">
                            {formatMoney(tipoPago === 'efectivo' ? item.precioEfectivo : item.precioTarjeta)} c/u
                          </p>
                        </div>
                        <button
                          onClick={() => setCarrito(carrito.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Cant:</label>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => {
                              const nuevaCantidad = parseInt(e.target.value);
                              if (nuevaCantidad > 0 && nuevaCantidad <= item.stockDisponible) {
                                const nuevoCarrito = [...carrito];
                                nuevoCarrito[index].cantidad = nuevaCantidad;
                                setCarrito(nuevoCarrito);
                              }
                            }}
                            className="w-16 p-1 border rounded text-center"
                            min="1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Dto %:</label>
                          <input
                            type="number"
                            value={item.descuento}
                            onChange={(e) => {
                              const nuevoCarrito = [...carrito];
                              nuevoCarrito[index].descuento = Math.min(100, parseInt(e.target.value) || 0);
                              setCarrito(nuevoCarrito);
                            }}
                            className="w-16 p-1 border rounded text-center"
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total:</span>
                    <span className="text-blue-600">{formatMoney(calcularTotal())}</span>
                  </div>
                  <button
                    onClick={handleFinalizarVenta}
                    className="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 transition"
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