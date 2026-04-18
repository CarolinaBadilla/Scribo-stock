// src/pages/CargaRapida.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';

export function CargaRapida() {
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [tipoMovimiento, setTipoMovimiento] = useState('agregar');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar sucursales desde la API
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
    } catch (error) {
      console.error('Error cargando sucursales:', error);
    }
  };

  const handleProductoEncontrado = async (codigo) => {
    setLoading(true);
    setError('');
    setProducto(null);
    
    try {
      console.log('Buscando código:', codigo, 'en sucursal:', sucursalId);
      
      const response = await api.get(`/productos/buscar?codigo=${codigo}&sucursal=${sucursalId}`);
      
      console.log('Respuesta de la API:', response.data);
      
      if (response.data && response.data.nombre_producto) {
        setProducto(response.data);
      } else {
        setError('Producto no encontrado o sin stock');
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.response?.status === 404) {
        setError('Producto no encontrado. Verificá el código de barras.');
      } else {
        setError('Error al buscar el producto. Revisá la conexión.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    if (!producto) return;

    try {
      if (tipoMovimiento === 'agregar') {
        await api.post('/stock/agregar', {
          tipoProducto: producto.tipo_producto,
          productoId: producto.producto_id,
          cantidad: cantidad,
          sucursalId: sucursalId
        });
        alert(`✅ Agregadas ${cantidad} unidades de ${producto.nombre_producto}`);
      } else {
        await api.post('/compras/registrar', {
          sucursalId: sucursalId,
          items: [{
            tipoProducto: producto.tipo_producto,
            productoId: producto.producto_id,
            cantidad: cantidad,
            precioCompra: producto.precio_compra || producto.precio_efectivo * 0.6
          }]
        });
        alert(`✅ Compra registrada: ${cantidad} unidades de ${producto.nombre_producto}`);
      }
      
      setProducto(null);
      setCantidad(1);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar la operación');
    }
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">⚡ Carga rápida de stock</h1>
        
        {/* Selector de sucursal desde BD */}
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
        
        {/* Input del escáner */}
        <div className="bg-yellow-100 p-6 rounded-xl mb-6">
          <label className="block text-lg font-bold mb-2">
            📷 Escanea el código de barras:
          </label>
          <input
            type="text"
            id="escaner-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleProductoEncontrado(e.target.value);
                e.target.value = '';
              }
            }}
            placeholder="Acerca el producto al escáner..."
            className="w-full p-4 text-2xl border-2 rounded-lg font-mono"
            autoFocus
          />
          <p className="text-sm text-gray-600 mt-2">
            💡 El escáner escribe el código y presiona Enter automáticamente
          </p>
        </div>
        
        {/* Loading y errores */}
        {loading && (
          <div className="text-center py-8 text-gray-500">
            Buscando producto...
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        {/* Producto encontrado */}
        {producto && !loading && (
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-500">
            <h2 className="text-xl font-bold mb-4">📦 Producto encontrado</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-500 text-sm">Nombre</p>
                <p className="font-bold">{producto.nombre_producto || 'Sin nombre'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Tipo</p>
                <p>{producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Stock actual</p>
                <p>{producto.cantidad || 0} unidades</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Precio efectivo</p>
                <p className="font-bold">${producto.precio_efectivo?.toLocaleString() || 0}</p>
              </div>
              {producto.tipo_producto === 'ropa' && (
                <>
                  <div>
                    <p className="text-gray-500 text-sm">Colegio</p>
                    <p>{producto.colegio || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Talle/Color</p>
                    <p>{producto.talle || '-'} / {producto.color || '-'}</p>
                  </div>
                </>
              )}
              {producto.tipo_producto === 'libro' && (
                <>
                  <div>
                    <p className="text-gray-500 text-sm">Autor</p>
                    <p>{producto.autor || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Editorial</p>
                    <p>{producto.editorial || '-'}</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="border-t pt-4">
              <label className="block font-bold mb-2">Tipo de operación:</label>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="agregar"
                    checked={tipoMovimiento === 'agregar'}
                    onChange={() => setTipoMovimiento('agregar')}
                  />
                  <span>➕ Solo agregar stock</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="compra"
                    checked={tipoMovimiento === 'compra'}
                    onChange={() => setTipoMovimiento('compra')}
                  />
                  <span>🛒 Registrar nueva compra</span>
                </label>
              </div>
              
              <label className="block font-bold mb-2">Cantidad:</label>
              <input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value))}
                className="border p-2 rounded w-32 text-center mb-4"
                min="1"
              />
              
              <button
                onClick={handleConfirmar}
                className="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 transition"
              >
                ✅ Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}