// src/components/ModalAgregarProducto.jsx
import { useState } from 'react';
import api from '../services/api';

export function ModalAgregarProducto({ sucursalId, onClose, onAgregar }) {
  const [tipo, setTipo] = useState('libro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    codigo_barras: '',
    nombre: '',
    autor: '',
    editorial: '',
    colegio: '',
    talle: '',
    color: '',
    precio_compra: '',
    precio_efectivo: '',
    precio_tarjeta: ''
  });

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

    if (!formData.codigo_barras.trim()) {
      setError('El código de barras es obligatorio');
      setLoading(false);
      return;
    }
    
    if (!formData.nombre.trim()) {
      setError('El nombre del producto es obligatorio');
      setLoading(false);
      return;
    }
    
    const precioEfectivo = parseFloat(formData.precio_efectivo);
    if (isNaN(precioEfectivo) || precioEfectivo <= 0) {
      setError('El precio efectivo debe ser mayor a 0');
      setLoading(false);
      return;
    }

    if (tipo === 'ropa' && !formData.colegio.trim()) {
      setError('El colegio es obligatorio para productos de indumentaria');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        tipo_producto: tipo,
        sucursal_id: sucursalId,
        codigo_barras: formData.codigo_barras.trim(),
        nombre: formData.nombre.trim(),
        precio_compra: parseFloat(formData.precio_compra) || 0,
        precio_efectivo: precioEfectivo,
        precio_tarjeta: parseFloat(formData.precio_tarjeta) || precioEfectivo,
        // Atributos específicos según categoría
        autor: tipo === 'libro' ? formData.autor.trim() || null : undefined,
        editorial: tipo === 'libro' ? formData.editorial.trim() || null : undefined,
        colegio: tipo === 'ropa' ? formData.colegio.trim() : undefined,
        talle: tipo === 'ropa' ? formData.talle.trim() || null : undefined,
        color: tipo === 'ropa' ? formData.color.trim() || null : undefined,
      };

      await api.post('/productos', payload);

      alert('✅ Producto registrado exitosamente');
      onAgregar();
      onClose();
    } catch (err) {
      console.error('Error creando producto:', err);
      const mensajeError = err.response?.data?.error || err.message || 'Error al guardar el producto';
      setError(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#5a4a3a]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
      <div className="bg-[#fefcf8] rounded-2xl shadow-2xl border border-[#e2d8cc] w-full max-w-lg max-h-[90vh] overflow-y-auto text-[#5a4a3a]">
        
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#e2d8cc] bg-[#f5f0e8]/50">
          <div>
            <h2 className="text-xl font-bold tracking-tight">➕ Registrar Nuevo Producto</h2>
            <p className="text-xs text-[#8a7a6a] mt-0.5">Completa los detalles para agregarlo al inventario</p>
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
            
            {/* Selector de Tipo de Producto */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8a7a6a] mb-1.5">
                Tipo de Producto
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipo('libro')}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition border ${
                    tipo === 'libro'
                      ? 'bg-[#5a4a3a] text-white border-[#5a4a3a] shadow-sm'
                      : 'bg-white text-[#5a4a3a] border-[#e2d8cc] hover:bg-[#f5f0e8]'
                  }`}
                >
                  <span>📚</span> Libro
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('ropa')}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition border ${
                    tipo === 'ropa'
                      ? 'bg-[#5a4a3a] text-white border-[#5a4a3a] shadow-sm'
                      : 'bg-white text-[#5a4a3a] border-[#e2d8cc] hover:bg-[#f5f0e8]'
                  }`}
                >
                  <span>👕</span> Indumentaria / Ropa
                </button>
              </div>
            </div>

            {/* Datos Generales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Código de barras *</label>
                <input 
                  type="text" 
                  name="codigo_barras" 
                  value={formData.codigo_barras} 
                  onChange={handleChange} 
                  className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                  placeholder="Ej: 9789500712345"
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Nombre / Título *</label>
                <input 
                  type="text" 
                  name="nombre" 
                  value={formData.nombre} 
                  onChange={handleChange} 
                  className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                  placeholder="Ej: Manuel Belgrano"
                  required 
                />
              </div>
            </div>

            {/* Formulario Dinámico según Tipo */}
            {tipo === 'libro' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f0e8]/40 p-3.5 rounded-xl border border-[#e2d8cc]/60">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Autor</label>
                  <input 
                    type="text" 
                    name="autor" 
                    value={formData.autor} 
                    onChange={handleChange} 
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="Ej: Felipe Pigna"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Editorial</label>
                  <input 
                    type="text" 
                    name="editorial" 
                    value={formData.editorial} 
                    onChange={handleChange} 
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="Ej: Planeta"
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
                    value={formData.colegio} 
                    onChange={handleChange} 
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="Ej: San Martín"
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Talle</label>
                    <input 
                      type="text" 
                      name="talle" 
                      value={formData.talle} 
                      onChange={handleChange} 
                      className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                      placeholder="Ej: 12 / M"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Color</label>
                    <input 
                      type="text" 
                      name="color" 
                      value={formData.color} 
                      onChange={handleChange} 
                      className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                      placeholder="Ej: Azul Marino"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Precios */}
            <div className="space-y-3 pt-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">Estructura de Precios</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5a4a3a] mb-1">Costo ($)</label>
                  <input 
                    type="number" 
                    name="precio_compra" 
                    value={formData.precio_compra} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="0.00" 
                    step="0.01" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5a4a3a] mb-1">Efectivo ($) *</label>
                  <input 
                    type="number" 
                    name="precio_efectivo" 
                    value={formData.precio_efectivo} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b] font-bold text-[#5a4a3a]" 
                    placeholder="0.00" 
                    required 
                    step="0.01" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5a4a3a] mb-1">Tarjeta ($)</label>
                  <input 
                    type="number" 
                    name="precio_tarjeta" 
                    value={formData.precio_tarjeta} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="0.00" 
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
                {loading ? 'Guardando...' : '✅ Guardar producto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}