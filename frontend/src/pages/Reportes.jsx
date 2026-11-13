// src/pages/Reportes.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatMoney, formatDate, formatearCantidadStock, formatearAtributos } from '../utils/formatters';
import { Estadisticas } from '../components/Estadisticas';
import { toast } from 'sonner';

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
  const [facturaModalData, setFacturaModalData] = useState(null);
  const [facturandoId, setFacturandoId] = useState(null);

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
    const token = localStorage.getItem('token');
    if (!token) return;

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

  
  const exportarExcel = async () => {
    if (!datos || datos.length === 0) return;
    setExportando(true);

    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const hoja = workbook.addWorksheet('Reporte');

      if (datos.length > 0) {
        const claves = Object.keys(datos[0]);
        hoja.columns = claves.map((k) => ({
          header: k.toUpperCase().replace(/_/g, ' '),
          key: k,
          width: 20
        }));
        hoja.addRows(datos);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${tipoReporte}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al generar Excel:', err);
    } finally {
      setExportando(false);
    }
  };

  const handleFacturarVenta = async (ventaId) => {
    setFacturandoId(ventaId);
    try {
      const res = await api.post(`/ventas/${ventaId}/facturar-afip`);
      if (res.data?.success) {
        toast.success(`✅ Factura emitida con éxito (CAE: ${res.data.factura?.cae})`);
        cargarDatos();
      } else {
        toast.error(`❌ ${res.data?.error || 'No se pudo emitir la factura'}`);
      }
    } catch (error) {
      toast.error(`❌ ${error.response?.data?.error || 'Error al conectar con AFIP'}`);
    } finally {
      setFacturandoId(null);
    }
  };

  const calcularTotal = () => {
    if (tipoReporte === 'stock') return null;
    return datos.reduce((sum, item) => sum + Number(item.total || 0), 0);
  };

  const getColumnas = () => {
    switch (tipoReporte) {
      case 'ventas':
        return ['Fecha', 'Producto', 'Detalle', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal', 'AFIP / Fiscal'];
      case 'compras':
        return ['Fecha', 'Producto', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal'];
      case 'stock':
        return ['Producto', 'Tipo', 'Detalle', 'Stock', 'Precio Efectivo', 'Precio Tarjeta', 'Sucursal'];
      case 'movimientos':
        return ['Fecha', 'Tipo', 'Producto', 'Cantidad', 'Precio Unit.', 'Total', 'Sucursal', 'AFIP / Fiscal'];
      default:
        return [];
    }
  };

  const renderFila = (item, index) => {
    if (!item) return null;
    switch (tipoReporte) {
      case 'ventas': {
        const esFacturado = Boolean(item.facturado_afip);
        const letra = item.afip_tipo_comprobante === 6 ? 'B' : 'C';
        const pv = String(item.afip_punto_venta || 1).padStart(4, '0');
        const nro = String(item.afip_numero_comprobante || 1).padStart(8, '0');

        return (
          <tr key={index} className="border-b border-[#e2d8cc]/50 hover:bg-[#f5f0e8]/40 transition-colors">
            <td className="p-3 text-xs font-semibold text-[#8a7a6a]">{formatDate(item.fecha)}</td>
            <td className="p-3 font-bold text-[#5a4a3a]">{item.nombre_producto || '-'}</td>
            <td className="p-3 text-xs text-[#8a7a6a]">{formatearAtributos(item.atributos, item.tipo_producto) || item.detalle_producto || '-'}</td>
            <td className="p-3 text-center font-bold text-[#5a4a3a]">
              {formatearCantidadStock(item.cantidad, item.es_pesable, item.unidad_medida)}
            </td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_unitario)}</td>
            <td className="p-3 text-right font-bold text-[#5a4a3a]">{formatMoney(item.total)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal || '-'}</td>
            <td className="p-3 text-center">
              {esFacturado ? (
                <div className="flex items-center justify-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Factura {letra} {pv}-{nro}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFacturaModalData(item)}
                    title="Ver detalle fiscal y CAE"
                    className="p-1 text-xs hover:bg-emerald-200/50 rounded cursor-pointer"
                  >
                    🔍
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#ede5da] text-[#8a7a6a]">
                    Sin Factura
                  </span>
                  <button
                    type="button"
                    disabled={facturandoId === item.id}
                    onClick={() => handleFacturarVenta(item.id)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#5a4a3a] hover:bg-[#43372b] text-white cursor-pointer disabled:opacity-50"
                  >
                    {facturandoId === item.id ? 'Emitiendo...' : '⚡ Facturar'}
                  </button>
                </div>
              )}
            </td>
          </tr>
        );
      }
      case 'compras':
        return (
          <tr key={index} className="border-b border-[#e2d8cc]/50 hover:bg-[#f5f0e8]/40 transition-colors">
            <td className="p-3 text-xs font-semibold text-[#8a7a6a]">{formatDate(item.fecha)}</td>
            <td className="p-3 font-bold text-[#5a4a3a]">{item.nombre_producto || '-'}</td>
            <td className="p-3 text-center font-bold text-[#5a4a3a]">
              {formatearCantidadStock(item.cantidad, item.es_pesable, item.unidad_medida)}
            </td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_unitario)}</td>
            <td className="p-3 text-right font-bold text-[#5a4a3a]">{formatMoney(item.total)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal || '-'}</td>
          </tr>
        );
      case 'stock':
        return (
          <tr key={index} className="border-b border-[#e2d8cc]/50 hover:bg-[#f5f0e8]/40 transition-colors">
            <td className="p-3 font-bold text-[#5a4a3a]">{item.nombre_producto || '-'}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">
              {item.tipo_producto === 'libro' ? '📚 Libro' : item.tipo_producto === 'ropa' ? '👕 Ropa' : '📦 General'}
            </td>
            <td className="p-3 text-xs text-[#8a7a6a]">
              {formatearAtributos(item.atributos, item.tipo_producto) || item.detalle || '-'}
            </td>
            <td className="p-3 text-center">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-xs ${
                Number(item.cantidad) >= 15 ? 'bg-blue-600 text-white' :
                Number(item.cantidad) >= 6 ? 'bg-emerald-600 text-white' :
                Number(item.cantidad) >= 1 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
              }`}>
                {formatearCantidadStock(item.cantidad, item.es_pesable, item.unidad_medida)}
              </span>
            </td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_efectivo)}</td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_tarjeta)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal_nombre || '-'}</td>
          </tr>
        );
      case 'movimientos': {
        const esVenta = item.tipo === 'Venta';
        const esFacturado = Boolean(item.facturado_afip);
        const letra = item.afip_tipo_comprobante === 6 ? 'B' : 'C';
        const pv = String(item.afip_punto_venta || 1).padStart(4, '0');
        const nro = String(item.afip_numero_comprobante || 1).padStart(8, '0');

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
            <td className="p-3 text-center font-bold text-[#5a4a3a]">
              {formatearCantidadStock(item.cantidad, item.es_pesable, item.unidad_medida)}
            </td>
            <td className="p-3 text-right font-semibold text-[#5a4a3a]">{formatMoney(item.precio_unitario)}</td>
            <td className="p-3 text-right font-bold text-[#5a4a3a]">{formatMoney(item.total)}</td>
            <td className="p-3 text-xs font-bold text-[#8a7a6a]">{item.sucursal || '-'}</td>
            <td className="p-3 text-center">
              {esVenta ? (
                esFacturado ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Factura {letra} {pv}-{nro}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFacturaModalData(item)}
                      title="Ver detalle fiscal y CAE"
                      className="p-1 text-xs hover:bg-emerald-200/50 rounded cursor-pointer"
                    >
                      🔍
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#ede5da] text-[#8a7a6a]">
                      Sin Factura
                    </span>
                    <button
                      type="button"
                      disabled={facturandoId === item.id}
                      onClick={() => handleFacturarVenta(item.id)}
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#5a4a3a] hover:bg-[#43372b] text-white cursor-pointer disabled:opacity-50"
                    >
                      {facturandoId === item.id ? 'Emitiendo...' : '⚡ Facturar'}
                    </button>
                  </div>
                )
              ) : (
                <span className="text-xs text-[#8a7a6a]">-</span>
              )}
            </td>
          </tr>
        );
      }
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
                      <td colSpan={tipoReporte === 'ventas' || tipoReporte === 'movimientos' ? 5 : getColumnas().length - 2} className="p-3 text-right uppercase text-xs text-[#8a7a6a]">
                        Total Acumulado:
                      </td>
                      <td className="p-3 text-right text-base text-[#5a4a3a]">
                        {formatMoney(calcularTotal())}
                      </td>
                      <td colSpan={tipoReporte === 'ventas' || tipoReporte === 'movimientos' ? 2 : 1} className="p-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal Detalle de Factura Electrónica */}
      {facturaModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#fefcf8] border border-[#e2d8cc] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2d8cc] flex items-center justify-between bg-[#fbf8f3]">
              <h3 className="font-black text-[#5a4a3a] text-sm">
                🧾 Comprobante Fiscal Autorizado
              </h3>
              <button
                onClick={() => setFacturaModalData(null)}
                className="text-[#8a7a6a] hover:text-[#5a4a3a] font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-black text-sm rounded-lg border border-emerald-300 uppercase">
                Factura {facturaModalData.afip_tipo_comprobante === 6 ? 'B' : 'C'} N° {String(facturaModalData.afip_punto_venta || 1).padStart(4, '0')}-{String(facturaModalData.afip_numero_comprobante || 1).padStart(8, '0')}
              </div>

              <div className="bg-[#f5efe6] p-3.5 rounded-xl border border-[#e2d8cc] text-left text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-[#5a4a3a]">
                  <span>Total:</span>
                  <span>{formatMoney(facturaModalData.total)}</span>
                </div>
                <div className="flex justify-between text-[#8a7a6a]">
                  <span>CAE:</span>
                  <span className="font-mono font-bold text-[#5a4a3a]">{facturaModalData.afip_cae}</span>
                </div>
                <div className="flex justify-between text-[#8a7a6a]">
                  <span>Vto. CAE:</span>
                  <span className="font-mono text-[#5a4a3a]">
                    {facturaModalData.afip_cae_vencimiento ? formatDate(facturaModalData.afip_cae_vencimiento) : '-'}
                  </span>
                </div>
                {facturaModalData.cliente_doc_nro && (
                  <div className="flex justify-between text-[#8a7a6a]">
                    <span>Documento Cliente:</span>
                    <span className="font-mono text-[#5a4a3a]">{facturaModalData.cliente_doc_nro}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center space-y-1 pt-1">
                <p className="text-[10px] font-bold text-[#8a7a6a] uppercase tracking-wider">Código QR Oficial AFIP</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify({ ver: 1, fecha: String(facturaModalData.fecha).split('T')[0], cuit: 30112233445, ptoVta: facturaModalData.afip_punto_venta, tipoCmp: facturaModalData.afip_tipo_comprobante, nroCmp: facturaModalData.afip_numero_comprobante, importe: Number(facturaModalData.total), cae: Number(facturaModalData.afip_cae) }))}`)}`}
                  alt="QR AFIP"
                  className="w-32 h-32 rounded-lg border border-[#e2d8cc] bg-white p-1 shadow-xs"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-[#fbf8f3] border-t border-[#e2d8cc] flex justify-end">
              <button
                type="button"
                onClick={() => setFacturaModalData(null)}
                className="px-4 py-2 rounded-xl bg-[#5a4a3a] text-white text-xs font-bold hover:bg-[#43372b] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}