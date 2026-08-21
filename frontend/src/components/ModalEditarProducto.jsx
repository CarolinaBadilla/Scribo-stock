// src/components/ModalEditarProducto.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';

export function ModalEditarProducto({ producto, tipo, onClose, onActualizar }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (producto) {
      setFormData({
        id: producto.producto_id,
        nombre: producto.nombre_producto || '',
        autor: producto.autor || '',
        editorial: producto.editorial || '',
        colegio: producto.detalle || '',
        talle: producto.talle || '',
        color: producto.color || '',
        precio_efectivo: producto.precio_efectivo || 0,
        precio_tarjeta: producto.precio_tarjeta || 0,
        precio_compra: producto.precio_compra || 0
      });
    }
  }, [producto]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.nombre?.trim()) {
      setError('El nombre del producto es obligatorio');
      setLoading(false);
      return;
    }

    const precioEfectivo = parseFloat(formData.precio_efectivo);
    if (isNaN(precioEfectivo) || precioEfectivo <= 0) {
      setError('El precio en efectivo debe ser mayor a 0');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        tipo_producto: tipo,
        nombre: formData.nombre.trim(),
        precio_compra: parseFloat(formData.precio_compra) || 0,
        precio_efectivo: precioEfectivo,
        precio_tarjeta: parseFloat(formData.precio_tarjeta) || precioEfectivo,
        // Atributos dinámicos por tipo
        autor: tipo === 'libro' ? formData.autor.trim() || null : undefined,
        editorial: tipo === 'libro' ? formData.editorial.trim() || null : undefined,
        colegio: tipo === 'ropa' ? formData.colegio.trim() : undefined,
        talle: tipo === 'ropa' ? formData.talle.trim() || null : undefined,
        color: tipo === 'ropa' ? formData.color.trim() || null : undefined,
      };

      await api.put(`/productos/${tipo}/${formData.id}`, payload);

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
      <div className="bg-[#fefcf8] rounded-2xl shadow-2xl border border-[#e2d8cc] w-full max-w-lg max-h-[90vh] overflow-y-auto text-[#5a4a3a]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#e2d8cc] bg-[#f5f0e8]/50">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              ✏️ Editar {tipo === 'libro' ? 'Libro' : 'Prenda'}
            </h2>
            <p className="text-xs text-[#8a7a6a] mt-0.5">Modifica los detalles del producto en inventario</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-white border border-[#e2d8cc] text-[#8a7a6a] hover:text-[#5a4a3a] hover:bg-[#f5f0e8] flex items-center justify-center text-lg font-bold transition-all"
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
            
            {/* Campo Nombre */}
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

            {/* Campos Dinámicos */}
            {tipo === 'libro' ? (
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
            ) : (
              <div className="space-y-3 bg-[#f5f0e8]/40 p-3.5 rounded-xl border border-[#e2d8cc]/60">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Colegio / Institución *</label>
                  <input
                    type="text"
                    name="colegio"
                    value={formData.colegio || ''}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    required
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

            {/* Precios */}
            <div className="space-y-3 pt-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">Precios de Venta</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Precio Efectivo ($) *</label>
                  <input
                    type="number"
                    name="precio_efectivo"
                    value={formData.precio_efectivo || 0}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    required
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Precio Tarjeta ($)</label>
                  <input
                    type="number"
                    name="precio_tarjeta"
                    value={formData.precio_tarjeta || 0}
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
                className="flex-1 px-4 py-2.5 border border-[#e2d8cc] rounded-xl hover:bg-[#f5f0e8] transition text-[#5a4a3a] text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#c9a87b] hover:bg-[#b8976a] active:bg-[#a8865d] text-white py-2.5 rounded-xl font-bold transition shadow-sm disabled:opacity-50 text-xs"
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