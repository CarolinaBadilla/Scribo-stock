import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatMoney, formatDate } from '../utils/formatters';

export function Reportes() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoReporte, setTipoReporte] = useState('ventas');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => { cargarSucursales(); }, []);
  useEffect(() => { if (sucursalId) cargarDatos(); }, [tipoReporte, fechaInicio, fechaFin, sucursalId]);

  const cargarSucursales = async () => {
    try {
      const response = await api.get('/sucursales');
      setSucursales(response.data);
      if (response.data.length > 0) setSucursalId(response.data[0].id);
    } catch (error) { console.error('Error:', error); }
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (tipoReporte) {
        case 'ventas': endpoint = '/reportes/ventas'; break;
        case 'compras': endpoint = '/reportes/compras'; break;
        case 'stock': endpoint = '/reportes/stock-actual'; break;
        case 'movimientos': endpoint = '/reportes/movimientos'; break;
        default: endpoint = '/reportes/ventas';
      }
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (sucursalId) params.append('sucursalId', sucursalId);
      const response = await api.get(`${endpoint}?${params.toString()}`);
      setDatos(response.data || []);
    } catch (error) { console.error('Error:', error); alert('Error al cargar los datos'); }
    finally { setLoading(false); }
  };

  const exportarExcel = () => {
    alert('📊 Exportación a Excel próximamente');
  };

  const calcularTotal = () => {
    if (tipoReporte === 'stock') return null;
    return datos.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const getColumnas = () => {
    switch (tipoReporte) {
      case 'ventas': return ['Fecha', 'Producto', 'Detalle', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal'];
      case 'compras': return ['Fecha', 'Producto', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal'];
      case 'stock': return ['Producto', 'Tipo', 'Detalle', 'Stock', 'Precio Efectivo', 'Precio Tarjeta', 'Sucursal'];
      case 'movimientos': return ['Fecha', 'Tipo', 'Producto', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal'];
      default: return [];
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-full mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">📄 Reportes y Exportaciones</h1>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-bold mb-4">Filtros</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-bold mb-1">Tipo de reporte</label><select value={tipoReporte} onChange={(e) => setTipoReporte(e.target.value)} className="w-full p-2 border rounded-lg"><option value="ventas">💰 Ventas</option><option value="compras">📦 Compras</option><option value="stock">📊 Stock actual</option><option value="movimientos">🔄 Todos los movimientos</option></select></div>
              <div><label className="block text-sm font-bold mb-1">Sucursal</label><select value={sucursalId || ''} onChange={(e) => setSucursalId(parseInt(e.target.value))} className="w-full p-2 border rounded-lg">{sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
              {tipoReporte !== 'stock' && (<><div><label className="block text-sm font-bold mb-1">Fecha inicio</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full p-2 border rounded-lg" /></div><div><label className="block text-sm font-bold mb-1">Fecha fin</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full p-2 border rounded-lg" /></div></>)}
              <button onClick={exportarExcel} disabled={exportando || datos.length === 0} className="w-full bg-green-500 text-white py-2 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50">{exportando ? 'Exportando...' : '📊 Exportar a Excel'}</button>
            </div>
          </div>
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-5">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Vista previa</h2>{!loading && datos.length > 0 && <span className="text-sm text-gray-500">{datos.length} registros</span>}</div>
            {loading ? <div className="text-center py-12 text-gray-500">Cargando datos...</div> : datos.length === 0 ? <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-2">📭</p><p>No hay datos para mostrar</p></div> : <div className="overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="bg-gray-100 border-b">{getColumnas().map((col, idx) => <th key={idx} className="text-left p-2 font-bold">{col}</th>)}</tr></thead><tbody>{datos.map((item, idx) => (<tr key={idx} className="border-b hover:bg-gray-50">{tipoReporte === 'ventas' && (<><td className="p-2">{formatDate(item.fecha)}</td><td className="p-2">{item.nombre_producto || '-'}</td><td className="p-2 text-gray-600">{item.detalle_producto || '-'}</td><td className="p-2 text-center">{item.cantidad || 0}</td><td className="p-2 text-right">{formatMoney(item.precio_unitario)}</td><td className="p-2 text-right font-bold">{formatMoney(item.total)}</td><td className="p-2">{item.sucursal || '-'}</td></>)}</tr>))}</tbody>{calcularTotal() !== null && <tfoot><tr className="bg-gray-50 border-t font-bold"><td colSpan={getColumnas().length - 1} className="p-2 text-right">Total:</td><td className="p-2 text-right">{formatMoney(calcularTotal())}</td></tr></tfoot>}</table></div>}
          </div>
        </div>
      </div>
    </div>
  );
}