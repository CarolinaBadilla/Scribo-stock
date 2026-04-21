import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatMoney, formatDate } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { Estadisticas } from '../components/Estadisticas';

const user = JSON.parse(localStorage.getItem('user') || '{}');
const esJefe = user.rol === 'jefe';

export function Reportes() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoReporte, setTipoReporte] = useState('ventas');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargarSucursales();
  }, []);

  useEffect(() => {
    if (sucursalId) {
      cargarDatos();
    }
  }, [tipoReporte, fechaInicio, fechaFin, sucursalId]);

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

  const cargarDatos = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (tipoReporte) {
        case 'ventas':
          endpoint = '/reportes/ventas';
          break;
        case 'compras':
          endpoint = '/reportes/compras';
          break;
        case 'stock':
          endpoint = '/reportes/stock-actual';
          break;
        case 'movimientos':
          endpoint = '/reportes/movimientos';
          break;
        default:
          endpoint = '/reportes/ventas';
      }
      
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (sucursalId) params.append('sucursalId', sucursalId);
      
      const response = await api.get(`${endpoint}?${params.toString()}`);
      setDatos(response.data || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    if (datos.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    
    setExportando(true);
    
    try {
      let datosExcel = [];
      
      switch (tipoReporte) {
        case 'ventas':
          datosExcel = datos.map(item => ({
            'Fecha': formatDate(item.fecha),
            'Producto': item.nombre_producto || '-',
            'Detalle': item.detalle_producto || '-',
            'Cantidad': item.cantidad || 0,
            'Precio Unitario': item.precio_unitario || 0,
            'Total': item.total || 0,
            'Sucursal': item.sucursal || '-'
          }));
          break;
          
        case 'compras':
          datosExcel = datos.map(item => ({
            'Fecha': formatDate(item.fecha),
            'Producto': item.nombre_producto || '-',
            'Cantidad': item.cantidad || 0,
            'Precio Unitario': item.precio_unitario || 0,
            'Total': item.total || 0,
            'Sucursal': item.sucursal || '-'
          }));
          break;
          
        case 'stock':
          datosExcel = datos.map(item => ({
            'Producto': item.nombre_producto || '-',
            'Tipo': item.tipo_producto === 'libro' ? 'Libro' : 'Ropa',
            'Detalle': item.detalle || '-',
            'Stock': item.cantidad || 0,
            'Precio Efectivo': item.precio_efectivo || 0,
            'Precio Tarjeta': item.precio_tarjeta || 0,
            'Sucursal': item.sucursal_nombre || '-'
          }));
          break;
          
        case 'movimientos':
          datosExcel = datos.map(item => ({
            'Fecha': formatDate(item.fecha),
            'Tipo': item.tipo || '-',
            'Producto': item.nombre_producto || '-',
            'Cantidad': item.cantidad || 0,
            'Precio Unitario': item.precio_unitario || 0,
            'Total': item.total || 0,
            'Sucursal': item.sucursal || '-'
          }));
          break;
          
        default:
          datosExcel = datos;
      }
      
      // Crear libro de Excel
      const worksheet = XLSX.utils.json_to_sheet(datosExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
      
      // Generar nombre del archivo
      const fechaActual = new Date().toISOString().split('T')[0];
      const nombreArchivo = `reporte_${tipoReporte}_${fechaActual}.xlsx`;
      
      // Descargar archivo
      XLSX.writeFile(workbook, nombreArchivo);
      
      alert(`✅ Reporte exportado como ${nombreArchivo}`);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar el reporte');
    } finally {
      setExportando(false);
    }
  };

  const calcularTotal = () => {
    if (tipoReporte === 'stock') return null;
    return datos.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const getColumnas = () => {
    switch (tipoReporte) {
      case 'ventas':
        return ['Fecha', 'Producto', 'Detalle', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal'];
      case 'compras':
        return ['Fecha', 'Producto', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal'];
      case 'stock':
        return ['Producto', 'Tipo', 'Detalle', 'Stock', 'Precio Efectivo', 'Precio Tarjeta', 'Sucursal'];
      case 'movimientos':
        return ['Fecha', 'Tipo', 'Producto', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal'];
      default:
        return [];
    }
  };

  const renderFila = (item, index) => {
    if (!item) return null;
    
    switch (tipoReporte) {
      case 'ventas':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="p-2">{formatDate(item.fecha)}</td>
            <td className="p-2">{item.nombre_producto || '-'}</td>
            <td className="p-2 text-gray-600">{item.detalle_producto || '-'}</td>
            <td className="p-2 text-center">{item.cantidad || 0}</td>
            <td className="p-2 text-right">{formatMoney(item.precio_unitario)}</td>
            <td className="p-2 text-right font-bold">{formatMoney(item.total)}</td>
            <td className="p-2">{item.sucursal || '-'}</td>
          </tr>
        );
      case 'compras':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="p-2">{formatDate(item.fecha)}</td>
            <td className="p-2">{item.nombre_producto || '-'}</td>
            <td className="p-2 text-center">{item.cantidad || 0}</td>
            <td className="p-2 text-right">{formatMoney(item.precio_unitario)}</td>
            <td className="p-2 text-right font-bold">{formatMoney(item.total)}</td>
            <td className="p-2">{item.sucursal || '-'}</td>
          </tr>
        );
      case 'stock':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="p-2 font-medium">{item.nombre_producto || '-'}</td>
            <td className="p-2">{item.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}</td>
            <td className="p-2 text-gray-600">{item.detalle || '-'}</td>
            <td className="p-2 text-center">
              <span className={`px-2 py-1 rounded-full text-xs ${
                item.cantidad >= 15 ? 'bg-blue-500 text-white' :
                item.cantidad >= 6 ? 'bg-green-500 text-white' :
                item.cantidad >= 1 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
              }`}>
                {item.cantidad || 0}
              </span>
            </td>
            <td className="p-2 text-right">{formatMoney(item.precio_efectivo)}</td>
            <td className="p-2 text-right">{formatMoney(item.precio_tarjeta)}</td>
            <td className="p-2">{item.sucursal_nombre || '-'}</td>
          </tr>
        );
      case 'movimientos':
        return (
          <tr key={index} className="border-b hover:bg-gray-50">
            <td className="p-2">{formatDate(item.fecha)}</td>
            <td className="p-2">
              <span className={`px-2 py-1 rounded-full text-xs ${
                item.tipo === 'Venta' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {item.tipo || '-'}
              </span>
            </td>
            <td className="p-2">{item.nombre_producto || '-'}</td>
            <td className="p-2 text-center">{item.cantidad || 0}</td>
            <td className="p-2 text-right">{formatMoney(item.precio_unitario)}</td>
            <td className="p-2 text-right font-bold">{formatMoney(item.total)}</td>
            <td className="p-2">{item.sucursal || '-'}</td>
          </tr>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-full mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">📄 Reportes y Exportaciones</h1>

        {esJefe && (
          <div className="mb-8">
            <Estadisticas sucursales={sucursales} />
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panel de filtros */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold mb-4">Filtros</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Tipo de reporte</label>
                <select
                  value={tipoReporte}
                  onChange={(e) => setTipoReporte(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="ventas">💰 Ventas</option>
                  <option value="compras">📦 Compras</option>
                  <option value="stock">📊 Stock actual</option>
                  <option value="movimientos">🔄 Todos los movimientos</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-1">Sucursal</label>
                <select
                  value={sucursalId || ''}
                  onChange={(e) => setSucursalId(parseInt(e.target.value))}
                  className="w-full p-2 border rounded-lg"
                >
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              
              {tipoReporte !== 'stock' && (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-1">Fecha inicio</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold mb-1">Fecha fin</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </>
              )}
              
              <button
                onClick={exportarExcel}
                disabled={exportando || datos.length === 0}
                className="w-full bg-green-500 text-white py-2 rounded-lg font-bold hover:bg-green-600 transition disabled:opacity-50"
              >
                {exportando ? 'Exportando...' : '📊 Exportar a Excel'}
              </button>
            </div>
          </div>
          
          {/* Vista previa */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Vista previa</h2>
              {!loading && datos.length > 0 && (
                <span className="text-sm text-gray-500">{datos.length} registros</span>
              )}
            </div>
            
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <p>Cargando datos...</p>
              </div>
            ) : datos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-2">📭</p>
                <p>No hay datos para mostrar</p>
                <p className="text-sm mt-1">Seleccioná filtros para ver los datos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      {getColumnas().map((col, idx) => (
                        <th key={idx} className="text-left p-2 font-bold">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.map((item, idx) => renderFila(item, idx))}
                  </tbody>
                  {calcularTotal() !== null && (
                    <tfoot>
                      <tr className="bg-gray-50 border-t font-bold">
                        <td colSpan={getColumnas().length - 1} className="p-2 text-right">
                          Total:
                        </td>
                        <td className="p-2 text-right">{formatMoney(calcularTotal())}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}