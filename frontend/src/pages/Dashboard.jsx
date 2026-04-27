import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { LeyendaColores } from '../components/LeyendaColores';
import { formatMoney } from '../utils/formatters';
import { ModalEditarProducto } from '../components/ModalEditarProducto';
import { ModalAgregarProducto } from '../components/ModalAgregarProducto';

export function Dashboard() {
  const [stock, setStock] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [productoEditando, setProductoEditando] = useState(null);
  const [tipoEditando, setTipoEditando] = useState(null);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  
  // Obtener el usuario y su rol
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const esJefe = user.rol === 'jefe';

  useEffect(() => {
    cargarSucursales();
  }, []);

  useEffect(() => {
    if (sucursalSeleccionada !== null) {
      cargarStock();
    }
  }, [sucursalSeleccionada, filtroTipo, busqueda]);

  const cargarSucursales = async () => {
    try {
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .order('id');
      
      if (error) throw error;
      
      setSucursales(data || []);
      if (data && data.length > 0) {
        setSucursalSeleccionada(data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error cargando sucursales:', error);
      setLoading(false);
    }
  };

  const cargarStock = async () => {
    if (!sucursalSeleccionada) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('vista_stock_completo')
        .select('*')
        .eq('sucursal_id', sucursalSeleccionada);
      
      if (filtroTipo !== 'todos') {
        query = query.eq('tipo_producto', filtroTipo);
      }
      
      if (busqueda) {
        query = query.ilike('nombre_producto', `%${busqueda}%`);
      }
      
      const { data, error } = await query.order('nombre_producto');
      
      if (error) throw error;
      
      setStock(data || []);
    } catch (error) {
      console.error('Error cargando stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const eliminarProducto = async (producto) => {
    if (!esJefe) {
      alert('Solo el jefe puede eliminar productos');
      return;
    }
    
    const confirmar = confirm(`¿Estás seguro de eliminar "${producto.nombre_producto}"?`);
    if (!confirmar) return;
    
    try {
      await supabase.from('stock').delete().eq('tipo_producto', producto.tipo_producto).eq('producto_id', producto.producto_id);
      await supabase.from('movimientos').delete().eq('tipo_producto', producto.tipo_producto).eq('producto_id', producto.producto_id);
      if (producto.tipo_producto === 'libro') {
        await supabase.from('libros').delete().eq('id', producto.producto_id);
      } else {
        await supabase.from('ropa').delete().eq('id', producto.producto_id);
      }
      alert('✅ Producto eliminado correctamente');
      cargarStock();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar producto');
    }
  };

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
      <div className="max-w-full mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl md:text-3xl font-bold">📊 Stock de la Librería</h1>
          <button onClick={() => setMostrarAgregar(true)} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2 transition text-sm md:text-base">
            ➕ Nuevo producto
          </button>
        </div>
        
        {sucursales.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl">
            <label className="font-bold mr-3">📍 Sucursal:</label>
            <select 
              value={sucursalSeleccionada || ''} 
              onChange={(e) => setSucursalSeleccionada(parseInt(e.target.value))} 
              className="p-2 border rounded-lg text-sm md:text-base"
            >
              {sucursales.map(suc => (
                <option key={suc.id} value={suc.id}>{suc.nombre}</option>
              ))}
            </select>
          </div>
        )}
        
        <LeyendaColores />
        
        <div className="mb-6 space-y-3">
          <input 
            type="text" 
            placeholder="🔍 Buscar por nombre de prenda o de libro" 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
            className="w-full p-3 border rounded-lg text-base" 
          />
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setFiltroTipo('todos')} 
              className={`px-4 py-2 rounded transition text-sm ${filtroTipo === 'todos' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFiltroTipo('libro')} 
              className={`px-4 py-2 rounded transition text-sm ${filtroTipo === 'libro' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              📚 Libros
            </button>
            <button 
              onClick={() => setFiltroTipo('ropa')} 
              className={`px-4 py-2 rounded transition text-sm ${filtroTipo === 'ropa' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              👕 Ropa
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando stock...</div>
        ) : (
          <>
            {/* Vista MÓVIL - Cards */}
            <div className="block md:hidden space-y-3">
              {stock.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No se encontraron productos.</div>
              ) : (
                stock.map((producto, index) => (
                  <div key={index} className="bg-white rounded-xl border border-[#e2d8cc] p-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">
                          {producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}
                        </div>
                        <p className="font-bold text-sm">{producto.nombre_producto || '-'}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {producto.tipo_producto === 'libro' 
                            ? `✍️ ${producto.detalle || 'Sin autor'}`
                            : `🏫 ${producto.detalle || 'Sin colegio'}`}
                        </p>
                        {producto.tipo_producto === 'ropa' && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {producto.talle || '-'} | {producto.color || '-'}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1.5 rounded-full text-base md:text-sm font-bold ${
                          producto.cantidad >= 15 ? 'bg-blue-500 text-white' :
                          producto.cantidad >= 6 ? 'bg-green-500 text-white' :
                          producto.cantidad >= 1 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
                        }`}>
                          {producto.cantidad || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-500">Efectivo</p>
                        <p className="text-sm font-bold text-[#5a4a3a]">{formatMoney(producto.precio_efectivo || 0)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-500">Tarjeta</p>
                        <p className="text-sm font-bold text-[#5a4a3a]">{formatMoney(producto.precio_tarjeta || 0)}</p>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            setProductoEditando(producto);
                            setTipoEditando(producto.tipo_producto);
                          }} 
                          className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
                        >
                          ✏️
                        </button>
                        {esJefe && (
                          <button 
                            onClick={() => eliminarProducto(producto)} 
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Vista DESKTOP - Tabla */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="text-left p-5 font-bold">Tipo</th>
                    <th className="text-left p-5 font-bold">Producto</th>
                    <th className="text-left p-5 font-bold">Detalle</th>
                    <th className="text-center p-5 font-bold">Stock</th>
                    <th className="text-right p-5 font-bold">Precio Efectivo</th>
                    <th className="text-right p-5 font-bold">Precio Tarjeta</th>
                    <th className="text-center p-5 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-gray-500">
                        No se encontraron productos.
                      </td>
                    </tr>
                  ) : (
                    stock.map((producto, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-5">{producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}</td>
                        <td className="p-5 font-medium">{producto.nombre_producto || '-'}</td>
                        <td className="p-5 text-gray-600">
                          {producto.tipo_producto === 'libro' 
                            ? `✍️ ${producto.detalle || 'Sin autor'}` 
                            : `🏫 ${producto.detalle || 'Sin colegio'} | ${producto.talle || '-'} | ${producto.color || '-'}`}
                        </td>
                        <td className="p-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            producto.cantidad >= 15 ? 'bg-blue-500 text-white' :
                            producto.cantidad >= 6 ? 'bg-green-500 text-white' :
                            producto.cantidad >= 1 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
                          }`}>
                            {producto.cantidad || 0} und
                          </span>
                        </td>
                        <td className="p-5 text-right font-medium">{formatMoney(producto.precio_efectivo || 0)}</td>
                        <td className="p-5 text-right font-medium">{formatMoney(producto.precio_tarjeta || 0)}</td>
                        <td className="p-5 text-center">
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => {
                                setProductoEditando(producto);
                                setTipoEditando(producto.tipo_producto);
                              }} 
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                            >
                              ✏️ Editar
                            </button>
                            {esJefe && (
                              <button 
                                onClick={() => eliminarProducto(producto)} 
                                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                              >
                                🗑️ Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      
      {productoEditando && (
        <ModalEditarProducto
          producto={productoEditando}
          tipo={tipoEditando}
          onClose={() => {
            setProductoEditando(null);
            setTipoEditando(null);
          }}
          onActualizar={cargarStock}
        />
      )}
      
      {mostrarAgregar && (
        <ModalAgregarProducto
          sucursalId={sucursalSeleccionada}
          onClose={() => setMostrarAgregar(false)}
          onAgregar={() => {
            cargarStock();
            setMostrarAgregar(false);
          }}
        />
      )}
    </div>
  );
}