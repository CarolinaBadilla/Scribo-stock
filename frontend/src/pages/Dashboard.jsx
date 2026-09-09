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
    <div className="w-full space-y-4">
      
      {/* Encabezado Principal Panorámico */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#fefcf8] px-6 py-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight">📊 Control de Stock</h1>
          <p className="text-xs font-bold text-[#8a7a6a] mt-0.5">Gestión e inventario en tiempo real</p>
        </div>
        <button 
          onClick={() => setMostrarAgregar(true)} 
          style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
          className="px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-[#43372b] flex items-center gap-2 transition-all text-xs sm:text-sm cursor-pointer border border-[#43372b]"
        >
          <span>➕</span>
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Sucursal y Leyenda */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {sucursales.length > 0 && (
          <div className="md:col-span-4 bg-[#fefcf8] p-4 rounded-2xl border border-[#e2d8cc] shadow-xs flex flex-col justify-center">
            <label className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a] mb-2 block">
              📍 Sucursal seleccionada
            </label>
            <select 
              value={sucursalSeleccionada || ''} 
              onChange={(e) => setSucursalSeleccionada(parseInt(e.target.value))} 
              className="w-full p-2.5 bg-[#f5f0e8] border border-[#e2d8cc] rounded-xl text-sm font-bold text-[#5a4a3a] focus:outline-none cursor-pointer"
            >
              {sucursales.map(suc => (
                <option key={suc.id} value={suc.id}>{suc.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="md:col-span-8 bg-[#fefcf8] p-4 rounded-2xl border border-[#e2d8cc] shadow-xs flex items-center">
          <LeyendaColores />
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-[#fefcf8] p-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text" 
            placeholder="🔍 Buscar por nombre, autor, código o detalle..." 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
            className="flex-1 px-4 py-2.5 border border-[#e2d8cc] rounded-xl text-sm font-bold bg-white text-[#5a4a3a] placeholder-[#8a7a6a]/60 focus:outline-none focus:border-[#5a4a3a] shadow-xs" 
          />
          
          <div className="flex gap-2">
            <button 
              onClick={() => setFiltroTipo('todos')} 
              style={{ 
                backgroundColor: filtroTipo === 'todos' ? '#5a4a3a' : '#ffffff',
                color: filtroTipo === 'todos' ? '#ffffff' : '#5a4a3a',
                borderColor: filtroTipo === 'todos' ? '#43372b' : '#e2d8cc'
              }}
              className="px-4 py-2.5 rounded-xl font-bold transition text-xs border cursor-pointer shadow-xs"
            >
              Todos
            </button>
            <button 
              onClick={() => setFiltroTipo('libro')} 
              style={{ 
                backgroundColor: filtroTipo === 'libro' ? '#5a4a3a' : '#ffffff',
                color: filtroTipo === 'libro' ? '#ffffff' : '#5a4a3a',
                borderColor: filtroTipo === 'libro' ? '#43372b' : '#e2d8cc'
              }}
              className="px-4 py-2.5 rounded-xl font-bold transition text-xs border cursor-pointer shadow-xs"
            >
              📚 Libros
            </button>
            <button 
              onClick={() => setFiltroTipo('ropa')} 
              style={{ 
                backgroundColor: filtroTipo === 'ropa' ? '#5a4a3a' : '#ffffff',
                color: filtroTipo === 'ropa' ? '#ffffff' : '#5a4a3a',
                borderColor: filtroTipo === 'ropa' ? '#43372b' : '#e2d8cc'
              }}
              className="px-4 py-2.5 rounded-xl font-bold transition text-xs border cursor-pointer shadow-xs"
            >
              👕 Ropa
            </button>
          </div>
        </div>
      </div>

      {/* Listado de Inventario */}
      {loading ? (
        <div className="text-center py-12 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] text-[#8a7a6a] font-bold text-sm">
          Cargando inventario de la sucursal...
        </div>
      ) : (
        <>
          {/* Vista Móvil */}
          <div className="block md:hidden space-y-3">
            {stock.length === 0 ? (
              <div className="text-center py-10 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] text-[#8a7a6a] font-bold text-xs">
                No se encontraron productos registrados.
              </div>
            ) : (
              stock.map((producto, index) => (
                <div key={index} className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-4 shadow-xs space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7a6a] bg-[#f5f0e8] px-2 py-0.5 rounded-md border border-[#e2d8cc]">
                        {producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}
                      </span>
                      <p className="font-bold text-sm text-[#5a4a3a] mt-1.5">{producto.nombre_producto || '-'}</p>
                      <p className="text-xs font-medium text-[#8a7a6a] mt-0.5">
                        {producto.detalle || '-'}
                      </p>
                    </div>
                    
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      producto.cantidad >= 15 ? 'bg-blue-600 text-white' :
                      producto.cantidad >= 6 ? 'bg-emerald-600 text-white' :
                      producto.cantidad >= 1 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {producto.cantidad || 0} und
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-[#e2d8cc]/60">
                    <div>
                      <p className="text-[10px] uppercase text-[#8a7a6a] font-bold">Efectivo / Tarjeta</p>
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
                        className="bg-[#f5f0e8] text-[#5a4a3a] hover:bg-[#e2d8cc] px-3 py-1.5 rounded-lg border border-[#e2d8cc] text-xs font-bold transition cursor-pointer"
                      >
                        ✏️ Editar
                      </button>
                      {esJefe && (
                        <button 
                          onClick={() => eliminarProducto(producto)} 
                          className="bg-rose-50 text-rose-700 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-200 text-xs font-bold cursor-pointer"
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

          {/* Vista Escritorio Tabla Ancha */}
          <div className="hidden md:block bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f0e8]/80 border-b border-[#e2d8cc] text-xs font-bold text-[#8a7a6a] uppercase tracking-wider">
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Producto</th>
                  <th className="p-4">Detalle</th>
                  <th className="p-4 text-center">Stock</th>
                  <th className="p-4 text-right">Precio Efectivo</th>
                  <th className="p-4 text-right">Precio Tarjeta</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2d8cc]/60 text-sm">
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-[#8a7a6a] font-bold">
                      No se encontraron productos en esta sucursal.
                    </td>
                  </tr>
                ) : (
                  stock.map((producto, index) => (
                    <tr key={index} className="hover:bg-[#f5f0e8]/40 transition-colors">
                      <td className="p-4 font-bold text-xs text-[#8a7a6a]">
                        {producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}
                      </td>
                      <td className="p-4 font-bold text-[#5a4a3a]">{producto.nombre_producto || '-'}</td>
                      <td className="p-4 text-[#8a7a6a] text-xs font-medium">
                        {producto.detalle || '-'}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block shadow-xs ${
                          producto.cantidad >= 15 ? 'bg-blue-600 text-white' :
                          producto.cantidad >= 6 ? 'bg-emerald-600 text-white' :
                          producto.cantidad >= 1 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {producto.cantidad || 0} und
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-[#5a4a3a]">{formatMoney(producto.precio_efectivo || 0)}</td>
                      <td className="p-4 text-right font-bold text-[#5a4a3a]">{formatMoney(producto.precio_tarjeta || 0)}</td>
                      <td className="p-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button 
                            onClick={() => {
                              setProductoEditando(producto);
                              setTipoEditando(producto.tipo_producto);
                            }} 
                            className="bg-[#f5f0e8] hover:bg-[#e2d8cc] text-[#5a4a3a] px-3 py-1.5 rounded-lg border border-[#e2d8cc] text-xs font-bold transition cursor-pointer"
                          >
                            ✏️ Editar
                          </button>
                          {esJefe && (
                            <button 
                              onClick={() => eliminarProducto(producto)} 
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-bold transition cursor-pointer"
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