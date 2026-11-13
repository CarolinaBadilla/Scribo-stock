// src/components/ModalAgregarProducto.jsx
import { useState } from 'react';
import api from '../services/api';

const CATEGORIAS = [
  { id: 'general', label: 'General', emoji: '📦' },
  { id: 'kiosco', label: 'Kiosco', emoji: '🍬' },
  { id: 'almacen', label: 'Almacén', emoji: '🥫' },
  { id: 'libro', label: 'Libro', emoji: '📚' },
  { id: 'ropa', label: 'Indumentaria', emoji: '👕' }
];

export function ModalAgregarProducto({ sucursalId, onClose, onAgregar }) {
  const [categoria, setCategoria] = useState('general');
  const [esPesable, setEsPesable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    codigo_barras: '',
    codigo_plu: '',
    nombre: '',
    cantidad_inicial: '0',
    precio_compra: '',
    precio_efectivo: '',
    precio_tarjeta: '',
    // Atributos dinámicos
    marca: '',
    fecha_vencimiento: '',
    autor: '',
    editorial: '',
    colegio: '',
    talle: '',
    color: '',
    descripcion_extra: ''
  });

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

    const nombreLimpio = formData.nombre.trim();
    if (!nombreLimpio) {
      setError('El nombre del producto es obligatorio');
      setLoading(false);
      return;
    }

    if (esPesable) {
      const pluLimpio = formData.codigo_plu.trim();
      if (!/^\d{5}$/.test(pluLimpio)) {
        setError('El código PLU de balanza debe contener exactamente 5 dígitos numéricos (ej: 00145)');
        setLoading(false);
        return;
      }
    } else {
      if (!formData.codigo_barras.trim()) {
        setError('El código de barras es obligatorio para productos estándar');
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

    if (categoria === 'ropa' && !formData.colegio.trim()) {
      setError('El colegio o institución es obligatorio para indumentaria escolar');
      setLoading(false);
      return;
    }

    try {
      const atributos = {};
      if (categoria === 'kiosco' || categoria === 'almacen') {
        if (formData.marca.trim()) atributos.marca = formData.marca.trim();
        if (formData.fecha_vencimiento) atributos.fecha_vencimiento = formData.fecha_vencimiento;
      } else if (categoria === 'libro') {
        if (formData.autor.trim()) atributos.autor = formData.autor.trim();
        if (formData.editorial.trim()) atributos.editorial = formData.editorial.trim();
      } else if (categoria === 'ropa') {
        if (formData.colegio.trim()) atributos.colegio = formData.colegio.trim();
        if (formData.talle.trim()) atributos.talle = formData.talle.trim();
        if (formData.color.trim()) atributos.color = formData.color.trim();
      } else {
        if (formData.descripcion_extra.trim()) atributos.descripcion_extra = formData.descripcion_extra.trim();
      }

      const payload = {
        categoria,
        tipo: categoria,
        tipo_producto: categoria,
        sucursal_id: sucursalId,
        nombre: nombreLimpio,
        codigo_barras: formData.codigo_barras.trim() || (esPesable ? formData.codigo_plu.trim() : null),
        es_pesable: esPesable,
        codigo_plu: esPesable ? formData.codigo_plu.trim() : null,
        unidad_medida: esPesable ? 'kg' : 'unidad',
        cantidad_inicial: parseFloat(formData.cantidad_inicial) || 0,
        precio_compra: parseFloat(formData.precio_compra) || 0,
        precio_efectivo: precioEfectivo,
        precio_tarjeta: parseFloat(formData.precio_tarjeta) || precioEfectivo,
        atributos,
        // Campos legacy directos para compatibilidad retroactiva
        autor: atributos.autor,
        editorial: atributos.editorial,
        colegio: atributos.colegio,
        talle: atributos.talle,
        color: atributos.color,
        marca: atributos.marca,
        fecha_vencimiento: atributos.fecha_vencimiento,
        descripcion_extra: atributos.descripcion_extra
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
      <div className="bg-[#fefcf8] rounded-2xl shadow-2xl border border-[#e2d8cc] w-full max-w-xl max-h-[92vh] overflow-y-auto text-[#5a4a3a]">
        
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#e2d8cc] bg-[#f5f0e8]/50 sticky top-0 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold tracking-tight">➕ Registrar Nuevo Producto</h2>
            <p className="text-xs text-[#8a7a6a] mt-0.5">Configura rubro, balanza, stock inicial y precios</p>
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
            
            {/* Selector de Categoría / Rubro */}
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
                  Habilita código PLU de 5 dígitos y venta fraccionada en kilogramos (kg)
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

            {/* Códigos y Nombre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">
                  {esPesable ? 'Código de barras (Opcional)' : 'Código de barras *'}
                </label>
                <input 
                  type="text" 
                  name="codigo_barras" 
                  value={formData.codigo_barras} 
                  onChange={handleChange} 
                  className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                  placeholder={esPesable ? "Ej: 2000145..." : "Ej: 7790895000997"}
                  required={!esPesable}
                />
              </div>

              {esPesable ? (
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Código PLU de Balanza (5 dígitos) *
                  </label>
                  <input 
                    type="text" 
                    name="codigo_plu" 
                    value={formData.codigo_plu} 
                    onChange={handleChange} 
                    maxLength={5}
                    className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500" 
                    placeholder="00145"
                    required
                  />
                  <span className="text-[10px] text-amber-800">Exactamente 5 dígitos (ej: 00145)</span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">
                    Stock inicial ({sucursalId ? 'Sucursal actual' : 'Comercio'})
                  </label>
                  <input 
                    type="number" 
                    name="cantidad_inicial" 
                    value={formData.cantidad_inicial} 
                    onChange={handleChange} 
                    step="1"
                    min="0"
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Nombre / Descripción del producto *</label>
              <input 
                type="text" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleChange} 
                className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                placeholder="Ej: Jamón Cocido / Galletitas / Remera / Cuaderno"
                required 
              />
            </div>

            {/* Stock inicial para pesables */}
            {esPesable && (
              <div>
                <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">
                  Stock inicial en Kilogramos (kg)
                </label>
                <input 
                  type="number" 
                  name="cantidad_inicial" 
                  value={formData.cantidad_inicial} 
                  onChange={handleChange} 
                  step="0.001"
                  min="0"
                  className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                  placeholder="0.000 kg"
                />
              </div>
            )}

            {/* Formulario Dinámico según Rubro / Categoría */}
            {(categoria === 'kiosco' || categoria === 'almacen') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f0e8]/40 p-3.5 rounded-xl border border-[#e2d8cc]/60">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Marca / Fabricante</label>
                  <input 
                    type="text" 
                    name="marca" 
                    value={formData.marca} 
                    onChange={handleChange} 
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="Ej: Arcor, Molinos, Serenísim..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Fecha de vencimiento</label>
                  <input 
                    type="date" 
                    name="fecha_vencimiento" 
                    value={formData.fecha_vencimiento} 
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
                    value={formData.autor} 
                    onChange={handleChange} 
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="Ej: Gabriel García Márquez"
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
                    placeholder="Ej: Sudamericana"
                  />
                </div>
              </div>
            )}

            {categoria === 'ropa' && (
              <div className="space-y-3 bg-[#f5f0e8]/40 p-3.5 rounded-xl border border-[#e2d8cc]/60">
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Colegio / Institución *</label>
                  <input 
                    type="text" 
                    name="colegio" 
                    value={formData.colegio} 
                    onChange={handleChange} 
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                    placeholder="Ej: Colegio San Martín"
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
                      placeholder="Ej: 14 / L"
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

            {categoria === 'general' && (
              <div>
                <label className="block text-xs font-semibold text-[#5a4a3a] mb-1">Descripción extra / Notas (Opcional)</label>
                <input 
                  type="text" 
                  name="descripcion_extra" 
                  value={formData.descripcion_extra} 
                  onChange={handleChange} 
                  className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87b]" 
                  placeholder="Detalles adicionales, proveedor o notas internas"
                />
              </div>
            )}

            {/* Estructura de Precios */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center">
                <span className="block text-xs font-bold uppercase tracking-wider text-[#8a7a6a]">
                  Estructura de Precios {esPesable && <span className="text-amber-800 font-bold">(por Kilogramo $/kg)</span>}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5a4a3a] mb-1">
                    {esPesable ? 'Costo ($/kg)' : 'Costo ($)'}
                  </label>
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
                  <label className="block text-[11px] font-semibold text-[#5a4a3a] mb-1">
                    {esPesable ? 'Efectivo ($/kg) *' : 'Efectivo ($) *'}
                  </label>
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
                  <label className="block text-[11px] font-semibold text-[#5a4a3a] mb-1">
                    {esPesable ? 'Tarjeta ($/kg)' : 'Tarjeta ($)'}
                  </label>
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
                className="flex-1 px-4 py-2.5 border border-[#e2d8cc] rounded-xl hover:bg-[#f5f0e8] transition text-[#5a4a3a] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#c9a87b] hover:bg-[#b8976a] active:bg-[#a8865d] text-white py-2.5 rounded-xl font-bold transition shadow-sm disabled:opacity-50 text-xs cursor-pointer"
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
