import { useState, useEffect } from 'react';
import api from '../services/api';
import { EscanerInput } from '../components/EscanerInput';
import { formatMoney } from '../utils/formatters';

export function Compras() {
  const [items, setItems] = useState([]);
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [precioCompra, setPrecioCompra] = useState(0);
  const [proveedor, setProveedor] = useState('');
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
      if (response.data.length > 0) setSucursalId(response.data[0].id);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const handleProductoEncontrado = async (codigo) => {
    try {
      const response = await api.get(`/productos/buscar?codigo=${codigo}&sucursal=${sucursalId}`);
      const productoData = response.data;
      setProducto({ id: productoData.producto_id, tipo: productoData.tipo_producto, nombre: productoData.nombre_producto, precio_venta: productoData.precio_efectivo });
      setPrecioCompra(productoData.precio_efectivo * 0.6);
    } catch (error) {
      if (error.response?.status === 404) alert('Producto no encontrado');
      else console.error('Error:', error);
    }
  };

  if (loading) return <div className="text-center py-10">Cargando...</div>;

  return (
    <div className="w-full">
      <div className="w-full">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">📦 Registrar Compra a Proveedor</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold mb-4">Agregar productos</h2>
            <EscanerInput onProductoEncontrado={handleProductoEncontrado} placeholder="Escanea el código de barras..." />
            {producto && (
              <div className="mt-4 border-t pt-4">
                <p className="font-bold">{producto.nombre}</p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-sm font-bold mb-1">Cantidad</label><input type="number" value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value))} className="w-full p-2 border rounded" min="1" /></div>
                  <div><label className="block text-sm font-bold mb-1">Precio compra</label><input type="number" value={precioCompra} onChange={(e) => setPrecioCompra(parseFloat(e.target.value))} className="w-full p-2 border rounded" /></div>
                </div>
                <button onClick={() => { setItems([...items, { id: Date.now(), productoId: producto.id, tipoProducto: producto.tipo, nombre: producto.nombre, cantidad, precioCompra, subtotal: cantidad * precioCompra }]); setProducto(null); setCantidad(1); setPrecioCompra(0); }} className="mt-3 w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">➕ Agregar a la compra</button>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold mb-4">🛒 Productos a comprar</h2>
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-2">📦</p><p>No hay productos agregados</p></div>
            ) : (
              <>
                <div className="max-h-80 overflow-y-auto mb-4 space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="border rounded-lg p-3 flex justify-between items-center">
                      <div><p className="font-bold">{item.nombre}</p><p className="text-sm text-gray-600">{item.cantidad} x {formatMoney(item.precioCompra)}</p></div>
                      <div className="text-right"><p className="font-bold">{formatMoney(item.subtotal)}</p><button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-red-500 text-sm">Eliminar</button></div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div><label className="block text-sm font-bold mb-1">Proveedor</label><input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="w-full p-2 border rounded" placeholder="Nombre del proveedor" /></div>
                  <div><label className="block text-sm font-bold mb-1">Sucursal</label><select value={sucursalId || ''} onChange={(e) => setSucursalId(parseInt(e.target.value))} className="w-full p-2 border rounded">{sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
                  <div className="flex justify-between text-xl font-bold"><span>Total:</span><span className="text-blue-600">{formatMoney(items.reduce((sum, i) => sum + i.subtotal, 0))}</span></div>
                  <button onClick={async () => { if (items.length === 0) { alert('Agregá productos'); return; } try { const user = JSON.parse(localStorage.getItem('user') || '{}'); await api.post('/compras/registrar', { sucursalId, items: items.map(item => ({ tipoProducto: item.tipoProducto, productoId: item.productoId, cantidad: item.cantidad, precioCompra: item.precioCompra })), proveedor, usuarioId: user.id }); alert('✅ Compra registrada'); setItems([]); setProveedor(''); } catch (error) { alert('Error al registrar'); } }} className="w-full bg-green-500 text-white py-3 rounded font-bold hover:bg-green-600">✅ Confirmar compra</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}