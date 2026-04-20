import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

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

    try {
      let result;
      
      if (tipo === 'libro') {
        result = await supabase
          .from('libros')
          .update({
            titulo: formData.nombre,
            autor: formData.autor || null,
            editorial: formData.editorial || null,
            precio_efectivo: parseFloat(formData.precio_efectivo),
            precio_tarjeta: parseFloat(formData.precio_tarjeta),
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);
      } else {
        const ganancia = parseFloat(formData.precio_efectivo) - parseFloat(formData.precio_compra || 0);
        
        result = await supabase
          .from('ropa')
          .update({
            nombre: formData.nombre,
            colegio: formData.colegio,
            talle: formData.talle || null,
            color: formData.color || null,
            precio_efectivo: parseFloat(formData.precio_efectivo),
            precio_tarjeta: parseFloat(formData.precio_tarjeta) || parseFloat(formData.precio_efectivo),
            ganancia: ganancia,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);
      }

      if (result.error) throw result.error;

      alert('✅ Producto actualizado correctamente');
      onActualizar();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Error al actualizar producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#5a4a3a] bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">✏️ Editar {tipo === 'libro' ? 'Libro' : 'Prenda'}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Nombre</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre || ''}
                onChange={handleChange}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>
            
            {tipo === 'libro' ? (
              <>
                <div>
                  <label className="block text-sm font-bold mb-1">Autor</label>
                  <input
                    type="text"
                    name="autor"
                    value={formData.autor || ''}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Editorial</label>
                  <input
                    type="text"
                    name="editorial"
                    value={formData.editorial || ''}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-bold mb-1">Colegio</label>
                  <input
                    type="text"
                    name="colegio"
                    value={formData.colegio || ''}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-lg"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold mb-1">Talle</label>
                    <input
                      type="text"
                      name="talle"
                      value={formData.talle || ''}
                      onChange={handleChange}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Color</label>
                    <input
                      type="text"
                      name="color"
                      value={formData.color || ''}
                      onChange={handleChange}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold mb-1">Precio Efectivo</label>
                <input
                  type="number"
                  name="precio_efectivo"
                  value={formData.precio_efectivo}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg"
                  required
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Precio Tarjeta</label>
                <input
                  type="number"
                  name="precio_tarjeta"
                  value={formData.precio_tarjeta}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg"
                  step="0.01"
                />
              </div>
            </div>
            
                <div className="flex gap-3 pt-4 mt-4 border-t border-[#e2d8cc]">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-[#e2d8cc] rounded-lg hover:bg-[#ede5d9] transition text-[#5a4a3a]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#c9a87b] text-white py-2 rounded-lg hover:bg-[#a8865d] transition disabled:opacity-50"
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