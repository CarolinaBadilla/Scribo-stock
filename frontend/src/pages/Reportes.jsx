// src/pages/Reportes.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatMoney, formatDate } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { Estadisticas } from '../components/Estadisticas';

export function Reportes() {
  const [usuario, setUsuario] = useState(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoReporte, setTipoReporte] = useState('ventas');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const userLocal = localStorage.getItem('user') || localStorage.getItem('usuario');
    if (userLocal) {
      try {
        setUsuario(JSON.parse(userLocal));
      } catch (e) {
        console.error('Error parseando usuario local:', e);
      }
    }
    cargarSucursales();
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [tipoReporte, fechaInicio, fechaFin, sucursalId]);

  const esJefe = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO';

  const cargarSucursales = async () => {
    try {
      const response = await api.get('/sucursales');
      const data = response.data || [];
      setSucursales(data);
      if (data.length > 0) {
        setSucursalId(data[0].id);
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
    } finally {
      setLoading(false);
    }
  };

  
  const exportarExcel = () => {
    if (datos.length === 0) return;
    setExportando(true);
    
    try {
      let datosExcel = [];
      switch (tipoReporte) {
        case 'ventas':
          datosExcel = datos.map(item => ({
            'Fecha': formatDate(item.fecha),
            'Producto': item.nombre_producto || 'Producto eliminado',
            'Detalle': item.detalle_producto || '-',
            'Cantidad': Number(item.cantidad || 0),
            'Precio Unitario': Number(item.precio_unitario || 0),
            'Total': Number(item.total || 0),
            'Sucursal': item.sucursal || '-'
          }));
          datosExcel.push({
            'Fecha': '',
            'Producto': '',
            'Detalle': '',
            'Cantidad': '',
            'Precio Unitario': 'TOTAL:',
            'Total': datosExcel.reduce((sum, i) => sum + i.Total, 0),
            'Sucursal': ''
          });
          break;

        case 'compras':
          datosExcel = datos.map(item => ({
            'Fecha': formatDate(item.fecha),
            'Producto': item.nombre_producto || 'Producto eliminado',
            'Cantidad': Number(item.cantidad || 0),
            'Precio Unitario': Number(item.precio_unitario || 0),
            'Total': Number(item.total || 0),
            'Sucursal': item.sucursal || '-'
          }));
          datosExcel.push({
            'Fecha': '',
            'Producto': '',
            'Cantidad': '',
            'Precio Unitario': 'TOTAL:',
            'Total': datosExcel.reduce((sum, i) => sum + i.Total, 0),
            'Sucursal': ''
          });
          break;

        case 'stock':
          datosExcel = datos.map(item => ({
            'Producto': item.nombre_producto || '-',
            'Tipo': item.tipo_producto === 'libro' ? 'Libro' : 'Ropa',
            'Detalle': item.detalle || '-',
            'Stock': Number(item.cantidad || 0),
            'Precio Efectivo': Number(item.precio_efectivo || 0),
            'Precio Tarjeta': Number(item.precio_tarjeta || 0),
            'Sucursal': item.sucursal_nombre || '-'
          }));
          break;

        case 'movimientos':
          datosExcel = datos.map(item => ({
            'Fecha': formatDate(item.fecha),
            'Tipo': item.tipo || '-',
            'Producto': item.nombre_producto || 'Producto eliminado',
            'Cantidad': Number(item.cantidad || 0),
            'Precio Unitario': Number(item.precio_unitario || 0),
            'Total': Number(item.total || 0),
            'Sucursal': item.sucursal || '-'
          }));
          datosExcel.push({
            'Fecha': '',
            'Tipo': '',
            'Producto': '',
            'Cantidad': '',
            'Precio Unitario': 'TOTAL:',
            'Total': datosExcel.reduce((sum, i) => sum + i.Total, 0),
            'Sucursal': ''
          });
          break;

        default:
          datosExcel = datos;
      }
      
      const worksheet = XLSX.utils.json_to_sheet(datosExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
      
      const fechaActual = new Date().toISOString().split('T')[0];
      const nombreArchivo = `reporte_${tipoReporte}_${fechaActual}.xlsx`;
      
      XLSX.writeFile(workbook, nombreArchivo);
    } catch (error) {
      console.error('Error exportando:', error);
    } finally {
      setExportando(false);
    }
  };

  const calcularTotal = () => {
    if (tipoReporte === 'stock') return null;
    return datos.reduce((sum, item) => sum + Number(item.total || 0), 0);
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
          <tr key={index} className="border-b border-[#e2d8cc]/50 hover:bg-[#f5f0e8]/40 transition-colors">
            <td className="p-3 text-xs font-semibold text-[#8a7a6a]">{formatDate(item.fecha)}</td>
            <td className="p-3 font-bold text-[#5a4a3a]">{item.nombre_producto || '-'}</td>
            <td className="p-3 text-xs text-[#8a7a6a]">{item.detalle_producto || '-'}</td>
            <td className="p-3 text-center font-bold text-[#5a4a3a]">{item.cantidad || 0}</td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_unitario)}</td>
            <td className="p-3 text-right font-bold text-[#5a4a3a]">{formatMoney(item.total)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal || '-'}</td>
          </tr>
        );
      case 'compras':
        return (
          <tr key={index} className="border-b border-[#e2d8cc]/50 hover:bg-[#f5f0e8]/40 transition-colors">
            <td className="p-3 text-xs font-semibold text-[#8a7a6a]">{formatDate(item.fecha)}</td>
            <td className="p-3 font-bold text-[#5a4a3a]">{item.nombre_producto || '-'}</td>
            <td className="p-3 text-center font-bold text-[#5a4a3a]">{item.cantidad || 0}</td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_unitario)}</td>
            <td className="p-3 text-right font-bold text-[#5a4a3a]">{formatMoney(item.total)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal || '-'}</td>
          </tr>
        );
      case 'stock':
        return (
          <tr key={index} className="border-b border-[#e2d8cc]/50 hover:bg-[#f5f0e8]/40 transition-colors">
            <td className="p-3 font-bold text-[#5a4a3a]">{item.nombre_producto || '-'}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}</td>
            <td className="p-3 text-xs text-[#8a7a6a]">{item.detalle || '-'}</td>
            <td className="p-3 text-center">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-xs ${
                item.cantidad >= 15 ? 'bg-blue-600 text-white' :
                item.cantidad >= 6 ? 'bg-emerald-600 text-white' :
                item.cantidad >= 1 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
              }`}>
                {item.cantidad || 0}
              </span>
            </td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_efectivo)}</td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_tarjeta)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal_nombre || '-'}</td>
          </tr>
        );
      case 'movimientos':
        return (
          <tr key={index} className="border-b border-[#e2d8cc]/50 hover:bg-[#f5f0e8]/40 transition-colors">
            <td className="p-3 text-xs font-semibold text-[#8a7a6a]">{formatDate(item.fecha)}</td>
            <td className="p-3">
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                item.tipo === 'Venta' ? 'bg-[#5a4a3a] text-white' : 'bg-[#c9a87b] text-white'
              }`}>
                {item.tipo || '-'}
              </span>
            </td>
            <td className="p-3 font-bold text-[#5a4a3a]">{item.nombre_producto || '-'}</td>
            <td className="p-3 text-center font-bold text-[#5a4a3a]">{item.cantidad || 0}</td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_unitario)}</td>
            <td className="p-3 text-right font-bold text-[#5a4a3a]">{formatMoney(item.total)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal || '-'}</td>
          </tr>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-4">
      
      {/* Encabezado Panorámico Extendido */}
      <div className="flex items-center justify-between bg-[#fefcf8] px-6 py-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight">📄 Reportes y Exportaciones</h1>
          <p className="text-xs font-bold text-[#8a7a6a] mt-0.5">Métricas de rendimiento y descarga de registros en Excel</p>
        </div>
      </div>

      {/* Estadísticas (Si es jefe) */}
      {esJefe && sucursales.length > 0 && (
        <div className="bg-[#fefcf8] p-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
          <Estadisticas sucursales={sucursales} sucursalId={sucursalId} />
        </div>
      )}

      {/* Grid Principal Panorámico (4 Col Filtros / 8 Col Vista Previa) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
        
        {/* Panel Izquierdo: Filtros */}
        <div className="lg:col-span-4 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">Filtros de Búsqueda</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                Tipo de Reporte
              </label>
              <select
                value={tipoReporte}
                onChange={(e) => setTipoReporte(e.target.value)}
                className="w-full p-2.5 bg-[#f5f0e8] border border-[#e2d8cc] rounded-xl text-xs font-bold text-[#5a4a3a] focus:outline-none cursor-pointer"
              >
                <option value="ventas">💰 Ventas</option>
                <option value="compras">📦 Compras</option>
                <option value="stock">📊 Stock Actual</option>
                <option value="movimientos">🔄 Todos los Movimientos</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                Sucursal
              </label>
              <select
                value={sucursalId || ''}
                onChange={(e) => setSucursalId(parseInt(e.target.value))}
                className="w-full p-2.5 bg-[#f5f0e8] border border-[#e2d8cc] rounded-xl text-xs font-bold text-[#5a4a3a] focus:outline-none cursor-pointer"
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            
            {tipoReporte !== 'stock' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full p-2 border border-[#e2d8cc] rounded-xl text-xs font-bold bg-white text-[#5a4a3a] focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full p-2 border border-[#e2d8cc] rounded-xl text-xs font-bold bg-white text-[#5a4a3a] focus:outline-none"
                  />
                </div>
              </div>
            )}
            
            <button
              onClick={exportarExcel}
              disabled={exportando || datos.length === 0}
              style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
              className="w-full font-bold py-3 px-4 rounded-xl text-xs shadow-md hover:bg-[#43372b] transition-all disabled:opacity-50 cursor-pointer border border-[#43372b] mt-2 flex items-center justify-center gap-2"
            >
              <span>📊</span>
              <span>{exportando ? 'Exportando Excel...' : 'Exportar a Excel'}</span>
            </button>
          </div>
        </div>
        
        {/* Panel Derecho: Tabla de Vista Previa */}
        <div className="lg:col-span-8 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-xs">
          <div className="flex justify-between items-center pb-3 border-b border-[#e2d8cc]/60 mb-4">
            <h2 className="text-xs font-bold text-[#5a4a3a] uppercase tracking-wider">Vista Previa del Reporte</h2>
            {!loading && datos.length > 0 && (
              <span className="text-xs font-bold text-[#8a7a6a] bg-[#f5f0e8] px-2.5 py-1 rounded-lg border border-[#e2d8cc]">
                {datos.length} registros
              </span>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-16 text-[#8a7a6a] font-bold text-sm">
              Cargando datos del reporte...
            </div>
          ) : datos.length === 0 ? (
            <div className="text-center py-16 text-[#8a7a6a]">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-sm font-bold text-[#5a4a3a]">No hay registros para mostrar</p>
              <p className="text-xs mt-0.5">Prueba cambiando el rango de fechas o el tipo de reporte</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f0e8]/80 border-b border-[#e2d8cc] text-xs font-bold text-[#8a7a6a] uppercase tracking-wider">
                    {getColumnas().map((col, idx) => (
                      <th key={idx} className="p-3">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2d8cc]/60 text-sm">
                  {datos.map((item, idx) => renderFila(item, idx))}
                </tbody>
                {calcularTotal() !== null && (
                  <tfoot>
                    <tr className="bg-[#f5f0e8] border-t border-[#e2d8cc] font-black text-[#5a4a3a]">
                      <td colSpan={getColumnas().length - 2} className="p-3 text-right uppercase text-xs text-[#8a7a6a]">
                        Total Acumulado:
                      </td>
                      <td className="p-3 text-right text-base text-[#5a4a3a]">
                        {formatMoney(calcularTotal())}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}