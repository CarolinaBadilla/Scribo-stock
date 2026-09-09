// src/pages/CargaRapida.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { EscanerInput } from '../components/EscanerInput';
import { formatMoney } from '../utils/formatters';
import { toast } from 'sonner';

export function CargaRapida() {
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [tipoMovimiento, setTipoMovimiento] = useState('agregar');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar sucursales desde la API
  useEffect(() => {
    cargarSucursales();
  }, []);

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

  const handleProductoEncontrado = async (codigo) => {
    setLoading(true);
    setError('');
    setProducto(null);
    
    try {
      console.log('Buscando código:', codigo, 'en sucursal:', sucursalId);
      
      const response = await api.get(`/productos/buscar?codigo=${codigo}&sucursal=${sucursalId}`);
      
      console.log('Respuesta de la API:', response.data);
      
      if (response.data && response.data.nombre_producto) {
        setProducto(response.data);
      } else {
        setError('Producto no encontrado o sin stock');
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.response?.status === 404) {
        setError('Producto no encontrado. Verificá el código de barras.');
      } else {
        setError('Error al buscar el producto. Revisá la conexión.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    if (!producto) return;

    try {
      if (tipoMovimiento === 'agregar') {
        await api.post('/stock/agregar', {
          tipoProducto: producto.tipo_producto,
          productoId: producto.producto_id,
          cantidad: cantidad,
          sucursalId: sucursalId
        });
        toast.success(`✅ Agregadas ${cantidad} unidades de ${producto.nombre_producto}`);
      } else {
        await api.post('/compras/registrar', {
          sucursalId: sucursalId,
          items: [{
            tipoProducto: producto.tipo_producto,
            productoId: producto.producto_id,
            cantidad: cantidad,
            precioCompra: producto.precio_compra || producto.precio_efectivo * 0.6
          }]
        });
        toast.success(`✅ Compra registrada: ${cantidad} unidades de ${producto.nombre_producto}`);
      }
      
      setProducto(null);
      setCantidad(1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la operación');
    }
  };

  return (
    <div className="w-full space-y-4">
      
      {/* Encabezado Panorámico Extendido */}
      <div className="flex items-center justify-between bg-[#fefcf8] px-6 py-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight">
            ⚡ Carga Rápida de Stock
          </h1>
          <span className="text-sm font-bold text-[#8a7a6a] hidden md:inline">
            — Ajustes e ingreso inmediato mediante código de barras
          </span>
        </div>

        <div className="flex items-center gap-3 bg-[#f5f0e8] px-4 py-2 rounded-xl border border-[#e2d8cc]">
          <span className="font-bold text-xs uppercase tracking-wider text-[#5a4a3a]">📍 Sucursal:</span>
          <select
            value={sucursalId || ''}
            onChange={(e) => setSucursalId(parseInt(e.target.value))}
            className="bg-transparent font-bold text-base text-[#5a4a3a] focus:outline-none cursor-pointer"
          >
            {sucursales.map(suc => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grilla Borde a Borde (5 Col Escáner / 7 Col Ficha de Operación) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
        
        {/* Columna Izquierda: Escáner Compacto */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">
              Lectura de Código
            </h2>
            
            <EscanerInput 
              onProductoEncontrado={handleProductoEncontrado} 
              placeholder="Escanea el código de barras o escríbelo..." 
            />

            {loading && (
              <div className="text-center py-6 font-bold text-xs text-[#8a7a6a]">
                Buscando producto en la base de datos...
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Ficha de Producto y Confirmación */}
        <div className="lg:col-span-7 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs flex flex-col justify-between min-h-[320px]">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e2d8cc]/60 mb-4">
              <h2 className="text-xs font-bold text-[#5a4a3a] uppercase tracking-wider">📦 Producto Encontrado</h2>
              {producto && (
                <span className="text-xs font-bold text-[#8a7a6a] bg-[#f5f0e8] px-3 py-1 rounded-lg border border-[#e2d8cc]">
                  ID: #{producto.producto_id}
                </span>
              )}
            </div>

            {!producto && !loading ? (
              <div className="text-center py-16 text-[#8a7a6a]">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-base font-bold text-[#5a4a3a]">Esperando lectura de código</p>
                <p className="text-xs mt-1">Escanea un producto para habilitar la carga rápida</p>
              </div>
            ) : producto && (
              <div className="space-y-4">
                <div className="bg-[#f5f0e8]/50 border border-[#e2d8cc] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="col-span-2 sm:col-span-3 pb-2 border-b border-[#e2d8cc]/60">
                    <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Nombre del Producto</p>
                    <p className="font-bold text-base text-[#5a4a3a]">{producto.nombre_producto || 'Sin nombre'}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Tipo</p>
                    <p className="text-xs font-bold text-[#5a4a3a]">
                      {producto.tipo_producto === 'libro' ? '📚 Libro' : '👕 Ropa'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Stock Actual</p>
                    <p className="text-xs font-bold text-[#5a4a3a]">{producto.cantidad || 0} unidades</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Precio Efectivo</p>
                    <p className="text-xs font-bold text-[#5a4a3a]">{formatMoney(producto.precio_efectivo || 0)}</p>
                  </div>

                  {producto.tipo_producto === 'ropa' && (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Colegio</p>
                        <p className="text-xs font-bold text-[#5a4a3a]">{producto.colegio || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Talle / Color</p>
                        <p className="text-xs font-bold text-[#5a4a3a]">{producto.talle || '-'} / {producto.color || '-'}</p>
                      </div>
                    </>
                  )}

                  {producto.tipo_producto === 'libro' && (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Autor</p>
                        <p className="text-xs font-bold text-[#5a4a3a]">{producto.autor || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#8a7a6a]">Editorial</p>
                        <p className="text-xs font-bold text-[#5a4a3a]">{producto.editorial || '-'}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Selección de Tipo de Operación y Cantidad */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-2">
                      Tipo de Operación
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button"
                        onClick={() => setTipoMovimiento('agregar')}
                        style={{ 
                          backgroundColor: tipoMovimiento === 'agregar' ? '#5a4a3a' : '#ffffff',
                          color: tipoMovimiento === 'agregar' ? '#ffffff' : '#5a4a3a',
                          borderColor: tipoMovimiento === 'agregar' ? '#43372b' : '#e2d8cc'
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 border rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <span>➕ Solo Agregar Stock</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setTipoMovimiento('compra')}
                        style={{ 
                          backgroundColor: tipoMovimiento === 'compra' ? '#5a4a3a' : '#ffffff',
                          color: tipoMovimiento === 'compra' ? '#ffffff' : '#5a4a3a',
                          borderColor: tipoMovimiento === 'compra' ? '#43372b' : '#e2d8cc'
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 border rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <span>🛒 Registrar Compra</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-36">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        value={cantidad}
                        onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                        className="w-full p-2 border border-[#e2d8cc] rounded-xl text-center text-sm font-bold bg-white text-[#5a4a3a] focus:outline-none"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {producto && (
            <div className="border-t border-[#e2d8cc] pt-4 mt-4">
              <button
                onClick={handleConfirmar}
                style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
                className="w-full font-bold py-3.5 px-8 rounded-xl text-sm shadow-md hover:bg-[#43372b] transition-all cursor-pointer border border-[#43372b]"
              >
                ✅ Confirmar Operación
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}