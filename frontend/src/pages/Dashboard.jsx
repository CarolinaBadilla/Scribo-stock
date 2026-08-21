// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
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
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const esJefe = user.rol === 'jefe' || user.rol === 'DUENO';

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
      const response = await api.get('/sucursales');
      const data = response.data || [];
      setSucursales(data);
      if (data.length > 0) {
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
      const response = await api.get(`/stock/por-sucursal/${sucursalSeleccionada}`);
      let data = response.data || [];

      // Filtrado local según los criterios
      if (filtroTipo !== 'todos') {
        data = data.filter(item => item.tipo_producto === filtroTipo);
      }

      if (busqueda.trim() !== '') {
        const query = busqueda.toLowerCase();
        data = data.filter(item => 
          (item.nombre_producto && item.nombre_producto.toLowerCase().includes(query)) ||
          (item.detalle && item.detalle.toLowerCase().includes(query))
        );
      }

      setStock(data);
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
      await api.delete(`/productos/${producto.tipo_producto}/${producto.producto_id}`);
      alert('✅ Producto eliminado correctamente');
      cargarStock();
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar producto');
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 bg-[#f5f0e8] min-h-screen text-[#5a4a3a]">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Encabezado Principal */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#fefcf8] p-6 rounded-2xl shadow-sm border border-[#e2d8cc]">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">📊 Control de Stock</h1>
            <p className="text-xs md:text-sm text-[#8a7a6a] mt-1 font-medium">Gestión e inventario en tiempo real</p>
          </div>
          <button 
            onClick={() => setMostrarAgregar(true)} 
            className="bg-[#c9a87b] hover:bg-[#b8976a] active:bg-[#a8865d] text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-all text-sm md:text-base"
          >
            <span>➕</span>
            <span>Nuevo producto</span>
          </button>
        </div>

        {/* Selector de Sucursal y Leyenda */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sucursales.length > 0 && (
            <div className="bg-[#fefcf8] p-5 rounded-2xl border border-[#e2d8cc] shadow-sm flex flex-col justify-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#8a7a6a] mb-2 block">
                📍 Sucursal seleccionada
              </label>
              <select 
                value={sucursalSeleccionada || ''} 
                onChange={(e) => setSucursalSeleccionada(parseInt(e.target.value))} 
                className="w-full p-2.5 bg-white border border-[#e2d8cc] rounded-xl text-sm md:text-base font-semibold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
              >
                {sucursales.map(suc => (
                  <option key={suc.id} value={suc.id}>{suc.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2 bg-[#fefcf8] p-5 rounded-2xl border border-[#e2d8cc] shadow-sm">
            <LeyendaColores />
          </div>
        </div>

        {/* Filtros de búsqueda */}
        <div className="bg-[#fefcf8] p-5 rounded-2xl border border-[#e2d8cc] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="🔍 Buscar por nombre, autor o detalle..." 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)} 
              className="flex-1 px-4 py-2.5 border border-[#e2d8cc] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a87b] text-[#5a4a3a] placeholder-[#8a7a6a]/60" 
            />
            
            <div className="flex gap-2">
              <button 
                onClick={() => setFiltroTipo('todos')} 
                className={`px-4 py-2.5 rounded-xl font-medium transition text-xs md:text-sm ${
                  filtroTipo === 'todos' 
                    ? 'bg-[#5a4a3a] text-white shadow-sm' 
                    : 'bg-white border border-[#e2d8cc] text-[#5a4a3a] hover:bg-[#f5f0e8]'
                }`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFiltroTipo('libro')} 
                className={`px-4 py-2.5 rounded-xl font-medium transition text-xs md:text-sm ${
                  filtroTipo === 'libro' 
                    ? 'bg-[#5a4a3a] text-white shadow-sm' 
                    : 'bg-white border border-[#e2d8cc] text-[#5a4a3a] hover:bg-[#f5f0e8]'
                }`}
              >
                📚 Libros
              </button>
              <button 
                onClick={() => setFiltroTipo('ropa')} 
                className={`px-4 py-2.5 rounded-xl font-medium transition text-xs md:text-sm ${
                  filtroTipo === 'ropa' 
                    ? 'bg-[#5a4a3a] text-white shadow-sm' 
                    : 'bg-white border border-[#e2d8cc] text-[#5a4a3a] hover:bg-[#f5f0e8]'
                }`}
              >
                👕 Ropa
              </button>
            </div>
          </div>
        </div>

        {/* Lista/Tabla de Stock */}
        {loading ? (
          <div className="text-center py-12 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] text-[#8a7a6a] font-medium">
            Cargando inventario de la sucursal...
          </div>
        ) : (
          <>
            {/* VISTA MÓVIL (Tarjetas) */}
            <div className="block md:hidden space-y-3">
              {stock.length === 0 ? (
                <div className="text-center py-10 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] text-[#8a7a6a]">
                  No se encontraron productos registrados.
                </div>
              ) : (
                stock.map((producto, index) => (
                  <div key={index} className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7a6a] bg-[#f5f0e8] px-2 py-0.5 rounded-md border border-[#e2d8cc]">
                          {producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}
                        </span>
                        <p className="font-bold text-base text-[#5a4a3a] mt-1.5">{producto.nombre_producto || '-'}</p>
                        <p className="text-xs text-[#8a7a6a] mt-0.5">
                          {producto.detalle || '-'}
                        </p>
                      </div>
                      
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                        producto.cantidad >= 15 ? 'bg-blue-600 text-white' :
                        producto.cantidad >= 6 ? 'bg-emerald-600 text-white' :
                        producto.cantidad >= 1 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
                      }`}>
                        {producto.cantidad || 0} und
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-[#e2d8cc]/60">
                      <div>
                        <p className="text-[10px] uppercase text-[#8a7a6a] font-semibold">Efectivo / Tarjeta</p>
                        <p className="text-xs font-bold text-[#5a4a3a]">
                          {formatMoney(producto.precio_efectivo || 0)} / {formatMoney(producto.precio_tarjeta || 0)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setProductoEditando(producto);
                            setTipoEditando(producto.tipo_producto);
                          }} 
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 p-2 rounded-lg border border-blue-200 text-xs font-semibold"
                        >
                          ✏️ Editar
                        </button>
                        {esJefe && (
                          <button 
                            onClick={() => eliminarProducto(producto)} 
                            className="bg-rose-50 text-rose-700 hover:bg-rose-100 p-2 rounded-lg border border-rose-200 text-xs font-semibold"
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

            {/* VISTA DESKTOP (Tabla) */}
            <div className="hidden md:block bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f0e8]/60 border-b border-[#e2d8cc] text-xs font-bold text-[#8a7a6a] uppercase tracking-wider">
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Producto</th>
                    <th className="p-4">Detalle</th>
                    <th className="p-4 text-center">Stock</th>
                    <th className="p-4 text-right">Precio Efectivo</th>
                    <th className="p-4 text-right">Precio Tarjeta</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2d8cc]/50 text-sm">
                  {stock.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-[#8a7a6a]">
                        No se encontraron productos en esta sucursal.
                      </td>
                    </tr>
                  ) : (
                    stock.map((producto, index) => (
                      <tr key={index} className="hover:bg-[#f5f0e8]/30 transition-colors">
                        <td className="p-4 font-medium">
                          {producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}
                        </td>
                        <td className="p-4 font-semibold text-[#5a4a3a]">{producto.nombre_producto || '-'}</td>
                        <td className="p-4 text-[#8a7a6a] text-xs">
                          {producto.detalle || '-'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block shadow-sm ${
                            producto.cantidad >= 15 ? 'bg-blue-600 text-white' :
                            producto.cantidad >= 6 ? 'bg-emerald-600 text-white' :
                            producto.cantidad >= 1 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
                          }`}>
                            {producto.cantidad || 0} und
                          </span>
                        </td>
                        <td className="p-4 text-right font-semibold">{formatMoney(producto.precio_efectivo || 0)}</td>
                        <td className="p-4 text-right font-semibold">{formatMoney(producto.precio_tarjeta || 0)}</td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => {
                                setProductoEditando(producto);
                                setTipoEditando(producto.tipo_producto);
                              }} 
                              className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-semibold transition"
                            >
                              ✏️ Editar
                            </button>
                            {esJefe && (
                              <button 
                                onClick={() => eliminarProducto(producto)} 
                                className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold transition"
                              >
                                🗑️
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

      {/* Modales */}
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