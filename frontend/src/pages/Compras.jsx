// src/pages/Compras.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { EscanerInput } from '../components/EscanerInput';
import { formatMoney } from '../utils/formatters';
import { toast } from 'sonner';

export function Compras() {
  const [items, setItems] = useState([]);
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [precioCompra, setPrecioCompra] = useState(0);
  const [proveedor, setProveedor] = useState('');
  const [sucursalId, setSucursalId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarSucursales();
  }, []);

  const cargarSucursales = async () => {
    try {
      const response = await api.get('/sucursales');
      setSucursales(response.data);
      if (response.data.length > 0) setSucursalId(response.data[0].id);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const handleProductoEncontrado = async (codigo) => {
    try {
      const response = await api.get(`/productos/buscar?codigo=${codigo}&sucursal=${sucursalId}`);
      const productoData = response.data;

      setProducto({ 
        id: productoData.producto_id, 
        tipo: productoData.tipo_producto, 
        nombre: productoData.nombre_producto, 
        precio_venta: productoData.precio_efectivo 
      });

      const precioCompraReal = Number(productoData.precio_compra) > 0 
        ? Number(productoData.precio_compra) 
        : Number(productoData.precio_efectivo || 0);

      setPrecioCompra(precioCompraReal);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('❌ Producto no encontrado');
      } else {
        console.error('Error:', error);
      }
    }
  };

  const handleAgregarACompra = () => {
    if (!producto) return;
    setItems([
      ...items, 
      { 
        id: Date.now(), 
        productoId: producto.id, 
        tipoProducto: producto.tipo, 
        nombre: producto.nombre, 
        cantidad, 
        precioCompra, 
        subtotal: cantidad * precioCompra 
      }
    ]);
    setProducto(null);
    setCantidad(1);
    setPrecioCompra(0);
  };

  const handleConfirmarCompra = async () => {
    if (items.length === 0) {
      toast.error('Agregá productos a la lista primero');
      return;
    }
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await api.post('/compras/registrar', { 
        sucursalId, 
        items: items.map(item => ({ 
          tipoProducto: item.tipoProducto, 
          productoId: item.productoId, 
          cantidad: item.cantidad, 
          precioCompra: item.precioCompra 
        })), 
        proveedor, 
        usuarioId: user.id 
      });
      toast.success('✅ Compra registrada correctamente');
      setItems([]);
      setProveedor('');
    } catch (error) {
      console.error('Error al registrar compra:', error);
      toast.error('Error al registrar la compra');
    }
  };

  if (loading) return <div className="text-center py-10 font-bold text-base text-[#8a7a6a]">Cargando Compras...</div>;

  return (
    <div className="w-full space-y-4">
      
      {/* Encabezado Panorámico Extendido */}
      <div className="flex items-center justify-between bg-[#fefcf8] px-6 py-4 rounded-2xl border border-[#e2d8cc] shadow-xs">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight">
            📦 Registrar Compra a Proveedor
          </h1>
          <span className="text-sm font-bold text-[#8a7a6a] hidden md:inline">
            — Ingreso de mercadería y reposición de inventario
          </span>
        </div>

        <div className="flex items-center gap-3 bg-[#f5f0e8] px-4 py-2 rounded-xl border border-[#e2d8cc]">
          <span className="font-bold text-xs uppercase tracking-wider text-[#5a4a3a]">📍 Recepción:</span>
          <select 
            value={sucursalId || ''} 
            onChange={(e) => setSucursalId(parseInt(e.target.value))} 
            className="bg-transparent font-bold text-base text-[#5a4a3a] focus:outline-none cursor-pointer"
          >
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Grilla Borde a Borde (5 Col Ingreso / 7 Col Resumen) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
        
        {/* Columna Izquierda: Escáner y Ajuste de Producto */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs flex-1 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">
              Búsqueda de Producto
            </h2>
            
            <EscanerInput 
              onProductoEncontrado={handleProductoEncontrado} 
              placeholder="Escanea el código de barras o escribe el código..." 
            />

            {producto && (
              <div className="mt-4 pt-4 border-t border-[#e2d8cc] space-y-3 bg-[#f5f0e8]/50 p-4 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7a6a]">Producto Seleccionado</span>
                  <p className="font-bold text-base text-[#5a4a3a]">{producto.nombre}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                      Cantidad
                    </label>
                    <input 
                      type="number" 
                      value={cantidad} 
                      onChange={(e) => setCantidad(parseInt(e.target.value) || 1)} 
                      className="w-full px-3 py-2 border border-[#e2d8cc] rounded-xl text-sm font-bold bg-white text-[#5a4a3a] focus:outline-none focus:border-[#5a4a3a]" 
                      min="1" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                      Precio Compra
                    </label>
                    <input 
                      type="number" 
                      value={precioCompra} 
                      onChange={(e) => setPrecioCompra(parseFloat(e.target.value) || 0)} 
                      className="w-full px-3 py-2 border border-[#e2d8cc] rounded-xl text-sm font-bold bg-white text-[#5a4a3a] focus:outline-none focus:border-[#5a4a3a]" 
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAgregarACompra} 
                  style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
                  className="w-full font-bold py-3 px-4 rounded-xl text-xs shadow-xs hover:bg-[#43372b] transition-all cursor-pointer border border-[#43372b] flex items-center justify-center gap-2"
                >
                  <span>➕</span>
                  <span>Agregar a la Compra</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Resumen de Compras y Confirmación */}
        <div className="lg:col-span-7 bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e2d8cc]/60 mb-4">
              <h2 className="text-xs font-bold text-[#5a4a3a] uppercase tracking-wider">🛒 Lista de Productos a Comprar</h2>
              <span className="text-xs font-bold text-[#8a7a6a] bg-[#f5f0e8] px-3 py-1 rounded-lg border border-[#e2d8cc]">
                {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-16 text-[#8a7a6a]">
                <p className="text-4xl mb-2">📦</p>
                <p className="text-base font-bold text-[#5a4a3a]">No hay productos en la lista</p>
                <p className="text-xs mt-1">Escanea productos para armar el remito de compra</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {items.map(item => (
                  <div key={item.id} className="bg-[#f5f0e8]/50 border border-[#e2d8cc] rounded-xl p-3.5 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-[#5a4a3a] truncate">{item.nombre}</p>
                      <p className="text-xs font-semibold text-[#8a7a6a]">
                        {item.cantidad} un. x {formatMoney(item.precioCompra)} c/u
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="font-black text-sm text-[#5a4a3a]">{formatMoney(item.subtotal)}</p>
                      <button 
                        onClick={() => setItems(items.filter(i => i.id !== item.id))} 
                        className="text-rose-600 hover:text-rose-800 text-xs font-bold bg-white border border-rose-200 px-2.5 py-1 rounded-lg cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-[#e2d8cc] pt-4 mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-1">
                    Proveedor (Opcional)
                  </label>
                  <input 
                    type="text" 
                    value={proveedor} 
                    onChange={(e) => setProveedor(e.target.value)} 
                    className="w-full px-3 py-2 border border-[#e2d8cc] rounded-xl text-xs font-bold bg-white text-[#5a4a3a] placeholder-[#8a7a6a]/60 focus:outline-none" 
                    placeholder="Ej: Editorial Planeta" 
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="flex justify-between items-center text-lg font-black text-[#5a4a3a] bg-[#f5f0e8] px-3 py-1.5 rounded-xl border border-[#e2d8cc]">
                    <span className="text-xs font-bold text-[#8a7a6a] uppercase">Total Inversión:</span>
                    <span>{formatMoney(items.reduce((sum, i) => sum + i.subtotal, 0))}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleConfirmarCompra} 
                style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
                className="w-full font-bold py-3.5 px-8 rounded-xl text-sm shadow-md hover:bg-[#43372b] transition-all cursor-pointer border border-[#43372b]"
              >
                ✅ Confirmar e Ingresar Stock ({formatMoney(items.reduce((sum, i) => sum + i.subtotal, 0))})
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}