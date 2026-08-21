// src/components/Estadisticas.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export function Estadisticas({ sucursales = [] }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const esJefe = user.rol === 'jefe' || user.rol === 'DUENO';

  if (!esJefe) {
    return (
      <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-8 text-center text-[#8a7a6a]">
        ⚠️ Acceso restringido. Solo los administradores pueden consultar las métricas de venta.
      </div>
    );
  }
  
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ventasPorDia, setVentasPorDia] = useState([]);
  const [stockBajo, setStockBajo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7d');
  const [sucursalFiltro, setSucursalFiltro] = useState('');

  useEffect(() => {
    cargarEstadisticas();
  }, [periodo, sucursalFiltro]);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/estadisticas', {
        params: {
          periodo,
          sucursal_id: sucursalFiltro || undefined
        }
      });

      const { 
        masVendidos = [], 
        ventasDiarias = [], 
        alertasStock = [] 
      } = response.data || {};

      setProductosMasVendidos(masVendidos);
      setVentasPorDia(ventasDiarias);
      setStockBajo(alertasStock);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      toast.error('No se pudieron recuperar las métricas de venta');
    } finally {
      setLoading(false);
    }
  };

  const totalUnidades = productosMasVendidos.reduce((sum, p) => sum + Number(p.cantidad || 0), 0);
  const totalMontoVentas = ventasPorDia.reduce((sum, d) => sum + Number(d.total || 0), 0);

  return (
    <div className="space-y-6 text-[#5a4a3a]">
      
      {/* Header del Panel */}
      <div className="bg-[#fefcf8] p-6 rounded-2xl border border-[#e2d8cc] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">📊 Panel de Estadísticas</h2>
          <span className="text-[11px] font-bold bg-[#c9a87b] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Administrador
          </span>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {sucursales.length > 0 && (
            <select
              value={sucursalFiltro}
              onChange={(e) => setSucursalFiltro(e.target.value)}
              className="px-3 py-2 border border-[#e2d8cc] rounded-xl text-xs font-semibold bg-white text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
            >
              <option value="">📍 Todas las sucursales</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}

          <div className="flex bg-[#f5f0e8] p-1 rounded-xl border border-[#e2d8cc]">
            {['7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periodo === p 
                    ? 'bg-[#5a4a3a] text-white shadow-xs' 
                    : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                }`}
              >
                {p === '7d' ? '7 Días' : p === '30d' ? '30 Días' : '90 Días'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-12 text-center text-[#8a7a6a] font-medium">
          Generando reportes y procesando ventas...
        </div>
      ) : (
        <>
          {/* Tarjetas de Resumen KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-sm text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">Unidades Vendidas</span>
              <p className="text-3xl font-extrabold text-[#c9a87b] mt-1">{totalUnidades.toLocaleString()}</p>
            </div>
            <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-sm text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">Total Recaudado</span>
              <p className="text-3xl font-extrabold text-[#c9a87b] mt-1">{formatMoney(totalMontoVentas)}</p>
            </div>
            <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-5 shadow-sm text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">Alertas de Stock</span>
              <p className="text-3xl font-extrabold text-rose-600 mt-1">{stockBajo.length}</p>
            </div>
          </div>

          {/* Gráfico 1: Productos más vendidos */}
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#5a4a3a] mb-4 flex items-center gap-2">
              <span>🏆</span> Productos más vendidos
            </h3>
            {productosMasVendidos.length === 0 ? (
              <div className="text-center py-10 text-[#8a7a6a] text-sm">No hay registros de ventas en este período.</div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productosMasVendidos} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2d8cc" />
                    <XAxis type="number" stroke="#8a7a6a" />
                    <YAxis type="category" dataKey="nombre" width={140} tick={{ fontSize: 11, fill: '#5a4a3a' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fefcf8', borderColor: '#e2d8cc', borderRadius: '12px' }}
                      formatter={(value) => [`${value} unidades`, 'Cantidad']} 
                    />
                    <Legend />
                    <Bar dataKey="cantidad" fill="#c9a87b" name="Unidades Vendidas" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Gráfico 2: Ventas por día */}
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#5a4a3a] mb-4 flex items-center gap-2">
              <span>📈</span> Tendencia de Ventas ($)
            </h3>
            {ventasPorDia.length === 0 ? (
              <div className="text-center py-10 text-[#8a7a6a] text-sm">No hay facturación registrada en este rango.</div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ventasPorDia} margin={{ left: 10, right: 20, top: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2d8cc" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#8a7a6a' }} angle={-30} textAnchor="end" height={50} />
                    <YAxis stroke="#8a7a6a" tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fefcf8', borderColor: '#e2d8cc', borderRadius: '12px' }}
                      formatter={(value) => [formatMoney(value), 'Facturación']} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#5a4a3a" strokeWidth={2.5} dot={{ fill: '#c9a87b', r: 4 }} name="Ventas ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Sección Stock Bajo */}
          {stockBajo.length > 0 && (
            <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#5a4a3a] mb-4 flex items-center gap-2">
                <span>⚠️</span> Productos con Stock Crítico
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {stockBajo.map((producto, idx) => (
                  <div key={idx} className="p-3.5 bg-[#f5f0e8]/60 border border-[#e2d8cc] rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-xs text-[#5a4a3a]">{producto.nombre_producto}</p>
                      <p className="text-[10px] text-[#8a7a6a] font-medium">{producto.sucursal_nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${producto.cantidad === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                        {producto.cantidad} und
                      </p>
                      <p className="text-[10px] text-[#8a7a6a]">Min: {producto.stock_minimo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}