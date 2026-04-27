// src/components/Estadisticas.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { formatMoney } from '../utils/formatters';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { exportarEstadisticasPDF } from '../utils/exportPDF';

export function Estadisticas({ sucursales = [] }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const esJefe = user.rol === 'jefe';

  if (!esJefe) {
    return null;
  }
  
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ventasPorDia, setVentasPorDia] = useState([]);
  const [stockBajo, setStockBajo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7d');
  const [sucursalFiltro, setSucursalFiltro] = useState(null);

  useEffect(() => {
    cargarEstadisticas();
  }, [periodo, sucursalFiltro]);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const fechaFin = new Date();
      const fechaInicio = new Date();
      if (periodo === '7d') fechaInicio.setDate(fechaInicio.getDate() - 7);
      if (periodo === '30d') fechaInicio.setDate(fechaInicio.getDate() - 30);
      if (periodo === '90d') fechaInicio.setDate(fechaInicio.getDate() - 90);

      // Consulta con filtro de sucursal
      let query = supabase
        .from('movimientos')
        .select('*')
        .eq('tipo_movimiento', 'venta')
        .gte('fecha', fechaInicio.toISOString());

      if (sucursalFiltro) {
        query = query.eq('sucursal_id', sucursalFiltro);
      }

      const { data: movimientos, error } = await query;
      
      if (error) throw error;

      // Productos más vendidos
      const productosMap = new Map();
      for (const mov of (movimientos || [])) {
        let nombre = '';
        if (mov.tipo_producto === 'libro') {
          const { data: libro } = await supabase
            .from('libros')
            .select('titulo')
            .eq('id', mov.producto_id)
            .single();
          nombre = libro?.titulo || 'Desconocido';
        } else {
          const { data: ropa } = await supabase
            .from('ropa')
            .select('nombre')
            .eq('id', mov.producto_id)
            .single();
          nombre = ropa?.nombre || 'Desconocido';
        }
        productosMap.set(nombre, (productosMap.get(nombre) || 0) + mov.cantidad);
      }

      const productosArray = Array.from(productosMap.entries())
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);

      setProductosMasVendidos(productosArray);

      // Ventas por día
      const ventasPorDiaMap = new Map();
      for (const mov of (movimientos || [])) {
        const fecha = new Date(mov.fecha).toLocaleDateString('es-AR');
        ventasPorDiaMap.set(fecha, (ventasPorDiaMap.get(fecha) || 0) + (mov.cantidad * mov.precio_unitario));
      }

      const ventasArray = Array.from(ventasPorDiaMap.entries())
        .map(([fecha, total]) => ({ fecha, total }))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      setVentasPorDia(ventasArray);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6">
        <div className="text-center py-8 text-[#8a7a6a]">Cargando estadísticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#5a4a3a]">📊 Panel de Estadísticas</h2>
          <span className="text-xs bg-[#c9a87b] text-white px-2 py-1 rounded-full">Solo Administrador</span>
        </div>

        {/*<button
          onClick={() => exportarEstadisticasPDF('estadisticas-container', 'Reporte de Estadísticas - Scribo Stock')}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#7d8a6e] text-white rounded-lg text-sm hover:bg-[#6d7a5e] transition"
        >
          📄 Exportar a PDF
        </button>*/}
        
        {/* Filtro de sucursal */}
        {sucursales.length > 0 && (
          <select
            value={sucursalFiltro || ''}
            onChange={(e) => setSucursalFiltro(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-1.5 border border-[#e2d8cc] rounded-lg text-sm bg-[#fefcf8]"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
      </div>

      <div id="estadisticas-container" className="space-y-6">

      <div className="flex justify-end gap-2">
        <button onClick={() => setPeriodo('7d')} className={`px-3 py-1 rounded-lg text-sm transition ${periodo === '7d' ? 'bg-[#c9a87b] text-white' : 'bg-[#ede5d9] text-[#5a4a3a]'}`}>7 días</button>
        <button onClick={() => setPeriodo('30d')} className={`px-3 py-1 rounded-lg text-sm transition ${periodo === '30d' ? 'bg-[#c9a87b] text-white' : 'bg-[#ede5d9] text-[#5a4a3a]'}`}>30 días</button>
        <button onClick={() => setPeriodo('90d')} className={`px-3 py-1 rounded-lg text-sm transition ${periodo === '90d' ? 'bg-[#c9a87b] text-white' : 'bg-[#ede5d9] text-[#5a4a3a]'}`}>90 días</button>
      </div>
      </div>

      {/* Productos más vendidos */}
      <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6">
        <h3 className="text-lg font-bold text-[#5a4a3a] mb-4">🏆 Productos más vendidos</h3>
        {productosMasVendidos.length === 0 ? (
          <div className="text-center py-8 text-[#8a7a6a]">No hay datos de ventas</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productosMasVendidos} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2d8cc" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value} unidades`, 'Cantidad']} />
                <Legend />
                <Bar dataKey="cantidad" fill="#c9a87b" name="Unidades vendidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ventas por día */}
      <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6">
        <h3 className="text-lg font-bold text-[#5a4a3a] mb-4">📈 Ventas por día</h3>
        {ventasPorDia.length === 0 ? (
          <div className="text-center py-8 text-[#8a7a6a]">No hay datos de ventas</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ventasPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2d8cc" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tickFormatter={(value) => formatMoney(value)} />
                <Tooltip formatter={(value) => [formatMoney(value), 'Total ventas']} />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#c9a87b" name="Ventas ($)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stock bajo */}
      {stockBajo.length > 0 && (
        <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6">
          <h3 className="text-lg font-bold text-[#5a4a3a] mb-4 flex items-center gap-2">
            <span>⚠️</span> Productos con stock bajo
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {stockBajo.map((producto, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-[#ede5d9] rounded-lg">
                <div>
                  <p className="font-medium text-[#5a4a3a]">{producto.nombre_producto}</p>
                  <p className="text-sm text-[#8a7a6a]">{producto.sucursal_nombre}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${producto.cantidad === 0 ? 'text-red-600' : producto.cantidad <= 2 ? 'text-orange-600' : 'text-yellow-600'}`}>
                    {producto.cantidad} unidades
                  </p>
                  <p className="text-xs text-[#8a7a6a]">Mínimo: {producto.stock_minimo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-4 text-center">
          <p className="text-2xl font-bold text-[#c9a87b]">
            {productosMasVendidos.reduce((sum, p) => sum + p.cantidad, 0)}
          </p>
          <p className="text-sm text-[#8a7a6a]">Unidades vendidas</p>
        </div>
        <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-4 text-center">
          <p className="text-2xl font-bold text-[#c9a87b]">
            {ventasPorDia.reduce((sum, d) => sum + d.total, 0).toLocaleString()}
          </p>
          <p className="text-sm text-[#8a7a6a]">Total ventas ($)</p>
        </div>
        <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-4 text-center">
          <p className="text-2xl font-bold text-[#c9a87b]">{stockBajo.length}</p>
          <p className="text-sm text-[#8a7a6a]">Productos con stock bajo</p>
        </div>
      </div>
    </div>
  );
}