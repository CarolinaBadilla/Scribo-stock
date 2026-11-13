// src/components/ModalActualizarPrecios.jsx
import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import { toast } from 'sonner';

const CATEGORIAS = [
  { id: 'todas', label: 'Todas las categorías' },
  { id: 'kiosco', label: 'Kiosco' },
  { id: 'almacen', label: 'Almacén' },
  { id: 'general', label: 'General' },
  { id: 'libro', label: 'Libros' },
  { id: 'ropa', label: 'Indumentaria / Ropa' }
];

export function ModalActualizarPrecios({ onClose, onActualizado }) {
  // Lista de productos cargada desde el catálogo unificado
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Filtros rápidos
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  // Herramienta de lote
  const [porcentajeLote, setPorcentajeLote] = useState(10);
  const [redondeoLote, setRedondeoLote] = useState(10);
  const [autoRecargoTarjeta, setAutoRecargoTarjeta] = useState(true);
  const [porcentajeTarjeta, setPorcentajeTarjeta] = useState(10);

  // Cargar productos activos del comercio
  useEffect(() => {
    let cancelado = false;

    const fetchProductos = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/productos?activo=true');
        const data = response.data || [];

        if (!cancelado) {
          // Inicializar estado editable por cada producto
          const itemsMapeados = data.map(item => ({
            id: item.id || item.producto_id,
            nombre: item.nombre || item.nombre_producto || 'Sin nombre',
            categoria: item.categoria || item.tipo_producto || 'general',
            codigo_barras: item.codigo_barras || '',
            codigo_plu: item.codigo_plu || '',
            marca: item.marca || item.atributos?.marca || '',
            precio_efectivo_actual: Number(item.precio_efectivo) || 0,
            precio_tarjeta_actual: Number(item.precio_tarjeta) || Number(item.precio_efectivo) || 0,
            nuevo_precio_efectivo: Number(item.precio_efectivo) || 0,
            nuevo_precio_tarjeta: Number(item.precio_tarjeta) || Number(item.precio_efectivo) || 0,
            seleccionado: true
          }));
          setProductos(itemsMapeados);
        }
      } catch (err) {
        if (!cancelado) {
          console.error('Error al cargar productos para editor de precios:', err);
          setError('No se pudieron cargar los productos del catálogo');
          toast.error('❌ Error al cargar productos');
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    fetchProductos();

    return () => {
      cancelado = true;
    };
  }, []);

  // Productos filtrados según búsqueda y categoría
  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      const matchCat = filtroCategoria === 'todas' || p.categoria.toLowerCase() === filtroCategoria.toLowerCase();
      if (!matchCat) return false;

      if (!busqueda.trim()) return true;

      const q = busqueda.toLowerCase().trim();
      const matchNombre = p.nombre.toLowerCase().includes(q);
      const matchMarca = p.marca.toLowerCase().includes(q);
      const matchCodigo = p.codigo_barras.toLowerCase().includes(q);
      const matchPlu = p.codigo_plu.toLowerCase().includes(q);

      return matchNombre || matchMarca || matchCodigo || matchPlu;
    });
  }, [productos, busqueda, filtroCategoria]);

  // Cantidad de productos seleccionados y modificados
  const seleccionadosCount = useMemo(() => {
    return productosFiltrados.filter(p => p.seleccionado).length;
  }, [productosFiltrados]);

  const modificadosCount = useMemo(() => {
    return productos.filter(p => 
      p.nuevo_precio_efectivo !== p.precio_efectivo_actual ||
      p.nuevo_precio_tarjeta !== p.precio_tarjeta_actual
    ).length;
  }, [productos]);

  // Selección masiva (todos / ninguno de los filtrados)
  const todosSeleccionados = productosFiltrados.length > 0 && productosFiltrados.every(p => p.seleccionado);

  const toggleSeleccionarTodos = () => {
    const nuevoValor = !todosSeleccionados;
    const idsFiltrados = new Set(productosFiltrados.map(p => p.id));
    setProductos(prev =>
      prev.map(p => (idsFiltrados.has(p.id) ? { ...p, seleccionado: nuevoValor } : p))
    );
  };

  const toggleSeleccionIndividual = (id) => {
    setProductos(prev =>
      prev.map(p => (p.id === id ? { ...p, seleccionado: !p.seleccionado } : p))
    );
  };

  // Función matemática de redondeo
  const aplicarRedondeo = (valor, factor) => {
    const f = parseInt(factor, 10) || 1;
    if (f <= 1) return Math.round(valor);
    return Math.round(valor / f) * f;
  };

  // Aplicar porcentaje en lote a los productos filtrados y seleccionados
  const handleAplicarPorcentajeLote = (e) => {
    e.preventDefault();
    const porc = parseFloat(porcentajeLote);
    if (isNaN(porc)) {
      toast.warning('Ingresa un porcentaje de variación válido');
      return;
    }

    const recargoTarj = parseFloat(porcentajeTarjeta) || 0;
    const idsFiltradosYSeleccionados = new Set(
      productosFiltrados.filter(p => p.seleccionado).map(p => p.id)
    );

    if (idsFiltradosYSeleccionados.size === 0) {
      toast.warning('No hay productos seleccionados para aplicar el ajuste');
      return;
    }

    setProductos(prev =>
      prev.map(p => {
        if (!idsFiltradosYSeleccionados.has(p.id)) return p;

        const baseEfectivo = p.precio_efectivo_actual;
        const brutoEfectivo = baseEfectivo * (1 + porc / 100);
        const nuevoEfectivo = Math.max(0, aplicarRedondeo(brutoEfectivo, redondeoLote));

        let nuevoTarjeta;
        if (autoRecargoTarjeta) {
          const brutoTarjeta = nuevoEfectivo * (1 + recargoTarj / 100);
          nuevoTarjeta = Math.max(0, aplicarRedondeo(brutoTarjeta, redondeoLote));
        } else {
          const baseTarjeta = p.precio_tarjeta_actual;
          const brutoTarjeta = baseTarjeta * (1 + porc / 100);
          nuevoTarjeta = Math.max(0, aplicarRedondeo(brutoTarjeta, redondeoLote));
        }

        return {
          ...p,
          nuevo_precio_efectivo: nuevoEfectivo,
          nuevo_precio_tarjeta: nuevoTarjeta
        };
      })
    );

    toast.info(`⚡ % aplicado a ${idsFiltradosYSeleccionados.size} productos en la tabla`);
  };

  // Edición manual de fila
  const handleCambioPrecioManual = (id, campo, valor) => {
    const num = parseFloat(valor);
    const valorLimpio = isNaN(num) || num < 0 ? 0 : num;

    setProductos(prev =>
      prev.map(p => {
        if (p.id !== id) return p;

        if (campo === 'nuevo_precio_efectivo') {
          let tarj = p.nuevo_precio_tarjeta;
          if (autoRecargoTarjeta) {
            const recargo = parseFloat(porcentajeTarjeta) || 0;
            tarj = Math.max(0, aplicarRedondeo(valorLimpio * (1 + recargo / 100), redondeoLote));
          }
          return {
            ...p,
            nuevo_precio_efectivo: valorLimpio,
            nuevo_precio_tarjeta: tarj
          };
        } else {
          return {
            ...p,
            [campo]: valorLimpio
          };
        }
      })
    );
  };

  // Restaurar precio original de un producto
  const handleRestaurarOriginal = (id) => {
    setProductos(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          nuevo_precio_efectivo: p.precio_efectivo_actual,
          nuevo_precio_tarjeta: p.precio_tarjeta_actual
        };
      })
    );
  };

  // Guardado en bloque
  const handleGuardarCambios = async () => {
    // Filtrar los productos seleccionados
    const seleccionados = productos.filter(p => p.seleccionado);

    if (seleccionados.length === 0) {
      toast.warning('Selecciona al menos un producto para guardar cambios');
      return;
    }

    const modificados = seleccionados.filter(
      p => p.nuevo_precio_efectivo !== p.precio_efectivo_actual ||
           p.nuevo_precio_tarjeta !== p.precio_tarjeta_actual
    );

    const itemsAEnviar = (modificados.length > 0 ? modificados : seleccionados).map(p => ({
      id: p.id,
      precio_efectivo: p.nuevo_precio_efectivo,
      precio_tarjeta: p.nuevo_precio_tarjeta
    }));

    const confirmacion = window.confirm(
      `¿Confirmas guardar los nuevos precios de ${itemsAEnviar.length} productos en la base de datos?`
    );

    if (!confirmacion) return;

    setGuardando(true);
    try {
      const response = await api.put('/productos/precios-lote', {
        productos: itemsAEnviar
      });

      toast.success(`✅ ${response.data?.mensaje || `Precios actualizados para ${itemsAEnviar.length} productos`}`);
      if (onActualizado) onActualizado();
      onClose();
    } catch (err) {
      console.error('Error al guardar precios en lote:', err);
      const msg = err.response?.data?.error || err.message || 'Error al guardar cambios de precios';
      toast.error(`❌ ${msg}`);
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#5a4a3a]/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 transition-all">
      <div className="bg-[#fefcf8] rounded-2xl shadow-2xl border border-[#e2d8cc] w-full max-w-5xl h-[94vh] flex flex-col text-[#5a4a3a] overflow-hidden">
        
        {/* 1. Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#e2d8cc] bg-[#f5f0e8]/70 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏷️</span>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#5a4a3a]">
                Editor Rápido y Masivo de Precios
              </h2>
              <p className="text-xs text-[#8a7a6a] font-medium">
                Aisla productos por marca, código o rubro y actualizá precios en lote o uno por uno
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-white border border-[#e2d8cc] text-[#8a7a6a] hover:text-[#5a4a3a] hover:bg-[#f5f0e8] flex items-center justify-center text-lg font-bold transition-all cursor-pointer"
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* 2. Barra de Filtros Rápidos y Herramienta de Lote */}
        <div className="p-4 sm:px-6 bg-[#fdfbf7] border-b border-[#e2d8cc] shrink-0 space-y-3">
          
          {/* Filtros rápidos superiores */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            
            {/* Buscador de texto */}
            <div className="sm:col-span-7 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a7a6a]">🔍</span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, marca (ej: Coca, Marlboro), código o PLU..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-[#e2d8cc] rounded-xl text-xs sm:text-sm font-semibold text-[#5a4a3a] placeholder:text-[#a89a8a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8a7a6a] hover:text-[#5a4a3a]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Selector de categoría */}
            <div className="sm:col-span-5">
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-xs sm:text-sm font-semibold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b] cursor-pointer"
              >
                {CATEGORIAS.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Caja de aumento en lote sobre los filtrados */}
          <form 
            onSubmit={handleAplicarPorcentajeLote}
            className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-[#f5f0e8]/80 rounded-xl border border-[#e2d8cc]"
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-black text-[#5a4a3a] uppercase tracking-wider">Aumento en lote:</span>
            </div>

            {/* Input % */}
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-[#8a7a6a]">%</span>
              <input
                type="number"
                step="0.5"
                value={porcentajeLote}
                onChange={(e) => setPorcentajeLote(e.target.value)}
                placeholder="10"
                className="w-20 px-2.5 py-1.5 bg-white border border-[#e2d8cc] rounded-lg text-xs font-black text-[#5a4a3a] text-center focus:outline-none focus:ring-1 focus:ring-[#c9a87b]"
                title="Porcentaje a aplicar (ej: 12 o -5)"
              />
            </div>

            {/* Redondeo */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#8a7a6a]">Redondeo:</span>
              <select
                value={redondeoLote}
                onChange={(e) => setRedondeoLote(parseInt(e.target.value, 10))}
                className="px-2.5 py-1.5 bg-white border border-[#e2d8cc] rounded-lg text-xs font-semibold text-[#5a4a3a] focus:outline-none focus:ring-1 focus:ring-[#c9a87b] cursor-pointer"
              >
                <option value={1}>Sin redondeo ($1)</option>
                <option value={10}>A $10</option>
                <option value={50}>A $50</option>
                <option value={100}>A $100</option>
              </select>
            </div>

            {/* Recargo tarjeta automático */}
            <div className="flex items-center gap-1.5 ml-auto">
              <label className="flex items-center gap-1 text-xs font-bold text-[#5a4a3a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRecargoTarjeta}
                  onChange={(e) => setAutoRecargoTarjeta(e.target.checked)}
                  className="rounded text-[#5a4a3a] focus:ring-[#c9a87b] cursor-pointer"
                />
                <span>Tarjeta auto (+</span>
              </label>
              <input
                type="number"
                step="0.5"
                value={porcentajeTarjeta}
                disabled={!autoRecargoTarjeta}
                onChange={(e) => setPorcentajeTarjeta(e.target.value)}
                className="w-14 px-1.5 py-1 bg-white border border-[#e2d8cc] rounded-lg text-xs font-black text-[#5a4a3a] text-center focus:outline-none focus:ring-1 focus:ring-[#c9a87b] disabled:opacity-50"
              />
              <span className="text-xs font-bold text-[#5a4a3a]">%)</span>
            </div>

            {/* Botón Aplicar % a la lista */}
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-[#5a4a3a] hover:bg-[#43372b] text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
              title="Calcula los nuevos precios en la tabla sin guardar todavía"
            >
              <span>⚡</span>
              <span>Aplicar % a la lista</span>
            </button>
          </form>
        </div>

        {/* 3. Tabla Interactiva con Vista Previa y Edición Manual */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2">
          {error && (
            <div className="my-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#8a7a6a] space-y-2">
              <span className="animate-spin text-3xl">⏳</span>
              <p className="text-xs font-bold uppercase tracking-wider">Cargando catálogo de productos...</p>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#8a7a6a] space-y-2">
              <span className="text-3xl">🔍</span>
              <p className="text-xs font-bold uppercase tracking-wider">No se encontraron productos con ese filtro</p>
              <p className="text-[11px] text-[#a89a8a]">Prueba cambiando la búsqueda o seleccionando otra categoría</p>
            </div>
          ) : (
            <div className="border border-[#e2d8cc] rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f5f0e8] text-[#5a4a3a] font-black border-b border-[#e2d8cc] uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        onChange={toggleSeleccionarTodos}
                        className="rounded text-[#5a4a3a] focus:ring-[#c9a87b] cursor-pointer"
                        title="Seleccionar / deseleccionar todos los filtrados"
                      />
                    </th>
                    <th className="py-2.5 px-3">Producto / Rubro</th>
                    <th className="py-2.5 px-3 w-48 text-center">Efectivo (Actual ➔ Nuevo)</th>
                    <th className="py-2.5 px-3 w-48 text-center">Tarjeta (Actual ➔ Nuevo)</th>
                    <th className="py-2.5 px-3 w-28 text-center">Variación</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e8de]">
                  {productosFiltrados.map((item) => {
                    const diffEfectivo = item.nuevo_precio_efectivo - item.precio_efectivo_actual;
                    const haCambiado = item.nuevo_precio_efectivo !== item.precio_efectivo_actual ||
                                       item.nuevo_precio_tarjeta !== item.precio_tarjeta_actual;
                    const porcVar = item.precio_efectivo_actual > 0 
                      ? Math.round((diffEfectivo / item.precio_efectivo_actual) * 100) 
                      : 0;

                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-colors hover:bg-[#fbf9f5] ${item.seleccionado ? '' : 'opacity-50 bg-gray-50'} ${haCambiado ? 'bg-amber-50/40' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.seleccionado}
                            onChange={() => toggleSeleccionIndividual(item.id)}
                            className="rounded text-[#5a4a3a] focus:ring-[#c9a87b] cursor-pointer"
                          />
                        </td>

                        {/* Nombre y detalles */}
                        <td className="py-2 px-3">
                          <div className="font-bold text-[#5a4a3a] text-xs">
                            {item.nombre}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#8a7a6a] mt-0.5">
                            {item.marca && (
                              <span className="font-bold text-[#5a4a3a] bg-[#f5f0e8] px-1.5 py-0.2 rounded border border-[#e2d8cc]">
                                {item.marca}
                              </span>
                            )}
                            <span className="capitalize">{item.categoria}</span>
                            {item.codigo_barras && (
                              <span className="font-mono text-[#a89a8a]">· {item.codigo_barras}</span>
                            )}
                            {item.codigo_plu && (
                              <span className="font-mono text-emerald-800">· PLU {item.codigo_plu}</span>
                            )}
                          </div>
                        </td>

                        {/* Precio Efectivo: Actual ➔ Input Nuevo */}
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[#8a7a6a] line-through text-[11px] shrink-0 font-medium">
                              {formatMoney(item.precio_efectivo_actual)}
                            </span>
                            <span className="text-[#a89a8a] font-bold text-xs">➔</span>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8a7a6a]">$</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={item.nuevo_precio_efectivo}
                                onChange={(e) => handleCambioPrecioManual(item.id, 'nuevo_precio_efectivo', e.target.value)}
                                className={`w-24 pl-5 pr-1.5 py-1 border rounded-lg text-xs font-black text-right focus:outline-none focus:ring-2 focus:ring-[#c9a87b] ${haCambiado ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-[#e2d8cc] bg-white text-[#5a4a3a]'}`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Precio Tarjeta: Actual ➔ Input Nuevo */}
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[#8a7a6a] line-through text-[11px] shrink-0 font-medium">
                              {formatMoney(item.precio_tarjeta_actual)}
                            </span>
                            <span className="text-[#a89a8a] font-bold text-xs">➔</span>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8a7a6a]">$</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={item.nuevo_precio_tarjeta}
                                onChange={(e) => handleCambioPrecioManual(item.id, 'nuevo_precio_tarjeta', e.target.value)}
                                className={`w-24 pl-5 pr-1.5 py-1 border rounded-lg text-xs font-black text-right focus:outline-none focus:ring-2 focus:ring-[#c9a87b] ${haCambiado ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-[#e2d8cc] bg-white text-[#5a4a3a]'}`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Variación */}
                        <td className="py-2 px-3 text-center">
                          {haCambiado ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${diffEfectivo >= 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                              {diffEfectivo >= 0 ? `+${porcVar}%` : `${porcVar}%`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#a89a8a] font-medium">—</span>
                          )}
                        </td>

                        {/* Acción rápida para restaurar */}
                        <td className="py-2 px-2 text-center">
                          {haCambiado && (
                            <button
                              type="button"
                              onClick={() => handleRestaurarOriginal(item.id)}
                              className="w-6 h-6 rounded hover:bg-gray-200 text-[#8a7a6a] hover:text-[#5a4a3a] inline-flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                              title="Restaurar precio original de este producto"
                            >
                              ↺
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Barra Inferior con Resumen y Guardado en Bloque */}
        <div className="px-6 py-3.5 bg-[#f5f0e8]/80 border-t border-[#e2d8cc] shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3">
          
          {/* Métricas rápidas */}
          <div className="flex items-center gap-3 text-xs text-[#5a4a3a]">
            <span className="font-medium">
              Filtrados: <b className="font-bold text-[#5a4a3a]">{productosFiltrados.length}</b>
            </span>
            <span className="text-[#e2d8cc]">|</span>
            <span className="font-medium">
              Seleccionados: <b className="font-bold text-[#5a4a3a]">{seleccionadosCount}</b>
            </span>
            <span className="text-[#e2d8cc]">|</span>
            <span className="font-medium">
              Con cambios: <b className={`font-bold ${modificadosCount > 0 ? 'text-amber-800' : 'text-[#8a7a6a]'}`}>{modificadosCount}</b>
            </span>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="flex-1 sm:flex-initial px-4 py-2 border border-[#e2d8cc] rounded-xl hover:bg-white text-[#5a4a3a] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleGuardarCambios}
              disabled={guardando || seleccionadosCount === 0}
              className="flex-1 sm:flex-initial px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {guardando ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar Cambios ({seleccionadosCount} productos)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
