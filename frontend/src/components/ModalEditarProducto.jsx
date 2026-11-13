// src/components/ModalEditarProducto.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';

const CATEGORIAS = [
  { id: 'general', label: 'General', emoji: '📦' },
  { id: 'kiosco', label: 'Kiosco', emoji: '🍬' },
  { id: 'almacen', label: 'Almacén', emoji: '🥫' },
  { id: 'libro', label: 'Libro', emoji: '📚' },
  { id: 'ropa', label: 'Indumentaria', emoji: '👕' }
];

export function ModalEditarProducto({ producto, onClose, onActualizar }) {
  const [categoria, setCategoria] = useState('general');
  const [esPesable, setEsPesable] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (producto) {
      const cat = (producto.categoria || producto.tipo_producto || 'general').toLowerCase();
      setCategoria(cat);
      setEsPesable(Boolean(producto.es_pesable));

      const atributos = producto.atributos || {};

      setFormData({
        id: producto.producto_unificado_id || producto.producto_id || producto.id,
        nombre: producto.nombre_producto || producto.nombre || '',
        codigo_barras: producto.codigo_barras || '',
        codigo_plu: producto.codigo_plu || '',
        precio_compra: producto.precio_compra ?? 0,
        precio_efectivo: producto.precio_efectivo ?? 0,
        precio_tarjeta: producto.precio_tarjeta ?? producto.precio_efectivo ?? 0,
        // Atributos dinámicos
        marca: atributos.marca || producto.marca || '',
        fecha_vencimiento: atributos.fecha_vencimiento || producto.fecha_vencimiento || '',
        autor: atributos.autor || producto.autor || '',
        editorial: atributos.editorial || producto.editorial || '',
        colegio: atributos.colegio || producto.colegio || producto.detalle || '',
        talle: atributos.talle || producto.talle || '',
        color: atributos.color || producto.color || '',
        descripcion_extra: atributos.descripcion_extra || producto.descripcion_extra || ''
      });
    }
  }, [producto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const nombreLimpio = formData.nombre?.trim();
    if (!nombreLimpio) {
      setError('El nombre del producto es obligatorio');
      setLoading(false);
      return;
    }

    if (esPesable) {
      const pluLimpio = formData.codigo_plu?.trim() || '';
      if (!/^\d{5}$/.test(pluLimpio)) {
        setError('El código PLU de balanza debe contener exactamente 5 dígitos numéricos (ej: 00145)');
        setLoading(false);
        return;
      }
    }

    const precioEfectivo = parseFloat(formData.precio_efectivo);
    if (isNaN(precioEfectivo) || precioEfectivo <= 0) {
      setError('El precio en efectivo debe ser mayor a 0');
      setLoading(false);
      return;
    }

    try {
      const atributos = {};
      if (categoria === 'kiosco' || categoria === 'almacen') {
        if (formData.marca?.trim()) atributos.marca = formData.marca.trim();
        if (formData.fecha_vencimiento) atributos.fecha_vencimiento = formData.fecha_vencimiento;
      } else if (categoria === 'libro') {
        if (formData.autor?.trim()) atributos.autor = formData.autor.trim();
        if (formData.editorial?.trim()) atributos.editorial = formData.editorial.trim();
      } else if (categoria === 'ropa') {
        if (formData.colegio?.trim()) atributos.colegio = formData.colegio.trim();
        if (formData.talle?.trim()) atributos.talle = formData.talle.trim();
        if (formData.color?.trim()) atributos.color = formData.color.trim();
      } else {
        if (formData.descripcion_extra?.trim()) atributos.descripcion_extra = formData.descripcion_extra.trim();
      }

      const payload = {
        categoria,
        tipo: categoria,
        tipo_producto: categoria,
        nombre: nombreLimpio,
        codigo_barras: formData.codigo_barras?.trim() || (esPesable ? formData.codigo_plu?.trim() : null),
        es_pesable: esPesable,
        codigo_plu: esPesable ? formData.codigo_plu?.trim() : null,
        unidad_medida: esPesable ? 'kg' : 'unidad',
        precio_compra: parseFloat(formData.precio_compra) || 0,
        precio_efectivo: precioEfectivo,
        precio_tarjeta: parseFloat(formData.precio_tarjeta) || precioEfectivo,
        atributos,
        // Compatibilidad legacy
        autor: atributos.autor,
        editorial: atributos.editorial,
        colegio: atributos.colegio,
        talle: atributos.talle,
        color: atributos.color,
        marca: atributos.marca,
        fecha_vencimiento: atributos.fecha_vencimiento,
        descripcion_extra: atributos.descripcion_extra
      };

      await api.put(`/productos/${formData.id}`, payload);

      alert('✅ Producto actualizado correctamente');
      onActualizar();
      onClose();
    } catch (err) {
      console.error('Error actualizando producto:', err);
      const mensajeError = err.response?.data?.error || err.message || 'Error al actualizar el producto';
      setError(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#5a4a3a]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
      <div className="bg-[#fefcf8] rounded-2xl shadow-2xl border border-[#e2d8cc] w-full max-w-xl max-h-[92vh] overflow-y-auto text-[#5a4a3a]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#e2d8cc] bg-[#f5f0e8]/50 sticky top-0 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold tracking-tight">✏️ Editar Producto</h2>
            <p className="text-xs text-[#8a7a6a] mt-0.5">Modifica los detalles, balanza y precios en el inventario</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-white border border-[#e2d8cc] text-[#8a7a6a] hover:text-[#5a4a3a] hover:bg-[#f5f0e8] flex items-center justify-center text-lg font-bold transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Selector de Rubro / Categoría */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8a7a6a] mb-1.5">
                Rubro / Categoría
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {CATEGORIAS.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoria(cat.id)}
                    className={`py-2 px-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition border cursor-pointer ${
                      categoria === cat.id
                        ? 'bg-[#5a4a3a] text-white border-[#5a4a3a] shadow-xs'
                        : 'bg-white text-[#5a4a3a] border-[#e2d8cc] hover:bg-[#f5f0e8]'
                    }`}
                  >
                    <span className="text-base">{cat.emoji}</span>
                    <span className="truncate w-full text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interruptor Balanza / Producto Pesable */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <span>⚖️</span> Producto pesable (Venta por peso / Balanza)
                </span>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  Precios por kilogramo ($/kg) y código PLU de 5 dígitos
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={esPesable} 
                  onChange={(e) => setEsPesable(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#c9a87b]"></div>
              </label>
            </div>

            {/* Códigos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Código de barras</label>
                <input
                  type="text"
                  name="codigo_barras"
                  value={formData.codigo_barras || ''}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                />
              </div>

              {esPesable && (
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Código PLU de Balanza (5 dígitos) *
                  </label>
                  <input
                    type="text"
                    name="codigo_plu"
                    value={formData.codigo_plu || ''}
                    onChange={handleChange}
                    maxLength={5}
                    className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="00145"
                    required
                  />
                </div>
              )}
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Nombre / Título *</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre || ''}
                onChange={handleChange}
                className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                required
              />
            </div>

            {/* Campos Dinámicos según Categoría */}
            {(categoria === 'kiosco' || categoria === 'almacen') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f0e8]/40 p-3.5 rounded-xl border border-[#e2d8cc]/60">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Marca / Fabricante</label>
                  <input
                    type="text"
                    name="marca"
                    value={formData.marca || ''}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Fecha de vencimiento</label>
                  <input
                    type="date"
                    name="fecha_vencimiento"
                    value={formData.fecha_vencimiento ? formData.fecha_vencimiento.slice(0, 10) : ''}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                  />
                </div>
              </div>
            )}

            {categoria === 'libro' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f0e8]/40 p-3.5 rounded-xl border border-[#e2d8cc]/60">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Autor</label>
                  <input
                    type="text"
                    name="autor"
                    value={formData.autor || ''}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Editorial</label>
                  <input
                    type="text"
                    name="editorial"
                    value={formData.editorial || ''}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                  />
                </div>
              </div>
            )}

            {categoria === 'ropa' && (
              <div className="space-y-3 bg-[#f5f0e8]/40 p-3.5 rounded-xl border border-[#e2d8cc]/60">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Colegio / Institución</label>
                  <input
                    type="text"
                    name="colegio"
                    value={formData.colegio || ''}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Talle</label>
                    <input
                      type="text"
                      name="talle"
                      value={formData.talle || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Color</label>
                    <input
                      type="text"
                      name="color"
                      value={formData.color || ''}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    />
                  </div>
                </div>
              </div>
            )}

            {categoria === 'general' && (
              <div>
                <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Descripción extra / Notas (Opcional)</label>
                <input
                  type="text"
                  name="descripcion_extra"
                  value={formData.descripcion_extra || ''}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                />
              </div>
            )}

            {/* Precios */}
            <div className="space-y-3 pt-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">
                Precios de Venta {esPesable && <span className="text-amber-800 font-bold">(por Kilogramo $/kg)</span>}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">
                    {esPesable ? 'Costo ($/kg)' : 'Costo ($)'}
                  </label>
                  <input
                    type="number"
                    name="precio_compra"
                    value={formData.precio_compra ?? 0}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">
                    {esPesable ? 'Efectivo ($/kg) *' : 'Efectivo ($) *'}
                  </label>
                  <input
                    type="number"
                    name="precio_efectivo"
                    value={formData.precio_efectivo ?? 0}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    required
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">
                    {esPesable ? 'Tarjeta ($/kg)' : 'Tarjeta ($)'}
                  </label>
                  <input
                    type="number"
                    name="precio_tarjeta"
                    value={formData.precio_tarjeta ?? 0}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="mt-6 pt-4 border-t border-[#e2d8cc] flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-[#e2d8cc] rounded-xl hover:bg-[#f5f0e8] transition text-[#5a4a3a] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#c9a87b] hover:bg-[#b8976a] active:bg-[#a8865d] text-white py-2.5 rounded-xl font-bold transition shadow-sm disabled:opacity-50 text-xs cursor-pointer"
              >
                {loading ? 'Guardando...' : '💾 Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
